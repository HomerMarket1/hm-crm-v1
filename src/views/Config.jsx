// src/views/Config.jsx
import React, { useState, useRef } from 'react';
import { 
    Settings, Plus, Trash2, Package, Users, Search, Edit2, 
    ShieldAlert, Layers, Database, UploadCloud, FileSpreadsheet, 
    CheckCircle2, AlertTriangle, Download, Box, Save, Archive 
} from 'lucide-react';
import { useCRMActions } from '../hooks/useCRMActions'; 
import { useDataSync } from '../hooks/useDataSync';

const Config = ({ 
    sales, // ✅ RECIBIMOS SALES PARA EL BACKUP
    catalog, catalogForm, setCatalogForm, packageForm, setPackageForm,
    handleAddServiceToCatalog, handleAddPackageToCatalog, handleEditCatalogService, triggerDeleteService,
    clientsDirectory, allClients, triggerDeleteClient, triggerEditClient,
    setNotification, formData, setFormData, darkMode 
}) => {
    
    const { user } = useDataSync();
    const crmActions = useCRMActions(user, setNotification);

    const [activeTab, setActiveTab] = useState('services'); 
    const [clientSearch, setClientSearch] = useState('');
    
    // Estados Migración
    const [migrationPreview, setMigrationPreview] = useState(null);
    const [isMigrating, setIsMigrating] = useState(false);
    const fileInputRef = useRef(null);

    const individualServices = catalog.filter(s => s.type !== 'Paquete');
    const packageServices = catalog.filter(s => s.type === 'Paquete');

    // 🎨 TEMA DINÁMICO
    const theme = {
        card: darkMode ? 'bg-[#161B28] border-white/5 shadow-none' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50',
        cardHeader: darkMode ? 'bg-[#0B0F19] border-white/5' : 'bg-slate-50 border-slate-100',
        text: darkMode ? 'text-white' : 'text-slate-800',
        subtext: darkMode ? 'text-slate-400' : 'text-slate-500',
        input: darkMode ? 'bg-black/20 text-white placeholder-slate-500 border-white/5 focus:border-indigo-500/50' : 'bg-slate-50 text-slate-800 placeholder-slate-400 border-slate-200 focus:border-indigo-500',
        itemBg: darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100',
        sectionTitle: darkMode ? 'text-white' : 'text-slate-900',
        tabActive: darkMode ? 'bg-[#161B28] text-indigo-400 shadow-sm border border-white/5' : 'bg-slate-800 text-white shadow-lg',
        tabInactive: darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600',
    };

    const filteredClients = allClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase()));

    // --- LOGICA DESCARGAS ---
    
    // 1. Plantilla (Excel-Ready)
    const downloadTemplate = () => {
        // \uFEFF es el BOM (Byte Order Mark) para que Excel abra UTF-8 correctamente
        const bom = "\uFEFF"; 
        const headers = "Cliente,Celular,Servicio,Correo,Contraseña,Perfil,PIN,Vencimiento,Precio";
        const example = "Juan Perez,5551234,Netflix,juan@gmail.com,12345,Perfil 1,0000,2025-12-31,500";
        const csvContent = bom + headers + "\n" + example;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Plantilla_Migracion_HM.csv"; // CSV es más seguro sin librerías externas
        link.click();
    };

    // 2. Backup Base de Datos
    const downloadFullBackup = () => {
        if (!sales || sales.length === 0) {
            setNotification({show: true, message: 'No hay datos para respaldar', type: 'error'});
            return;
        }

        const bom = "\uFEFF";
        const headers = "ID_Venta,Cliente,Celular,Servicio,Tipo,Correo,Contraseña,Perfil,PIN,Vencimiento,Costo,Creado";
        
        const rows = sales.map(s => {
            // Sanitizar campos para evitar romper el CSV (quitar comas de los textos)
            const clean = (txt) => txt ? String(txt).replace(/,/g, ' ').trim() : '';
            return [
                s.id,
                clean(s.client),
                clean(s.phone),
                clean(s.service),
                clean(s.type),
                clean(s.email),
                clean(s.pass),
                clean(s.profile),
                clean(s.pin),
                s.endDate || 'Vencido',
                s.cost || 0,
                s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''
            ].join(',');
        });

        const csvContent = bom + headers + "\n" + rows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const dateStr = new Date().toISOString().split('T')[0];
        link.href = URL.createObjectURL(blob);
        link.download = `HM_Backup_Completo_${dateStr}.csv`;
        link.click();
        
        setNotification({show: true, message: 'Copia de seguridad descargada', type: 'success'});
    };

    // --- LÓGICA PARSEO ---
    const parseMigrationCSV = (text) => {
        const lines = text.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) return [];
        const h = lines[0].toLowerCase().split(',').map(s => s.trim());
        const idx = {
            client: h.findIndex(s => s.includes('client') || s.includes('nombre')),
            phone: h.findIndex(s => s.includes('cel') || s.includes('tel') || s.includes('phone')),
            service: h.findIndex(s => s.includes('serv') || s.includes('plat')),
            email: h.findIndex(s => s.includes('email') || s.includes('correo')),
            pass: h.findIndex(s => s.includes('pass') || s.includes('con') || s.includes('cla')),
            profile: h.findIndex(s => s.includes('perf') || s.includes('prof')),
            pin: h.findIndex(s => s === 'pin' || s.includes('pantalla')),
            date: h.findIndex(s => s.includes('venc') || s.includes('fin') || s.includes('end')),
            cost: h.findIndex(s => s.includes('prec') || s.includes('cost') || s.includes('pag'))
        };
        if ((idx.client === -1 && idx.email === -1) || idx.service === -1) return null;
        return lines.slice(1).map(line => {
            const cols = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(c => c.trim().replace(/^"|"$/g, ''));
            return {
                client: idx.client !== -1 ? cols[idx.client] : (idx.email !== -1 ? cols[idx.email].split('@')[0] : 'Desconocido'),
                phone: idx.phone !== -1 ? cols[idx.phone] : '',
                service: idx.service !== -1 ? cols[idx.service] : 'Servicio Gral',
                email: idx.email !== -1 ? cols[idx.email] : '',
                pass: idx.pass !== -1 ? cols[idx.pass] : '',
                profile: idx.profile !== -1 ? cols[idx.profile] : '',
                pin: idx.pin !== -1 ? cols[idx.pin] : '',
                endDate: idx.date !== -1 ? cols[idx.date] : '',
                cost: idx.cost !== -1 ? cols[idx.cost].replace(/[^0-9.]/g, '') : 0
            };
        }).filter(r => r.client && r.service);
    };

    const handleMigrationUpload = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const parsed = parseMigrationCSV(evt.target.result);
            if(parsed) setMigrationPreview(parsed);
            else alert("Error al leer CSV. Revisa las cabeceras.");
        };
        reader.readAsText(file);
        e.target.value = null;
    };

    const executeMigration = async () => {
        if(!migrationPreview) return;
        setIsMigrating(true);
        const success = await crmActions.importLegacyPortfolio(migrationPreview);
        setIsMigrating(false);
        if(success) setMigrationPreview(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            
            {/* TABS HEADER */}
            <div className={`p-1 rounded-2xl flex gap-1 w-full max-w-xl mx-auto mb-8 border ${darkMode ? 'bg-[#0B0F19] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                <button onClick={() => setActiveTab('services')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'services' ? theme.tabActive : theme.tabInactive}`}>
                    <Package size={14}/> Catálogo
                </button>
                <button onClick={() => setActiveTab('clients')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'clients' ? theme.tabActive : theme.tabInactive}`}>
                    <Users size={14}/> Clientes
                </button>
                <button onClick={() => setActiveTab('migration')} className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all ${activeTab === 'migration' ? theme.tabActive : theme.tabInactive}`}>
                    <Database size={14}/> Datos
                </button>
            </div>

            {/* --- PESTAÑA SERVICIOS Y PAQUETES --- */}
            {activeTab === 'services' && (
                <div className="space-y-8">
                    {/* SERVICIOS INDIVIDUALES */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <Settings size={18} className={theme.subtext}/>
                            <h3 className={`font-black text-lg ${theme.text}`}>Servicios Individuales</h3>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className={`lg:col-span-1 rounded-[2rem] overflow-hidden border ${theme.card}`}>
                                <div className={`px-6 py-4 border-b ${theme.cardHeader}`}>
                                    <h3 className={`font-black text-xs uppercase tracking-wider ${theme.subtext}`}>Nuevo Servicio</h3>
                                </div>
                                <div className="p-6">
                                    <form onSubmit={handleAddServiceToCatalog} className="space-y-4">
                                        <div className="space-y-1">
                                            <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Nombre</label>
                                            <input type="text" placeholder="Ej: Netflix 1 Perfil" required className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={catalogForm.name} onChange={e => setCatalogForm({...catalogForm, name: e.target.value})}/>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Costo</label>
                                                <input type="number" placeholder="0" required className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={catalogForm.cost} onChange={e => setCatalogForm({...catalogForm, cost: e.target.value})}/>
                                            </div>
                                            <div className="space-y-1">
                                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Cupos</label>
                                                <input type="number" placeholder="5" required min="1" className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={catalogForm.defaultSlots} onChange={e => setCatalogForm({...catalogForm, defaultSlots: e.target.value})}/>
                                            </div>
                                        </div>
                                        <div className={`p-1 rounded-xl flex border ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                                            <button type="button" onClick={() => setCatalogForm({...catalogForm, type: 'Perfil'})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${catalogForm.type === 'Perfil' ? (darkMode ? 'bg-[#161B28] text-white shadow-sm border border-white/5' : 'bg-white text-black shadow-sm') : 'text-slate-400'}`}>Perfil</button>
                                            <button type="button" onClick={() => setCatalogForm({...catalogForm, type: 'Cuenta'})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${catalogForm.type === 'Cuenta' ? (darkMode ? 'bg-[#161B28] text-white shadow-sm border border-white/5' : 'bg-white text-black shadow-sm') : 'text-slate-400'}`}>Cuenta</button>
                                        </div>
                                        <button type="submit" className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg border active:scale-95 transition-all ${darkMode ? 'bg-[#0B0F19] hover:bg-black text-white border-white/10' : 'bg-slate-900 hover:bg-slate-800 text-white border-transparent'}`}>Guardar</button>
                                    </form>
                                </div>
                            </div>
                            <div className={`lg:col-span-2 rounded-[2rem] p-6 border ${theme.card}`}>
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {individualServices.map((item) => (
                                        <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${theme.itemBg}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-1 bg-indigo-500 h-8 rounded-full`}></div>
                                                <div>
                                                    <p className={`font-bold text-sm ${theme.text}`}>{item.name}</p>
                                                    <p className={`text-[10px] font-bold ${theme.subtext}`}>{item.type} • {item.defaultSlots} cupos</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`font-black text-sm ${theme.text}`}>${item.cost}</span>
                                                <button onClick={() => triggerDeleteService(item.id)} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-rose-500/20 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {individualServices.length === 0 && <p className="text-center text-xs opacity-50 py-4">Sin servicios configurados.</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PAQUETES */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 px-2 pt-4 border-t border-dashed border-slate-500/20">
                            <Package size={18} className="text-purple-500"/>
                            <h3 className={`font-black text-lg ${theme.text}`}>Paquetes y Combos</h3>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className={`lg:col-span-1 rounded-[2rem] overflow-hidden border ${theme.card}`}>
                                <div className={`px-6 py-4 border-b ${theme.cardHeader}`}>
                                    <h3 className={`font-black text-xs uppercase tracking-wider ${theme.subtext}`}>Crear Paquete</h3>
                                </div>
                                <div className="p-6">
                                    <form onSubmit={handleAddPackageToCatalog} className="space-y-4">
                                        <div className="space-y-1">
                                            <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Nombre Base</label>
                                            <input type="text" placeholder="Ej: Netflix" required className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})}/>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Costo Total</label>
                                                <input type="number" required className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={packageForm.cost} onChange={e => setPackageForm({...packageForm, cost: e.target.value})}/>
                                            </div>
                                            <div className="space-y-1">
                                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Perfiles</label>
                                                <input type="number" required className={`w-full p-3 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={packageForm.slots} onChange={e => setPackageForm({...packageForm, slots: e.target.value})}/>
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full py-3 mt-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-purple-500/20 active:scale-95 transition-all">Crear Paquete</button>
                                    </form>
                                </div>
                            </div>
                            <div className={`lg:col-span-2 rounded-[2rem] p-6 border ${theme.card}`}>
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {packageServices.map((item) => (
                                        <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${theme.itemBg}`}>
                                            <div className="flex items-center gap-3">
                                                <div className={`w-1 bg-purple-500 h-8 rounded-full`}></div>
                                                <div>
                                                    <p className={`font-bold text-sm ${theme.text}`}>{item.name}</p>
                                                    <p className={`text-[10px] font-bold ${theme.subtext}`}>Paquete de {item.defaultSlots} perfiles</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className={`font-black text-sm ${theme.text}`}>${item.cost}</span>
                                                <button onClick={() => triggerDeleteService(item.id)} className={`p-1.5 rounded-lg transition-colors ${darkMode ? 'hover:bg-rose-500/20 text-slate-500 hover:text-rose-400' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-500'}`}><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                    {packageServices.length === 0 && <p className="text-center text-xs opacity-50 py-4">No hay paquetes creados.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
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
                            <input type="text" placeholder="Buscar cliente..." className={`w-full pl-10 pr-4 py-2 rounded-xl font-bold text-sm outline-none border transition-all ${theme.input}`} value={clientSearch} onChange={e => setClientSearch(e.target.value)}/>
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

            {/* --- PESTAÑA DATOS (MIGRACIÓN + BACKUP) --- */}
            {activeTab === 'migration' && (
                <div className={`rounded-[2rem] p-6 md:p-8 border relative overflow-hidden ${theme.card}`}>
                    <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none"/>
                    
                    <div className="max-w-2xl mx-auto text-center space-y-8">
                        
                        {/* SECCIÓN BACKUP */}
                        <div className={`p-6 rounded-2xl border flex flex-col items-center gap-2 ${darkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50/50 border-indigo-100'}`}>
                            <div className="flex items-center gap-3 mb-2">
                                <Archive className="text-indigo-500" size={24}/>
                                <h3 className={`font-black text-lg ${theme.text}`}>Copia de Seguridad</h3>
                            </div>
                            <p className={`text-xs max-w-sm mx-auto mb-4 ${theme.subtext}`}>
                                Descarga un archivo completo con todas las ventas, clientes y contraseñas actuales.
                            </p>
                            <button onClick={downloadFullBackup} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/20 active:scale-95 transition-all flex items-center gap-2">
                                <Save size={16}/> Descargar Base de Datos
                            </button>
                        </div>

                        <hr className={`border-dashed ${darkMode ? 'border-white/10' : 'border-slate-200'}`} />

                        {/* SECCIÓN MIGRACIÓN */}
                        <div>
                            <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center shadow-lg mb-4 ${darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}>
                                <Database size={32}/>
                            </div>
                            <h2 className={`text-2xl font-black mb-2 ${theme.sectionTitle}`}>Migrador Universal</h2>
                            <p className={`text-sm max-w-md mx-auto mb-6 ${theme.subtext}`}>Importa tu cartera histórica. Detecta: Cliente, Servicio, Vencimiento, etc.</p>

                            <div className={`p-6 rounded-2xl border border-dashed flex flex-col items-center gap-4 transition-all ${darkMode ? 'bg-white/5 border-white/10 hover:bg-white/10' : 'bg-slate-50 border-slate-300 hover:bg-slate-100'}`}>
                                <div className="flex gap-4">
                                    <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/30 active:scale-95 transition-all flex items-center gap-2">
                                        <UploadCloud size={16}/> Subir CSV
                                    </button>
                                    <button onClick={downloadTemplate} className={`px-4 py-3 rounded-xl font-bold text-sm border flex items-center gap-2 active:scale-95 transition-all ${darkMode ? 'border-white/10 hover:bg-white/5 text-slate-300' : 'border-slate-200 hover:bg-white text-slate-600'}`}>
                                        <Download size={16}/> Modelo
                                    </button>
                                </div>
                                <input type="file" ref={fileInputRef} accept=".csv, .txt" className="hidden" onChange={handleMigrationUpload} />
                            </div>
                        </div>

                        {migrationPreview && (
                            <div className="animate-in slide-in-from-bottom-4 text-left mt-8">
                                <div className={`p-4 rounded-t-2xl border-b flex items-center justify-between ${darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                                    <div>
                                        <h3 className={`font-bold ${theme.text}`}>Vista Previa</h3>
                                        <p className="text-xs text-emerald-500 font-bold">{migrationPreview.length} registros válidos</p>
                                    </div>
                                    <button onClick={executeMigration} disabled={isMigrating} className={`px-6 py-2 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-2 ${isMigrating ? 'bg-slate-500 opacity-50 cursor-wait' : 'bg-slate-900 text-white hover:scale-105 transition-transform'}`}>
                                        {isMigrating ? 'Importando...' : 'Confirmar Migración'}
                                    </button>
                                </div>
                                <div className={`max-h-[300px] overflow-y-auto border-x border-b rounded-b-2xl p-2 ${darkMode ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200'}`}>
                                    <table className="w-full text-xs">
                                        <tbody className={`font-medium ${theme.text}`}>
                                            {migrationPreview.slice(0, 50).map((row, i) => (
                                                <tr key={i} className={`border-b ${darkMode ? 'border-white/5' : 'border-slate-100'}`}>
                                                    <td className="p-2">{row.client}</td>
                                                    <td className="p-2">{row.service}</td>
                                                    <td className="p-2 font-mono">{row.endDate || <span className="text-rose-500">Vencido</span>}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Config;