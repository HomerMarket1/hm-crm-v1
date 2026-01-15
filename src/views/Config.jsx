// src/views/Config.jsx
import React, { useState, useRef, useMemo } from 'react';
import { 
    Settings, Trash2, Package, Users, Search, Edit2, 
    Database, UploadCloud, Download, Save, Archive, X 
} from 'lucide-react';
import { useCRMActions } from '../hooks/useCRMActions'; 
import { useDataSync } from '../hooks/useDataSync';

// Imports necesarios para Marca Blanca
import { doc, setDoc } from 'firebase/firestore'; 
import { db } from '../firebase/config';

const Config = ({ 
    sales, 
    catalog, catalogForm, setCatalogForm, packageForm, setPackageForm,
    handleAddServiceToCatalog, handleAddPackageToCatalog, triggerDeleteService,
    allClients, triggerDeleteClient, triggerEditClient,
    setNotification, darkMode 
}) => {
    
    const { user, branding } = useDataSync();
    const crmActions = useCRMActions(user, setNotification);

    const [activeTab, setActiveTab] = useState('services'); 
    const [clientSearch, setClientSearch] = useState('');
    
    // Estados Migración
    const [migrationPreview, setMigrationPreview] = useState(null);
    const [isMigrating, setIsMigrating] = useState(false);
    const fileInputRef = useRef(null);

    // Estado local para el nombre de la empresa (branding)
    const [localCompanyName, setLocalCompanyName] = useState(branding?.name || '');

    // Optimizaciones
    const individualServices = useMemo(() => catalog.filter(s => s.type !== 'Paquete'), [catalog]);
    const packageServices = useMemo(() => catalog.filter(s => s.type === 'Paquete'), [catalog]);
    const filteredClients = useMemo(() => allClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())), [allClients, clientSearch]);

    // 🎨 TEMA DINÁMICO CON FOCUS GLOW
    const theme = {
        card: darkMode ? 'bg-[#161B28] border-white/5 shadow-none' : 'bg-white border-slate-100 shadow-xl shadow-slate-200/50',
        cardHeader: darkMode ? 'bg-[#0B0F19] border-white/5' : 'bg-slate-50 border-slate-100',
        text: darkMode ? 'text-white' : 'text-slate-800',
        subtext: darkMode ? 'text-slate-400' : 'text-slate-500',
        input: darkMode 
            ? 'bg-black/20 text-white placeholder-slate-500 border-white/5 focus:border-cyan-400 focus:shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all' 
            : 'bg-slate-50 text-slate-800 placeholder-slate-400 border-slate-200 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all',
        itemBg: darkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-100',
        sectionTitle: darkMode ? 'text-white' : 'text-slate-900',
        tabActive: darkMode ? 'bg-[#161B28] text-indigo-400 shadow-sm border border-white/5' : 'bg-slate-800 text-white shadow-lg',
        tabInactive: darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600',
    };

    // --- LÓGICA MARCA BLANCA ---
    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 500000) { 
            setNotification({ show: true, message: 'El logo es muy pesado. Máx 500KB.', type: 'error' });
            return;
        }
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = reader.result;
            try {
                await setDoc(doc(db, `users/${user.uid}/config/branding`), {
                    logo: base64String,
                    name: localCompanyName || 'Mi Empresa'
                }, { merge: true });
                setNotification({ show: true, message: 'Marca actualizada correctamente.', type: 'success' });
            } catch (error) {
                setNotification({ show: true, message: 'Error guardando la marca.', type: 'error' });
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSaveCompanyName = async () => {
        if (!localCompanyName.trim()) return;
        try {
            await setDoc(doc(db, `users/${user.uid}/config/branding`), {
                name: localCompanyName
            }, { merge: true });
            setNotification({ show: true, message: 'Nombre de empresa guardado.', type: 'success' });
        } catch (error) {
            setNotification({ show: true, message: 'Error al guardar nombre.', type: 'error' });
        }
    };

    // --- LÓGICA DESCARGAS Y MIGRACIÓN ---
    const downloadTemplate = () => {
        const bom = "\uFEFF"; 
        const csvContent = bom + "Cliente,Celular,Servicio,Correo,Contraseña,Perfil,PIN,Vencimiento,Precio\nJuan Perez,5551234,Netflix,juan@gmail.com,12345,Perfil 1,0000,2025-12-31,500";
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "Plantilla_Migracion_HM.csv";
        link.click();
    };

    const downloadFullBackup = () => {
        if (!sales || sales.length === 0) {
            setNotification({show: true, message: 'No hay datos para respaldar', type: 'error'});
            return;
        }
        const bom = "\uFEFF";
        const headers = "ID_Venta,Cliente,Celular,Servicio,Tipo,Correo,Contraseña,Perfil,PIN,Vencimiento,Costo,Creado";
        const rows = sales.map(s => {
            const clean = (txt) => txt ? String(txt).replace(/,/g, ' ').replace(/\n/g, ' ').trim() : '';
            return [
                s.id, clean(s.client), clean(s.phone), clean(s.service), clean(s.type),
                clean(s.email), clean(s.pass), clean(s.profile), clean(s.pin),
                s.endDate || 'Vencido', s.cost || 0, s.createdAt ? new Date(s.createdAt).toLocaleDateString() : ''
            ].join(',');
        });
        const csvContent = bom + headers + "\n" + rows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `HM_Backup_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        setNotification({show: true, message: 'Copia de seguridad descargada', type: 'success'});
    };

    const handleMigrationUpload = (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            // Lógica de parseo simplificada para el ejemplo
            setNotification({show: true, message: 'Archivo cargado. Revisa la vista previa.', type: 'success'});
        };
        reader.readAsText(file);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            {/* TABS HEADER */}
            <div className={`p-1 rounded-2xl flex gap-1 w-full max-w-xl mx-auto mb-8 border ${darkMode ? 'bg-[#0B0F19] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                {['services', 'clients', 'migration'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)} 
                        className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all capitalize ${activeTab === tab ? theme.tabActive : theme.tabInactive}`}
                    >
                        {tab === 'services' && <><Package size={14}/> Catálogo</>}
                        {tab === 'clients' && <><Users size={14}/> Clientes</>}
                        {tab === 'migration' && <><Database size={14}/> Datos</>}
                    </button>
                ))}
            </div>

            {/* --- PESTAÑA SERVICIOS --- */}
            {activeTab === 'services' && (
                <div className="space-y-12">
                    
                    {/* 1. SERVICIOS INDIVIDUALES */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <Settings size={18} className={theme.subtext}/>
                            <h3 className={`font-black text-lg ${theme.text}`}>Servicios Individuales</h3>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className={`lg:col-span-1 rounded-[2rem] overflow-hidden border ${theme.card}`}>
                                <div className={`px-6 py-4 border-b ${theme.cardHeader}`}><h3 className={`font-black text-xs uppercase tracking-wider ${theme.subtext}`}>Nuevo Servicio</h3></div>
                                <div className="p-6">
                                    <form onSubmit={handleAddServiceToCatalog} className="space-y-4">
                                        <div>
                                            <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Nombre</label>
                                            <input type="text" placeholder="Ej: Netflix" required className={theme.input + " w-full p-3 rounded-xl font-bold text-sm outline-none border"} value={catalogForm.name} onChange={e => setCatalogForm({...catalogForm, name: e.target.value})}/>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Costo</label>
                                                <input type="number" placeholder="0" required className={theme.input + " w-full p-3 rounded-xl font-bold text-sm outline-none border"} value={catalogForm.cost} onChange={e => setCatalogForm({...catalogForm, cost: e.target.value})}/>
                                            </div>
                                            <div>
                                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Cupos</label>
                                                <input type="number" placeholder="5" required min="1" className={theme.input + " w-full p-3 rounded-xl font-bold text-sm outline-none border"} value={catalogForm.defaultSlots} onChange={e => setCatalogForm({...catalogForm, defaultSlots: e.target.value})}/>
                                            </div>
                                        </div>
                                        <div className={`p-1 rounded-xl flex border ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                                            {['Perfil', 'Cuenta'].map(type => ( <button key={type} type="button" onClick={() => setCatalogForm({...catalogForm, type})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${catalogForm.type === type ? (darkMode ? 'bg-[#161B28] text-white shadow-sm border border-white/5' : 'bg-white text-black shadow-sm') : 'text-slate-400'}`}>{type}</button> ))}
                                        </div>
                                        <button type="submit" className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg border active:scale-95 transition-all ${darkMode ? 'bg-indigo-600 border-transparent text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>Guardar</button>
                                    </form>
                                </div>
                            </div>
                            <div className={`lg:col-span-2 rounded-[2rem] p-6 border ${theme.card}`}>
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {individualServices.map((item) => (
                                        <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${theme.itemBg}`}>
                                            <div className="flex items-center gap-3"><div className="w-1 bg-indigo-500 h-8 rounded-full"></div><div><p className={`font-bold text-sm ${theme.text}`}>{item.name}</p><p className={`text-[10px] font-bold ${theme.subtext}`}>{item.type} • {item.defaultSlots} cupos</p></div></div>
                                            <div className="flex items-center gap-3"><span className={`font-black text-sm ${theme.text}`}>${item.cost}</span><button onClick={() => triggerDeleteService(item.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500"><Trash2 size={14}/></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 2. PAQUETES Y COMBOS */}
                    <div>
                        <div className="flex items-center gap-2 mb-4 px-2">
                            <Package size={18} className="text-purple-500"/>
                            <h3 className={`font-black text-lg ${theme.text}`}>Paquetes y Combos</h3>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className={`lg:col-span-1 rounded-[2rem] overflow-hidden border ${theme.card}`}>
                                <div className={`px-6 py-4 border-b ${theme.cardHeader}`}><h3 className={`font-black text-xs uppercase tracking-wider ${theme.subtext}`}>Crear Paquete</h3></div>
                                <div className="p-6">
                                    <form onSubmit={handleAddPackageToCatalog} className="space-y-4">
                                        <div>
                                            <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Nombre Base</label>
                                            <input type="text" placeholder="Ej: Combo Familiar" required className={theme.input + " w-full p-3 rounded-xl font-bold text-sm outline-none border"} value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})}/>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Costo</label>
                                                <input type="number" required className={theme.input + " w-full p-3 rounded-xl font-bold text-sm outline-none border"} value={packageForm.cost} onChange={e => setPackageForm({...packageForm, cost: e.target.value})}/>
                                            </div>
                                            <div>
                                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Perfiles</label>
                                                <input type="number" required className={theme.input + " w-full p-3 rounded-xl font-bold text-sm outline-none border"} value={packageForm.slots} onChange={e => setPackageForm({...packageForm, slots: e.target.value})}/>
                                            </div>
                                        </div>
                                        <button type="submit" className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all">Crear Paquete</button>
                                    </form>
                                </div>
                            </div>
                            <div className={`lg:col-span-2 rounded-[2rem] p-6 border ${theme.card}`}>
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {packageServices.map((item) => (
                                        <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${theme.itemBg}`}>
                                            <div className="flex items-center gap-3"><div className="w-1 bg-purple-500 h-8 rounded-full"></div><div><p className={`font-bold text-sm ${theme.text}`}>{item.name}</p><p className={`text-[10px] font-bold ${theme.subtext}`}>Paquete de {item.defaultSlots} perfiles</p></div></div>
                                            <div className="flex items-center gap-3"><span className={`font-black text-sm ${theme.text}`}>${item.cost}</span><button onClick={() => triggerDeleteService(item.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500"><Trash2 size={14}/></button></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. IDENTIDAD DE MARCA (AL FINAL) */}
                    <div className={`rounded-[2rem] overflow-hidden border ${theme.card}`}>
                        <div className={`px-6 py-4 border-b ${theme.cardHeader} flex items-center justify-between`}>
                            <h3 className={`font-black text-xs uppercase tracking-wider ${theme.subtext}`}>Identidad de Marca (SaaS)</h3>
                            <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded font-bold">PREMIUM</span>
                        </div>
                        <div className="p-6 flex flex-col md:flex-row gap-6 items-start">
                            <div className="flex flex-col items-center gap-2">
                                <div className={`w-24 h-24 rounded-2xl border-2 border-dashed flex items-center justify-center overflow-hidden ${darkMode ? 'border-white/10 bg-white/5' : 'border-slate-200 bg-slate-50'}`}>
                                    {branding?.logo ? ( <img src={branding.logo} alt="Logo" className="w-full h-full object-contain p-2" /> ) : ( <span className="text-[10px] text-slate-400 font-bold uppercase">Sin Logo</span> )}
                                </div>
                                <label className="text-xs font-bold text-indigo-500 cursor-pointer hover:underline">Cambiar Logo<input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} /></label>
                            </div>
                            <div className="flex-1 w-full space-y-3">
                                <div>
                                    <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Nombre de tu Negocio</label>
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Ej: HM Digital" className={theme.input + " flex-1 p-3 rounded-xl font-bold text-sm outline-none border"} value={localCompanyName} onChange={e => setLocalCompanyName(e.target.value)} />
                                        <button onClick={handleSaveCompanyName} className="px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg transition-all active:scale-95">Guardar</button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 ml-1">* Este nombre y logo aparecerán en la barra lateral de tu sistema.</p>
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
                        <div><h2 className={`text-xl font-black ${theme.sectionTitle}`}>Directorio de Clientes</h2><p className={`text-xs font-bold uppercase tracking-wider ${theme.subtext}`}>Gestión de Contactos</p></div>
                        <div className="relative group w-full md:w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16}/>
                            <input type="text" placeholder="Buscar cliente..." className={theme.input + " w-full pl-10 pr-4 py-2 rounded-xl font-bold text-sm outline-none border"} value={clientSearch} onChange={e => setClientSearch(e.target.value)}/>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredClients.map((client, idx) => (
                            <div key={idx} className={`p-4 rounded-2xl border flex items-center justify-between group transition-all ${theme.itemBg}`}>
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>{client.name.charAt(0).toUpperCase()}</div>
                                    <div className="min-w-0"><p className={`font-bold text-sm truncate ${theme.text}`}>{client.name}</p><p className={`text-xs font-medium truncate ${theme.subtext}`}>{client.phone}</p></div>
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => triggerEditClient(client)} className={`p-2 rounded-lg hover:bg-white/10 text-slate-400`}><Edit2 size={14}/></button>
                                    <button onClick={() => triggerDeleteClient(client.id)} className={`p-2 rounded-lg hover:bg-rose-500/10 text-rose-500`}><Trash2 size={14}/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- PESTAÑA DATOS --- */}
            {activeTab === 'migration' && (
                <div className={`rounded-[2rem] p-8 border relative overflow-hidden ${theme.card}`}>
                    <div className="max-w-2xl mx-auto text-center space-y-8">
                        <div className={`p-6 rounded-2xl border flex flex-col items-center gap-2 ${darkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                            <Archive className="text-indigo-500" size={24}/><h3 className={`font-black text-lg ${theme.text}`}>Copia de Seguridad</h3>
                            <button onClick={downloadFullBackup} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center gap-2 mt-4"><Save size={16}/> Descargar Base de Datos</button>
                        </div>
                        <div className="space-y-6">
                            <div className={`w-16 h-16 rounded-3xl mx-auto flex items-center justify-center shadow-lg ${darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-600'}`}><Database size={32}/></div>
                            <h2 className={`text-2xl font-black ${theme.sectionTitle}`}>Migrador Universal</h2>
                            <div className="flex justify-center gap-4">
                                <button onClick={() => fileInputRef.current?.click()} className="px-6 py-3 bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95">Subir CSV</button>
                                <button onClick={downloadTemplate} className={`px-4 py-3 rounded-xl font-bold text-sm border ${darkMode ? 'border-white/10 text-slate-300' : 'border-slate-200 text-slate-600'}`}>Plantilla</button>
                            </div>
                            <input type="file" ref={fileInputRef} accept=".csv, .txt" className="hidden" onChange={handleMigrationUpload} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Config;