// src/views/SaleForm.jsx
import React, { useMemo, useEffect } from 'react';
import { Copy, Package, User, Smartphone, DollarSign, Layers, X, Save, CheckCircle2 } from 'lucide-react';
import AppleCalendar from '../components/AppleCalendar';

// Helper local para categorizar servicios
const getServiceCategory = (serviceName) => {
    if (!serviceName) return 'UNKNOWN';
    const lower = serviceName.toLowerCase();
    const keywords = {
        'Netflix': 'Netflix', 'Disney': 'Disney', 'Max': ['max', 'hbo'],
        'Prime': ['prime', 'amazon'], 'Paramount': 'Paramount',
        'Crunchyroll': 'Crunchyroll', 'Vix': 'Vix', 'Plex': 'Plex',
        'IPTV': 'IPTV', 'Magis': 'Magis'
    };
    for (const [key, val] of Object.entries(keywords)) {
        if (Array.isArray(val)) { if (val.some(v => lower.includes(v))) return key; }
        else { if (lower.includes(val.toLowerCase())) return key; }
    }
    return serviceName.split(' ')[0];
};

const SaleForm = ({
    formData, setFormData,
    bulkProfiles, setBulkProfiles,
    maxAvailableSlots = [], // ✅ BLINDAJE 1: Valor por defecto para evitar crash
    handleClientNameChange,
    handleBulkProfileChange,
    handleSingleProfileChange,
    handleSaveSale,
    setView,
    resetForm,
    catalog = [],
    darkMode 
}) => {

    // 🧠 LÓGICA INTELIGENTE: Calculadora de Precio Automática
    useEffect(() => {
        if ((formData.client === 'LIBRE' || !formData.id) && formData.service && catalog.length > 0) {
            const catalogItem = catalog.find(c => c.name === formData.service);
            
            if (catalogItem) {
                const qty = parseInt(formData.profilesToBuy || 1);
                const totalCost = (parseInt(catalogItem.cost) || 0) * qty;
                
                if (parseInt(formData.cost) !== totalCost) {
                    setFormData(prev => ({ ...prev, cost: totalCost }));
                }
            }
        }
    }, [formData.service, formData.profilesToBuy, catalog, formData.client, formData.id]);

    // 🎨 TEMA UNIFICADO
    const theme = {
        bg: darkMode ? 'bg-[#161B28]' : 'bg-white',
        text: darkMode ? 'text-white' : 'text-slate-900',
        subtext: darkMode ? 'text-slate-400' : 'text-slate-500',
        inputBg: darkMode ? 'bg-black/40' : 'bg-slate-50',
        border: darkMode ? 'border-white/10' : 'border-slate-100',
        focusRing: 'focus:ring-2 focus:ring-indigo-500/50',
        iconColor: 'text-slate-400',
        sectionBg: darkMode ? 'bg-white/5' : 'bg-slate-50',
        activeChip: darkMode ? 'bg-[#2A303C] text-white shadow-sm ring-1 ring-white/10' : 'bg-white text-indigo-600 shadow-sm'
    };

    const INPUT_CLASS = `w-full h-12 pl-11 pr-4 rounded-xl text-sm font-bold outline-none border transition-all ${theme.inputBg} ${theme.border} ${theme.text} ${theme.focusRing} placeholder:font-medium placeholder:text-slate-500`;
    const ICON_CLASS = `absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-indigo-500 ${theme.iconColor}`;

    // Lógica de Negocio
    const baseService = getServiceCategory(formData.service);
    
    // Filtrar servicios compatibles
    const filteredConversionCatalog = useMemo(() => {
        if (!catalog.length) return [];
        return catalog.filter(s => {
            const cat = getServiceCategory(s.name);
            return (cat === baseService && s.name !== formData.service);
        });
    }, [catalog, baseService, formData.service]); 

    // ✅ BLINDAJE 2: Filtrar slots libres con seguridad
    const freeSlots = useMemo(() => {
        // Aseguramos que sea un array antes de filtrar
        const safeSlots = Array.isArray(maxAvailableSlots) ? maxAvailableSlots : [];
        
        return formData.service 
            ? safeSlots.filter(s => s.service === formData.service && s.client === 'LIBRE')
            : [];
    }, [maxAvailableSlots, formData.service]);

    // Clientes exentos
    const EXEMPT_STATUSES = ['Admin', 'Actualizar', 'Caída', 'Dominio', 'EXPIRED', 'Vencido', 'Problemas', 'Garantía'];
    const isExempt = useMemo(() => {
        if (!formData.client) return false;
        return EXEMPT_STATUSES.some(status => formData.client.trim().toLowerCase() === status.toLowerCase());
    }, [formData.client]);

    const handleQuantityClick = (num) => {
        setFormData({ ...formData, profilesToBuy: num });
    };

    const copyCredentials = (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(`${formData.email}:${formData.pass}`);
        const btn = e.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="text-emerald-500 font-black tracking-tight">¡Copiado!</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 1500);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className={`w-full md:max-w-lg h-[85dvh] md:h-auto md:max-h-[90vh] rounded-t-[2rem] md:rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ${theme.bg}`}>
                
                {/* HEADER */}
                <div className={`px-5 py-4 border-b z-10 flex flex-col gap-3 ${theme.border}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className={`text-2xl font-black tracking-tight leading-none ${theme.text}`}>
                                {formData.client === 'LIBRE' ? 'Nueva Venta' : 'Editar Venta'}
                            </h2>
                            <p className={`text-xs font-bold uppercase tracking-wider mt-1 opacity-80 ${theme.subtext}`}>
                                {formData.service}
                            </p>
                        </div>
                        <button onClick={()=>{setView('dashboard'); resetForm();}} className={`p-2 rounded-full transition-colors ${darkMode ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Credenciales Rapidas */}
                    <button onClick={copyCredentials} className={`w-full py-2 px-3 rounded-xl flex items-center justify-between text-xs font-bold active:scale-95 transition-transform border ${darkMode ? 'bg-black/40 border-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                        <span className="font-mono truncate flex-1 text-left">{formData.email}</span>
                        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                            <span className="font-mono tracking-widest">••••••</span>
                            <Copy size={12} className="text-indigo-500"/>
                        </div>
                    </button>
                </div>

                {/* BODY SCROLLABLE */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 custom-scrollbar">
                    <form id="sale-form" onSubmit={handleSaveSale} className="space-y-6">
                        
                        {/* 1. SELECTOR CANTIDAD Y VISOR STOCK */}
                        {(formData.client === 'LIBRE' || formData.id) && (
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className={`text-[10px] font-bold uppercase tracking-wider ml-1 ${theme.subtext}`}>Cantidad de Perfiles</label>
                                    <div className={`flex p-1 rounded-xl gap-1 ${darkMode ? 'bg-black/40' : 'bg-slate-100'}`}>
                                        {[1,2,3,4,5].map(num => {
                                            const availableCount = freeSlots.length; // Usamos freeSlots que ya está filtrado
                                            // Solo deshabilitamos si es venta nueva (LIBRE) y pedimos más de lo que hay
                                            // IMPORTANTE: Si estamos editando (id existe), no limitamos por stock libre
                                            const isDisabled = formData.client === 'LIBRE' && num > availableCount && availableCount > 0;
                                            
                                            const isActive = parseInt(formData.profilesToBuy) === num;
                                            return (
                                                <button key={num} type="button" onClick={() => handleQuantityClick(num)} 
                                                    className={`flex-1 h-9 rounded-lg text-sm font-black transition-all 
                                                    ${isActive ? theme.activeChip : 'text-slate-500 hover:text-slate-400'}`}>
                                                    {num}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 👁️ VISUALIZADOR DE SLOTS LIBRES */}
                                {freeSlots.length > 0 && formData.client === 'LIBRE' && (
                                    <div className={`p-3 rounded-2xl border ${darkMode ? 'bg-emerald-500/5 border-emerald-500/10' : 'bg-emerald-50/50 border-emerald-100'}`}>
                                        <p className="text-[10px] font-bold text-emerald-500 uppercase mb-2 flex items-center gap-1.5"><CheckCircle2 size={12}/> Disponibles en esta cuenta:</p>
                                        <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                                            {freeSlots.slice(0, 5).map((slot, i) => (
                                                <div key={i} className={`flex-shrink-0 p-2 px-3 rounded-lg border w-32 ${darkMode ? 'bg-[#0B0F19] border-white/10' : 'bg-white border-slate-200'}`}>
                                                    <div className={`text-[9px] font-bold truncate ${theme.text}`}>{slot.email}</div>
                                                    <div className="text-[10px] font-mono opacity-60">PIN: {slot.pin || '--'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. DATOS DEL CLIENTE */}
                        <div className="space-y-3">
                            <div className="relative group">
                                <User size={18} className={ICON_CLASS}/>
                                <input list="clients-suggestions" className={INPUT_CLASS} value={formData.client === 'LIBRE' ? '' : formData.client} onChange={handleClientNameChange} placeholder="Nombre del Cliente" autoFocus required/>
                            </div>
                            <div className="relative group">
                                <Smartphone size={18} className={ICON_CLASS}/>
                                <input type="tel" className={INPUT_CLASS} value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} placeholder="WhatsApp (Opcional)"/>
                            </div>
                        </div>

                        {/* 3. FECHA Y PRECIO (Grid alineada) */}
                        <div className="grid grid-cols-2 gap-3 items-end">
                            {/* Componente Calendario */}
                            <div className="w-full">
                                <AppleCalendar 
                                    value={formData.endDate} 
                                    onChange={(newDate) => setFormData({...formData, endDate: newDate})} 
                                    label="Vencimiento"
                                    darkMode={darkMode}
                                />
                            </div>
                            
                            {/* Input Precio */}
                            <div className="space-y-1">
                                <label className={`text-[10px] font-bold uppercase tracking-wider ml-1 ${theme.subtext}`}>Precio</label>
                                <div className="relative group">
                                    <DollarSign size={16} className={ICON_CLASS}/>
                                    <input type="number" className={INPUT_CLASS} value={formData.cost} onChange={e=>setFormData({...formData, cost:e.target.value})} placeholder="0.00" required={!isExempt} />
                                </div>
                            </div>
                        </div>

                        {/* 4. PERFILES (Dinámico) */}
                        <div className={`rounded-2xl p-4 border ${theme.sectionBg} ${theme.border}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Layers size={16} className="text-indigo-500"/>
                                <span className={`text-xs font-black uppercase ${theme.text}`}>
                                    {parseInt(formData.profilesToBuy) > 1 ? `Asignar ${formData.profilesToBuy} Perfiles` : 'Datos del Perfil'}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {(parseInt(formData.profilesToBuy) > 1 ? bulkProfiles : [bulkProfiles[0] || {profile: formData.profile, pin: formData.pin}]).map((p, i) => (
                                    <div key={i} className="flex gap-2 animate-in slide-in-from-left-2" style={{animationDelay: `${i*50}ms`}}>
                                        <input 
                                            className={`flex-1 p-3 rounded-xl text-xs font-bold outline-none border focus:border-indigo-500 transition-colors ${theme.inputBg} ${theme.border} ${theme.text} placeholder:text-slate-500`}
                                            placeholder={`Nombre Perfil ${i+1}`} 
                                            value={parseInt(formData.profilesToBuy) > 1 ? p.profile : formData.profile} 
                                            onChange={(e) => parseInt(formData.profilesToBuy) > 1 ? handleBulkProfileChange(i, 'profile', e.target.value) : handleSingleProfileChange(e.target.value)} 
                                            list="suggested-profiles"
                                        />
                                        <input 
                                            className={`w-20 p-3 text-center rounded-xl text-xs font-mono font-bold outline-none border focus:border-indigo-500 transition-colors ${theme.inputBg} ${theme.border} ${theme.text} placeholder:text-slate-500`}
                                            placeholder="PIN" 
                                            value={parseInt(formData.profilesToBuy) > 1 ? p.pin : formData.pin} 
                                            onChange={(e) => parseInt(formData.profilesToBuy) > 1 ? handleBulkProfileChange(i, 'pin', e.target.value) : setFormData({...formData, pin: e.target.value})}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 5. MIGRACIÓN DE SERVICIO (Opcional) */}
                        {filteredConversionCatalog.length > 0 && (
                            <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-100/50'}`}>
                                <label className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase mb-2"><Package size={12}/> Cambiar Plan</label>
                                <div className="relative">
                                    <select 
                                        className={`w-full p-3 rounded-xl text-xs font-bold outline-none border appearance-none cursor-pointer ${darkMode ? 'bg-[#0B0F19] border-white/10 text-indigo-300' : 'bg-white border-indigo-100 text-indigo-900'}`}
                                        onChange={(e) => { 
                                            const selected = catalog.find(s => s.name === e.target.value); 
                                            if (selected) setFormData(prev => ({ ...prev, service: selected.name, cost: selected.cost, profilesToBuy: selected.defaultSlots })); 
                                        }} 
                                        value={formData.service}
                                    >
                                        <option value={formData.service}>{formData.service} (Actual)</option>
                                        <option disabled>──────────</option>
                                        {filteredConversionCatalog.map(item => <option key={item.id} value={item.name}>{item.name} - ${item.cost}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className="h-4"></div>
                    </form>
                </div>

                {/* FOOTER ACCIONES */}
                <div className={`p-4 border-t flex gap-3 pb-8 md:pb-4 ${darkMode ? 'bg-[#161B28] border-white/10' : 'bg-white border-slate-100'}`}>
                    <button type="button" onClick={()=>{setView('dashboard'); resetForm();}} className={`flex-1 py-3.5 rounded-2xl font-bold text-sm transition-colors ${darkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                        Cancelar
                    </button>
                    <button type="submit" form="sale-form" className={`flex-[2] py-3.5 rounded-2xl font-black text-sm shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 text-white ${darkMode ? 'bg-black border border-white/20 hover:bg-white/5 shadow-black/50' : 'bg-slate-900 shadow-slate-900/20 hover:bg-slate-800'}`}>
                        <Save size={18} className="text-emerald-400"/> Guardar Venta
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SaleForm;