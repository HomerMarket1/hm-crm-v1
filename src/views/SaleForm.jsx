// src/views/SaleForm.jsx
import React, { useMemo } from 'react';
import { Copy, Package, User, Smartphone, Calendar, DollarSign, Layers, X, Save } from 'lucide-react';

// =========================================================================
// 0. HELPER INTERNO
// =========================================================================
const getServiceCategory = (serviceName) => {
    if (!serviceName) return 'UNKNOWN';
    const lower = serviceName.toLowerCase();
    if (lower.includes('netflix')) return 'Netflix';
    if (lower.includes('disney')) return 'Disney';
    if (lower.includes('max') || lower.includes('hbo')) return 'Max';
    if (lower.includes('prime') || lower.includes('amazon')) return 'Prime';
    if (lower.includes('paramount')) return 'Paramount';
    if (lower.includes('crunchyroll')) return 'Crunchyroll';
    if (lower.includes('vix')) return 'Vix';
    if (lower.includes('plex')) return 'Plex';
    if (lower.includes('iptv')) return 'IPTV';
    if (lower.includes('magis')) return 'Magis';
    return serviceName.split(' ')[0];
};

const SaleForm = ({
    formData, setFormData,
    bulkProfiles, setBulkProfiles,
    packageCatalog,
    maxAvailableSlots,
    handleClientNameChange,
    handleBulkProfileChange,
    handleSingleProfileChange,
    handleSaveSale,
    setView,
    resetForm,
    catalog,
    darkMode // ✅ Recibimos el Modo Oscuro
}) => {

    // =========================================================================
    // 🎨 ESTILOS DINÁMICOS (Modo Día / Noche)
    // =========================================================================
    const theme = {
        bg: darkMode ? 'bg-[#161B28]' : 'bg-white',
        text: darkMode ? 'text-white' : 'text-slate-800',
        textMuted: darkMode ? 'text-slate-400' : 'text-slate-400',
        border: darkMode ? 'border-white/5' : 'border-slate-50',
        inputBg: darkMode ? 'bg-black/20' : 'bg-slate-50',
        inputBorder: darkMode ? 'border-white/5' : 'border-slate-200',
        inputText: darkMode ? 'text-white' : 'text-slate-800',
        sectionBg: darkMode ? 'bg-black/20' : 'bg-slate-50/80',
        sectionBorder: darkMode ? 'border-white/5' : 'border-slate-100',
        divider: darkMode ? 'border-white/5' : 'border-slate-100',
        footerBg: darkMode ? 'bg-[#161B28]' : 'bg-white',
        cancelBtn: darkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-slate-100 text-slate-500 hover:bg-slate-200',
        trackBg: darkMode ? 'bg-black/20' : 'bg-slate-100',
        activeBtn: darkMode ? 'bg-[#2A303C] text-white shadow-sm' : 'bg-white text-indigo-600 shadow-sm',
    };

    const INPUT_WRAPPER = "relative group";
    const ICON_STYLE = "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none";
    
    // Input adaptado a ambos modos
    const INPUT_STYLE = `w-full p-4 pl-11 rounded-2xl text-sm font-bold outline-none transition-all focus:ring-4 focus:ring-indigo-500/10 ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} placeholder:text-slate-400 disabled:opacity-50`;
    
    // 1. LÓGICA DE CATEGORIZACIÓN
    const baseService = getServiceCategory(formData.service);

    const filteredConversionCatalog = useMemo(() => {
        if (!catalog) return [];
        return catalog.filter(s => {
            const cat = getServiceCategory(s.name);
            return cat === baseService || s.name === formData.service;
        });
    }, [catalog, baseService, formData.service]); 

    // 2. DETECCIÓN DE ESTADOS EXENTOS
    const EXEMPT_STATUSES = ['Admin', 'Actualizar', 'Caída', 'Dominio', 'EXPIRED', 'Vencido', 'Problemas', 'Garantía'];
    
    const isExempt = useMemo(() => {
        if (!formData.client) return false;
        return EXEMPT_STATUSES.some(status => 
            formData.client.trim().toLowerCase() === status.toLowerCase()
        );
    }, [formData.client]);

    // 3. HANDLERS
    const handleQuantityClick = (num) => {
        let newCost = formData.cost;
        let newService = formData.service;
        
        if (formData.client === 'LIBRE' && num > 0) {
            const individualService = catalog.find(s => 
                s.type === 'Perfil' && s.defaultSlots === 1 && getServiceCategory(s.name) === baseService
            );
            if (individualService) {
                newCost = Number(individualService.cost) * num; 
            }
        }
        setFormData({ ...formData, profilesToBuy: num, cost: newCost, service: newService });
    };

    const copyCredentials = (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(`${formData.email}:${formData.pass}`);
        const btn = e.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="text-emerald-500 flex items-center gap-1">Copiado</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className={`w-full md:max-w-lg h-[85dvh] md:h-auto md:max-h-[90vh] rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden ${theme.bg}`}>
                
                {/* HEADER */}
                <div className={`px-6 pt-6 pb-4 z-10 border-b ${theme.bg} ${theme.border}`}>
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className={`text-2xl font-black tracking-tight ${theme.text}`}>
                                {formData.client === 'LIBRE' ? 'Nueva Venta' : 'Editar'}
                            </h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide truncate max-w-[200px]">
                                {formData.service}
                            </p>
                        </div>
                        <button onClick={()=>{setView('dashboard'); resetForm();}} className={`p-2 rounded-full transition-colors ${darkMode ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}>
                            <X size={20} />
                        </button>
                    </div>
                    <button onClick={copyCredentials} className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-bold active:scale-95 transition-transform border ${darkMode ? 'bg-[#0B0F19] border-white/5 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
                        <span className="font-mono truncate">{formData.email}</span><span className="opacity-30">|</span><span className="font-mono">••••••</span><Copy size={12}/>
                    </button>
                </div>

                {/* BODY */}
                <div className={`flex-1 overflow-y-auto px-6 py-4 space-y-6 no-scrollbar ${theme.bg}`}>
                    <form id="sale-form" onSubmit={handleSaveSale} className="space-y-6 pb-4">
                        
                        {/* SELECTOR CANTIDAD */}
                        {(formData.client === 'LIBRE' || formData.id) && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">Perfiles a vender</label>
                                <div className={`flex p-1 rounded-xl ${theme.trackBg}`}>
                                    {[1,2,3,4,5].map(num => {
                                        const isDisabled = num > maxAvailableSlots && formData.client === 'LIBRE';
                                        return (
                                            <button key={num} type="button" onClick={() => handleQuantityClick(num)} disabled={isDisabled} className={`flex-1 h-9 rounded-lg text-sm font-black transition-all ${formData.profilesToBuy === num ? theme.activeBtn : 'text-slate-500'} ${isDisabled ? 'opacity-30 cursor-not-allowed' : ''}`}>{num}</button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* INPUTS CLIENTE */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                                <div className={INPUT_WRAPPER}>
                                    <User size={18} className={ICON_STYLE}/>
                                    <input list="clients-suggestions" className={INPUT_STYLE} value={formData.client === 'LIBRE' ? '' : formData.client} onChange={handleClientNameChange} placeholder="Nombre del Cliente" autoFocus required/>
                                </div>
                                <div className={INPUT_WRAPPER}>
                                    <Smartphone size={18} className={ICON_STYLE}/>
                                    <input className={INPUT_STYLE} value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} placeholder="WhatsApp (Opcional)" type="tel"/>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className={INPUT_WRAPPER}>
                                    <Calendar size={18} className={ICON_STYLE}/>
                                    <input 
                                        type="date" 
                                        className={INPUT_STYLE + " pr-2 text-xs"} 
                                        value={formData.endDate} 
                                        onChange={e=>setFormData({...formData, endDate:e.target.value})} 
                                        required={!isExempt} 
                                    />
                                </div>
                                <div className={INPUT_WRAPPER}>
                                    <DollarSign size={18} className={ICON_STYLE}/>
                                    <input 
                                        type="number" 
                                        className={INPUT_STYLE} 
                                        value={formData.cost} 
                                        onChange={e=>setFormData({...formData, cost:e.target.value})} 
                                        placeholder="Precio" 
                                        required={!isExempt} 
                                    />
                                </div>
                            </div>
                        </div>

                        {/* INPUTS PERFILES */}
                        <div className={`rounded-2xl p-4 border ${theme.sectionBg} ${theme.sectionBorder}`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Layers size={16} className="text-indigo-500"/>
                                <span className={`text-xs font-black uppercase ${darkMode ? 'text-indigo-300' : 'text-slate-700'}`}>{formData.profilesToBuy > 1 ? `Asignar ${formData.profilesToBuy} Perfiles` : 'Datos del Perfil'}</span>
                            </div>
                            <div className="space-y-2">
                                {(formData.profilesToBuy > 1 ? bulkProfiles : [bulkProfiles[0] || {profile: formData.profile, pin: formData.pin}]).map((p, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input className={`w-full p-3 border rounded-xl text-xs font-bold outline-none focus:border-indigo-500 ${theme.bg} ${theme.inputBorder} ${theme.inputText}`} placeholder={`Nombre Perfil ${i+1}`} value={formData.profilesToBuy > 1 ? p.profile : formData.profile} onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'profile', e.target.value) : handleSingleProfileChange(e.target.value)} list="suggested-profiles"/>
                                        <input className={`w-20 p-3 text-center border rounded-xl text-xs font-mono font-bold outline-none focus:border-indigo-500 ${theme.bg} ${theme.inputBorder} ${theme.inputText}`} placeholder="PIN" value={formData.profilesToBuy > 1 ? p.pin : formData.pin} onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'pin', e.target.value) : setFormData({...formData, pin: e.target.value})}/>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* CONVERSION (RESTAURADO) */}
                        {filteredConversionCatalog.length > 0 && (
                            <div className={`p-4 rounded-2xl border ${darkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-100/50'}`}>
                                <label className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase mb-2"><Package size={12}/> Tipo de Servicio</label>
                                <div className="relative">
                                    <select className={`w-full p-3 border rounded-xl text-xs font-bold outline-none appearance-none ${darkMode ? 'bg-[#0B0F19] border-white/5 text-indigo-300' : 'bg-white border-indigo-100 text-indigo-900'}`} onChange={(e) => { const selectedName = e.target.value; const selected = catalog.find(s => s.name === selectedName); if (selected) { setFormData(prev => ({ ...prev, service: selected.name, cost: selected.cost, profilesToBuy: selected.defaultSlots })); } }} value={formData.service}>
                                        <option value={formData.service}>{formData.service} (Actual)</option>
                                        <option disabled>──────────</option>
                                        {filteredConversionCatalog.map(item => <option key={item.id} value={item.name}>{item.name} ({item.type}) - ${item.cost}</option>)}
                                    </select>
                                </div>
                            </div>
                        )}
                        <div className="h-4"></div>
                    </form>
                </div>

                {/* FOOTER */}
                <div className={`p-4 border-t flex gap-3 pb-8 md:pb-4 ${theme.footerBg} ${theme.divider}`}>
                    <button type="button" onClick={()=>{setView('dashboard'); resetForm();}} className={`flex-1 py-4 rounded-2xl font-bold text-sm transition-colors ${theme.cancelBtn}`}>Cancelar</button>
                    <button type="submit" form="sale-form" className={`flex-[2] py-4 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2 ${darkMode ? 'bg-black border border-white/10' : 'bg-slate-900'}`}><Save size={18} className="text-emerald-400"/> Guardar</button>
                </div>
            </div>
        </div>
    );
};

export default SaleForm;