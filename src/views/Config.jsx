// src/views/Config.jsx (DISEÑO ESTILO MACOS SETTINGS / CENTRO DE CONTROL)

import React, { useState } from 'react';
import { 
    Plus, Package, Trash2, FileText, Upload, AlertTriangle, 
    Edit2, Search, Settings, Users, Box, Zap, Download 
} from 'lucide-react';

const Config = ({
    catalog,
    catalogForm, setCatalogForm,
    packageForm, setPackageForm,
    handleAddServiceToCatalog,
    handleAddPackageToCatalog,
    handleImportCSV,
    importStatus,
    triggerDeleteService,
    clientsDirectory, 
    allClients, 
    triggerDeleteClient, 
    triggerEditClient,   
    setNotification, 
    formData, setFormData 
}) => {
    // ESTADOS LOCALES
    const [configTab, setConfigTab] = useState('catalog'); 
    const [editingClient, setEditingClient] = useState(null); 
    const [searchTerm, setSearchTerm] = useState(''); 
    
    // FILTRADO DE CLIENTES
    const filteredClients = allClients.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (client.phone && client.phone.includes(searchTerm))
    );

    // HANDLERS CLIENTES
    const handleStartEdit = (client) => {
        const directoryEntry = clientsDirectory.find(d => d.name === client.name);
        setEditingClient({ 
            id: directoryEntry?.id || null, 
            name: client.name, 
            phone: client.phone 
        });
    };
    
    const handleSaveEdit = (e) => {
        e.preventDefault();
        triggerEditClient(editingClient.id, editingClient.name, editingClient.phone);
        setEditingClient(null); 
    };

    // CLASES DE ESTILO (IOS STYLE)
    const INPUT_STYLE = "w-full p-3 bg-slate-100/50 border border-slate-200/50 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400";
    const SECTION_CARD = "bg-white/80 backdrop-blur-xl border border-white/60 shadow-sm rounded-[24px] p-6 mb-6";
    const ICON_BOX = (colorBg, colorText) => `w-8 h-8 rounded-lg flex items-center justify-center ${colorBg} ${colorText} shadow-sm`;

    return (
        <div className="w-full pb-32 space-y-6">
            
            {/* 0. NAVEGACIÓN TIPO "SEGMENTED CONTROL" */}
            <div className="sticky top-0 z-30 bg-[#F2F2F7]/80 backdrop-blur-xl py-2 -mx-1 px-1">
                <div className="flex p-1 bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
                    <button onClick={() => setConfigTab('catalog')} 
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${configTab === 'catalog' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:bg-white/40'}`}>
                        <Settings size={14}/> Sistema & Catálogo
                    </button>
                    <button onClick={() => setConfigTab('clients')} 
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${configTab === 'clients' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:bg-white/40'}`}>
                        <Users size={14}/> Directorio ({allClients.length})
                    </button>
                </div>
            </div>

            {/* --- VISTA 1: CATÁLOGO Y UTILIDADES --- */}
            {configTab === 'catalog' && (
                <div className="animate-in slide-in-from-bottom-4 duration-300">
                    
                    {/* BLOQUE A: NUEVOS SERVICIOS (Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        
                        {/* 1. Agregar Servicio Simple */}
                        <div className={SECTION_CARD + " mb-0"}>
                            <div className="flex items-center gap-3 mb-5">
                                <div className={ICON_BOX('bg-blue-100', 'text-blue-600')}><Box size={16}/></div>
                                <h3 className="font-bold text-slate-800 text-sm">Nuevo Servicio</h3>
                            </div>
                            <form onSubmit={handleAddServiceToCatalog} className="space-y-3">
                                <input required type="text" className={INPUT_STYLE} placeholder="Nombre (Ej: Netflix 1 Perfil)" value={catalogForm.name} onChange={e => setCatalogForm({...catalogForm, name: e.target.value})} />
                                <div className="flex gap-2">
                                    <input required type="number" className={INPUT_STYLE} placeholder="Costo $" value={catalogForm.cost} onChange={e => setCatalogForm({...catalogForm, cost: e.target.value})} />
                                    <input required type="number" className={INPUT_STYLE} placeholder="Cupos" value={catalogForm.defaultSlots} onChange={e => setCatalogForm({...catalogForm, defaultSlots: e.target.value})} />
                                </div>
                                <div className="flex p-1 bg-slate-100/50 rounded-xl border border-slate-200/50">
                                    {['Perfil', 'Cuenta'].map(t => (
                                        <button key={t} type="button" onClick={() => setCatalogForm({...catalogForm, type: t})} 
                                            className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${catalogForm.type === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>
                                            {t}
                                        </button>
                                    ))}
                                </div>
                                <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-lg hover:scale-[1.02] active:scale-95 transition-all">
                                    Guardar Servicio
                                </button>
                            </form>
                        </div>

                        {/* 2. Agregar Paquete */}
                        <div className={SECTION_CARD + " mb-0"}>
                            <div className="flex items-center gap-3 mb-5">
                                <div className={ICON_BOX('bg-indigo-100', 'text-indigo-600')}><Package size={16}/></div>
                                <h3 className="font-bold text-slate-800 text-sm">Crear Paquete</h3>
                            </div>
                            <form onSubmit={handleAddPackageToCatalog} className="space-y-3">
                                <input required type="text" className={INPUT_STYLE} placeholder="Nombre Base (Ej: Netflix)" value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})} />
                                <div className="flex gap-2">
                                    <input required type="number" className={INPUT_STYLE} placeholder="Costo Total" value={packageForm.cost} onChange={e => setPackageForm({...packageForm, cost: e.target.value})} />
                                    <input required type="number" min="2" max="5" className={INPUT_STYLE} placeholder="Slots" value={packageForm.slots} onChange={e => setPackageForm({...packageForm, slots: Number(e.target.value)})} />
                                </div>
                                <div className="p-4"></div> {/* Espaciador visual */}
                                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">
                                    Crear Paquete
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* BLOQUE B: LISTA DE CATÁLOGO (Estilo iOS List) */}
                    <div className={SECTION_CARD + " p-0 overflow-hidden"}>
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Catálogo Actual</h3>
                        </div>
                        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                            {catalog.map(s => (
                                <div key={s.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-8 rounded-full ${s.type === 'Paquete' ? 'bg-indigo-500' : 'bg-blue-500'}`}/>
                                        <div>
                                            <div className="font-bold text-sm text-slate-800">{s.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex gap-2">
                                                <span>{s.type}</span> • <span>{s.defaultSlots} Cupos</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className="font-mono font-bold text-slate-700">${s.cost}</span>
                                        <button onClick={() => triggerDeleteService(s.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {catalog.length === 0 && <p className="p-6 text-center text-slate-400 text-xs">Catálogo vacío.</p>}
                        </div>
                    </div>

                    {/* BLOQUE C: IMPORTACIÓN (Zona de Peligro / Utilidades) */}
                    <div className={SECTION_CARD + " border-emerald-100/50 bg-emerald-50/30"}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className={ICON_BOX('bg-emerald-100', 'text-emerald-600')}><FileText size={16}/></div>
                            <div>
                                <h3 className="font-bold text-slate-800 text-sm">Importación de Datos</h3>
                                <p className="text-[10px] text-slate-500">Carga masiva vía CSV</p>
                            </div>
                        </div>
                        
                        <div className="relative group cursor-pointer">
                            <div className="absolute inset-0 bg-emerald-100 rounded-xl opacity-0 group-hover:opacity-50 transition-opacity"/>
                            <div className="relative border-2 border-dashed border-emerald-200 rounded-xl p-6 text-center transition-all group-hover:border-emerald-400">
                                <Upload size={24} className="mx-auto text-emerald-400 mb-2"/>
                                <p className="text-xs font-bold text-emerald-700">Toca para subir CSV de Ventas</p>
                                <input type="file" accept=".csv" onChange={(e) => handleImportCSV(e, 'sales')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/>
                            </div>
                        </div>
                        {importStatus && (<div className="mt-3 p-3 bg-white/60 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2"><Zap size={14}/> {importStatus}</div>)}
                    </div>
                </div>
            )}

            {/* --- VISTA 2: DIRECTORIO DE CLIENTES --- */}
            {configTab === 'clients' && (
                <div className="animate-in slide-in-from-right-4 duration-300">
                    
                    {/* Buscador de Contactos */}
                    <div className="relative mb-6">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                            <Search className="text-slate-400" size={18} />
                        </div>
                        <input type="text" placeholder="Buscar en el directorio..." 
                            className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-xl border border-white/50 rounded-[20px] text-sm font-bold text-slate-700 outline-none shadow-sm focus:bg-white transition-all placeholder:text-slate-400"
                            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>

                    {/* Lista de Tarjetas de Contacto */}
                    <div className="space-y-2">
                        {allClients.length === 0 ? ( 
                            <div className="text-center py-20 text-slate-400">
                                <Users size={48} className="mx-auto mb-4 opacity-20"/>
                                <p className="text-xs font-bold">Sin clientes registrados</p>
                            </div>
                        ) : (
                            filteredClients.map((client, index) => {
                                const directoryEntry = clientsDirectory.find(d => d.name === client.name);
                                const canEditDelete = !!directoryEntry; 

                                return (
                                    <div key={index} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                                        {/* Modo Edición */}
                                        {editingClient && editingClient.id === directoryEntry?.id ? (
                                            <form onSubmit={handleSaveEdit} className="flex-1 flex gap-2">
                                                <input required type="text" className={INPUT_STYLE} value={editingClient.name} onChange={e => setEditingClient({...editingClient, name: e.target.value})} placeholder="Nombre" autoFocus/>
                                                <input type="text" className={INPUT_STYLE} value={editingClient.phone} onChange={e => setEditingClient({...editingClient, phone: e.target.value})} placeholder="Tel" />
                                                <button type="submit" className="p-3 bg-blue-600 text-white rounded-xl"><Download size={16}/></button>
                                                <button type="button" onClick={() => setEditingClient(null)} className="p-3 bg-slate-200 text-slate-600 rounded-xl"><X size={16}/></button>
                                            </form>
                                        ) : (
                                            /* Modo Visualización */
                                            <>
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-slate-200 to-slate-100 flex items-center justify-center text-slate-500 font-black text-sm border border-white">
                                                        {client.name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-sm text-slate-800">{client.name}</div>
                                                        <div className="text-xs text-slate-500 font-medium">{client.phone || 'Sin teléfono'}</div>
                                                    </div>
                                                </div>
                                                
                                                <div className="flex gap-2 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {canEditDelete ? (
                                                        <>
                                                            <button onClick={() => handleStartEdit(client)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors"><Edit2 size={14}/></button>
                                                            <button onClick={() => triggerDeleteClient(directoryEntry.id)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"><Trash2 size={14}/></button>
                                                        </>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-lg border border-amber-100">Solo Ventas</span>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Config;