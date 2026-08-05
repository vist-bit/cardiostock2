import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  HeartPulse, 
  ScanBarcode, 
  PackagePlus, 
  Activity, 
  AlertTriangle, 
  Database, 
  Download, 
  CheckCircle,
  X,
  Search,
  Trash2,
  Camera,
  Calendar,
  Filter,
  ArrowDownUp
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Ініціалізація Supabase клієнта
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Парсер GS1
const parseGS1 = (code) => {
  let cleanCode = code.replace(/\\u001d|\\x1d|<GS>|\]d2/gi, String.fromCharCode(29));
  if (cleanCode.startsWith(']d2')) cleanCode = cleanCode.substring(3);
  
  let result = { gtin: '', lot: '', exp: '', serial: '', raw: code };
  let remaining = cleanCode;

  try {
    while (remaining.length > 0) {
      if (remaining.startsWith('01') && remaining.length >= 16) {
        result.gtin = remaining.substring(2, 16);
        remaining = remaining.substring(16);
      } else if (remaining.startsWith('17') && remaining.length >= 8) {
        let dateStr = remaining.substring(2, 8);
        let year = parseInt(dateStr.substring(0, 2), 10);
        year = (year > 50 ? 1900 + year : 2000 + year);
        result.exp = `${year}-${dateStr.substring(2, 4)}-${dateStr.substring(4, 6)}`;
        remaining = remaining.substring(8);
      } else if (remaining.startsWith('10')) {
        let nextGS = remaining.indexOf(String.fromCharCode(29));
        if (nextGS === -1) { result.lot = remaining.substring(2); remaining = ''; }
        else { result.lot = remaining.substring(2, nextGS); remaining = remaining.substring(nextGS + 1); }
      } else if (remaining.startsWith('21')) {
        let nextGS = remaining.indexOf(String.fromCharCode(29));
        if (nextGS === -1) { result.serial = remaining.substring(2); remaining = ''; }
        else { result.serial = remaining.substring(2, nextGS); remaining = remaining.substring(nextGS + 1); }
      } else {
        let nextGS = remaining.indexOf(String.fromCharCode(29));
        if (nextGS === -1) break; 
        remaining = remaining.substring(nextGS + 1);
      }
    }
  } catch (e) {
    console.error("GS1 Parse Error:", e);
  }
  
  if (!result.gtin) {
      const basicGtinMatch = cleanCode.match(/(?:01)(\d{14})/);
      if (basicGtinMatch) result.gtin = basicGtinMatch[1];
  }
  return result;
};

// Компонент Сканера
const BarcodeScanner = ({ onScan, onClose }) => {
  const [error, setError] = useState('');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let html5QrcodeScanner;

    const initScanner = () => {
      setIsReady(true);
      try {
        html5QrcodeScanner = new window.Html5QrcodeScanner(
          "reader", { fps: 30, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, false
        );
        html5QrcodeScanner.render(
          (decodedText) => {
            onScan(decodedText);
            html5QrcodeScanner.clear();
          },
          (err) => { /* ігноруємо помилки кадрів */ }
        );
      } catch (e) {
        setError("Не вдалося запустити камеру. Перевірте дозволи.");
      }
    };

    if (!window.Html5QrcodeScanner) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/html5-qrcode';
      script.async = true;
      script.onload = initScanner;
      document.body.appendChild(script);
    } else {
      initScanner();
    }

    return () => {
      if (html5QrcodeScanner) {
        html5QrcodeScanner.clear().catch(e => console.error(e));
      }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col backdrop-blur-sm">
      <div className="p-4 flex justify-between items-center text-white bg-slate-900 border-b border-slate-800 shadow-lg">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <ScanBarcode className="text-teal-400" /> Сканування коду
        </h2>
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors">
          <X size={24} />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col justify-center items-center p-4">
        {error ? (
          <div className="text-rose-400 bg-rose-400/10 p-4 rounded-xl text-center max-w-sm border border-rose-900/50">
            <AlertTriangle className="mx-auto mb-2" size={32} />
            {error}
          </div>
        ) : (
          <div className="w-full max-w-sm bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative border border-slate-700 min-h-[300px]">
             <div id="reader" className="w-full bg-black"></div>
             {!isReady && <div className="absolute inset-0 flex items-center justify-center text-teal-500 animate-pulse">Ініціалізація камери...</div>}
             
             <div className="absolute bottom-2 left-2 right-2 bg-slate-950/90 p-3 rounded-xl text-xs text-center border border-slate-700 shadow-xl">
                <p className="mb-2 font-bold text-teal-400">Симуляція сканування (Емулятор)</p>
                <div className="flex flex-col gap-2 justify-center">
                    <button onClick={() => onScan('01008000000000011728120110LOT-ONX-A21\x1D21SN-998877')} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white font-bold transition-colors">Скан: On-X</button>
                    <button onClick={() => onScan('01008987654321091726091510LOT-OXY4')} className="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-white font-bold transition-colors">Скан: Оксигенатор</button>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Компонент Дашборду
const Dashboard = ({ state }) => {
  const totalValue = state.stock.reduce((sum, item) => sum + (item.quantity * item.purchase_price), 0);
  const thirtyDays = new Date();
  thirtyDays.setDate(thirtyDays.getDate() + 30);

  const expiringItems = state.stock.filter(item => new Date(item.expiration_date) <= thirtyDays && item.quantity > 0);
  const lowStockItems = state.materials.filter(mat => {
    const totalQty = state.stock.filter(s => s.material_id === mat.id).reduce((sum, s) => sum + s.quantity, 0);
    return totalQty < mat.min_stock;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 p-5 rounded-3xl shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Activity size={64}/></div>
          <div className="flex items-center gap-3 text-slate-400 mb-2 relative z-10">
            <Activity className="text-teal-400" size={18} />
            <h3 className="font-semibold text-xs uppercase tracking-widest">Капітал складу</h3>
          </div>
          <div className="text-3xl font-black text-white relative z-10 tracking-tight">
            {totalValue.toLocaleString('uk-UA')} <span className="text-xl text-teal-500 font-medium">₴</span>
          </div>
          <p className="text-xs text-slate-400 mt-2 relative z-10 font-medium">Всього партій: {state.stock.filter(s => s.quantity > 0).length}</p>
        </div>

        <div className={`border p-5 rounded-3xl shadow-lg relative overflow-hidden ${expiringItems.length > 0 ? 'bg-gradient-to-br from-rose-950 to-slate-900 border-rose-900/50' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-10"><Calendar size={64} className={expiringItems.length > 0 ? 'text-rose-500' : 'text-slate-500'}/></div>
          <div className="flex items-center gap-3 text-slate-400 mb-2 relative z-10">
            <Calendar className={expiringItems.length > 0 ? 'text-rose-400' : 'text-slate-400'} size={18} />
            <h3 className="font-semibold text-xs uppercase tracking-widest text-slate-300">FEFO Контроль</h3>
          </div>
          <div className={`text-3xl font-black tracking-tight relative z-10 ${expiringItems.length > 0 ? 'text-rose-400' : 'text-white'}`}>
            {expiringItems.length} <span className="text-sm text-slate-400 font-medium tracking-normal">партіям &lt; 30 днів</span>
          </div>
          {expiringItems.length > 0 && (
            <div className="mt-3 text-xs text-rose-200/80 space-y-1.5 relative z-10">
              {expiringItems.slice(0, 2).map((item, i) => {
                const mat = state.materials.find(m => m.id === item.material_id);
                return <div key={i} className="truncate bg-rose-950/50 px-2 py-1 rounded-md border border-rose-900/50">• {mat?.name}</div>;
              })}
            </div>
          )}
        </div>

        <div className={`border p-5 rounded-3xl shadow-lg relative overflow-hidden ${lowStockItems.length > 0 ? 'bg-gradient-to-br from-amber-950 to-slate-900 border-amber-900/50' : 'bg-gradient-to-br from-slate-800 to-slate-900 border-slate-700'}`}>
          <div className="absolute top-0 right-0 p-4 opacity-10"><AlertTriangle size={64} className={lowStockItems.length > 0 ? 'text-amber-500' : 'text-slate-500'}/></div>
          <div className="flex items-center gap-3 text-slate-400 mb-2 relative z-10">
            <AlertTriangle className={lowStockItems.length > 0 ? 'text-amber-400' : 'text-slate-400'} size={18} />
            <h3 className="font-semibold text-xs uppercase tracking-widest text-slate-300">Дефіцит</h3>
          </div>
          <div className={`text-3xl font-black tracking-tight relative z-10 ${lowStockItems.length > 0 ? 'text-amber-400' : 'text-white'}`}>
            {lowStockItems.length} <span className="text-sm text-slate-400 font-medium tracking-normal">позицій &lt; норми</span>
          </div>
           {lowStockItems.length > 0 && (
            <div className="mt-3 text-xs text-amber-200/80 space-y-1.5 relative z-10">
              {lowStockItems.slice(0, 2).map((mat, i) => (
                <div key={i} className="truncate bg-amber-950/50 px-2 py-1 rounded-md border border-amber-900/50">• {mat.name} (Min: {mat.min_stock})</div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity size={20} className="text-teal-500" /> Останні проведені операції
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-950">
              <tr>
                <th className="px-4 py-3 rounded-tl-xl">Дата</th>
                <th className="px-4 py-3">№ Опер.</th>
                <th className="px-4 py-3">Пацієнт (ІБ)</th>
                <th className="px-4 py-3 rounded-tr-xl">Тип</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {state.operations.slice().sort((a,b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5).map(op => (
                <tr key={op.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-4 whitespace-nowrap">{new Date(op.operation_date).toLocaleDateString('uk-UA')}</td>
                  <td className="px-4 py-4 font-mono text-teal-400 font-bold">{op.operation_num}</td>
                  <td className="px-4 py-4 font-medium">{op.patient_case_id}</td>
                  <td className="px-4 py-4 text-slate-400">{op.operation_type}</td>
                </tr>
              ))}
              {state.operations.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-4 py-12 text-center text-slate-500">Історія операцій порожня</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Компонент Списання
const PostOpExpense = ({ state, dispatch }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState({operation_num:"", patient_case_id:"", operation_type:"CABG On-pump", surgeon_name:"", date:""});
  const [expenses, setExpenses] = useState([]);
  const [scanMessage, setScanMessage] = useState(null);

  const handleScan = (code) => {
    setShowScanner(false);
    const parsed = parseGS1(code);
    
    if (!parsed.gtin) {
      setScanMessage({ type: 'error', text: 'Помилка: не знайдено GTIN у коді.' });
      setTimeout(() => setScanMessage(null), 4000);
      return;
    }

    const material = state.materials.find(m => m.gtin === parsed.gtin);
    if (!material) {
       setScanMessage({ type: 'error', text: `Матеріал з GTIN ${parsed.gtin} не зареєстрований в базі.` });
       setTimeout(() => setScanMessage(null), 4000);
       return;
    }

    let batch = null;
    if (parsed.lot) batch = state.stock.find(s => s.material_id === material.id && s.lot_number === parsed.lot && s.quantity > 0);
    if (!batch && parsed.serial) batch = state.stock.find(s => s.material_id === material.id && s.serial_number === parsed.serial && s.quantity > 0);
    if (!batch) {
       const batches = state.stock.filter(s => s.material_id === material.id && s.quantity > 0).sort((a,b) => new Date(a.expiration_date) - new Date(b.expiration_date));
       if (batches.length > 0) batch = batches[0];
    }

    if (!batch) {
      setScanMessage({ type: 'error', text: `Склад порожній: "${material.name}" немає в наявності.` });
      setTimeout(() => setScanMessage(null), 4000);
      return;
    }

    setExpenses(prev => {
      const existing = prev.find(e => e.stock_batch_id === batch.id);
      if (existing) {
        if (existing.quantity + 1 > batch.quantity) {
           setScanMessage({ type: 'error', text: 'Помилка: Перевищено доступний залишок на складі!' });
           return prev;
        }
        setScanMessage({ type: 'success', text: `Кількість збільшено: ${material.name}` });
        return prev.map(e => e.stock_batch_id === batch.id ? { ...e, quantity: e.quantity + 1 } : e);
      } else {
        setScanMessage({ type: 'success', text: `Успішно додано: ${material.name}` });
        return [...prev, { 
          id: 'exp_' + Date.now(), 
          stock_batch_id: batch.id, 
          material_id: material.id,
          name: material.name,
          lot: batch.lot_number,
          serial: batch.serial_number,
          quantity: 1, 
          max: batch.quantity 
        }];
      }
    });
    setTimeout(() => setScanMessage(null), 3000);
  };

  const submitOperation = async () => {
    if (!formData.operation_num || !formData.patient_case_id) {
      alert("Заповніть номер операції та історію хвороби"); return;
    }
    
    try {
      // 1. Зберігаємо операцію в Supabase
      const { data: opData, error: opError } = await supabase
        .from('operations')
        .insert([{
          operation_num: formData.operation_num,
          patient_case_id: formData.patient_case_id,
          operation_date: formData.date || new Date().toISOString().split('T')[0],
          operation_type: formData.operation_type,
          surgeon_name: formData.surgeon_name
        }])
        .select();

      if (opError) throw opError;
      const newOperation = opData[0];

      // 2. Зберігаємо витрати
      const expensesToInsert = expenses.map(e => ({
        operation_id: newOperation.id,
        stock_batch_id: e.stock_batch_id,
        quantity: e.quantity
      }));

      const { data: expData, error: expError } = await supabase
        .from('expenses')
        .insert(expensesToInsert)
        .select();

      if (expError) throw expError;

      // 3. Оновлюємо залишки складу в базі
      for (const item of expenses) {
        const batch = state.stock.find(s => s.id === item.stock_batch_id);
        const newQuantity = batch.quantity - item.quantity;
        
        const { error: updateError } = await supabase
          .from('stock_batches')
          .update({ quantity: newQuantity })
          .eq('id', item.stock_batch_id);
          
        if (updateError) throw updateError;
      }

      // 4. Оновлюємо локальний UI
      dispatch({ 
        type: 'ADD_OPERATION', 
        payload: { operation: newOperation, expenses: expData } 
      });
      
      setFormData({ operation_num: '', patient_case_id: '', operation_type: 'CABG On-pump', surgeon_name: '', date: '' });
      setExpenses([]);
      
      setScanMessage({ type: 'success', text: '✅ Операцію збережено в хмарі, залишки списано!' });
      setTimeout(() => setScanMessage(null), 5000);

    } catch (error) {
      console.error("Supabase Error:", error);
      alert("Помилка збереження в базу даних. Перевірте підключення.");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      
      {scanMessage && (
        <div className={`p-4 rounded-2xl border flex items-center gap-3 shadow-lg transition-all ${scanMessage.type === 'error' ? 'bg-rose-950/80 border-rose-900 text-rose-200' : 'bg-teal-950/80 border-teal-900 text-teal-200'}`}>
          {scanMessage.type === 'error' ? <AlertTriangle size={20} className="text-rose-500" /> : <CheckCircle size={20} className="text-teal-500" />}
          <span className="font-medium text-sm">{scanMessage.text}</span>
        </div>
      )}

      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
        <h2 className="text-xl font-black text-white mb-8 flex items-center gap-3">
          <div className="p-2 bg-rose-500/10 rounded-xl text-rose-500"><Activity size={24} /></div>
          Списання на операцію
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">№ Операції *</label>
            <input type="text" value={formData.operation_num} onChange={e => setFormData({...formData, operation_num: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-mono" placeholder="Напр. 1024" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">ID Пацієнта (ІБ) *</label>
            <input type="text" value={formData.patient_case_id} onChange={e => setFormData({...formData, patient_case_id: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-teal-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600 font-mono" placeholder="ІБ-2026/45" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Тип операції</label>
            <select value={formData.operation_type} onChange={e => setFormData({...formData, operation_type: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-teal-500 outline-none transition-all appearance-none cursor-pointer">
              <option>CABG On-pump</option><option>CABG Off-pump</option><option>AVR (Аортальний клапан)</option><option>MVR (Мітральний клапан)</option><option>Bentall</option><option>Комбінована</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Дата</label>
            <input type="date" value={formData.date} onChange={e => setFormData({...formData, date: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-teal-500 outline-none transition-all color-scheme-dark" />
          </div>
        </div>

        <div className="bg-slate-950/50 p-5 rounded-2xl border border-slate-800 shadow-inner">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
             <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">Використані матеріали</h3>
             <button onClick={() => setShowScanner(true)} className="w-full sm:w-auto bg-teal-600 hover:bg-teal-500 text-white px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(13,148,136,0.3)]">
               <Camera size={18} /> Сканувати код
             </button>
          </div>

          {expenses.length === 0 ? (
            <div className="text-center py-12 text-slate-600 border-2 border-dashed border-slate-800 rounded-2xl">
               <ScanBarcode size={48} className="mx-auto mb-4 opacity-30" />
               <p className="text-sm font-medium">Відскануйте DataMatrix на упаковці імпланту</p>
            </div>
          ) : (
            <div className="space-y-3">
              {expenses.map((item) => (
                <div key={item.id} className="flex flex-col sm:flex-row justify-between sm:items-center bg-slate-900 p-4 rounded-xl border border-slate-700 shadow-md gap-4 group">
                  <div className="flex-1">
                    <p className="font-bold text-white text-sm">{item.name}</p>
                    <div className="flex gap-3 mt-1.5">
                      {item.lot && <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700 font-mono">LOT: {item.lot}</span>}
                      {item.serial && <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded border border-slate-700 font-mono">SN: {item.serial}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 justify-between sm:justify-end">
                    <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800">
                      <button onClick={() => setExpenses(prev => prev.map(e => e.id === item.id ? {...e, quantity: Math.max(1, e.quantity - 1)} : e))} className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-l-lg transition-colors">-</button>
                      <div className="px-3 py-1.5 text-white text-sm font-bold min-w-[3rem] text-center">{item.quantity} <span className="text-slate-500 text-xs font-normal">/ {item.max}</span></div>
                      <button onClick={() => setExpenses(prev => prev.map(e => e.id === item.id ? {...e, quantity: Math.min(e.max, e.quantity + 1)} : e))} className="px-3 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-r-lg transition-colors">+</button>
                    </div>
                    <button onClick={() => setExpenses(prev => prev.filter(e => e.id !== item.id))} className="p-2 text-rose-500 hover:bg-rose-500/20 rounded-lg transition-colors">
                      <Trash2 size={20} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <button 
          onClick={submitOperation}
          disabled={expenses.length === 0}
          className={`w-full mt-6 py-4 rounded-2xl font-black text-lg transition-all duration-300 ${expenses.length > 0 ? 'bg-gradient-to-r from-teal-500 to-emerald-500 text-white shadow-[0_10px_30px_rgba(13,148,136,0.3)] hover:scale-[1.01] hover:shadow-[0_10px_40px_rgba(13,148,136,0.4)]' : 'bg-slate-950 text-slate-700 border border-slate-800 cursor-not-allowed'}`}
        >
          Завершити операцію ({expenses.reduce((s,e) => s + e.quantity, 0)} шт)
        </button>
      </div>
    </div>
  );
};

// Компонент Приходу
const StockIn = ({ state, dispatch }) => {
  const [showScanner, setShowScanner] = useState(false);
  const [formData, setFormData] = useState({ gtin: '', lot: '', serial: '', exp: '', quantity: 1, price: '' });
  const [message, setMessage] = useState(null);

  const activeMaterial = state.materials.find(m => m.gtin === formData.gtin);

  const handleScan = (code) => {
    setShowScanner(false);
    const parsed = parseGS1(code);
    if (!parsed.gtin) {
      setMessage({ type: 'error', text: 'Неможливо розпізнати код.' }); 
      setTimeout(() => setMessage(null), 3000);
      return;
    }
    
    setFormData({
      gtin: parsed.gtin,
      lot: parsed.lot || '',
      serial: parsed.serial || '',
      exp: parsed.exp || '',
      quantity: 1,
      price: ''
    });
    
    const mat = state.materials.find(m => m.gtin === parsed.gtin);
    if (mat) {
      setMessage({ type: 'success', text: `Розпізнано: ${mat.name}` });
    } else {
      setMessage({ type: 'warning', text: `Новий GTIN: ${parsed.gtin}. Потрібно додати в довідник.` });
    }
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSave = async () => {
    if (!activeMaterial) { alert("Матеріал не знайдено. Спочатку додайте його в довідник."); return; }
    if (!formData.lot || !formData.exp || formData.quantity <= 0) { alert("Заповніть обов'язкові поля: LOT, Термін, Кількість."); return; }

    const batch = {
      material_id: activeMaterial.id,
      lot_number: formData.lot,
      serial_number: formData.serial,
      expiration_date: formData.exp,
      quantity: Number(formData.quantity),
      purchase_price: Number(formData.price) || 0
    };

    try {
      const { data, error } = await supabase.from('stock_batches').insert([batch]).select();
      if (error) throw error;
      
      dispatch({ type: 'ADD_STOCK', payload: data[0] });
      setFormData({ gtin: '', lot: '', serial: '', exp: '', quantity: 1, price: '' });
      setMessage({ type: 'success', text: '✅ Товар успішно оприбутковано на склад!' });
      setTimeout(() => setMessage(null), 4000);
    } catch (e) {
      console.error(e);
      setMessage({ type: 'error', text: 'Помилка збереження в базу даних.' });
    }
  };

  return (
    <div className="max-w-2xl mx-auto animate-in slide-in-from-bottom-4 duration-500">
      {showScanner && <BarcodeScanner onScan={handleScan} onClose={() => setShowScanner(false)} />}
      
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl">
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <h2 className="text-xl font-black text-white flex items-center gap-3">
              <div className="p-2 bg-teal-500/10 rounded-xl text-teal-500"><PackagePlus size={24} /></div>
              Прихід товару
            </h2>
            <button onClick={() => setShowScanner(true)} className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-teal-400 px-5 py-2.5 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors border border-slate-700">
               <Camera size={18} /> Сканувати
            </button>
         </div>

         {message && (
          <div className={`p-4 rounded-xl border mb-6 flex items-center gap-3 text-sm font-medium ${message.type === 'error' ? 'bg-rose-950/80 border-rose-900 text-rose-200' : message.type === 'warning' ? 'bg-amber-950/80 border-amber-900 text-amber-200' : 'bg-teal-950/80 border-teal-900 text-teal-200'}`}>
            <AlertTriangle size={18}/> {message.text}
          </div>
         )}

         <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">GTIN Код *</label>
              <input type="text" value={formData.gtin} onChange={e => setFormData({...formData, gtin: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-teal-400 focus:ring-2 focus:ring-teal-500 outline-none transition-all font-mono font-bold tracking-widest" placeholder="00000000000000" />
            </div>

            {activeMaterial && (
              <div className="p-4 bg-teal-950/20 border border-teal-900/50 rounded-xl flex items-center gap-4">
                 <div className="w-12 h-12 bg-slate-900 rounded-lg flex items-center justify-center border border-slate-800">
                    <Database className="text-teal-500 opacity-50" size={24} />
                 </div>
                 <div>
                   <p className="text-white font-bold text-sm">{activeMaterial.name}</p>
                   <p className="text-xs text-slate-400 mt-1">{activeMaterial.category} › {activeMaterial.subcategory}</p>
                 </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">LOT Партія *</label>
                <input type="text" value={formData.lot} onChange={e => setFormData({...formData, lot: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-teal-500 outline-none font-mono" placeholder="ABC-123" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Серійний № (Опц)</label>
                <input type="text" value={formData.serial} onChange={e => setFormData({...formData, serial: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-teal-500 outline-none font-mono" placeholder="SN-000" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Придатний до *</label>
                  <input type="date" value={formData.exp} onChange={e => setFormData({...formData, exp: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-teal-500 outline-none color-scheme-dark" />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Кількість *</label>
                  <input type="number" min="1" value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-teal-500 outline-none font-bold text-center text-lg" />
               </div>
               <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Ціна (₴)</label>
                  <input type="number" step="100" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-white focus:ring-2 focus:ring-teal-500 outline-none" placeholder="0" />
               </div>
            </div>

            <button 
              onClick={handleSave}
              className="w-full mt-6 bg-slate-800 hover:bg-teal-600 text-white font-black py-4 rounded-2xl transition-all duration-300 hover:shadow-[0_10px_30px_rgba(13,148,136,0.3)] border border-slate-700 hover:border-teal-500"
            >
              Оприбуткувати товар
            </button>
         </div>
      </div>
    </div>
  );
};

// Компонент Інвентаризації
const Inventory = ({ state }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortBy, setSortBy] = useState('exp_asc');

  const subcategories = useMemo(() => {
    const unique = new Set(state.materials.map(m => m.subcategory));
    return ['All', ...Array.from(unique)].sort();
  }, [state.materials]);

  const exportCSV = () => {
    let csvContent = "Дата;№ Операції;ID Пацієнта;Тип;Хірург;Матеріал;GTIN;LOT;Серійний;Кількість;Ціна;Сума\n";
    state.operations.forEach(op => {
      const opExpenses = state.expenses.filter(e => e.operation_id === op.id);
      opExpenses.forEach(exp => {
        const batch = state.stock.find(s => s.id === exp.stock_batch_id) || {};
        const mat = state.materials.find(m => m.id === batch.material_id) || {};
        const row = [
          op.operation_date, op.operation_num, op.patient_case_id, op.operation_type, op.surgeon_name,
          mat.name || '-', mat.gtin || '', batch.lot_number || '', batch.serial_number || '',
          exp.quantity, batch.purchase_price || 0, (exp.quantity * (batch.purchase_price || 0))
        ].map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(';');
        csvContent += row + "\n";
      });
    });

    const blob = new Blob([new Uint8Array([0xEF, 0xBB, 0xBF]), csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `cardio_expenses_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const inventoryView = useMemo(() => {
    let result = [];
    state.materials.forEach(mat => {
      if (filterCategory !== 'All' && mat.subcategory !== filterCategory) return;
      
      const batches = state.stock.filter(s => s.material_id === mat.id && s.quantity > 0);
      batches.forEach(b => {
        if (mat.name.toLowerCase().includes(searchTerm.toLowerCase()) || b.lot_number.toLowerCase().includes(searchTerm.toLowerCase())) {
            result.push({ ...mat, ...b, unique_id: b.id });
        }
      });
    });
    
    return result.sort((a, b) => {
        if (sortBy === 'exp_asc') return new Date(a.expiration_date) - new Date(b.expiration_date);
        if (sortBy === 'exp_desc') return new Date(b.expiration_date) - new Date(a.expiration_date);
        if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
        if (sortBy === 'qty_desc') return b.quantity - a.quantity;
        return 0;
    });
  }, [state, searchTerm, filterCategory, sortBy]);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h2 className="text-xl font-black text-white flex items-center gap-3">
          <div className="p-2 bg-slate-800 rounded-xl text-slate-300"><Database size={24} /></div>
          Залишки на складі
        </h2>
        <button onClick={exportCSV} className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all">
          <Download size={18} className="text-teal-400" /> CSV Звіт витрат
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
          <input 
            type="text" 
            placeholder="Пошук матеріалу за назвою або партією (LOT)..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full h-full bg-slate-900 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 text-white focus:ring-2 focus:ring-teal-500 outline-none shadow-lg placeholder:text-slate-600 transition-all"
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-48">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <select 
                    value={filterCategory} 
                    onChange={e => setFilterCategory(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-3 text-sm text-white focus:ring-2 focus:ring-teal-500 outline-none shadow-lg appearance-none cursor-pointer"
                >
                    <option value="All">Всі категорії</option>
                    {subcategories.filter(c => c !== 'All').map(c => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>
            
            <div className="relative flex-1 md:w-48">
                <ArrowDownUp className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <select 
                    value={sortBy} 
                    onChange={e => setSortBy(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3.5 pl-10 pr-3 text-sm text-white focus:ring-2 focus:ring-teal-500 outline-none shadow-lg appearance-none cursor-pointer"
                >
                    <option value="exp_asc">Термін (спочатку старі)</option>
                    <option value="exp_desc">Термін (спочатку нові)</option>
                    <option value="name_asc">За алфавітом (А-Я)</option>
                    <option value="qty_desc">Кількість (спочатку більше)</option>
                </select>
            </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-slate-950">
              <tr>
                <th className="px-5 py-4">Номенклатура</th>
                <th className="px-5 py-4">Партія (LOT / SN)</th>
                <th className="px-5 py-4">Термін</th>
                <th className="px-5 py-4 text-right">Залишок</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 text-slate-300">
              {inventoryView.map(item => {
                const isExpiring = new Date(item.expiration_date) <= new Date(new Date().setDate(new Date().getDate() + 30));
                return (
                  <tr key={item.unique_id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-5 py-4">
                      <div className="font-bold text-white text-sm">{item.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-1 tracking-wider">{item.gtin}</div>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs">
                      <div className="text-teal-400 font-bold bg-teal-500/10 inline-block px-2 py-0.5 rounded border border-teal-500/20">{item.lot_number}</div>
                      {item.serial_number && <div className="text-slate-400 mt-1.5">SN: {item.serial_number}</div>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-bold inline-flex items-center gap-1 ${isExpiring ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'text-slate-400'}`}>
                        {isExpiring && <AlertTriangle size={12} />}
                        {new Date(item.expiration_date).toLocaleDateString('uk-UA')}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="font-black text-xl text-white">{item.quantity} <span className="text-xs text-slate-500 font-medium">{item.unit}</span></div>
                    </td>
                  </tr>
                )
              })}
              {inventoryView.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-5 py-16 text-center">
                     <Database size={48} className="mx-auto text-slate-700 mb-3" />
                     <p className="text-slate-500 font-medium">Склад порожній або нічого не знайдено</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Reducer для керування станом (тільки локальний стейт без localStorage)
const reducer = (state, action) => {
  switch (action.type) {
    case 'INIT': 
      return action.payload;
    case 'ADD_STOCK':
      return { ...state, stock: [...state.stock, action.payload] };
    case 'ADD_OPERATION':
      const { operation, expenses } = action.payload;
      const updatedStock = state.stock.map(batch => {
         const used = expenses.find(e => e.stock_batch_id === batch.id);
         if (used) return { ...batch, quantity: batch.quantity - used.quantity };
         return batch;
      });
      return { ...state, operations: [...state.operations, operation], expenses: [...state.expenses, ...expenses], stock: updatedStock };
    default: return state;
  }
};

// Головний компонент додатку
export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [state, dispatch] = React.useReducer(reducer, { materials: [], stock: [], operations: [], expenses: [] });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function fetchCloudData() {
      try {
        const [matRes, stockRes, opRes, expRes] = await Promise.all([
          supabase.from('materials').select('*'),
          supabase.from('stock_batches').select('*'),
          supabase.from('operations').select('*'),
          supabase.from('expenses').select('*')
        ]);

        dispatch({
          type: 'INIT',
          payload: {
            materials: matRes.data || [],
            stock: stockRes.data || [],
            operations: opRes.data || [],
            expenses: expRes.data || []
          }
        });
      } catch (error) {
        console.error("Помилка завантаження бази даних:", error);
      } finally {
        setIsLoaded(true);
      }
    }
    
    fetchCloudData();
  }, []);

  if (!isLoaded) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-4 text-teal-500">
      <HeartPulse size={48} className="animate-pulse" />
      <span className="font-bold tracking-widest uppercase text-sm">З'єднання з хмарою...</span>
    </div>
  );

  const NavItem = ({ id, icon: Icon, label }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`flex flex-col items-center justify-center w-full py-3 gap-1.5 transition-all ${activeTab === id ? 'text-teal-400 scale-110' : 'text-slate-500 hover:text-slate-300'}`}
    >
      <Icon size={22} className={activeTab === id ? 'drop-shadow-[0_0_10px_rgba(45,212,191,0.6)]' : ''} />
      <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#020817] text-slate-200 pb-24 md:pb-0 font-sans selection:bg-teal-500/30">
      <header className="bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 md:h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="bg-gradient-to-br from-teal-400 to-emerald-600 text-slate-950 p-2 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)]">
               <HeartPulse size={24} strokeWidth={2.5} />
             </div>
             <div>
                <h1 className="text-xl font-black tracking-tight text-white leading-none">Cardio<span className="text-teal-400">Stock</span></h1>
                <span className="text-[10px] text-slate-500 font-bold tracking-widest uppercase">Хірургічний облік</span>
             </div>
          </div>
          <div className="hidden md:flex items-center gap-1 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-800">
             {[
               {id: 'dashboard', label: 'Дашборд'},
               {id: 'postop', label: 'Списання'},
               {id: 'stockin', label: 'Прихід'},
               {id: 'inventory', label: 'Склад'}
             ].map(t => (
               <button 
                 key={t.id}
                 onClick={() => setActiveTab(t.id)} 
                 className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 ${activeTab === t.id ? 'bg-slate-800 text-teal-400 shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
               >
                 {t.label}
               </button>
             ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-6 md:py-10">
        {activeTab === 'dashboard' && <Dashboard state={state} />}
        {activeTab === 'postop' && <PostOpExpense state={state} dispatch={dispatch} />}
        {activeTab === 'stockin' && <StockIn state={state} dispatch={dispatch} />}
        {activeTab === 'inventory' && <Inventory state={state} />}
      </main>

      <nav className="md:hidden fixed bottom-0 w-full bg-slate-950/90 backdrop-blur-lg border-t border-slate-800 pb-safe z-40">
        <div className="flex justify-around items-center h-20 px-2">
          <NavItem id="dashboard" icon={Activity} label="Дашборд" />
          <NavItem id="stockin" icon={PackagePlus} label="Прихід" />
          
          <div className="relative -top-6">
            <button 
              onClick={() => setActiveTab('postop')}
              className={`h-16 w-16 rounded-full flex items-center justify-center shadow-[0_10px_30px_rgba(13,148,136,0.4)] transition-transform active:scale-90 border-4 border-[#020817] ${activeTab === 'postop' ? 'bg-teal-400 text-slate-950' : 'bg-slate-800 text-teal-400'}`}
            >
              <HeartPulse size={28} strokeWidth={2.5} />
            </button>
          </div>
          
          <NavItem id="inventory" icon={Database} label="Склад" />
        </div>
      </nav>
    </div>
  );
}