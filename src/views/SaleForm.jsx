// src/views/SaleForm.jsx
import React from 'react';
import { Copy, Package } from 'lucide-react';

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
        // ✅ CORTAR Y PEGAR ESTE BLOQUE
        <div className="w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-100 mb-20 animate-in slide-in-from-bottom-4">
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
                
                {/* Botones de Cantidad */}
                {(formData.client === 'LIBRE' || formData.id) && (
                    <div className="p-1 bg-slate-100 rounded-2xl flex">
                        {[1,2,3,4,5].map(num => (<button key={num} type="button" onClick={()=>setFormData({...formData, profilesToBuy: num})} disabled={num > maxAvailableSlots && formData.client === 'LIBRE'} className={`flex-1 h-10 min-w-[40px] rounded-lg text-xs font-bold border ${formData.profilesToBuy === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'} ${num > maxAvailableSlots && formData.client === 'LIBRE' ? 'opacity-30' : ''}`}>{num}</button>))}
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
                                className="w-full p-2 bg-white rounded-lg text-sm font-medium"
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
                    <input list="clients-suggestions" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={formData.client === 'LIBRE' ? '' : formData.client} onChange={handleClientNameChange} placeholder="Cliente" autoFocus/>
                    <input className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} placeholder="Celular"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <input type="date" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={formData.endDate} onChange={e=>setFormData({...formData, endDate:e.target.value})}/>
                    <input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={formData.cost} onChange={e=>setFormData({...formData, cost:e.target.value})} placeholder="$0"/>
                </div>
                <div className="space-y-3 pt-2">
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Perfiles</div>
                    {(formData.profilesToBuy > 1 ? bulkProfiles : [bulkProfiles[0] || {profile: formData.profile, pin: formData.pin}]).map((p, i) => (
                        <div key={i} className="flex gap-2"><input className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" placeholder="Nombre Perfil" value={formData.profilesToBuy > 1 ? p.profile : formData.profile} onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'profile', e.target.value) : handleSingleProfileChange(e.target.value)} list="suggested-profiles"/><input className="w-20 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center outline-none" placeholder="PIN" value={formData.profilesToBuy > 1 ? p.pin : formData.pin} onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'pin', e.target.value) : setFormData({...formData, pin: e.target.value})}/></div>
                    ))}
                </div>
                <div className="flex gap-3 pt-4">
                    <button type="button" onClick={()=>{setView('dashboard'); resetForm();}} className="flex-1 py-3 font-bold text-slate-400 text-xs bg-slate-50 rounded-xl">Cancelar</button>
                    <button type="submit" className="flex-[2] py-3 bg-black text-white rounded-xl font-bold text-xs shadow-lg active:scale-95">Guardar</button>
                </div>
            </form>
        </div>
    );
};

export default SaleForm;