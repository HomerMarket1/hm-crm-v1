// src/views/StockManager.jsx
import React, { useState, useMemo } from 'react';
import { 
    Plus, Trash2, Search, Copy, Check, Shield, Zap, Box, 
    Layers, Mail, Lock, Settings, Eye, EyeOff, AlertTriangle,
    Download
} from 'lucide-react';

const StockManager = ({
    accountsInventory,      
    stockTab, 
    setStockTab, 
    stockForm, 
    setStockForm,
    catalog,
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
    
    // 🎨 TEMA DINÁMICO
    const theme = {
        card: darkMode ? 'bg-[#161B28] border-white/5' : 'bg-white/60 backdrop-blur-xl border-white/60',
        cardHover: darkMode ? 'hover:bg-[#1C2230]' : 'hover:shadow-xl',
        inputBg: darkMode ? 'bg-black/20 text-white placeholder-slate-500 caret-white' : 'bg-white/70 text-slate-700 placeholder-slate-400 caret-indigo-500',
        textPrimary: darkMode ? 'text-white' : 'text-slate-800',
        textSecondary: darkMode ? 'text-slate-400' : 'text-slate-500',
        textMuted: darkMode ? 'text-slate-500' : 'text-slate-400',
        iconContainer: darkMode ? 'bg-indigo-500/20 text-indigo-400' : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white',
        actionBtn: darkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-500 hover:text-white',
        deleteBtn: darkMode ? 'bg-white/5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400' : 'bg-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500',
        cleanBtn: darkMode ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-500 hover:text-white',
        itemBg: darkMode ? 'bg-black/20 border-white/5 hover:bg-white/5' : 'bg-white/50 border-white/50 hover:bg-white',
        progressBarBg: darkMode ? 'bg-white/10' : 'bg-slate-200',
        tabActive: darkMode ? 'bg-[#161B28] text-white shadow-md' : 'bg-white text-slate-900 shadow-md',
        tabInactive: darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:bg-white/40',
        formCard: darkMode ? 'bg-[#161B28] border-white/5' : 'bg-white/80 border-white/60',
        formInput: darkMode ? 'bg-black/20 border-white/5 text-white placeholder-slate-500 focus:border-indigo-500/50 caret-white' : 'bg-slate-100/50 border-slate-200/50 text-slate-700 placeholder-slate-300 focus:bg-white caret-indigo-500',
        numberInputBox: darkMode ? 'bg-black/20 border-white/5 text-indigo-400' : 'bg-indigo-50/50 border-indigo-100/50 text-indigo-600',
    };

    // --- LÓGICA EXPORTAR ---
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
        link.download = `Stock_Boveda_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    // --- FILTRADO INTELIGENTE ---
    const filteredAccounts = useMemo(() => {
        let result = accountsInventory;

        if (hideEmpty) {
            result = result.filter(acc => {
                const realFree = parseInt(acc.free) || 0;
                return realFree > 0;
            });
        }

        if (searchInventory) {
            const lowerSearch = searchInventory.toLowerCase();
            result = result.filter(acc => 
                acc.email.toLowerCase().includes(lowerSearch) ||
                acc.service.toLowerCase().includes(lowerSearch)
            );
        }
        return result;
    }, [accountsInventory, searchInventory, hideEmpty, catalog]);

    const handleCopy = (text, uniqueId) => {
        navigator.clipboard.writeText(text);
        setCopiedId(uniqueId);
        setTimeout(() => setCopiedId(null), 2000); 
    };

    // --- SUB-COMPONENTE: TARJETA DE BÓVEDA ---
    const VaultCard = ({ acc, index }) => {
        const catalogService = catalog.find(s => s.name === acc.service);
        
        // Priorizar DB sobre catálogo, pero respetar mínimos
        const dbTotal = parseInt(acc.total) || 0;
        const catalogTotal = catalogService ? parseInt(catalogService.defaultSlots) : 1;
        const realTotal = Math.max(dbTotal, catalogTotal);
        
        const realFree = parseInt(acc.free) || 0;
        const percentFree = realTotal > 0 ? Math.round((realFree / realTotal) * 100) : 0;
        
        const isCritical = realFree > 0 && realFree <= 2;
        
        let barColor = "bg-emerald-500 shadow-emerald-500/50";
        if (isCritical) barColor = "bg-rose-500 shadow-rose-500/50 animate-pulse";
        else if (percentFree < 50) barColor = "bg-amber-500 shadow-amber-500/50";
        if (percentFree === 0) barColor = darkMode ? "bg-slate-600" : "bg-slate-300";

        return (
            <div className={`group relative w-full p-5 border rounded-[24px] shadow-sm transition-all duration-300 ${theme.card} ${theme.cardHover} ${realFree === 0 ? 'opacity-60 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}>
                
                {isCritical && (
                    <div className="absolute -top-2 -right-2 bg-rose-500 text-white text-[9px] font-black px-2 py-1 rounded-full shadow-lg flex items-center gap-1 animate-bounce z-10">
                        <AlertTriangle size={10} className="fill-white"/> CRÍTICO
                    </div>
                )}

                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg ${theme.iconContainer}`}>
                            <Box size={18} />
                        </div>
                        <div>
                            <h3 className={`font-bold text-base leading-tight truncate w-32 md:w-40 ${theme.textPrimary}`} title={acc.service}>
                                {acc.service}
                            </h3>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${theme.textMuted}`}>Cuenta Madre</span>
                        </div>
                    </div>
                    
                    <div className="flex gap-1 items-center">
                        <button onClick={() => triggerEditAccount(acc)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${theme.actionBtn}`} title="Editar Contraseña">
                            <Settings size={14} /> 
                        </button>
                        {realFree > 0 && (
                            <button onClick={() => triggerDeleteFreeStock(acc.email, acc.pass)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${theme.cleanBtn}`} title={`Limpiar ${realFree} libres`}>
                                <Trash2 size={14} /> 
                            </button>
                        )}
                        <button onClick={() => triggerDeleteAccount(acc)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${theme.deleteBtn}`} title="Eliminar cuenta">
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                <div className="space-y-2 mb-5">
                    <button onClick={() => handleCopy(acc.email, `email-${index}`)} className={`w-full flex items-center justify-between p-3 rounded-xl border group/btn transition-all text-left ${theme.itemBg}`}>
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Mail size={14} className={theme.textMuted}/>
                            <span className={`text-xs font-semibold truncate ${theme.textSecondary}`}>{acc.email}</span>
                        </div>
                        <div className="text-indigo-500 opacity-0 group-hover/btn:opacity-100 transition-opacity scale-90">
                            {copiedId === `email-${index}` ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                        </div>
                    </button>

                    <div className="flex gap-2">
                        <button onClick={() => handleCopy(acc.pass, `pass-${index}`)} className={`flex-1 flex items-center justify-between p-3 rounded-xl border group/btn transition-all text-left ${theme.itemBg}`}>
                            <div className="flex items-center gap-2">
                                <Lock size={14} className={theme.textMuted}/>
                                <span className={`text-xs font-mono ${theme.textSecondary}`}>••••••••</span>
                            </div>
                            <div className="text-indigo-500 opacity-0 group-hover/btn:opacity-100 transition-opacity scale-90">
                                {copiedId === `pass-${index}` ? <Check size={14} className="text-emerald-500"/> : <Copy size={14}/>}
                            </div>
                        </button>
                        <div className={`px-3 py-2 rounded-xl flex items-center justify-center border ${theme.itemBg}`}>
                            <span className={`text-[10px] font-black ${theme.textMuted}`}>#{index + 1}</span>
                        </div>
                    </div>
                </div>

                <div className={`rounded-2xl p-3 border ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-100/50 border-slate-200/50'}`}>
                    <div className="flex justify-between items-end mb-2">
                        <div className={`text-xs font-bold ${theme.textMuted}`}>Disponibilidad</div>
                        <div className="text-right">
                            <span className={`text-lg font-black ${realFree === 0 ? theme.textMuted : theme.textPrimary}`}>{realFree}</span>
                            <span className={`text-[10px] font-bold ${theme.textMuted}`}> / {realTotal}</span>
                        </div>
                    </div>
                    <div className={`w-full h-2 rounded-full overflow-hidden ${theme.progressBarBg}`}>
                        <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${percentFree}%` }}/>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="w-full pb-32 space-y-6">
            <style>{`
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 20px; border: 3px solid transparent; background-clip: content-box; }
                *:hover::-webkit-scrollbar-thumb { background-color: ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'}; }
            `}</style>

            {/* TABS HEADER */}
            <div className={`sticky top-0 z-30 backdrop-blur-xl py-2 -mx-1 px-1 ${darkMode ? 'bg-[#0B0F19]/80' : 'bg-[#F2F2F7]/80'}`}>
                <div className={`backdrop-blur-md p-1.5 rounded-2xl border shadow-sm flex gap-1 ${darkMode ? 'bg-[#161B28]/60 border-white/10' : 'bg-white/60 border-white/50'}`}>
                    <button onClick={() => setStockTab('manage')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${stockTab === 'manage' ? theme.tabActive : theme.tabInactive}`}>
                        <Layers size={14}/> Bóveda ({filteredAccounts.length})
                    </button>
                    <button onClick={() => setStockTab('add')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-bold transition-all ${stockTab === 'add' ? theme.tabActive : theme.tabInactive}`}>
                        <Plus size={14}/> Nuevo Ingreso
                    </button>
                </div>
            </div>

            {stockTab === 'add' ? (
                // --- VISTA: AGREGAR STOCK (LIMPIA) ---
                <div className="animate-in slide-in-from-bottom-4 duration-300">
                    <div className={`w-full backdrop-blur-xl p-6 md:p-8 rounded-[32px] shadow-2xl border relative overflow-hidden ${theme.formCard}`}>
                        {/* Decoración */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -mr-10 -mt-10"/>
                        
                        <div className="relative z-10">
                            <h2 className={`text-2xl font-black mb-1 tracking-tight ${theme.textPrimary}`}>Ingresar Cuenta</h2>
                            <p className={`text-xs font-bold uppercase tracking-wider mb-8 ${theme.textMuted}`}>Generador de Lotes</p>
                            
                            <form onSubmit={(e) => { e.preventDefault(); handleGenerateStock(stockForm); }} className="space-y-5">
                                <div className="space-y-1">
                                    <label className={`text-xs font-bold ml-3 ${theme.textSecondary}`}>Plataforma</label>
                                    <div className="relative">
                                        <select 
                                            className={`w-full p-4 pl-5 rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20 appearance-none transition-all ${theme.formInput}`}
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
                                        <label className={`text-xs font-bold ml-3 ${theme.textSecondary}`}>Credenciales</label>
                                        <input type="email" required className={`w-full p-4 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all ${theme.formInput}`} value={stockForm.email} onChange={e=>setStockForm({...stockForm, email:e.target.value})} placeholder="correo@ejemplo.com"/>
                                        <input className={`w-full p-4 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all mt-2 ${theme.formInput}`} value={stockForm.pass} onChange={e=>setStockForm({...stockForm, pass:e.target.value})} placeholder="Contraseña"/>
                                    </div>

                                    <div className="space-y-1">
                                        <label className={`text-xs font-bold ml-3 ${theme.textSecondary}`}>Capacidad</label>
                                        <div className={`p-4 rounded-2xl border flex flex-col items-center justify-center h-full ${theme.numberInputBox}`}>
                                            <input type="number" min="1" className={`bg-transparent text-4xl font-black text-center w-full outline-none ${darkMode ? 'text-indigo-400 placeholder-indigo-900 caret-indigo-400' : 'text-indigo-600 placeholder-indigo-200 caret-indigo-500'}`} value={stockForm.slots} onChange={e => { const val = parseInt(e.target.value); setStockForm({...stockForm, slots: isNaN(val) || val < 1 ? 1 : val}) }}/>
                                        </div>
                                    </div>
                                </div>
                                
                                <button type="submit" className={`w-full py-4 text-white rounded-2xl font-bold text-sm shadow-xl hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2 ${darkMode ? 'bg-black border border-white/10' : 'bg-slate-900'}`}>
                                    <Zap size={18} className="text-yellow-400 fill-yellow-400"/> Generar Inventario
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

            ) : (
                // --- VISTA: GESTIÓN DE BÓVEDA ---
                <div className="animate-in slide-in-from-bottom-4 duration-300 space-y-4">
                    <div className="flex gap-2 items-center">
                        <div className="relative flex-1">
                            <input type="text" placeholder="Buscar en la bóveda..." value={searchInventory} onChange={(e) => setSearchInventory(e.target.value)} className={`w-full p-4 pl-12 backdrop-blur-xl border-none rounded-[20px] text-sm font-bold outline-none shadow-sm focus:shadow-lg transition-all ${theme.inputBg}`}/>
                            <Search size={18} className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400" />
                        </div>
                        
                        {/* BOTONES DE HERRAMIENTAS */}
                        <button 
                            onClick={() => setHideEmpty(!hideEmpty)} 
                            className={`h-[52px] w-[52px] rounded-[20px] flex items-center justify-center transition-all ${hideEmpty ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : (darkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-white text-slate-400 hover:bg-slate-100')}`} 
                            title={hideEmpty ? "Mostrar Todo" : "Ocultar Vacíos"}
                        >
                            {hideEmpty ? <EyeOff size={20}/> : <Eye size={20}/>}
                        </button>
                        
                        <button onClick={handleExportCSV} className={`h-[52px] w-[52px] rounded-[20px] flex items-center justify-center transition-all ${darkMode ? 'bg-white/5 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white text-emerald-600 hover:bg-emerald-50'}`} title="Descargar Stock">
                            <Download size={20}/>
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredAccounts.length > 0 ? (
                            filteredAccounts.map((acc, i) => <VaultCard key={`${acc.email}-${acc.service}-${i}`} acc={acc} index={i} />)
                        ) : (
                            <div className="col-span-full py-20 text-center">
                                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${darkMode ? 'bg-white/5 text-slate-500' : 'bg-slate-100 text-slate-300'}`}>
                                    <Shield size={32}/>
                                </div>
                                <p className={`font-bold text-sm ${theme.textMuted}`}>
                                    {hideEmpty ? 'Cuentas vacías ocultas' : 'Bóveda vacía o sin resultados'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockManager;