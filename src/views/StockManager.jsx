// src/views/StockManager.jsx (CÓDIGO FINAL Y PULIDO)

import React, { useState, useMemo } from 'react'; // ✅ Importar useMemo
import { 
    Plus, Trash2, Search, Copy, Check, Shield, Zap, Box, 
    Layers, Smartphone, Lock, Mail 
} from 'lucide-react';

const StockManager = ({
    accountsInventory,
    stockTab, 
    setStockTab, 
    stockForm, setStockForm,
    catalog,
    handleStockServiceChange,
    handleGenerateStock,
    triggerDeleteAccount
}) => {
    
    // 1. ESTADOS LOCALES
    const [searchInventory, setSearchInventory] = useState('');
    const [copiedId, setCopiedId] = useState(null); 

    // 2. FILTRADO (✅ OPTIMIZACIÓN: Usar useMemo)
    const filteredAccounts = useMemo(() => {
        return accountsInventory.filter(acc => 
            acc.email.toLowerCase().includes(searchInventory.toLowerCase()) ||
            acc.service.toLowerCase().includes(searchInventory.toLowerCase())
        );
    }, [accountsInventory, searchInventory]); // Recalcula solo si el inventario o la búsqueda cambian

    // 3. COPIADO
    const handleCopy = (text, uniqueId) => {
        navigator.clipboard.writeText(text);
        setCopiedId(uniqueId);
        setTimeout(() => setCopiedId(null), 2000); 
    };

    // 4. TARJETA BÓVEDA (Sin cambios)
    const VaultCard = ({ acc, index }) => {
        const percentFree = Math.round((acc.free / acc.total) * 100);
        let barColor = "bg-emerald-500 shadow-emerald-500/50";
        if (percentFree < 50) barColor = "bg-amber-500 shadow-amber-500/50";
        if (percentFree === 0) barColor = "bg-slate-300";

        return (
            <div className="group relative w-full p-5 bg-white/60 backdrop-blur-xl border border-white/60 rounded-[24px] shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
                            <Box size={18} />
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-800 text-base leading-tight">{acc.service}</h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Cuenta Madre</span>
                        </div>
                    </div>
                    <button onClick={() => triggerDeleteAccount(acc)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500 flex items-center justify-center transition-colors">
                        <Trash2 size={14} />
                    </button>
                </div>

                <div className="space-y-2 mb-5">
                    <button onClick={() => handleCopy(acc.email, `email-${index}`)} className="w-full flex items-center justify-between p-3 bg-white/50 rounded-xl border border-white/50 hover:bg-white hover:border-indigo-100 group/btn transition-all text-left">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Mail size={14} className="text-slate-400 flex-shrink-0"/>
                            <span className="text-xs font-semibold text-slate-600 truncate">{acc.email}</span>
                        </div>
                        <div className="text-indigo-500 opacity-0 group-hover/btn:opacity-100 transition-opacity scale-90">
                            {copiedId === `email-${index}` ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                        </div>
                    </button>

                    <div className="flex gap-2">
                        <button onClick={() => handleCopy(acc.pass, `pass-${index}`)} className="flex-1 flex items-center justify-between p-3 bg-white/50 rounded-xl border border-white/50 hover:bg-white hover:border-indigo-100 group/btn transition-all text-left">
                            <div className="flex items-center gap-2">
                                <Lock size={14} className="text-slate-400"/>
                                <span className="text-xs font-mono text-slate-500">••••••••</span>
                            </div>
                            <div className="text-indigo-500 opacity-0 group-hover/btn:opacity-100 transition-opacity scale-90">
                                {copiedId === `pass-${index}` ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                            </div>
                        </button>
                        <div className="px-3 py-2 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200/50">
                            <span className="text-[10px] font-black text-slate-400">ID #{index + 1}</span>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-100/50 rounded-2xl p-3 border border-slate-200/50">
                    <div className="flex justify-between items-end mb-2">
                        <div className="text-xs font-bold text-slate-500">Disponibilidad</div>
                        <div className="text-right">
                            <span className={`text-lg font-black ${percentFree === 0 ? 'text-slate-400' : 'text-slate-800'}`}>{acc.free}</span>
                            <span className="text-[10px] font-bold text-slate-400"> / {acc.total}</span>
                        </div>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percentFree}%` }}/>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full pb-32 space-y-6">
            
            {/* 1. HEADER (Sin cambios) */}
            <div className="sticky top-0 z-30 bg-[#F2F2F7]/80 backdrop-blur-xl py-2 -mx-1 px-1">
                <div className="bg-white/60 backdrop-blur-md p-1.5 rounded-2xl border border-white/50 shadow-sm flex gap-1">
                    <button onClick={() => setStockTab('manage')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${stockTab === 'manage' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:bg-white/40'}`}>
                        <Layers size={14}/> Bóveda ({accountsInventory.length})
                    </button>
                    <button onClick={() => setStockTab('add')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${stockTab === 'add' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-400 hover:bg-white/40'}`}>
                        <Plus size={14}/> Nuevo Ingreso
                    </button>
                </div>
            </div>

            {stockTab === 'add' ? (
                // --- VISTA: AGREGAR STOCK ---
                <div className="animate-in slide-in-from-bottom-4 duration-300">
                    <div className="w-full bg-white/80 backdrop-blur-xl p-6 md:p-8 rounded-[32px] shadow-2xl border border-white/60 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"/>
                        
                        <div className="relative z-10">
                            <h2 className="text-2xl font-black text-slate-800 mb-1 tracking-tight">Ingresar Cuenta</h2>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-8">Generador de Lotes</p>
                            
                            <form onSubmit={handleGenerateStock} className="space-y-5">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 ml-3">Plataforma</label>
                                    <div className="relative">
                                        <select className="w-full p-4 pl-5 bg-slate-100/50 border border-slate-200/50 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all" value={stockForm.service} onChange={handleStockServiceChange}>
                                            <option value="">Seleccionar del catálogo...</option>
                                            {catalog.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▼</div>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 ml-3">Credenciales</label>
                                        
                                        <input 
                                            type="email" 
                                            required
                                            className="w-full p-4 bg-slate-100/50 border border-slate-200/50 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-300" 
                                            value={stockForm.email} 
                                            onChange={e=>setStockForm({...stockForm, email:e.target.value})} 
                                            placeholder="correo@ejemplo.com"
                                        />
                                        
                                        <input 
                                            className="w-full p-4 bg-slate-100/50 border border-slate-200/50 rounded-2xl text-sm font-medium text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-300 mt-2" 
                                            value={stockForm.pass} 
                                            onChange={e=>setStockForm({...stockForm, pass:e.target.value})} 
                                            placeholder="Contraseña de acceso"
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-slate-500 ml-3">Capacidad</label>
                                        <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50 flex flex-col items-center justify-center h-full">
                                            
                                            <input 
                                                type="number" 
                                                min="1" 
                                                className="bg-transparent text-4xl font-black text-indigo-600 text-center w-full outline-none placeholder-indigo-200" 
                                                value={stockForm.slots} 
                                                onChange={e => {
                                                    const val = parseInt(e.target.value);
                                                    setStockForm({...stockForm, slots: isNaN(val) || val < 1 ? 1 : val})
                                                }}
                                            />
                                            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-1">Perfiles a Crear</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold text-sm shadow-xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <Zap size={18} className="text-yellow-400 fill-yellow-400"/> Generar Inventario
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

            ) : (
                // --- VISTA: GESTIÓN DE BÓVEDA ---
                <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-4">
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Buscar en la bóveda..."
                            value={searchInventory}
                            onChange={(e) => setSearchInventory(e.target.value)}
                            className="w-full p-4 pl-12 bg-white/70 backdrop-blur-xl border-none rounded-[20px] text-sm font-bold text-slate-700 outline-none shadow-sm focus:shadow-lg focus:bg-white transition-all placeholder:text-slate-400"
                        />
                        <Search size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredAccounts.length > 0 ? (
                            filteredAccounts.map((acc, i) => <VaultCard key={acc.email} acc={acc} index={i} />)
                        ) : (
                            <div className="col-span-full py-20 text-center">
                                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                    <Shield size={32}/>
                                </div>
                                <p className="text-slate-400 font-bold text-sm">Bóveda vacía o sin resultados</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockManager;