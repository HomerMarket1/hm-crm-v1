// src/views/Config.jsx
import React from 'react';
import { Plus, PackageX, Trash2, FileText, Upload, AlertTriangle } from 'lucide-react';

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
        // ✅ CORTAR Y PEGAR ESTE BLOQUE
        <div className="space-y-6 w-full pb-20">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><Plus size={16} className="text-blue-600"/> Nuevo Servicio</h3>
                <form onSubmit={handleAddServiceToCatalog} className="space-y-3">
                    <input required type="text" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" placeholder="Nombre (Ej: Netflix)" value={catalogForm.name} onChange={e => setCatalogForm({...catalogForm, name: e.target.value})} />
                    <div className="flex gap-2">
                        <input required type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" placeholder="Costo ($)" value={catalogForm.cost} onChange={e => setCatalogForm({...catalogForm, cost: e.target.value})} />
                        <input required type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" placeholder="Cupos" value={catalogForm.defaultSlots} onChange={e => setCatalogForm({...catalogForm, defaultSlots: e.target.value})} />
                    </div>
                    <div className="flex gap-2">
                        {['Perfil', 'Cuenta'].map(t => (<button key={t} type="button" onClick={() => setCatalogForm({...catalogForm, type: t})} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${catalogForm.type === t ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-slate-100 text-slate-400'}`}>{t}</button>))}
                    </div>
                    <button type="submit" className="w-full py-3 bg-black text-white rounded-xl font-bold text-xs shadow-lg active:scale-95">Agregar</button>
                </form>
            </div>

            {/* REGISTRO DE PAQUETES (MÁS SENCILLO Y VISIBLE) */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><PackageX size={16} className="text-blue-600"/> Registrar Paquete Fijo</h3>
                <form onSubmit={handleAddPackageToCatalog} className="space-y-3">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Nombre Base (Ej: Netflix)</label><input required type="text" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})} /></div>
                    <div className="grid grid-cols-2 gap-3">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Costo TOTAL ($)</label><input required type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" placeholder="480" value={packageForm.cost} onChange={e => setPackageForm({...packageForm, cost: e.target.value})} /></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Slots / Cupos</label><input required type="number" min="2" max="5" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" placeholder="2 o 3" value={packageForm.slots} onChange={e => setPackageForm({...packageForm, slots: Number(e.target.value)})} /></div>
                    </div>
                    <button type="submit" className="w-full py-3 bg-[#007AFF] text-white rounded-xl font-bold text-xs shadow-lg active:scale-95">Crear Paquete</button>
                </form>
            </div>


            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="md:hidden">
                    {catalog.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0">
                            <div>
                                <div className="font-bold text-sm text-slate-800">{s.name}</div>
                                <div className="text-xs text-slate-400 mt-0.5 flex gap-2">
                                    <span className="bg-slate-100 px-1.5 rounded text-[10px] font-bold uppercase">{s.type}</span>
                                    <span>{s.defaultSlots} slots</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="font-mono font-bold text-slate-700 text-sm">${s.cost}</span>
                                <button onClick={() => triggerDeleteService(s.id)} className="p-2 text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={16}/></button>
                            </div>
                        </div>
                    ))}
                </div>

                <table className="w-full text-left hidden md:table">
                    <thead className="bg-slate-50/50 border-b border-slate-100"><tr><th className="px-4 py-3 text-[10px] font-bold text-slate-400">Nombre</th><th className="px-4 py-3 text-[10px] font-bold text-slate-400">Tipo</th><th className="px-4 py-3 text-[10px] font-bold text-slate-400">Cupos</th><th className="px-4 py-3 text-[10px] font-bold text-slate-400">Precio</th><th className="px-4 py-3 text-right"></th></tr></thead>
                    <tbody className="divide-y divide-slate-50">{catalog.map(s => (<tr key={s.id}><td className="px-4 py-3 font-bold text-slate-700 text-xs">{s.name}</td><td className="px-4 py-3 text-slate-400 text-xs font-bold">{s.type}</td><td className="px-4 py-3 text-slate-400 text-xs font-bold">{s.defaultSlots}</td><td className="px-4 py-3 font-mono font-bold text-slate-700">${s.cost}</td><td className="px-4 py-3 text-right"><button onClick={() => triggerDeleteService(s.id)} type="button" className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button></td></tr>))}</tbody>
                </table>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-xl font-black text-blue-600 mb-4 flex items-center gap-3"><FileText size={20}/> Utilidades de Importación</h3>
                <p className="text-xs text-slate-500 mb-4">Carga tus datos de tu hoja de Excel guardados como archivos **CSV**.</p>
                <div className="space-y-4">
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                        <label className="flex items-center gap-2 mb-2 font-bold text-sm text-emerald-800 cursor-pointer">
                            <Upload size={16}/> Importar VENTAS Masivas
                        </label>
                        <p className="text-xs text-emerald-600 mb-3 font-medium">Sube tu hoja de ventas completa. <br/>Formato: [Cliente], [Servicio], [FechaVencimiento], [Email], [Pass], [Perfil], [Pin], [Costo], [Celular]</p>
                        <input type="file" accept=".csv" onChange={(e) => handleImportCSV(e, 'sales')} className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer"/>
                    </div>
                    {importStatus && (<div className="p-3 bg-yellow-50 text-yellow-800 rounded-xl text-sm font-medium flex items-center gap-2"><AlertTriangle size={16}/> {importStatus}</div>)}
                </div>
            </div>
        </div>
    );
};

export default Config;