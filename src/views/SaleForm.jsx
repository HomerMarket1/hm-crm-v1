// src/views/SaleForm.jsx (Diseño Minimalista Estilo iOS/macOS)

import React from 'react';
import { Copy, Package } from 'lucide-react';

// Clase unificada para Inputs y Selects: Fondo suave, borde sutil, foco limpio.
const INPUT_CLASS = "w-full p-3 bg-slate-100/70 border border-slate-200/50 rounded-xl text-xs font-bold outline-none focus:bg-white";
const PROFILE_INPUT_CLASS = "p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-slate-50";

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
    catalog // Se necesita para el selector de paquetes
}) => {

    return (
        // ✅ CONTENEDOR DE TARJETA MODAL FLOTANTE
        <div className="max-w-xl mx-auto p-4 md:p-6 bg-white/90 backdrop-blur-xl rounded-t-[2rem] md:rounded-[2rem] shadow-2xl border border-white/50 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <h2 className="text-xl font-black text-slate-800 mb-1">{formData.client === 'LIBRE' ? 'Vender' : 'Editar'}</h2>
            <p className="text-xs font-mono text-slate-400 bg-slate-50 p-1 rounded w-fit mb-6">
                <button onClick={(e) => {
                    e.preventDefault();
                    navigator.clipboard.writeText(`${formData.email}:${formData.pass}`);
                    e.currentTarget.querySelector('span').textContent = '¡Copiado!'; 
                    setTimeout(() => {
                        e.currentTarget.querySelector('span').textContent = `${formData.email} | ${formData.pass}`;
                    }, 1500);
                }} className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                    <span>{formData.email} | {formData.pass}</span> <Copy size={12}/>
                </button>
            </p>
            
            <form onSubmit={handleSaveSale} className="space-y-4">
                
                {/* Botones de Cantidad (Slots a Vender) */}
                {(formData.client === 'LIBRE' || formData.id) && (
                    <div className="p-1 bg-slate-100 rounded-2xl flex border border-slate-200/50">
                        {[1,2,3,4,5].map(num => (<button key={num} type="button" onClick={()=>setFormData({...formData, profilesToBuy: num})} disabled={num > maxAvailableSlots && formData.client === 'LIBRE'} className={`flex-1 h-10 min-w-[40px] rounded-xl text-xs font-bold transition-colors ${formData.profilesToBuy === num ? 'bg-blue-600 text-white shadow-md' : 'bg-white text-slate-500 hover:bg-slate-50' } ${num > maxAvailableSlots && formData.client === 'LIBRE' ? 'opacity-40 cursor-not-allowed' : ''}`}>{num}</button>))}
                    </div>
                )}
                
                {/* SELECTOR DE PAQUETE */}
                {packageCatalog.length > 0 && (
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1"><Package size={12}/> {formData.client === 'LIBRE' ? 'Venta Rápida Paquete' : 'Cambiar Tipo de Servicio'}</label>
                            <select 
                                onChange={(e) => {
                                    const selectedName = e.target.value;
                                    const selected = catalog.find(s => s.name === selectedName);
                                    
                                    if (selected) {
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            service: selected.name,
                                            cost: selected.cost,
                                            profilesToBuy: selected.defaultSlots 
                                        }));
                                    } else {
                                        const baseService = catalog.find(s => s.name.toLowerCase().includes('1 perfil') && s.type !== 'Paquete');
                                        setFormData(prev => ({ 
                                            ...prev, 
                                            service: baseService ? baseService.name : 'Netflix 1 Perfil',
                                            profilesToBuy: 1,
                                            cost: baseService ? baseService.cost : prev.cost
                                        }));
                                    }
                                }} 
                                className={`${INPUT_CLASS} text-slate-600`} // Aplicar clase unificada
                                value={formData.service}
                            >
                                    <option value={formData.service}>
                                        {formData.service.toLowerCase().includes('paquete') 
                                            ? `${formData.service} (Actual)`
                                            : `${formData.service} (Individual)`
                                        }
                                    </option>
                                    <option value="">--- Opciones de Conversión ---</option>

                                    {packageCatalog.map(pkg => (
                                        <option key={pkg.id} value={pkg.name}>
                                            {pkg.name} ({pkg.defaultSlots} slots | ${pkg.cost})
                                        </option>
                                    ))}
                                    {catalog.filter(s => s.type !== 'Paquete').map(ind => (
                                        <option key={`ind-${ind.id}`} value={ind.name}>
                                            {ind.name} (Individual)
                                        </option>
                                    ))}
                            </select>
                        </div>
                )}


                <div className="grid grid-cols-2 gap-3">
                    <input 
                        list="clients-suggestions" 
                        className={INPUT_CLASS} // Aplicar clase unificada
                        value={formData.client === 'LIBRE' ? '' : formData.client} 
                        onChange={handleClientNameChange} 
                        placeholder="Cliente" 
                        autoFocus
                    />
                    <input 
                        className={INPUT_CLASS} // Aplicar clase unificada
                        value={formData.phone} 
                        onChange={e=>setFormData({...formData, phone:e.target.value})} 
                        placeholder="Celular"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <input 
                        type="date" 
                        className={INPUT_CLASS} // Aplicar clase unificada
                        value={formData.endDate} 
                        onChange={e=>setFormData({...formData, endDate:e.target.value})}
                    />
                    <input 
                        type="number" 
                        className={INPUT_CLASS} // Aplicar clase unificada
                        value={formData.cost} 
                        onChange={e=>setFormData({...formData, cost:e.target.value})} 
                        placeholder="$0"
                    />
                </div>
                <div className="space-y-3 pt-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Perfiles</div>
                    {(formData.profilesToBuy > 1 ? bulkProfiles : [bulkProfiles[0] || {profile: formData.profile, pin: formData.pin}]).map((p, i) => (
                        <div key={i} className="flex gap-2">
                            <input 
                                className={`flex-1 ${PROFILE_INPUT_CLASS}`}
                                placeholder="Nombre Perfil" 
                                value={formData.profilesToBuy > 1 ? p.profile : formData.profile} 
                                onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'profile', e.target.value) : handleSingleProfileChange(e.target.value)} 
                                list="suggested-profiles"
                            />
                            <input 
                                className={`w-20 text-center ${PROFILE_INPUT_CLASS}`} 
                                placeholder="PIN" 
                                value={formData.profilesToBuy > 1 ? p.pin : formData.pin} 
                                onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'pin', e.target.value) : setFormData({...formData, pin: e.target.value})}
                            />
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 pt-4">
                    <button 
                        type="button" 
                        onClick={()=>{setView('dashboard'); resetForm();}} 
                        className="flex-1 py-3 font-bold text-slate-500 text-xs bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button 
                        type="submit" 
                        className="flex-[2] py-3 bg-black text-white rounded-xl font-bold text-xs shadow-lg active:scale-95 hover:opacity-90 transition-opacity"
                    >
                        Guardar
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SaleForm;