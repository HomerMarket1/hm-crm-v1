// src/views/SaleForm.jsx (DISEÑO FINAL PREMIUM IOS STYLE)

import React from 'react';
import { Copy, Package, User, Smartphone, Calendar, DollarSign, Layers, X, Check } from 'lucide-react';

const SaleForm = ({
    formData, setFormData,
    bulkProfiles, setBulkProfiles,
    allClients,
    packageCatalog,
    maxAvailableSlots,
    getClientPreviousProfiles,
    handleClientNameChange,
    handleBulkProfileChange,
    handleSingleProfileChange,
    handleSaveSale,
    setView,
    resetForm,
    catalog
}) => {

    // ESTILOS REUTILIZABLES (GLASS UI)
    const INPUT_WRAPPER = "relative group";
    const ICON_STYLE = "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none";
    const INPUT_STYLE = "w-full p-4 pl-11 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-indigo-100 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400";
    
    // Función auxiliar para copiar credenciales
    const copyCredentials = (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(`${formData.email}:${formData.pass}`);
        const btn = e.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="text-emerald-600 flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/20 backdrop-blur-sm animate-in fade-in duration-300">
            
            {/* TARJETA MODAL FLOTANTE */}
            <div className="w-full max-w-lg bg-white/90 backdrop-blur-2xl rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl border border-white/50 overflow-hidden flex flex-col max-h-[95vh]">
                
                {/* 1. ENCABEZADO CON GRADIENTE SUTIL */}
                <div className="px-8 pt-8 pb-4 bg-gradient-to-b from-white to-transparent">
                    <div className="flex justify-between items-start mb-2">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                {formData.client === 'LIBRE' ? 'Nueva Venta' : 'Editar Venta'}
                            </h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                                {formData.service}
                            </p>
                        </div>
                        <button onClick={()=>{setView('dashboard'); resetForm();}} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                            <X size={20} className="text-slate-500"/>
                        </button>
                    </div>

                    {/* Píldora de Credenciales (Copiable) */}
                    <button onClick={copyCredentials} className="w-full py-2 px-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 hover:bg-indigo-100 transition-all active:scale-95">
                        <span className="font-mono truncate max-w-[200px]">{formData.email}</span>
                        <span className="opacity-30">|</span>
                        <span className="font-mono">••••••</span>
                        <Copy size={12}/>
                    </button>
                </div>

                {/* 2. CUERPO DEL FORMULARIO (SCROLLABLE) */}
                <div className="flex-1 overflow-y-auto px-8 pb-4 space-y-5 no-scrollbar">
                    
                    <form id="sale-form" onSubmit={handleSaveSale} className="space-y-6">
                        
                        {/* SELECTOR DE CANTIDAD (Segmented Control iOS) */}
                        {(formData.client === 'LIBRE' || formData.id) && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">Cantidad de Perfiles</label>
                                <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                                    {[1,2,3,4,5].map(num => (
                                        <button 
                                            key={num} 
                                            type="button" 
                                            onClick={()=>setFormData({...formData, profilesToBuy: num})} 
                                            disabled={num > maxAvailableSlots && formData.client === 'LIBRE'} 
                                            className={`flex-1 h-10 rounded-xl text-sm font-black transition-all ${
                                                formData.profilesToBuy === num 
                                                    ? 'bg-white text-indigo-600 shadow-md scale-100' 
                                                    : 'text-slate-400 hover:text-slate-600'
                                            } ${num > maxAvailableSlots && formData.client === 'LIBRE' ? 'opacity-30 cursor-not-allowed' : ''}`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* DATOS DEL CLIENTE */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className={INPUT_WRAPPER}>
                                    <User size={18} className={ICON_STYLE}/>
                                    <input 
                                        list="clients-suggestions" 
                                        className={INPUT_STYLE} 
                                        value={formData.client === 'LIBRE' ? '' : formData.client} 
                                        onChange={handleClientNameChange} 
                                        placeholder="Nombre Cliente" 
                                        autoFocus
                                    />
                                </div>
                                <div className={INPUT_WRAPPER}>
                                    <Smartphone size={18} className={ICON_STYLE}/>
                                    <input 
                                        className={INPUT_STYLE} 
                                        value={formData.phone} 
                                        onChange={e=>setFormData({...formData, phone:e.target.value})} 
                                        placeholder="WhatsApp"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className={INPUT_WRAPPER}>
                                    <Calendar size={18} className={ICON_STYLE}/>
                                    <input 
                                        type="date" 
                                        className={INPUT_STYLE + " pr-2"} 
                                        value={formData.endDate} 
                                        onChange={e=>setFormData({...formData, endDate:e.target.value})}
                                    />
                                </div>
                                <div className={INPUT_WRAPPER}>
                                    <DollarSign size={18} className={ICON_STYLE}/>
                                    <input 
                                        type="number" 
                                        className={INPUT_STYLE} 
                                        value={formData.cost} 
                                        onChange={e=>setFormData({...formData, cost:e.target.value})} 
                                        placeholder="Costo"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* GESTIÓN DE PERFILES (Dinámico) */}
                        <div className="bg-slate-50/50 rounded-[20px] p-4 border border-slate-100">
                            <div className="flex items-center gap-2 mb-3 px-1">
                                <Layers size={16} className="text-indigo-500"/>
                                <span className="text-xs font-black text-slate-700 uppercase tracking-wide">
                                    {formData.profilesToBuy > 1 ? `Asignar ${formData.profilesToBuy} Perfiles` : 'Datos del Perfil'}
                                </span>
                            </div>
                            
                            <div className="space-y-2">
                                {(formData.profilesToBuy > 1 ? bulkProfiles : [bulkProfiles[0] || {profile: formData.profile, pin: formData.pin}]).map((p, i) => (
                                    <div key={i} className="flex gap-2 animate-in slide-in-from-right-4 duration-300" style={{animationDelay: `${i*50}ms`}}>
                                        <div className="relative flex-1">
                                            <input 
                                                className="w-full p-3 pl-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-300"
                                                placeholder={`Perfil ${formData.profilesToBuy > 1 ? i+1 : ''}`} 
                                                value={formData.profilesToBuy > 1 ? p.profile : formData.profile} 
                                                onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'profile', e.target.value) : handleSingleProfileChange(e.target.value)} 
                                                list="suggested-profiles"
                                            />
                                        </div>
                                        <div className="relative w-24">
                                            <input 
                                                className="w-full p-3 text-center bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-500/10 placeholder:text-slate-300" 
                                                placeholder="PIN" 
                                                value={formData.profilesToBuy > 1 ? p.pin : formData.pin} 
                                                onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'pin', e.target.value) : setFormData({...formData, pin: e.target.value})}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SELECTOR DE PAQUETE (Opcional) */}
                        {packageCatalog.length > 0 && (
                            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                                <label className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase mb-2">
                                    <Package size={12}/> Conversión de Servicio
                                </label>
                                <div className="relative">
                                    <select 
                                        className="w-full p-3 pl-4 bg-white border border-indigo-100 rounded-xl text-xs font-bold text-indigo-900 outline-none appearance-none"
                                        onChange={(e) => {
                                            const selectedName = e.target.value;
                                            const selected = catalog.find(s => s.name === selectedName);
                                            if (selected) {
                                                setFormData(prev => ({ ...prev, service: selected.name, cost: selected.cost, profilesToBuy: selected.defaultSlots }));
                                            } else {
                                                const baseService = catalog.find(s => s.name.toLowerCase().includes('1 perfil') && s.type !== 'Paquete');
                                                setFormData(prev => ({ ...prev, service: baseService ? baseService.name : 'Netflix 1 Perfil', profilesToBuy: 1, cost: baseService ? baseService.cost : prev.cost }));
                                            }
                                        }} 
                                        value={formData.service}
                                    >
                                        <option value={formData.service}>{formData.service} (Actual)</option>
                                        <option disabled>──────────</option>
                                        {packageCatalog.map(pkg => <option key={pkg.id} value={pkg.name}>{pkg.name} (${pkg.cost})</option>)}
                                        {catalog.filter(s => s.type !== 'Paquete').map(ind => <option key={`ind-${ind.id}`} value={ind.name}>{ind.name}</option>)}
                                    </select>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-indigo-400">▼</div>
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* 3. FOOTER FIJO (BOTÓN DE ACCIÓN) */}
                <div className="p-6 pt-2 bg-white/50 backdrop-blur-md border-t border-slate-100">
                    <button 
                        type="submit" 
                        form="sale-form"
                        className="w-full py-4 bg-slate-900 text-white rounded-[1.2rem] font-black text-sm shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Check size={18} className="text-emerald-400"/> Confirmar Venta
                    </button>
                </div>

            </div>
        </div>
    );
};

export default SaleForm;