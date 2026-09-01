// appsScriptClient.js
// Заміна supabaseClient.js — усі виклики йдуть на розгорнутий Google Apps Script Web App.
//
// ВАЖЛИВО про CORS: POST-запити відправляються з Content-Type: text/plain,
// а не application/json. Це навмисно — Apps Script не обробляє CORS-preflight
// (OPTIONS-запит), і якщо браузер його відправить (що станеться при
// application/json), запит впаде. text/plain — це "simple request" за
// специфікацією CORS, preflight не потрібен. На боці Apps Script (doPost)
// тіло однаково парситься як JSON через JSON.parse(e.postData.contents),
// незалежно від заявленого Content-Type.

const APPS_SCRIPT_URL = 'ВСТАВТЕ_СЮДИ_URL_ВЛАСНОГО_ДЕПЛОЮ_ЩО_ЗАКІНЧУЄТЬСЯ_НА_/exec';

/**
 * Завантажує стан застосунку (materials, stock, operations, expenses,
 * subcategories, writeoffs, users) одним запитом.
 *
 * pin — необов'язковий. Без нього сервер повертає "публічний" зріз (без
 * ІБ пацієнтів у operations, без PIN-кодів у users) — саме це вантажиться
 * при першому відкритті застосунку, ще до входу. Після успішного логіну
 * виклич це ще раз з pin — сервер довантажить ІБ пацієнтів (для будь-якого
 * залогіненого) і реальні PIN-и в users (лише якщо pin належить admin).
 *
 * Кидає Error з людяним повідомленням при мережевій помилці або якщо
 * сервер повернув success:false.
 */
async function fetchAllData(pin) {
  let res;
  try {
    const url = pin
      ? `${APPS_SCRIPT_URL}?action=getAll&pin=${encodeURIComponent(pin)}`
      : `${APPS_SCRIPT_URL}?action=getAll`;
    res = await fetch(url);
  } catch (networkErr) {
    throw new Error("Немає з'єднання з сервером Apps Script.");
  }
  if (!res.ok) throw new Error('Мережева помилка: ' + res.status);

  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Невідома помилка сервера.');
  return json.data;
}

/**
 * Виконує дію запису на сервері (addStock, addOperation, saveMaterial, ...).
 * pin — PIN поточного залогіненого користувача (currentUser?.pin); сервер
 * сам перевіряє права для кожної дії, це не просто UI-затвор.
 *
 * Повертає { success: true, data: {...} } або { success: false, error: '...' } —
 * компоненти самі показують result.error через showMsg/alert, як і раніше.
 * Мережеві збої (сервер недоступний) прокидаються як виняток — лови їх у
 * викликаючому коді через try/catch, як у решті обробників форм.
 */
async function callAction(action, payload, pin) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action, pin, payload })
  });
  if (!res.ok) throw new Error('Мережева помилка: ' + res.status);
  return res.json();
}

export { fetchAllData, callAction };
