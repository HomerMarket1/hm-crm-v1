// src/views/StockManager.jsx
import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

const StockManager = ({
    accountsInventory,
    stockTab, setStockTab,
    stockForm, setStockForm,
    catalog,
    handleStockServiceChange,
    handleGenerateStock,
    triggerDeleteAccount
}) => {
    return (
        // ✅ CORTAR Y PEGAR ESTE BLOQUE
        <div className="space-y-6 w-full pb-20">
            {/* PESTAÑAS DE NAVEGACIÓN DENTRO DE STOCK */}
            <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
                <button onClick={() => setStockTab('add')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${stockTab === 'add' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>➕ Agregar Stock</button>
                <button onClick={() => setStockTab('manage')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${stockTab === 'manage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>📋 Gestionar Cuentas</button>
            </div>

            {stockTab === 'add' ? (
                // FORMULARIO AGREGAR
                <div className="w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                    <h2 className="text-xl font-black text-slate-800 mb-6">Agregar Stock</h2>
                    <form onSubmit={handleGenerateStock} className="space-y-4">
                        <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none" value={stockForm.service} onChange={handleStockServiceChange}><option value="">Seleccionar Servicio...</option>{catalog.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select>
                        <input className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none" value={stockForm.email} onChange={e=>setStockForm({...stockForm, email:e.target.value})} placeholder="Correo"/>
                        <input className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none" value={stockForm.pass} onChange={e=>setStockForm({...stockForm, pass:e.target.value})} placeholder="Contraseña"/>
                        <div className="flex items-center gap-3"><input type="number" className="w-16 p-3 bg-blue-50 text-blue-600 font-bold rounded-xl text-center outline-none border-blue-100 border" value={stockForm.slots} onChange={e=>setStockForm({...stockForm, slots:Number(e.target.value)})}/><span className="text-xs font-bold text-slate-400">Cupos</span></div>
                        <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg active:scale-95">Generar</button>
                    </form>
                </div>
            ) : (
                // GESTOR DE CUENTAS (Borrado Masivo)
                <div className="space-y-3">
                    <div className="flex justify-between items-center px-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase">Cuentas Registradas ({accountsInventory.length})</h3>
                    </div>
                    {accountsInventory.length === 0 && <p className="text-center text-slate-400 text-xs py-8 bg-white rounded-xl">No hay cuentas madre registradas.</p>}
                    {accountsInventory.map((acc, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                            <div className="overflow-hidden">
                                <div className="font-bold text-slate-800 text-sm truncate">{acc.service}</div>
                                <div className="text-xs text-slate-500 truncate">{acc.email}</div>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-lg font-bold">Libres: {acc.free}</span>
                                    <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-lg font-bold">Total: {acc.total}</span>
                                </div>
                            </div>
                            <button onClick={() => triggerDeleteAccount(acc)} className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-xl shadow-sm hover:bg-red-100 active:scale-95"><Trash2 size={16}/></button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StockManager;