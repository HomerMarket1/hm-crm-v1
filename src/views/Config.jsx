// src/views/Config.jsx
import React, { useState } from 'react';
import { Settings, Plus, Trash2, Package, Users, Search, Edit2, ShieldAlert } from 'lucide-react';

const Config = ({ 
    catalog, catalogForm, setCatalogForm, packageForm, setPackageForm,
    handleAddServiceToCatalog, handleAddPackageToCatalog, handleEditCatalogService, triggerDeleteService,
    clientsDirectory, allClients, triggerDeleteClient, triggerEditClient,
    setNotification, formData, setFormData, darkMode // ✅ Recibimos darkMode
}) => {

    const [activeTab, setActiveTab] = useState('services'); // services | clients
    const [clientSearch, setClientSearch] = useState('');

    // Estilos dinámicos
    const theme = {
        card: darkMode ? 'bg-[#161B28] border-white/5 shadow-none' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50',
        cardHeader: darkMode ? 'bg-[#0B0F19] border-white/5' : 'bg-slate-50 border-slate-100',
        text: darkMode ? 'text-white' : 'text-slate-800',
        subtext: darkMode ? 'text-slate-400' : 'text-slate-500',
        input: darkMode ? 'bg-black/20 text-white placeholder-slate-500 border-white/5 focus:border-indigo-500/50' : 'bg-slate-50 text-slate-800 placeholder-slate-400 border-slate-200 focus:border-indigo-500',
        itemBg: darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100',
        sectionTitle: darkMode ? 'text-white' : 'text-slate-900',
    };

    const filteredClients = allClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            
            {/* TABS HEADER */}
            <div className={`p-1 rounded-2xl flex gap-1 w-full max-w-md mx-auto mb-8 border ${darkMode ? 'bg-[#0B0F19] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                <button onClick={() => setActiveTab('services')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'services' ? (darkMode ? 'bg-[#161B28] text-indigo-400 shadow-sm border border-white/5' : 'bg-slate-800 text-white shadow-lg') : (darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}>
                    <Package size={14}/> Catálogo
                </button>
                <button onClick={() => setActiveTab('clients')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'clients' ? (darkMode ? 'bg-[#161B28] text-indigo-400 shadow-sm border border-white/5' : 'bg-slate-800 text-white shadow-lg') : (darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}`}>
                    <Users size={14}/> Clientes ({allClients.length})
                </button>
            </div>

            {/* --- PESTAÑA SERVICIOS --- */}
            {activeTab === 'services' && (
                <>
                    {/* FORMULARIOS (Grid de 2 columnas) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        
                        {/* Nuevo Servicio */}
                        <div className={`rounded-[2rem] overflow-hidden border ${theme.card}`}>
                            <div className={`px-6 py-4 border-b flex items-center gap-3 ${theme.cardHeader}`}>
                                <div className={`p-2 rounded-lg ${darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}><Settings size={18}/></div>
                                <h3 className={`font-black text-sm uppercase tracking-wider ${theme.text}`}>Nuevo Servicio</h3>
                            </div>
                            <div className="p-6">
                                <form onSubmit={handleAddServiceToCatalog} className="space-y-4">
                                    <input type="text" placeholder="Nombre (Ej: Netflix 1 Perfil)" required className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={catalogForm.name} onChange={e => setCatalogForm({...catalogForm, name: e.target.value})}/>
                                    <div className="flex gap-4">
                                        <input type="number" placeholder="Costo $" required className={`w-1/3 p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={catalogForm.cost} onChange={e => setCatalogForm({...catalogForm, cost: e.target.value})}/>
                                        <div className={`flex-1 p-1 rounded-xl flex border ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                                            <button type="button" onClick={() => setCatalogForm({...catalogForm, type: 'Perfil'})} className={`flex-1 rounded-lg text-xs font-bold transition-all ${catalogForm.type === 'Perfil' ? (darkMode ? 'bg-[#161B28] text-white shadow-sm border border-white/5' : 'bg-white text-black shadow-sm') : 'text-slate-400'}`}>Perfil</button>
                                            <button type="button" onClick={() => setCatalogForm({...catalogForm, type: 'Cuenta'})} className={`flex-1 rounded-lg text-xs font-bold transition-all ${catalogForm.type === 'Cuenta' ? (darkMode ? 'bg-[#161B28] text-white shadow-sm border border-white/5' : 'bg-white text-black shadow-sm') : 'text-slate-400'}`}>Cuenta</button>
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full py-3 bg-[#0B0F19] hover:bg-black text-white rounded-xl font-bold text-sm shadow-lg shadow-slate-900/10 border border-white/10">Guardar</button>
                                </form>
                            </div>
                        </div>

                        {/* Crear Paquete */}
                        <div className={`rounded-[2rem] overflow-hidden border ${theme.card}`}>
                            <div className={`px-6 py-4 border-b flex items-center gap-3 ${theme.cardHeader}`}>
                                <div className={`p-2 rounded-lg ${darkMode ? 'bg-purple-500/10 text-purple-400' : 'bg-purple-100 text-purple-600'}`}><Package size={18}/></div>
                                <h3 className={`font-black text-sm uppercase tracking-wider ${theme.text}`}>Crear Paquete</h3>
                            </div>
                            <div className="p-6">
                                <form onSubmit={handleAddPackageToCatalog} className="space-y-4">
                                    <input type="text" placeholder="Nombre Base (Ej: Netflix)" required className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})}/>
                                    <div className="flex gap-4">
                                        <div className="w-1/2 space-y-1">
                                            <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Costo Total</label>
                                            <input type="number" required className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={packageForm.cost} onChange={e => setPackageForm({...packageForm, cost: e.target.value})}/>
                                        </div>
                                        <div className="w-1/2 space-y-1">
                                            <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Perfiles</label>
                                            <input type="number" required className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={packageForm.slots} onChange={e => setPackageForm({...packageForm, slots: e.target.value})}/>
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20">Crear Paquete</button>
                                </form>
                            </div>
                        </div>
                    </div>

                    {/* LISTA CATÁLOGO */}
                    <div className={`rounded-[2rem] p-6 border mt-6 ${theme.card}`}>
                        <h3 className={`text-xs font-bold uppercase tracking-widest mb-4 ml-1 ${theme.subtext}`}>Catálogo Actual</h3>
                        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                            {catalog.map((item) => (
                                <div key={item.id} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${theme.itemBg}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1 bg-indigo-500 h-8 rounded-full`}></div>
                                        <div>
                                            <p className={`font-bold text-sm ${theme.text}`}>{item.name}</p>
                                            <div className="flex gap-2">
                                                <span className={`text-[10px] font-bold uppercase ${theme.subtext}`}>{item.type}</span>
                                                {item.defaultSlots > 1 && <span className="text-[10px] font-bold text-indigo-500">• {item.defaultSlots} cupos</span>}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={`font-black text-sm ${theme.text}`}>${item.cost}</span>
                                        <div className="flex gap-1">
                                            <button 
                                                onClick={() => {
                                                    const newCost = prompt(`Nuevo costo para ${item.name}:`, item.cost);
                                                    if(newCost && !isNaN(newCost)) handleEditCatalogService(item.id, { cost: parseFloat(newCost) });
                                                }}
                                                className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10 text-slate-500 hover:text-white' : 'hover:bg-slate-200 text-slate-400 hover:text-slate-600'}`}
                                            >
                                                <Edit2 size={14}/>
                                            </button>
                                            <button 
                                                onClick={() => triggerDeleteService(item.id)}
                                                className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-rose-500/20 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* --- PESTAÑA CLIENTES --- */}
            {activeTab === 'clients' && (
                <div className={`rounded-[2rem] p-6 border ${theme.card}`}>
                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                        <div>
                            <h2 className={`text-xl font-black ${theme.sectionTitle}`}>Directorio de Clientes</h2>
                            <p className={`text-xs font-bold uppercase tracking-wider ${theme.subtext}`}>Gestión de Contactos</p>
                        </div>
                        <div className="relative group w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16}/>
                            <input 
                                type="text" 
                                placeholder="Buscar cliente..." 
                                className={`w-full pl-10 pr-4 py-2 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`}
                                value={clientSearch}
                                onChange={e => setClientSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredClients.map((client, idx) => (
                            <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${theme.itemBg}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                                        {client.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className={`font-bold text-sm truncate ${theme.text}`}>{client.name}</p>
                                        <p className={`text-xs font-medium truncate ${theme.subtext}`}>{client.phone}</p>
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => triggerEditClient(client)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-white/10 text-slate-400' : 'hover:bg-slate-200 text-slate-500'}`}><Edit2 size={14}/></button>
                                    <button onClick={() => triggerDeleteClient(client.id)} className={`p-2 rounded-lg transition-colors ${darkMode ? 'hover:bg-rose-500/20 text-slate-400 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-500 hover:text-rose-500'}`}><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Config;