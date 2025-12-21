// src/views/StockManager.jsx
import React, { useState, useMemo } from 'react';
import { 
    Plus, Trash2, Search, Copy, Check, Shield, Zap, Box, 
    Layers, Mail, Lock, Settings, Eye, EyeOff, AlertTriangle,
    Download, Eraser // ✅ AGREGADO: Icono de Borrador
} from 'lucide-react';

const StockManager = ({
    accountsInventory,      
    stockTab, 
    setStockTab, 
    stockForm, 
    setStockForm,
    catalog = [], 
    handleStockServiceChange, 
    handleGenerateStock,      
    triggerDeleteAccount,     
    triggerDeleteFreeStock,   
    triggerEditAccount,
    darkMode 
}) => {
    
    const [searchInventory, setSearchInventory] = useState('');
    const [copiedId, setCopiedId] = useState(null); 
    const [hideEmpty, setHideEmpty] = useState(false); 
    
    // 🎨 TEMA UNIFICADO
    const theme = {
        card: darkMode ? 'bg-[#161B28] border-white/5' : 'bg-white/80 backdrop-blur-xl border-white/60 shadow-lg shadow-indigo-500/5',
        text: darkMode ? 'text-white' : 'text-slate-900',
        subtext: darkMode ? 'text-slate-400' : 'text-slate-500',
        inputBg: darkMode ? 'bg-black/30 border-white/5' : 'bg-white/80 border-slate-200',
        actionBtn: darkMode ? 'bg-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600',
        accentBtn: darkMode ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/20' : 'bg-indigo-50 text-indigo-600 border border-indigo-100',
        dangerBtn: darkMode ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20' : 'bg-rose-50 text-rose-600 hover:bg-rose-100',
        separator: darkMode ? 'bg-white/10' : 'bg-slate-200', // ✅ Nuevo color separador
    };

    const handleExportCSV = () => {
        const bom = "\uFEFF"; 
        const headers = "Servicio,Email,Contraseña,Total,Libres\n";
        const rows = accountsInventory.map(acc => {
            const currentUsed = (parseInt(acc.total) || 1) - (parseInt(acc.free) || 0);
            const realFree = Math.max(0, (parseInt(acc.total)||1) - currentUsed);
            return `${acc.service},${acc.email},${acc.pass},${acc.total},${realFree}`;
        }).join("\n");
        
        const blob = new Blob([bom + headers + rows], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Stock_HM_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const filteredAccounts = useMemo(() => {
        let result = accountsInventory || [];
        if (hideEmpty) {
            result = result.filter(acc => (parseInt(acc.free) || 0) > 0);
        }
        if (searchInventory) {
            const lower = searchInventory.toLowerCase();
            result = result.filter(acc => 
                acc.email.toLowerCase().includes(lower) ||
                acc.service.toLowerCase().includes(lower)
            );
        }
        return result;
    }, [accountsInventory, searchInventory, hideEmpty]);

    const handleCopy = (text, uniqueId) => {
        navigator.clipboard.writeText(text);
        setCopiedId(uniqueId);
        setTimeout(() => setCopiedId(null), 1500); 
    };

    const VaultCard = ({ acc, index }) => {
        const catalogService = catalog.find(s => s.name === acc.service);
        const dbTotal = parseInt(acc.total) || 0;
        const catalogTotal = catalogService ? parseInt(catalogService.defaultSlots) : 1;
        const realTotal = Math.max(dbTotal, catalogTotal);
        const realFree = parseInt(acc.free) || 0;
        const percentFree = realTotal > 0 ? Math.round((realFree / realTotal) * 100) : 0;
        
        let barColor = "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
        if (realFree > 0 && realFree <= 2) barColor = "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)] animate-pulse";
        else if (percentFree < 50) barColor = "bg-amber-500";
        if (realFree === 0) barColor = darkMode ? "bg-slate-700" : "bg-slate-300";

        return (
            <div className={`group relative w-full p-5 border rounded-[24px] transition-all duration-300 ${theme.card} ${realFree === 0 ? 'opacity-70 grayscale hover:grayscale-0 hover:opacity-100' : 'hover:scale-[1.01]'}`}>
                
                {realFree > 0 && realFree <= 2 && (
                    <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded-full shadow-lg flex items-center gap-1 z-10 animate-bounce">
                        <AlertTriangle size={10} className="fill-white"/> CRÍTICO
                    </div>
                )}

                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${darkMode ? 'bg-white/10 text-white' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'}`}>
                            <Box size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3 className={`font-bold text-sm leading-tight truncate w-32 ${theme.text}`} title={acc.service}>
                                {acc.service}
                            </h3>
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Cuenta Madre</span>
                        </div>
                    </div>
                    
                    {/* ✅ BOTONES DE ACCIÓN MEJORADOS */}
                    <div className="flex items-center gap-1">
                        <button onClick={() => triggerEditAccount(acc)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${theme.actionBtn}`} title="Editar Contraseña"><Settings size={14} /></button>
                        
                        {realFree > 0 && (
                            <>
                                {/* Separador visual */}
                                <div className={`w-px h-3 mx-1 ${theme.separator}`}></div>

                                <button onClick={() => triggerDeleteFreeStock(acc.email, acc.pass)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${darkMode ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`} title="Limpiar Libres">
                                    <Eraser size={14} /> {/* Icono cambiado a Borrador */}
                                </button>
                            </>
                        )}
                        
                        {/* Separador visual si hay botón de limpiar */}
                        {realFree > 0 && <div className={`w-px h-3 mx-1 ${theme.separator}`}></div>}

                        <button onClick={() => triggerDeleteAccount(acc)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${theme.dangerBtn}`} title="Eliminar cuenta"><Trash2 size={14} /></button>
                    </div>
                </div>

                <div className="space-y-2 mb-5">
                    <button onClick={() => handleCopy(acc.email, `email-${index}`)} className={`w-full flex items-center justify-between p-3 rounded-xl border group/btn transition-all text-left ${darkMode ? 'bg-black/20 border-white/5 hover:bg-white/5' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Mail size={14} className="text-slate-400 shrink-0"/>
                            <span className={`text-xs font-semibold truncate ${theme.subtext}`}>{acc.email}</span>
                        </div>
                        <div className="text-indigo-500 opacity-0 group-hover/btn:opacity-100 transition-opacity scale-90">
                            {copiedId === `email-${index}` ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                        </div>
                    </button>

                    <div className="flex gap-2">
                        <button onClick={() => handleCopy(acc.pass, `pass-${index}`)} className={`flex-1 flex items-center justify-between p-3 rounded-xl border group/btn transition-all text-left ${darkMode ? 'bg-black/20 border-white/5 hover:bg-white/5' : 'bg-slate-50 border-slate-100 hover:bg-white'}`}>
                            <div className="flex items-center gap-2">
                                <Lock size={14} className="text-slate-400 shrink-0"/>
                                <span className={`text-xs font-mono tracking-widest ${theme.subtext}`}>••••••</span>
                            </div>
                            <div className="text-indigo-500 opacity-0 group-hover/btn:opacity-100 transition-opacity scale-90">
                                {copiedId === `pass-${index}` ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                            </div>
                        </button>
                        <div className={`px-3 py-2 rounded-xl flex items-center justify-center border ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                            <span className="text-[10px] font-black text-slate-500">#{index + 1}</span>
                        </div>
                    </div>
                </div>

                <div className={`rounded-2xl p-3 border ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100'}`}>
                    <div className="flex justify-between items-end mb-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Disponibles</div>
                        <div className="text-right leading-none">
                            <span className={`text-lg font-black ${realFree === 0 ? 'text-slate-500' : (darkMode ? 'text-white' : 'text-slate-800')}`}>{realFree}</span>
                            <span className="text-[10px] font-bold text-slate-400 opacity-60"> / {realTotal}</span>
                        </div>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${darkMode ? 'bg-black/40' : 'bg-slate-200'}`}>
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percentFree}%` }}/>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full pb-32 space-y-6 animate-in fade-in">
            <div className={`sticky top-0 z-30 backdrop-blur-xl py-2 -mx-1 px-1 ${darkMode ? 'bg-[#0B0F19]/80' : 'bg-[#F2F2F7]/80'}`}>
                <div className={`p-1.5 rounded-2xl border shadow-sm flex gap-1 ${darkMode ? 'bg-[#161B28]/80 border-white/10' : 'bg-white/80 border-white/50'}`}>
                    <button onClick={() => setStockTab('manage')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${stockTab === 'manage' ? (darkMode ? 'bg-[#2A303C] text-white shadow-sm ring-1 ring-white/10' : 'bg-white text-indigo-600 shadow-sm') : 'text-slate-400 hover:text-slate-500'}`}>
                        <Layers size={14}/> Bóveda ({filteredAccounts.length})
                    </button>
                    <button onClick={() => setStockTab('add')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${stockTab === 'add' ? (darkMode ? 'bg-[#2A303C] text-white shadow-sm ring-1 ring-white/10' : 'bg-white text-indigo-600 shadow-sm') : 'text-slate-400 hover:text-slate-500'}`}>
                        <Plus size={14}/> Nuevo Ingreso
                    </button>
                </div>
            </div>

            {stockTab === 'add' ? (
                <div className="animate-in slide-in-from-bottom-4 duration-300">
                    <div className={`w-full p-6 md:p-8 rounded-[32px] shadow-2xl border relative overflow-hidden ${darkMode ? 'bg-[#161B28] border-white/10' : 'bg-white border-white/60'}`}>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"/>
                        
                        <div className="relative z-10">
                            <h2 className={`text-2xl font-black mb-1 tracking-tight ${theme.text}`}>Ingresar Cuenta</h2>
                            <p className="text-xs font-bold uppercase tracking-wider mb-8 text-slate-400">Generador de Lotes</p>
                            
                            <form onSubmit={(e) => { e.preventDefault(); handleGenerateStock(stockForm); }} className="space-y-5">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold ml-3 text-slate-400 uppercase">Plataforma</label>
                                    <div className="relative">
                                        <select 
                                            className={`w-full p-4 pl-4 rounded-2xl text-sm font-bold outline-none border focus:border-indigo-500 transition-all appearance-none ${theme.inputBg} ${theme.text}`}
                                            value={stockForm.service} 
                                            onChange={handleStockServiceChange}
                                        >
                                            <option value="">Seleccionar del catálogo...</option>
                                            {catalog.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold ml-3 text-slate-400 uppercase">Credenciales</label>
                                        <input type="email" required className={`w-full p-4 rounded-2xl text-sm font-medium outline-none border focus:border-indigo-500 transition-all ${theme.inputBg} ${theme.text}`} value={stockForm.email} onChange={e=>setStockForm({...stockForm, email:e.target.value})} placeholder="correo@ejemplo.com"/>
                                        <input className={`w-full p-4 mt-2 rounded-2xl text-sm font-medium outline-none border focus:border-indigo-500 transition-all ${theme.inputBg} ${theme.text}`} value={stockForm.pass} onChange={e=>setStockForm({...stockForm, pass:e.target.value})} placeholder="Contraseña"/>
                                    </div>

                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold ml-3 text-slate-400 uppercase">Perfiles / Slots</label>
                                        <div className={`p-4 h-32 rounded-2xl border flex flex-col items-center justify-center ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200'}`}>
                                            <input type="number" min="1" className={`bg-transparent text-4xl font-black text-center w-full outline-none ${darkMode ? 'text-indigo-400 placeholder-indigo-900' : 'text-indigo-600 placeholder-indigo-200'}`} value={stockForm.slots} onChange={e => { const val = parseInt(e.target.value); setStockForm({...stockForm, slots: isNaN(val) || val < 1 ? 1 : val}) }}/>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="submit" className={`w-full py-4 rounded-2xl font-bold text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-white ${darkMode ? 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20' : 'bg-slate-900 hover:bg-slate-800'}`}>
                                    <Zap size={18} className="text-yellow-400 fill-yellow-400"/> Generar Inventario
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

            ) : (
                <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-4">
                    <div className="flex gap-2 items-center">
                        <div className="relative flex-1 group">
                            <input type="text" placeholder="Buscar..." value={searchInventory} onChange={(e) => setSearchInventory(e.target.value)} className={`w-full p-3.5 pl-11 border rounded-[20px] text-sm font-bold outline-none shadow-sm focus:shadow-md transition-all ${theme.inputBg} ${theme.text} placeholder:text-slate-400`}/>
                            <Search size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        </div>
                        
                        <button onClick={() => setHideEmpty(!hideEmpty)} className={`h-[50px] w-[50px] rounded-[18px] flex items-center justify-center transition-all border ${hideEmpty ? 'bg-indigo-500 text-white border-indigo-500' : (darkMode ? 'bg-white/5 border-white/5 text-slate-400' : 'bg-white border-slate-200 text-slate-400')}`}>
                            {hideEmpty ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                        
                        <button onClick={handleExportCSV} className={`h-[50px] w-[50px] rounded-[18px] flex items-center justify-center transition-all border ${darkMode ? 'bg-white/5 border-white/5 text-emerald-400' : 'bg-white border-slate-200 text-emerald-600'}`}>
                            <Download size={20}/>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredAccounts.length > 0 ? (
                            filteredAccounts.map((acc, i) => <VaultCard key={`${acc.email}-${acc.service}-${i}`} acc={acc} index={i} />)
                        ) : (
                            <div className="col-span-full py-20 text-center opacity-50">
                                <Shield size={48} className="mx-auto mb-4 text-slate-400 opacity-20"/>
                                <p className="font-bold text-sm text-slate-400">Sin resultados</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockManager;