// src/views/SaleForm.jsx (FINAL CORREGIDO: Lógica Limpia)

import React, { useMemo } from 'react';
import { Copy, Package, User, Smartphone, Calendar, DollarSign, Layers, X, Check, Save } from 'lucide-react';
// ✅ IMPORTAR LA UTILIDAD DE CATEGORIZACIÓN
import { getServiceCategory } from '../utils/helpers'; 

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
    catalog // Lista COMPLETA ordenada alfabéticamente desde App.jsx
}) => {

    // ESTILOS REUTILIZABLES
    const INPUT_WRAPPER = "relative group";
    const ICON_STYLE = "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none";
    const INPUT_STYLE = "w-full p-4 pl-11 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400";
    
    // 🗑️ ELIMINADO: La función local getBaseServiceName

    // ✅ OPTIMIZACIÓN: CÁLCULOS MEMORIZADOS
    const baseService = getServiceCategory(formData.service);

    const filteredConversionCatalog = useMemo(() => {
        return catalog.filter(s => {
            const serviceCategory = getServiceCategory(s.name);
            // Mantiene la lógica de filtrado por categoría o el servicio actual
            if (baseService === 'UNKNOWN') return true; 
            return serviceCategory === baseService || s.name === formData.service;
        });
    }, [catalog, baseService, formData.service]); 

    // ✅ OPTIMIZACIÓN: Usamos el catálogo filtrado memorizado
    const filteredPackages = filteredConversionCatalog.filter(s => s.type === 'Paquete');
    const filteredProfiles = filteredConversionCatalog.filter(s => s.type !== 'Paquete');


    const copyCredentials = (e) => {
        e.preventDefault();
        navigator.clipboard.writeText(`${formData.email}:${formData.pass}`);
        const btn = e.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="text-emerald-600 flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
    };

    return (
        // FONDO OSCURO (MODAL)
        <div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
            
            {/* TARJETA PRINCIPAL */}
            <div className="w-full md:max-w-lg h-[85dvh] md:h-auto md:max-h-[90vh] bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl flex flex-col overflow-hidden">
                
                {/* 1. ENCABEZADO (Fijo) */}
                <div className="px-6 pt-6 pb-4 bg-white z-10 border-b border-slate-50">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">
                                {formData.client === 'LIBRE' ? 'Nueva Venta' : 'Editar'}
                            </h2>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide truncate max-w-[200px]">
                                {formData.service}
                            </p>
                        </div>
                        <button onClick={()=>{setView('dashboard'); resetForm();}} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                            <X size={20} className="text-slate-500"/>
                        </button>
                    </div>

                    <button onClick={copyCredentials} className="w-full py-2.5 px-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 active:scale-95 transition-transform">
                        <span className="font-mono truncate">{formData.email}</span>
                        <span className="opacity-30">|</span>
                        <span className="font-mono">••••••</span>
                        <Copy size={12}/>
                    </button>
                </div>

                {/* 2. CUERPO DEL FORMULARIO (Scrollable) */}
                <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 bg-white no-scrollbar">
                    <form id="sale-form" onSubmit={handleSaveSale} className="space-y-6 pb-4">
                        
                        {/* CANTIDAD DE PERFILES */}
                        {(formData.client === 'LIBRE' || formData.id) && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-2">Perfiles a vender</label>
                                <div className="flex p-1 bg-slate-100 rounded-xl">
                                    {[1,2,3,4,5].map(num => (
                                        <button 
                                            key={num} 
                                            type="button" 
                                            onClick={()=> {
                                                let newCost = formData.cost;
                                                let newService = formData.service;
                                                
                                                if (formData.client === 'LIBRE' && num > 0) {
                                                    // ✅ USAMOS LA UTILIDAD IMPORTADA
                                                    const base = getServiceCategory(formData.service); 
                                                    const individualService = catalog.find(s => 
                                                        s.type === 'Perfil' && 
                                                        s.defaultSlots === 1 && 
                                                        getServiceCategory(s.name) === base
                                                    );
                                                    
                                                    if (individualService) {
                                                        newCost = Number(individualService.cost) * num; 
                                                        newService = individualService.name; 
                                                    }
                                                }

                                                setFormData({
                                                    ...formData, 
                                                    profilesToBuy: num,
                                                    cost: newCost,
                                                    service: newService
                                                });
                                            }}
                                            disabled={num > maxAvailableSlots && formData.client === 'LIBRE'} 
                                            className={`flex-1 h-9 rounded-lg text-sm font-black transition-all ${
                                                formData.profilesToBuy === num 
                                                    ? 'bg-white text-indigo-600 shadow-sm scale-100' 
                                                    : 'text-slate-400'
                                            } ${num > maxAvailableSlots && formData.client === 'LIBRE' ? 'opacity-30' : ''}`}
                                        >
                                            {num}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* DATOS CLIENTE (Sin cambios) */}
                        <div className="space-y-3">
                            <div className="grid grid-cols-1 gap-3">
                                <div className={INPUT_WRAPPER}>
                                    <User size={18} className={ICON_STYLE}/>
                                    <input 
                                        list="clients-suggestions" 
                                        className={INPUT_STYLE} 
                                        value={formData.client === 'LIBRE' ? '' : formData.client} 
                                        onChange={handleClientNameChange} 
                                        placeholder="Nombre del Cliente" 
                                        autoFocus
                                    />
                                </div>
                                <div className={INPUT_WRAPPER}>
                                    <Smartphone size={18} className={ICON_STYLE}/>
                                    <input 
                                        className={INPUT_STYLE} 
                                        value={formData.phone} 
                                        onChange={e=>setFormData({...formData, phone:e.target.value})} 
                                        placeholder="WhatsApp (Opcional)"
                                        type="tel"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className={INPUT_WRAPPER}>
                                    <Calendar size={18} className={ICON_STYLE}/>
                                    <input type="date" className={INPUT_STYLE + " pr-2 text-xs"} value={formData.endDate} onChange={e=>setFormData({...formData, endDate:e.target.value})}/>
                                </div>
                                <div className={INPUT_WRAPPER}>
                                    <DollarSign size={18} className={ICON_STYLE}/>
                                    <input type="number" className={INPUT_STYLE} value={formData.cost} onChange={e=>setFormData({...formData, cost:e.target.value})} placeholder="Precio"/>
                                </div>
                            </div>
                        </div>

                        {/* PERFILES (Sin cambios) */}
                        <div className="bg-slate-50/80 rounded-2xl p-4 border border-slate-100">
                            <div className="flex items-center gap-2 mb-3">
                                <Layers size={16} className="text-indigo-500"/>
                                <span className="text-xs font-black text-slate-700 uppercase">
                                    {formData.profilesToBuy > 1 ? `Asignar ${formData.profilesToBuy} Perfiles` : 'Datos del Perfil'}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {(formData.profilesToBuy > 1 ? bulkProfiles : [bulkProfiles[0] || {profile: formData.profile, pin: formData.pin}]).map((p, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-indigo-300"
                                            placeholder={`Nombre Perfil ${i+1}`} 
                                            value={formData.profilesToBuy > 1 ? p.profile : formData.profile} 
                                            onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'profile', e.target.value) : handleSingleProfileChange(e.target.value)} 
                                            list="suggested-profiles"
                                        />
                                        <input className="w-20 p-3 text-center bg-white border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 outline-none focus:border-indigo-300" 
                                            placeholder="PIN" 
                                            value={formData.profilesToBuy > 1 ? p.pin : formData.pin} 
                                            onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'pin', e.target.value) : setFormData({...formData, pin: e.target.value})}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* SELECTOR DE PAQUETE (Conversión) */}
                        {packageCatalog.length > 0 && (
                            <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                                <label className="flex items-center gap-2 text-[10px] font-bold text-indigo-400 uppercase mb-2">
                                    <Package size={12}/> Conversión
                                </label>
                                <div className="relative">
                                    <select className="w-full p-3 bg-white border border-indigo-100 rounded-xl text-xs font-bold text-indigo-900 outline-none appearance-none"
                                        onChange={(e) => {
                                            const selectedName = e.target.value;
                                            const selected = catalog.find(s => s.name === selectedName);
                                            if (selected) setFormData(prev => ({ ...prev, service: selected.name, cost: selected.cost, profilesToBuy: selected.defaultSlots }));
                                            else {
                                                const baseService = catalog.find(s => getServiceCategory(s.name) === getServiceCategory(formData.service) && s.type !== 'Paquete');
                                                setFormData(prev => ({ ...prev, service: baseService ? baseService.name : 'Netflix 1 Perfil', profilesToBuy: 1, cost: baseService ? baseService.cost : prev.cost }));
                                            }
                                        }} 
                                        value={formData.service}
                                    >
                                        <option value={formData.service}>{formData.service} (Actual)</option>
                                        <option disabled>──────────</option>
                                        {/* Paquetes y Perfiles filtrados por la categoría base actual */}
                                        {filteredPackages
                                            .filter(pkg => getServiceCategory(pkg.name) === baseService) // FILTRO: Mostrar solo paquetes de la misma plataforma
                                            .map(pkg => <option key={pkg.id} value={pkg.name}>{pkg.name} (${pkg.cost})</option>)
                                        }
                                        {filteredProfiles
                                            .filter(s => getServiceCategory(s.name) === baseService) // FILTRO: Mostrar solo perfiles/cuentas de la misma plataforma
                                            .map(ind => <option key={`ind-${ind.id}`} value={ind.name}>{ind.name}</option>)
                                        }
                                    </select>
                                </div>
                            </div>
                        )}
                        
                        {/* Espacio extra al final */}
                        <div className="h-4"></div>
                    </form>
                </div>

                {/* 3. FOOTER FIJO (BOTONES DE ACCIÓN) */}
                <div className="p-4 bg-white border-t border-slate-100 flex gap-3 pb-8 md:pb-4">
                    <button 
                        type="button" 
                        onClick={()=>{setView('dashboard'); resetForm();}} 
                        className="flex-1 py-4 bg-slate-100 text-slate-500 rounded-2xl font-bold text-sm hover:bg-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        form="sale-form"
                        className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-sm shadow-xl shadow-slate-900/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={18} className="text-emerald-400"/> Guardar
                    </button>
                </div>

            </div>
        </div>
    );
};

export default SaleForm;