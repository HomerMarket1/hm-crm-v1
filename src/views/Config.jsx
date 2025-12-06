// src/views/Config.jsx (FINAL: GESTIÓN Y EDICIÓN DE CATÁLOGO)

import React, { useState } from 'react';
import { 
    Plus, Package, Trash2, FileText, Upload, AlertTriangle, 
    Edit2, Search, Settings, Users, Box, Zap, Download, Skull, AlertOctagon, X 
} from 'lucide-react';

// Importaciones para el borrado total (se mantienen)
import { db, auth } from '../firebase/config';
import { collection, getDocs, writeBatch } from 'firebase/firestore';

const Config = ({
    catalog,
    catalogForm, setCatalogForm,
    packageForm, setPackageForm,
    handleAddServiceToCatalog,
    handleAddPackageToCatalog,
    handleEditCatalogService, // <--- NUEVO PROP: Función para guardar edición
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
    
    const [configTab, setConfigTab] = useState('catalog'); 
    const [searchTerm, setSearchTerm] = useState(''); 
    
    // ✅ ESTADO DE EDICIÓN DE CLIENTES
    const [editingTarget, setEditingTarget] = useState(null); 

    // 🔥 NUEVO ESTADO: Para el modal de edición del catálogo
    const [editingService, setEditingService] = useState(null);
    
    // FILTRADO
    const filteredClients = allClients.filter(client => 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (client.phone && client.phone.includes(searchTerm))
    );

    // --- HANDLERS SEGUROS ---
    const handleStartEdit = (client) => {
        // Buscamos si existe en el directorio real
        const directoryEntry = clientsDirectory.find(d => d.name === client.name);
        
        setEditingTarget({ 
            id: directoryEntry?.id || null, // Si es null, es un cliente de "Solo Ventas"
            originalName: client.name,      // CLAVE: Guardamos el nombre original para encontrarlo
            name: client.name, 
            phone: client.phone || ''
        });
    };
    
    const handleSaveEdit = (e) => {
        e.preventDefault();
        // Pasamos el originalName para poder actualizar las ventas antiguas
        triggerEditClient(editingTarget.id, editingTarget.name, editingTarget.phone, editingTarget.originalName);
        setEditingTarget(null); 
    };

    // 🔥 NUEVA FUNCIÓN: Manejar el guardado del servicio de catálogo
    const handleSaveServiceEdit = async (e) => {
        e.preventDefault();
        const success = await handleEditCatalogService(editingService.id, {
            name: editingService.name,
            cost: Number(editingService.cost),
            defaultSlots: Number(editingService.defaultSlots),
            type: editingService.type,
        });
        if (success) {
            setEditingService(null); // Cerrar modal al guardar
        }
    };

    const handleNukeDatabase = async () => {
        if(!window.confirm("⚠️ ¿BORRAR TODA LA BASE DE DATOS? (Irreversible)")) return;
        if(!window.confirm("Confirma una segunda vez: Se borrarán Ventas, Clientes y Catálogo.")) return;
        
        const user = auth.currentUser;
        if (!user) return;
        const userPath = `users/${user.uid}`;
        setNotification({ show: true, message: '☢️ Borrando todo...', type: 'warning' });
        
        try {
            const batch = writeBatch(db);
            const salesSnap = await getDocs(collection(db, userPath, 'sales'));
            salesSnap.forEach(d => batch.delete(d.ref));
            const catSnap = await getDocs(collection(db, userPath, 'catalog'));
            catSnap.forEach(d => batch.delete(d.ref));
            const cliSnap = await getDocs(collection(db, userPath, 'clients'));
            cliSnap.forEach(d => batch.delete(d.ref));
            await batch.commit();
            setNotification({ show: true, message: '✅ Base de datos reiniciada.', type: 'success' });
            setTimeout(() => window.location.reload(), 1500);
        } catch (error) {
            setNotification({ show: true, message: 'Error de cuota o permisos.', type: 'error' });
        }
    };

    // CLASES
    const INPUT_STYLE = "w-full p-3 bg-slate-100/50 border border-slate-200/50 rounded-xl text-xs font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/10 transition-all placeholder:text-slate-400";
    const SECTION_CARD = "bg-white/80 backdrop-blur-xl border border-white/60 shadow-sm rounded-[24px] p-6 mb-6";
    const ICON_BOX = (colorBg, colorText) => `w-8 h-8 rounded-lg flex items-center justify-center ${colorBg} ${colorText} shadow-sm`;

    return (
        <div className="w-full pb-32 space-y-6">
            
            {/* TABS */}
            <div className="sticky top-0 z-30 bg-[#F2F2F7]/80 backdrop-blur-xl py-2 -mx-1 px-1">
                <div className="flex p-1 bg-white/60 backdrop-blur-md rounded-2xl border border-white/50 shadow-sm">
                    <button onClick={() => setConfigTab('catalog')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${configTab === 'catalog' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:bg-white/40'}`}>
                        <Settings size={14}/> Sistema
                    </button>
                    <button onClick={() => setConfigTab('clients')} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${configTab === 'clients' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-400 hover:bg-white/40'}`}>
                        <Users size={14}/> Clientes ({allClients.length})
                    </button>
                </div>
            </div>

            {/* --- MODAL DE EDICIÓN DE CATÁLOGO --- */}
            {editingService && (
                <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-300 p-4">
                    <div className="w-full max-w-sm bg-white rounded-[24px] p-6 shadow-2xl">
                        <h3 className="text-xl font-black text-slate-800 mb-4">Editar Servicio</h3>
                        <form onSubmit={handleSaveServiceEdit} className="space-y-4">
                            <input required type="text" className={INPUT_STYLE} placeholder="Nombre" value={editingService.name} onChange={e => setEditingService({...editingService, name: e.target.value})} />
                            <div className="flex gap-2">
                                <input required type="number" className={INPUT_STYLE} placeholder="Costo $" value={editingService.cost} onChange={e => setEditingService({...editingService, cost: e.target.value})} />
                                <input required type="number" min="1" className={INPUT_STYLE} placeholder="Cupos" value={editingService.defaultSlots} onChange={e => setEditingService({...editingService, defaultSlots: e.target.value})} />
                            </div>
                            <div className="flex p-1 bg-slate-100/50 rounded-xl border border-slate-200/50">
                                {['Perfil', 'Cuenta', 'Paquete'].map(t => (<button key={t} type="button" onClick={() => setEditingService({...editingService, type: t})} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${editingService.type === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>{t}</button>))}
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="button" onClick={() => setEditingService(null)} className="flex-1 py-3 bg-slate-100 text-slate-500 rounded-xl font-bold text-xs">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs">Guardar Cambios</button>
                            </div>
                            <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold flex items-center gap-2"><AlertOctagon size={16}/> Cambiará el stock y futuras ventas.</div>
                        </form>
                    </div>
                </div>
            )}
            {/* --- FIN MODAL DE EDICIÓN DE CATÁLOGO --- */}


            {configTab === 'catalog' && (
                <div className="animate-in slide-in-from-bottom-4 duration-300">
                    {/* ... (SECCIÓN DE CREACIÓN DE SERVICIOS Y PAQUETES) ... */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div className={SECTION_CARD + " mb-0"}>
                            <div className="flex items-center gap-3 mb-5"><div className={ICON_BOX('bg-blue-100', 'text-blue-600')}><Box size={16}/></div><h3 className="font-bold text-slate-800 text-sm">Nuevo Servicio</h3></div>
                            <form onSubmit={handleAddServiceToCatalog} className="space-y-3">
                                <input required type="text" className={INPUT_STYLE} placeholder="Nombre (Ej: Netflix 1 Perfil)" value={catalogForm.name} onChange={e => setCatalogForm({...catalogForm, name: e.target.value})} />
                                <div className="flex gap-2"><input required type="number" className={INPUT_STYLE} placeholder="Costo $" value={catalogForm.cost} onChange={e => setCatalogForm({...catalogForm, cost: e.target.value})} /><input required type="number" min="1" className={INPUT_STYLE} placeholder="Cupos" value={catalogForm.defaultSlots} onChange={e => setCatalogForm({...catalogForm, defaultSlots: e.target.value})} /></div>
                                <div className="flex p-1 bg-slate-100/50 rounded-xl border border-slate-200/50">{['Perfil', 'Cuenta'].map(t => (<button key={t} type="button" onClick={() => setCatalogForm({...catalogForm, type: t})} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition-all ${catalogForm.type === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>{t}</button>))}</div>
                                <button type="submit" className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-lg hover:scale-[1.02] active:scale-95 transition-all">Guardar</button>
                            </form>
                        </div>
                        <div className={SECTION_CARD + " mb-0"}>
                            <div className="flex items-center gap-3 mb-5"><div className={ICON_BOX('bg-indigo-100', 'text-indigo-600')}><Package size={16}/></div><h3 className="font-bold text-slate-800 text-sm">Crear Paquete</h3></div>
                            <form onSubmit={handleAddPackageToCatalog} className="space-y-3">
                                <input required type="text" className={INPUT_STYLE} placeholder="Nombre Base (Ej: Netflix)" value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})} />
                                <div className="flex gap-2"><input required type="number" className={INPUT_STYLE} placeholder="Costo Total" value={packageForm.cost} onChange={e => setPackageForm({...packageForm, cost: e.target.value})} /><input required type="number" min="2" max="5" className={INPUT_STYLE} placeholder="Slots" value={packageForm.slots} onChange={e => setPackageForm({...packageForm, slots: Number(e.target.value)})} /></div>
                                <div className="p-4"></div>
                                <button type="submit" className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95 transition-all">Crear Paquete</button>
                            </form>
                        </div>
                    </div>
                    {/* --- TABLA DE CATÁLOGO ACTUAL --- */}
                    <div className={SECTION_CARD + " p-0 overflow-hidden"}>
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50"><h3 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Catálogo Actual</h3></div>
                        <div className="divide-y divide-slate-100 max-h-[300px] overflow-y-auto">
                            {catalog.map(s => (
                                <div key={s.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-8 rounded-full ${s.type === 'Paquete' ? 'bg-indigo-500' : 'bg-blue-500'}`}/>
                                        <div>
                                            <div className="font-bold text-sm text-slate-800">{s.name}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wide flex gap-2">
                                                <span>{s.type}</span> • 
                                                <span>{s.defaultSlots} Cupos</span>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-slate-700">${s.cost}</span>
                                        
                                        {/* 🔥 BOTÓN DE EDICIÓN (NUEVO) */}
                                        <button 
                                            onClick={() => setEditingService({ id: s.id, name: s.name, cost: s.cost, defaultSlots: s.defaultSlots, type: s.type })} 
                                            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-all"
                                            title="Editar Costo y Cupos"
                                        >
                                            <Edit2 size={16}/>
                                        </button>
                                        
                                        <button onClick={() => triggerDeleteService(s.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"><Trash2 size={16}/></button>
                                    </div>
                                </div>
                            ))}
                            {catalog.length === 0 && <p className="p-6 text-center text-slate-400 text-xs">Catálogo vacío.</p>}
                        </div>
                    </div>
                    <div className={SECTION_CARD + " border-emerald-100/50 bg-emerald-50/30"}>
                        <div className="flex items-center gap-3 mb-4"><div className={ICON_BOX('bg-emerald-100', 'text-emerald-600')}><FileText size={16}/></div><div><h3 className="font-bold text-slate-800 text-sm">Importación</h3><p className="text-[10px] text-slate-500">Carga masiva vía CSV</p></div></div>
                        <div className="relative group cursor-pointer bg-white/50 hover:bg-white rounded-xl transition-all border border-emerald-100 border-dashed"><div className="relative p-6 text-center"><Upload size={24} className="mx-auto text-emerald-400 mb-2"/><p className="text-xs font-bold text-emerald-700">Toca para subir CSV</p><input type="file" accept=".csv" onChange={(e) => handleImportCSV(e, 'sales')} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"/></div></div>
                        {importStatus && (<div className="mt-3 p-3 bg-white/60 rounded-xl text-xs font-bold text-emerald-700 flex items-center gap-2"><Zap size={14}/> {importStatus}</div>)}
                    </div>
                    <div className="mt-8 border-t border-slate-200 pt-8"><div className="bg-rose-50/50 border border-rose-100 rounded-[24px] p-6"><button onClick={handleNukeDatabase} className="w-full py-4 bg-white border-2 border-rose-100 text-rose-600 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white hover:border-rose-500 transition-all flex items-center justify-center gap-2"><Skull size={16}/> RESETEAR BASE DE DATOS</button></div></div>
                </div>
            )}

            {configTab === 'clients' && (
                <div className="animate-in slide-in-from-right-4 duration-300">
                    <div className="relative mb-6">
                        <Search className="absolute inset-y-0 left-4 my-auto text-slate-400" size={18} />
                        <input type="text" placeholder="Buscar..." className="w-full pl-12 pr-4 py-4 bg-white/70 backdrop-blur-xl border border-white/50 rounded-[20px] text-sm font-bold text-slate-700 outline-none shadow-sm focus:bg-white transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>

                    <div className="space-y-2">
                        {filteredClients.map((client, index) => {
                            // Detectamos si existe en directorio real
                            const directoryEntry = clientsDirectory.find(d => d.name === client.name);
                            const isSaved = !!directoryEntry; 

                            // Determinamos si es este el que se está editando
                            const isEditing = editingTarget && editingTarget.originalName === client.name;

                            return (
                                <div key={index} className="bg-white/80 backdrop-blur-md p-4 rounded-2xl border border-white/50 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                                    
                                    {isEditing ? (
                                        <form onSubmit={handleSaveEdit} className="flex-1 flex gap-2">
                                            <input required className={INPUT_STYLE} value={editingTarget.name} onChange={e => setEditingTarget({...editingTarget, name: e.target.value})} placeholder="Nombre" autoFocus/>
                                            <input className={INPUT_STYLE} value={editingTarget.phone} onChange={e => setEditingTarget({...editingTarget, phone: e.target.value})} placeholder="Tel" />
                                            <button type="submit" className="p-3 bg-blue-600 text-white rounded-xl"><Download size={16}/></button>
                                            <button type="button" onClick={() => setEditingTarget(null)} className="p-3 bg-slate-200 text-slate-600 rounded-xl"><X size={16}/></button>
                                        </form>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm border-2 ${isSaved ? 'bg-slate-100 text-slate-600 border-white' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>
                                                    {client.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm text-slate-800">{client.name}</div>
                                                    <div className="text-xs text-slate-500 font-medium flex gap-2 items-center">
                                                        {client.phone || 'Sin teléfono'}
                                                        {!isSaved && <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 rounded font-bold">Solo Ventas</span>}
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div className="flex gap-2">
                                                <button onClick={() => handleStartEdit(client)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-600 flex items-center justify-center transition-colors"><Edit2 size={14}/></button>
                                                
                                                {/* Botón Borrar: Solo habilitado si está en directorio */}
                                                {isSaved ? (
                                                    <button onClick={() => triggerDeleteClient(directoryEntry.id)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center transition-colors"><Trash2 size={14}/></button>
                                                ) : (
                                                    <button onClick={() => alert("Este cliente solo existe porque tiene ventas activas.\n\nPara eliminarlo, debes borrar sus ventas en el Tablero.")} className="w-8 h-8 rounded-full bg-slate-50 text-slate-300 cursor-not-allowed flex items-center justify-center"><Trash2 size={14}/></button>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Config;