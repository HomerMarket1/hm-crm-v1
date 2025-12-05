// src/views/Config.jsx (Revisión Final)

import React from 'react';
import { Plus, PackageX, Trash2, FileText, Upload, AlertTriangle } from 'lucide-react';

// Clase unificada para Inputs y Selects
const INPUT_CLASS = "w-full p-3 bg-slate-100/70 border border-slate-200/50 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white";

const Config = ({
    catalog,
    catalogForm, setCatalogForm,
    packageForm, setPackageForm,
    handleAddServiceToCatalog,
    handleAddPackageToCatalog,
    handleImportCSV,
    importStatus,
    triggerDeleteService
}) => {
    return (
        <div className="space-y-6 w-full pb-20">
            
            {/* 1. NUEVO SERVICIO (Tarjeta limpia) */}
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/50">
                <h3 className="text-lg font-black text-slate-800 mb-5 flex items-center gap-2"><Plus size={18} className="text-blue-600"/> Nuevo Servicio al Catálogo</h3>
                
                <form onSubmit={handleAddServiceToCatalog} className="space-y-3">
                    <input required type="text" className={INPUT_CLASS} placeholder="Nombre (Ej: Netflix 1 Perfil)" value={catalogForm.name} onChange={e => setCatalogForm({...catalogForm, name: e.target.value})} />
                    
                    <div className="flex gap-2">
                        <input required type="number" className={INPUT_CLASS} placeholder="Costo ($)" value={catalogForm.cost} onChange={e => setCatalogForm({...catalogForm, cost: e.target.value})} />
                        <input required type="number" className={INPUT_CLASS} placeholder="Cupos (Máx 5)" value={catalogForm.defaultSlots} onChange={e => setCatalogForm({...catalogForm, defaultSlots: e.target.value})} />
                    </div>
                    
                    {/* Botones Perfil/Cuenta con estilo segmentado simple */}
                    <div className="flex gap-2 p-1 bg-slate-100/70 rounded-xl border border-slate-200/50">
                        {['Perfil', 'Cuenta'].map(t => (<button key={t} type="button" onClick={() => setCatalogForm({...catalogForm, type: t})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${catalogForm.type === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:bg-slate-200/50'}`}>{t}</button>))}
                    </div>
                    <button type="submit" className="w-full py-3 bg-black text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 hover:opacity-90 transition-opacity">Agregar Servicio</button>
                </form>
            </div>

            {/* 2. REGISTRO DE PAQUETES */}
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/50">
                <h3 className="text-lg font-black text-slate-800 mb-5 flex items-center gap-2"><PackageX size={18} className="text-blue-600"/> Registrar Paquete Fijo</h3>
                
                <form onSubmit={handleAddPackageToCatalog} className="space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Nombre Base (Ej: Netflix)</label>
                        <input required type="text" className={INPUT_CLASS} value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})} />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Costo TOTAL ($)</label>
                            <input required type="number" className={INPUT_CLASS} placeholder="480" value={packageForm.cost} onChange={e => setPackageForm({...packageForm, cost: e.target.value})} />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Slots / Cupos</label>
                            <input required type="number" min="2" max="5" className={INPUT_CLASS} placeholder="2 o 3" value={packageForm.slots} onChange={e => setPackageForm({...packageForm, slots: Number(e.target.value)})} />
                        </div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-[#007AFF] text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 hover:opacity-90 transition-opacity">Crear Paquete</button>
                </form>
            </div>


            {/* 3. GESTIÓN DEL CATÁLOGO */}
            <div className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-white/50 overflow-hidden">
                <h3 className="text-lg font-black text-slate-800 p-6 pb-2">Catálogo de Servicios</h3>
                
                {/* Vista Móvil */}
                <div className="md:hidden pt-2">
                    {catalog.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                            <div>
                                <div className="font-bold text-sm text-slate-800">{s.name}</div>
                                <div className="text-xs text-slate-400 mt-0.5 flex gap-2">
                                    <span className="bg-blue-100 text-blue-600 px-1.5 rounded text-[10px] font-bold uppercase">{s.type}</span>
                                    <span>{s.defaultSlots} slots</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-slate-700 text-sm">${s.cost}</span>
                                {/* Botón de Papelera Unificado (pequeño) */}
                                <button onClick={() => triggerDeleteService(s.id)} className="p-2 w-8 h-8 flex items-center justify-center text-red-500 rounded-lg hover:bg-red-100/50"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Vista PC */}
                <table className="w-full text-left hidden md:table">
                    <thead className="bg-slate-50/50 border-b border-slate-100">
                        <tr>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400">Nombre</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400">Tipo</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400">Cupos</th>
                            <th className="px-6 py-3 text-[10px] font-bold text-slate-400">Precio</th>
                            <th className="px-6 py-3 text-right"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {catalog.map(s => (
                            <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-6 py-3 font-bold text-slate-700 text-xs">{s.name}</td>
                                <td className="px-6 py-3 text-blue-600 text-xs font-bold">{s.type}</td>
                                <td className="px-6 py-3 text-slate-500 text-xs font-bold">{s.defaultSlots}</td>
                                <td className="px-6 py-3 font-mono font-bold text-slate-700">${s.cost}</td>
                                <td className="px-6 py-3 text-right">
                                    {/* Botón de Papelera Unificado (pequeño) */}
                                    <button onClick={() => triggerDeleteService(s.id)} type="button" className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-100/50 rounded-lg transition-colors"><Trash2 size={16}/></button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* 4. UTILIDADES DE IMPORTACIÓN (Tarjeta limpia) */}
            <div className="bg-white/90 backdrop-blur-md p-6 rounded-2xl shadow-xl border border-white/50">
                <h3 className="text-xl font-black text-blue-600 mb-5 flex items-center gap-3"><FileText size={20}/> Utilidades de Importación</h3>
                <p className="text-sm text-slate-500 mb-4">Carga masiva de datos desde archivos **CSV**.</p>
                <div className="space-y-4">
                    
                    {/* Bloque de Importación de Ventas */}
                    <div className="bg-emerald-50/70 p-4 rounded-xl border border-emerald-200/50 shadow-inner">
                        <label className="flex items-center gap-2 mb-2 font-black text-sm text-emerald-800 cursor-pointer">
                            <Upload size={16}/> Importar VENTAS
                        </label>
                        <p className="text-xs text-emerald-700 mb-3 font-medium">Formato: [Cliente], [Servicio], [FechaVencimiento], [Email], [Pass], [Perfil], [Pin], [Costo], [Celular]</p>
                        {/* Botón de carga de archivo estilizado */}
                        <input type="file" accept=".csv" onChange={(e) => handleImportCSV(e, 'sales')} className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer"/>
                    </div>
                    
                    {/* Mensajes de Estado (Mantenido para compatibilidad con la función handleImportCSV original) */}
                    {importStatus && (<div className="p-3 bg-yellow-50 text-yellow-800 rounded-xl text-sm font-medium flex items-center gap-2"><AlertTriangle size={16}/> {importStatus}</div>)}
                </div>
            </div>
        </div>
    );
};

export default Config;