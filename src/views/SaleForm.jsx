import React, { useMemo, useEffect, useState } from 'react';
import { Copy, Package, User, Smartphone, DollarSign, Layers, X, Save, CheckCircle2, Database, Lock, Star, History, Link as LinkIcon } from 'lucide-react';
import AppleCalendar from '../components/AppleCalendar';

// ✅ HELPER PARA CATEGORIZAR SERVICIOS
const getServiceCategory = (serviceName) => {
    if (!serviceName) return 'UNKNOWN';
    const lower = serviceName.toLowerCase();

    // 1. Separación estricta para Disney
    if (lower.includes('disney') && lower.includes('basico')) return 'DISNEY_BASICO';
    if (lower.includes('disney') && lower.includes('vivo')) return 'DISNEY_VIVO';
    
    // 2. Si es Disney pero no especifica, es GENÉRICO
    if (lower.includes('disney')) return 'DISNEY_GENERICO';

    // 3. Reglas generales
    const keywords = {
        'Netflix': 'Netflix', 
        'Max': ['max', 'hbo'],
        'Prime': ['prime', 'amazon'], 
        'Paramount': 'Paramount',
        'Crunchyroll': 'Crunchyroll', 
        'Vix': 'Vix', 
        'Plex': 'Plex',
        'IPTV': 'IPTV', 
        'Magis': 'Magis'
    };

    for (const [key, val] of Object.entries(keywords)) {
        if (Array.isArray(val)) { 
            if (val.some(v => lower.includes(v))) return key; 
        } else { 
            if (lower.includes(val.toLowerCase())) return key; 
        }
    }
    return serviceName.split(' ')[0];
};

const SaleForm = ({
    formData, setFormData,
    bulkProfiles, setBulkProfiles,
    maxAvailableSlots = [], 
    handleClientNameChange,
    handleBulkProfileChange,
    handleSingleProfileChange,
    handleSaveSale,
    setView,
    resetForm,
    catalog = [],
    getClientPreviousProfiles = [], 
    darkMode 
}) => {

    const [stockMode, setStockMode] = useState(false);

    // ✅ HELPER MAESTRO
    const isClientFree = (clientName) => {
        if (!clientName) return true;
        const name = clientName.toString().trim().toLowerCase();
        return name === '' || name === 'libre' || name === 'espacio libre' || name === 'disponible';
    };

    const isNewSale = isClientFree(formData.client) || !formData.id;
    const isEditingStock = formData.id && isClientFree(formData.client);

    // Limpiar nombre al abrir si es Cuenta Completa
    useEffect(() => {
        if (!stockMode && formData.profile === 'Cuenta Completa') {
            setFormData(prev => ({ ...prev, profile: '' }));
        }
    }, [formData.id, stockMode]);

    // 🔥 PRECIO VISUAL (CALCULADORA)
    const qty = parseInt(formData.profilesToBuy || 1);
    const unitPrice = Number(formData.cost) || 0;
    
    const isNamePackage = formData.service.toLowerCase().includes('paquete');
    const isNameAccount = formData.service.toLowerCase().includes('cuenta completa');
    const visualTotal = (!isNamePackage && !isNameAccount && qty > 1) ? (unitPrice * qty) : unitPrice;

    // LÓGICA DE PRECIOS AUTOMÁTICA
    useEffect(() => {
        if (isNewSale && formData.service && catalog.length > 0 && !stockMode) {
            const catalogItem = catalog.find(c => c.name === formData.service);
            if (catalogItem) {
                const costToSet = parseInt(catalogItem.cost) || 0;
                if (parseInt(formData.cost) !== costToSet) {
                    setFormData(prev => ({ ...prev, cost: costToSet }));
                }
            }
        }
    }, [formData.service, catalog, formData.client, formData.id, stockMode]);

    // FILTRO DE STOCK
    const freeSlotsInThisAccount = useMemo(() => {
        const safeSlots = Array.isArray(maxAvailableSlots) ? maxAvailableSlots : [];
        const normalize = (text) => text ? text.toString().trim().toLowerCase() : '';
        const currentCategory = getServiceCategory(formData.service); 
        const currentEmail = normalize(formData.email);
        
        // Match flexible: Si soy "Disney Generico", acepto cualquier cosa que sea Disney
        const matchesCategory = (slotService) => {
            const slotCat = getServiceCategory(slotService);
            if (currentCategory === 'DISNEY_GENERICO') return slotCat.includes('DISNEY');
            return slotCat === currentCategory;
        };

        if (formData.email) {
            return safeSlots.filter(s => 
                matchesCategory(s.service) && 
                normalize(s.email) === currentEmail &&
                isClientFree(s.client)
            );
        }
        return safeSlots.filter(s => matchesCategory(s.service) && isClientFree(s.client));
    }, [maxAvailableSlots, formData.service, formData.email]);

    // 🔥 CORRECCIÓN DEL DESPLEGABLE (FILTRO DE CATÁLOGO) 🔥
    const filteredConversionCatalog = useMemo(() => {
        if (!catalog.length) return [];
        
        const currentCat = getServiceCategory(formData.service);

        return catalog.filter(s => {
            // Si es el mismo ítem, lo ocultamos
            if (s.name === formData.service) return false;

            const itemCat = getServiceCategory(s.name);

            // 1. Coincidencia exacta (Ej: Disney Basico -> Disney Basico Paquete)
            if (currentCat === itemCat) return true;

            // 2. EXCEPCIÓN: Si estoy en "Disney" (Genérico), muéstrame TODO lo de Disney (Básico y Vivo)
            // para que pueda elegir a cuál cambiarme.
            if (currentCat === 'DISNEY_GENERICO' && (itemCat === 'DISNEY_BASICO' || itemCat === 'DISNEY_VIVO')) {
                return true;
            }

            return false;
        });
    }, [catalog, formData.service]);

    // DETECTAR PERFIL FAVORITO
    const favoriteProfile = useMemo(() => {
        if (!formData.client || isClientFree(formData.client)) return null;
        const match = getClientPreviousProfiles.find(p => p.profile && p.pin);
        return match || null;
    }, [formData.client, getClientPreviousProfiles]);

    const EXEMPT_STATUSES = ['Admin', 'Actualizar', 'Caída', 'Dominio', 'EXPIRED', 'Vencido', 'Problemas', 'Garantía'];
    const isExempt = useMemo(() => {
        if (!formData.client) return false;
        return EXEMPT_STATUSES.some(status => formData.client.trim().toLowerCase() === status.toLowerCase());
    }, [formData.client]);

    const handleQuantityClick = (num) => {
        if (isNewSale && num > freeSlotsInThisAccount.length) return;
        setFormData({ ...formData, profilesToBuy: num });
    };

    const handleQuickSelectSlot = (slot) => {
        const qty = parseInt(formData.profilesToBuy || 1);
        if (qty > 1) {
            setBulkProfiles(prev => {
                const newBulk = [...prev];
                const emptyIndex = newBulk.findIndex(p => !p.profile || p.profile === '');
                if (emptyIndex !== -1) {
                    newBulk[emptyIndex] = { profile: slot.profile || '', pin: slot.pin || '' };
                }
                return newBulk;
            });
        } else {
            setFormData(prev => ({ ...prev, profile: slot.profile || '', pin: slot.pin || '' }));
        }
    };

    const handleUseHistoryData = (historyItem) => {
        setFormData(prev => ({ ...prev, profile: historyItem.profile, pin: historyItem.pin }));
    };

    const toggleStockMode = () => {
        if (!stockMode) {
            setStockMode(true);
            setFormData(prev => ({ ...prev, client: 'LIBRE' }));
        } else {
            setStockMode(false);
            setFormData(prev => ({ ...prev, client: '' }));
        }
    };

    const copyCredentials = (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(`${formData.email}:${formData.pass}`);
        const btn = e.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="text-emerald-500 font-black tracking-tight">¡Copiado!</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 1500);
    };

    const theme = {
        bg: darkMode ? 'bg-[#161B28]' : 'bg-white',
        text: darkMode ? 'text-white' : 'text-slate-900',
        subtext: darkMode ? 'text-slate-400' : 'text-slate-500',
        inputBg: darkMode ? 'bg-black/40' : 'bg-slate-50',
        border: darkMode ? 'border-white/10' : 'border-slate-100',
        focusRing: 'focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.4)]',
        iconColor: 'text-slate-400',
        sectionBg: darkMode ? 'bg-white/5' : 'bg-slate-50',
        activeChip: darkMode ? 'bg-[#2A303C] text-white shadow-sm ring-1 ring-white/10' : 'bg-white text-indigo-600 shadow-sm',
        disabledChip: darkMode ? 'bg-white/5 text-slate-600 cursor-not-allowed' : 'bg-slate-100 text-slate-300 cursor-not-allowed'
    };
    
    // 🔥 ACTUALIZADA: Clase con Focus Glow
    const INPUT_CLASS = `w-full h-11 pl-10 pr-4 rounded-xl text-xs font-bold outline-none border transition-all ${theme.inputBg} ${theme.border} ${theme.text} ${theme.focusRing} placeholder:font-medium placeholder:text-slate-500`;
    const ICON_CLASS = `absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-indigo-500 ${theme.iconColor}`;

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full md:max-w-lg h-[85dvh] md:h-auto md:max-h-[95vh] rounded-t-[2rem] md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ${theme.bg}`}>
                
                {/* HEADER */}
                <div className={`px-5 py-3 border-b z-10 flex flex-col gap-2 ${theme.border}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className={`text-xl font-black tracking-tight leading-none ${theme.text}`}>
                                {stockMode ? 'Actualizar Stock' : (isNewSale ? 'Nueva Venta' : 'Editar Venta')}
                            </h2>
                            <p className={`text-[10px] font-bold uppercase tracking-wider mt-0.5 opacity-80 ${theme.subtext}`}>
                                {formData.service}
                                {(isNamePackage || isNameAccount) && <span className="ml-2 text-indigo-500 bg-indigo-500/10 px-1 rounded">Precio Total</span>}
                            </p>
                        </div>
                        <button onClick={()=>{setView('dashboard'); resetForm();}} className={`p-1.5 rounded-full transition-colors ${darkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
                            <X size={18} />
                        </button>
                    </div>

                    <button onClick={copyCredentials} className={`w-full py-1.5 px-3 rounded-xl flex items-center justify-between text-[11px] font-bold active:scale-95 transition-transform border ${darkMode ? 'bg-black/40 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        <span className="font-mono truncate flex-1 text-left">{formData.email}</span>
                        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                            <span className="font-mono tracking-widest">••••••</span>
                            <Copy size={12} className="text-indigo-500"/>
                        </div>
                    </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3 custom-scrollbar">
                    <form id="sale-form" onSubmit={handleSaveSale} className="space-y-3">
                        
                        {/* 1. SELECTOR CANTIDAD Y STOCK */}
                        {(isNewSale || formData.id) && (
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <label className={`text-[10px] font-bold uppercase tracking-wider ml-1 ${theme.subtext}`}>Cantidad</label>
                                    {isNewSale && (
                                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-md border ${freeSlotsInThisAccount.length === 0 ? 'text-red-500 bg-red-500/10 border-red-500/20' : 'text-amber-500 bg-amber-500/10 border-amber-500/20'}`}>
                                            {freeSlotsInThisAccount.length} libres
                                        </span>
                                    )}
                                </div>

                                <div className={`flex p-1 rounded-xl gap-1 ${darkMode ? 'bg-black/40' : 'bg-slate-100'}`}>
                                    {[1,2,3,4,5].map(num => {
                                        const availableCount = freeSlotsInThisAccount.length;
                                        const isDisabled = isNewSale && num > availableCount;
                                        const isActive = parseInt(formData.profilesToBuy) === num;
                                        return (
                                            <button key={num} type="button" onClick={() => handleQuantityClick(num)} disabled={isDisabled || stockMode}
                                                className={`flex-1 h-8 rounded-lg text-xs font-black transition-all ${isDisabled || stockMode ? theme.disabledChip : (isActive ? theme.activeChip : 'text-slate-500 hover:text-slate-400')}`}>{num}</button>
                                        );
                                    })}
                                </div>
                                
                                {freeSlotsInThisAccount.length > 0 && isNewSale && (
                                    <div className={`p-2 rounded-xl border transition-colors ${darkMode ? 'bg-emerald-500/5 border-emerald-500/10 hover:border-emerald-500/30' : 'bg-emerald-50/50 border-emerald-100 hover:border-emerald-300'}`}>
                                        <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                                            {freeSlotsInThisAccount.slice(0, 5).map((slot, i) => {
                                                const qty = parseInt(formData.profilesToBuy || 1);
                                                const isSelected = qty > 1 ? bulkProfiles.some(p => p.profile === slot.profile && p.profile !== '') : formData.profile === slot.profile && formData.profile !== '';
                                                const isFavorite = favoriteProfile && slot.profile === favoriteProfile.profile;
                                                return (
                                                    <button key={i} type="button" onClick={() => handleQuickSelectSlot(slot)} className={`flex-shrink-0 p-1.5 px-2 rounded-lg border w-28 text-left transition-all active:scale-95 group relative ${isSelected ? (darkMode ? 'bg-emerald-500/20 border-emerald-500 ring-1 ring-emerald-500' : 'bg-emerald-100 border-emerald-500 ring-1 ring-emerald-500') : (isFavorite ? (darkMode ? 'bg-amber-500/10 border-amber-500/50 ring-1 ring-amber-500/30' : 'bg-amber-50 border-amber-200 ring-1 ring-amber-300') : (darkMode ? 'bg-[#0B0F19] border-white/10 hover:bg-emerald-900/20' : 'bg-white border-slate-200 hover:bg-emerald-50'))}`}>
                                                        {isSelected && <div className="absolute top-1 right-1 text-emerald-500"><CheckCircle2 size={10} fill="currentColor" className={darkMode ? "text-emerald-900" : "text-white"}/></div>}
                                                        {isFavorite && !isSelected && <div className="absolute top-1 right-1 text-amber-400"><Star size={10} fill="currentColor"/></div>}
                                                        <div className={`text-[9px] font-bold truncate transition-colors ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : (isFavorite ? 'text-amber-500' : theme.text)}`}>{slot.profile || 'Sin Nombre'}</div>
                                                        <div className={`text-[9px] font-mono opacity-60 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>PIN: {slot.pin || '--'}</div>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {isEditingStock && (
                                    <div className="flex justify-end pt-1">
                                        <button type="button" onClick={toggleStockMode} className={`text-[10px] font-bold px-2 py-1 rounded-md flex items-center gap-1 active:scale-95 transition-all border ${stockMode ? 'bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/30' : 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20'}`}>
                                            {stockMode ? <CheckCircle2 size={12}/> : <Database size={12}/>} {stockMode ? 'Modo Stock Activado' : 'Solo guardar datos'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. DATOS DEL CLIENTE */}
                        <div className="space-y-2">
                            <div className="relative group">
                                {stockMode ? <Lock size={16} className={ICON_CLASS}/> : <User size={16} className={ICON_CLASS}/>}
                                <input list="clients-suggestions" className={`${INPUT_CLASS} ${stockMode ? 'opacity-50 cursor-not-allowed' : ''}`} value={stockMode ? 'LIBRE' : (isNewSale ? '' : formData.client)} onChange={handleClientNameChange} placeholder="Nombre del Cliente" disabled={stockMode} autoFocus={!stockMode} required />
                            </div>
                            
                            {!stockMode && isNewSale && favoriteProfile && !formData.profile && (
                                <button type="button" onClick={() => handleUseHistoryData(favoriteProfile)} className={`w-full flex items-center gap-2 p-2 rounded-lg border text-[10px] animate-in fade-in slide-in-from-top-2 ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20' : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100'}`}>
                                    <History size={12}/>
                                    <span>Rotación: Usar <b>{favoriteProfile.profile}</b> (PIN: {favoriteProfile.pin})</span>
                                </button>
                            )}

                            {!stockMode && (
                                <div className="space-y-2">
                                    <div className="relative group">
                                        <Smartphone size={16} className={ICON_CLASS}/>
                                        <input type="tel" className={INPUT_CLASS} value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} placeholder="WhatsApp (Opcional)"/>
                                    </div>
                                    <div className="relative group animate-in slide-in-from-top-1">
                                        <div className={`absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${theme.iconColor}`}>
                                            <LinkIcon size={16}/>
                                        </div>
                                        <input className={INPUT_CLASS} value={formData.lastCode || ''} onChange={e => setFormData({...formData, lastCode: e.target.value})} placeholder="Pegar Enlace Netflix Aquí"/>
                                        <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600'}`}>Info Cliente</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 3. FECHA Y PRECIO CON CALCULADORA */}
                        {!stockMode && (
                            <div className="grid grid-cols-2 gap-2 items-start">
                                <div className="w-full">
                                    <AppleCalendar value={formData.endDate} onChange={(newDate) => setFormData({...formData, endDate: newDate})} label="Vencimiento" darkMode={darkMode} />
                                </div>
                                <div className="space-y-1">
                                    <label className={`text-[10px] font-bold uppercase tracking-wider ml-1 ${theme.subtext}`}>
                                        {(isNamePackage || isNameAccount) ? 'Precio Total' : 'Precio Unitario'}
                                    </label>
                                    <div className="relative group">
                                        <DollarSign size={14} className={ICON_CLASS}/>
                                        <input type="number" className={INPUT_CLASS} value={formData.cost} onChange={e=>setFormData({...formData, cost:e.target.value})} placeholder="0.00" required={!isExempt} />
                                    </div>
                                    
                                    {!isNamePackage && !isNameAccount && qty > 1 && unitPrice > 0 && (
                                         <p className={`text-[10px] text-right font-bold ${darkMode ? 'text-emerald-400' : 'text-emerald-600'} animate-in slide-in-from-top-1`}>
                                            Total: ${visualTotal} ({qty} x ${unitPrice})
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 4. PERFILES */}
                        <div className={`rounded-xl p-3 border ${theme.sectionBg} ${theme.border}`}>
                            <div className="flex items-center gap-2 mb-2">
                                <Layers size={14} className="text-indigo-500"/>
                                <span className={`text-[10px] font-black uppercase ${theme.text}`}>{parseInt(formData.profilesToBuy) > 1 ? `Asignar ${formData.profilesToBuy} Perfiles` : 'Datos del Perfil'}</span>
                            </div>
                            <div className="space-y-2">
                                {(parseInt(formData.profilesToBuy) > 1 ? bulkProfiles : [bulkProfiles[0] || {profile: formData.profile, pin: formData.pin}]).map((p, i) => (
                                    <div key={i} className="flex gap-2 animate-in slide-in-from-left-2" style={{animationDelay: `${i*50}ms`}}>
                                        {/* 🔥 Focus Glow aplicado aquí también */}
                                        <input className={`flex-1 p-2.5 rounded-lg text-xs font-bold outline-none border focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all ${theme.inputBg} ${theme.border} ${theme.text} placeholder:text-slate-500`} placeholder={`Nombre Perfil ${i+1}`} value={parseInt(formData.profilesToBuy) > 1 ? p.profile : formData.profile} onChange={(e) => parseInt(formData.profilesToBuy) > 1 ? handleBulkProfileChange(i, 'profile', e.target.value) : handleSingleProfileChange(e.target.value)} list="suggested-profiles"/>
                                        <input className={`w-16 p-2.5 text-center rounded-lg text-xs font-mono font-bold outline-none border focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all ${theme.inputBg} ${theme.border} ${theme.text} placeholder:text-slate-500`} placeholder="PIN" value={parseInt(formData.profilesToBuy) > 1 ? p.pin : formData.pin} onChange={(e) => parseInt(formData.profilesToBuy) > 1 ? handleBulkProfileChange(i, 'pin', e.target.value) : setFormData({...formData, pin: e.target.value})}/>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 5. MIGRACIÓN DE SERVICIO (CORREGIDA) */}
                        {!stockMode && filteredConversionCatalog.length > 0 && (
                            <div className={`p-3 rounded-xl border ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-100/50'}`}>
                                <label className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase mb-1"><Package size={12}/> Cambiar Plan</label>
                                <div className="relative">
                                    {/* 🔥 Focus Glow en el Selector */}
                                    <select className={`w-full p-2.5 rounded-lg text-[10px] font-bold outline-none border transition-all focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.4)] appearance-none cursor-pointer ${darkMode ? 'bg-[#0B0F19] border-white/10 text-indigo-300' : 'bg-white border-indigo-100 text-indigo-900'}`} onChange={(e) => { const selected = catalog.find(s => s.name === e.target.value); if (selected) setFormData(prev => ({ ...prev, service: selected.name, cost: selected.cost, profilesToBuy: selected.defaultSlots })); }} value={formData.service}>
                                        <option value={formData.service}>{formData.service} (Actual)</option>
                                        <option disabled>──────────</option>
                                        {filteredConversionCatalog.map(item => <option key={item.id} value={item.name}>{item.name} - ${item.cost}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="h-2"></div>
                    </form>
                </div>

                {/* FOOTER */}
                <div className={`p-4 border-t flex gap-3 pb-8 md:pb-4 ${darkMode ? 'bg-[#161B28] border-white/10' : 'bg-white border-slate-100'}`}>
                    <button type="button" onClick={()=>{setView('dashboard'); resetForm();}} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-colors ${darkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>Cancelar</button>
                    <button type="submit" form="sale-form" className={`flex-[2] py-3 rounded-xl font-black text-xs shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-white ${darkMode ? 'bg-black border border-white/20 hover:bg-white/5 shadow-black/50' : 'bg-slate-900 shadow-slate-900/20 hover:bg-slate-800'}`}>
                        <Save size={16} className="text-emerald-400"/> 
                        {stockMode ? 'Guardar Cambios' : `Guardar Venta ($${visualTotal})`}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaleForm;