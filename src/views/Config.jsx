// src/views/Config.jsx
import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
    Settings, Trash2, Package, Users, Search, Edit2,
    Database, UploadCloud, Download, Save, Archive, X, DollarSign, Palette, History,
    Bot, Send, Store, Clock, MessageSquareText
} from 'lucide-react';
import MoveHistory from '../components/MoveHistory';
import BillingSchedule from '../components/BillingSchedule';
import BusinessHours from '../components/BusinessHours';
import BotRules from '../components/BotRules';
import SegmentedTabs from '../components/SegmentedTabs';
import BotStatus from '../components/BotStatus';
import { exportBackupExcel, exportBackupJson } from '../utils/backupExport';

// Secciones de la pestaña "Bot WhatsApp"
const BOT_SECTIONS = [
    { id: 'rules', label: 'Respuestas', desc: 'Respuestas por palabra clave e imágenes', icon: MessageSquareText },
    { id: 'messages', label: 'Mensajes', desc: 'Datos al vender y aviso al renovar', icon: Send },
    { id: 'hours', label: 'Horario de atención', desc: 'Días, horas y modo viaje', icon: Store },
    { id: 'billing', label: 'Cobranzas', desc: 'Hora de los recordatorios de cobro', icon: Clock }
];

// Imports necesarios para Marca Blanca y Edición
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

const Config = ({ 
    sales, 
    catalog, catalogForm, setCatalogForm, packageForm, setPackageForm,
    handleAddServiceToCatalog, handleAddPackageToCatalog, triggerDeleteService,
    allClients, triggerDeleteClient, triggerEditClient,
    setNotification, darkMode, user, branding,
    autoSendData = true, setAutoSendData = () => {}, autoSendRenewal = true, setAutoSendRenewal = () => {}
}) => {

    const [activeTab, setActiveTab] = useState('services');
    const [catalogSection, setCatalogSection] = useState('individual'); // 'individual' | 'packages' | 'branding' | 'bot'
    const [botSection, setBotSection] = useState('messages'); // 'messages' | 'hours' | 'billing'
    const [serviceSearch, setServiceSearch] = useState('');
    const [packageSearch, setPackageSearch] = useState('');
    const [clientSearch, setClientSearch] = useState('');
    
    // Estados Edición de Precio
    const [editingItem, setEditingItem] = useState(null); // { id, name, cost, type... }

    // Estados Migración
    const [migrationPreview, setMigrationPreview] = useState(null);
    const [isMigrating, setIsMigrating] = useState(false);
    const fileInputRef = useRef(null);

    // Estado local para el nombre de la empresa (branding)
    const [localCompanyName, setLocalCompanyName] = useState(branding?.name || '');

    // Sincronizar cuando la marca termina de cargar desde Firestore
    useEffect(() => {
        setLocalCompanyName(branding?.name || '');
    }, [branding?.name]);

    // Optimizaciones
    const individualServices = useMemo(() => catalog.filter(s => s.type !== 'Paquete'), [catalog]);
    const packageServices = useMemo(() => catalog.filter(s => s.type === 'Paquete'), [catalog]);
    const matchesSearch = (item, term) => {
        const t = term.trim().toLowerCase();
        return !t || item.name.toLowerCase().includes(t);
    };
    const visibleServices = useMemo(() => individualServices.filter(s => matchesSearch(s, serviceSearch)), [individualServices, serviceSearch]);
    const visiblePackages = useMemo(() => packageServices.filter(s => matchesSearch(s, packageSearch)), [packageServices, packageSearch]);
    const filteredClients =useMemo(() => allClients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())), [allClients, clientSearch]);

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
        modal: darkMode ? 'bg-[#0B0F19] border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-2xl',
    };

    // Cuentas antiguas guardaban la capacidad en defaultSlots
    const getProfileCapacity = (item) => Number(item.profileCapacity) || (Number(item.defaultSlots) > 1 ? Number(item.defaultSlots) : 5);

    // --- LÓGICA EDICIÓN ---
    const handleEditClick = (item) => {
        const copy = { ...item }; // Copia para editar sin afectar la lista visualmente aun
        if (item.type === 'Cuenta') copy.profileCapacity = getProfileCapacity(item);
        setEditingItem(copy);
    };

    const handleUpdatePrice = async (e) => {
        e.preventDefault();
        if (!editingItem || !user) return;
        const name = editingItem.name.trim();
        if (!name) return;

        const oldName = catalog.find(c => c.id === editingItem.id)?.name;
        const nameTaken = name !== oldName && catalog.some(c => c.name.toLowerCase() === name.toLowerCase());
        if (nameTaken) {
            setNotification({ show: true, message: 'Ya existe un servicio con ese nombre.', type: 'error' });
            return;
        }

        try {
            // Las ventas referencian el servicio por nombre: renombrarlas también
            const linkedSales = oldName && name !== oldName ? (sales || []).filter(s => s.service === oldName) : [];
            const catalogData = { name, cost: Number(editingItem.cost) };
            if (editingItem.type === 'Cuenta') {
                catalogData.defaultSlots = 1;
                catalogData.profileCapacity = Number(editingItem.profileCapacity) || 5;
            }
            const updates = [
                { ref: doc(db, `users/${user.uid}/catalog`, editingItem.id), data: catalogData },
                ...linkedSales.map(s => ({ ref: doc(db, `users/${user.uid}/sales`, s.id), data: { service: name } }))
            ];
            // Firestore permite máx 500 operaciones por batch
            for (let i = 0; i < updates.length; i += 450) {
                const batch = writeBatch(db);
                updates.slice(i, i + 450).forEach(u => batch.update(u.ref, u.data));
                await batch.commit();
            }
            const extra = linkedSales.length ? ` (${linkedSales.length} ventas/stock renombrados)` : '';
            setNotification({ show: true, message: `Servicio actualizado${extra}.`, type: 'success' });
            setEditingItem(null); // Cerrar modal
        } catch (error) {
            console.error(error);
            setNotification({ show: true, message: 'Error al actualizar.', type: 'error' });
        }
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

    // 💾 COPIA DE SEGURIDAD COMPLETA (Excel ordenado por hojas, o JSON con todos los datos)
    const [backupBusy, setBackupBusy] = useState(null); // 'excel' | 'json' | null
    const downloadFullBackup = async (format) => {
        if (!user) return;
        setBackupBusy(format);
        try {
            const args = { uid: user.uid, sales: sales || [], catalog: catalog || [], clients: allClients || [] };
            const counts = format === 'json' ? await exportBackupJson(args) : await exportBackupExcel(args);
            const rules = counts.botRules ?? counts.rules ?? 0;
            setNotification({ show: true, message: `Copia descargada: ${counts.catalog ?? counts.services} servicios, ${counts.sales} registros, ${counts.clients} clientes, ${rules} respuestas automáticas.`, type: 'success' });
        } catch (error) {
            console.error('Error generando la copia de seguridad:', error);
            setNotification({ show: true, message: 'No se pudo generar la copia de seguridad.', type: 'error' });
        } finally {
            setBackupBusy(null);
        }
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
            
            {/* --- MODAL DE EDICIÓN DE PRECIO --- */}
            {editingItem && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className={`w-full max-w-sm rounded-[2rem] p-6 border shadow-2xl transform transition-all scale-100 ${theme.modal}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className={`text-lg font-black ${theme.text}`}>{editingItem.type === 'Paquete' ? 'Editar Paquete' : 'Editar Servicio'}</h3>
                                <p className={`text-xs font-bold uppercase tracking-wider text-indigo-500`}>{editingItem.type}</p>
                            </div>
                            <button onClick={() => setEditingItem(null)} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"><X size={20}/></button>
                        </div>
                        
                        <form onSubmit={handleUpdatePrice} className="space-y-4">
                            <div>
                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Nombre</label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    className={theme.input + " w-full px-4 py-3 rounded-xl font-bold text-sm outline-none border"}
                                    value={editingItem.name}
                                    onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Nuevo Costo</label>
                                <div className="relative group">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={16}/>
                                    <input 
                                        type="number"
                                        required
                                        className={theme.input + " w-full pl-10 pr-4 py-3 rounded-xl font-bold text-lg outline-none border"} 
                                        value={editingItem.cost} 
                                        onChange={e => setEditingItem({...editingItem, cost: e.target.value})}
                                    />
                                </div>
                            </div>
                            {editingItem.type === 'Cuenta' && (
                                <div>
                                    <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Perfiles de la cuenta</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        max="10"
                                        className={theme.input + " w-full px-4 py-3 rounded-xl font-bold text-sm outline-none border"}
                                        value={editingItem.profileCapacity}
                                        onChange={e => setEditingItem({...editingItem, profileCapacity: e.target.value})}
                                    />
                                </div>
                            )}
                            <button type="submit" className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all">
                                Guardar Cambios
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* TABS HEADER */}
            <div className={`p-1 rounded-2xl flex gap-1 w-full max-w-xl mx-auto mb-8 border ${darkMode ? 'bg-[#0B0F19] border-white/5' : 'bg-white border-slate-100 shadow-sm'}`}>
                {['services', 'clients', 'history', 'migration'].map((tab) => (
                    <button 
                        key={tab}
                        onClick={() => setActiveTab(tab)} 
                        className={`flex-1 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all capitalize ${activeTab === tab ? theme.tabActive : theme.tabInactive}`}
                    >
                        {tab === 'services' && <><Package size={14}/> Catálogo</>}
                        {tab === 'clients' && <><Users size={14}/> Clientes</>}
                        {tab === 'history' && <><History size={14}/> Historial</>}
                        {tab === 'migration' && <><Database size={14}/> Datos</>}
                    </button>
                ))}
            </div>

            {/* --- PESTAÑA SERVICIOS --- */}
            {activeTab === 'services' && (
                <div className="space-y-12">
                    
                    <div className="space-y-6">
                    {/* SUB-PESTAÑAS DEL CATÁLOGO */}
                    <SegmentedTabs
                        darkMode={darkMode}
                        value={catalogSection}
                        onChange={setCatalogSection}
                        className="max-w-4xl"
                        tabs={[
                            { id: 'individual', label: 'Servicios Individuales', shortLabel: 'Servicios', icon: Settings, count: individualServices.length, activeText: 'text-indigo-400' },
                            { id: 'packages', label: 'Paquetes y Combos', shortLabel: 'Paquetes', icon: Package, count: packageServices.length, activeText: 'text-purple-400' },
                            { id: 'branding', label: 'Identidad de Marca', shortLabel: 'Marca', icon: Palette, activeText: 'text-cyan-400' },
                            { id: 'bot', label: 'Bot WhatsApp', shortLabel: 'Bot', icon: Bot, activeText: 'text-emerald-400' }
                        ]}
                    />

                    {/* 1. SERVICIOS INDIVIDUALES */}
                    {catalogSection === 'individual' && (
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
                                                {catalogForm.type === 'Cuenta' ? (
                                                    <input type="number" readOnly tabIndex={-1} title="Una cuenta completa siempre ocupa 1 cupo" className={theme.input + " w-full p-3 rounded-xl font-bold text-sm outline-none border cursor-not-allowed opacity-60"} value={1}/>
                                                ) : (
                                                    <input type="number" placeholder="5" required min="1" className={theme.input + " w-full p-3 rounded-xl font-bold text-sm outline-none border"} value={catalogForm.defaultSlots} onChange={e => setCatalogForm({...catalogForm, defaultSlots: e.target.value})}/>
                                                )}
                                            </div>
                                        </div>
                                        {catalogForm.type === 'Cuenta' && (
                                            <div>
                                                <label className={`text-[10px] font-bold uppercase ml-1 ${theme.subtext}`}>Perfiles de la cuenta</label>
                                                <input type="number" placeholder="5" required min="1" max="10" className={theme.input + " w-full p-3 rounded-xl font-bold text-sm outline-none border"} value={catalogForm.profileCapacity} onChange={e => setCatalogForm({...catalogForm, profileCapacity: e.target.value})}/>
                                                <p className={`text-[10px] mt-1 ml-1 ${theme.subtext}`}>Cuántos perfiles se generan al cargar stock por perfiles en la Bóveda.</p>
                                            </div>
                                        )}
                                        <div className={`p-1 rounded-xl flex border ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-100 border-slate-200'}`}>
                                            {['Perfil', 'Cuenta'].map(type => ( <button key={type} type="button" onClick={() => setCatalogForm({...catalogForm, type})} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${catalogForm.type === type ? (darkMode ? 'bg-[#161B28] text-white shadow-sm border border-white/5' : 'bg-white text-black shadow-sm') : 'text-slate-400'}`}>{type}</button> ))}
                                        </div>
                                        <button type="submit" className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg border active:scale-95 transition-all ${darkMode ? 'bg-indigo-600 border-transparent text-white' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}>Guardar</button>
                                    </form>
                                </div>
                            </div>
                            <div className={`lg:col-span-2 rounded-[2rem] p-6 border ${theme.card}`}>
                                <div className="relative group mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={16}/>
                                    <input type="text" placeholder="Buscar servicio..." className={theme.input + " w-full pl-10 pr-10 py-2.5 rounded-xl font-bold text-sm outline-none border"} value={serviceSearch} onChange={e => setServiceSearch(e.target.value)}/>
                                    {serviceSearch && <button onClick={() => setServiceSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"><X size={16}/></button>}
                                </div>
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {visibleServices.length === 0 && <p className={`text-center text-xs font-bold py-8 ${theme.subtext}`}>{serviceSearch ? `Sin resultados para "${serviceSearch}"` : 'No hay servicios.'}</p>}
                                    {visibleServices.map((item) => (
                                        <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${theme.itemBg}`}>
                                            <div className="flex items-center gap-3"><div className="w-1 bg-indigo-500 h-8 rounded-full"></div><div><p className={`font-bold text-sm ${theme.text}`}>{item.name}</p><p className={`text-[10px] font-bold ${theme.subtext}`}>{item.type === 'Cuenta' ? `Cuenta • 1 cupo • ${getProfileCapacity(item)} perfiles` : `${item.type} • ${item.defaultSlots} cupos`}</p></div></div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-black text-sm mr-2 ${theme.text}`}>${item.cost}</span>
                                                {/* BOTÓN EDITAR */}
                                                <button onClick={() => handleEditClick(item)} className="p-1.5 rounded-lg hover:bg-indigo-500/10 text-indigo-500 transition-colors"><Edit2 size={14}/></button>
                                                {/* BOTÓN ELIMINAR */}
                                                <button onClick={() => triggerDeleteService(item.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* 2. PAQUETES Y COMBOS */}
                    {catalogSection === 'packages' && (
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
                                <div className="relative group mb-4">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-500 transition-colors" size={16}/>
                                    <input type="text" placeholder="Buscar paquete..." className={theme.input + " w-full pl-10 pr-10 py-2.5 rounded-xl font-bold text-sm outline-none border"} value={packageSearch} onChange={e => setPackageSearch(e.target.value)}/>
                                    {packageSearch && <button onClick={() => setPackageSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"><X size={16}/></button>}
                                </div>
                                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                                    {visiblePackages.length === 0 && <p className={`text-center text-xs font-bold py-8 ${theme.subtext}`}>{packageSearch ? `Sin resultados para "${packageSearch}"` : 'No hay paquetes.'}</p>}
                                    {visiblePackages.map((item) => (
                                        <div key={item.id} className={`flex items-center justify-between p-3 rounded-xl border transition-all ${theme.itemBg}`}>
                                            <div className="flex items-center gap-3"><div className="w-1 bg-purple-500 h-8 rounded-full"></div><div><p className={`font-bold text-sm ${theme.text}`}>{item.name}</p><p className={`text-[10px] font-bold ${theme.subtext}`}>Paquete de {item.defaultSlots} perfiles</p></div></div>
                                            <div className="flex items-center gap-2">
                                                <span className={`font-black text-sm mr-2 ${theme.text}`}>${item.cost}</span>
                                                {/* BOTÓN EDITAR */}
                                                <button onClick={() => handleEditClick(item)} className="p-1.5 rounded-lg hover:bg-indigo-500/10 text-indigo-500 transition-colors"><Edit2 size={14}/></button>
                                                {/* BOTÓN ELIMINAR */}
                                                <button onClick={() => triggerDeleteService(item.id)} className="p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-500 transition-colors"><Trash2 size={14}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    )}

                    {/* 🤖 BOT WHATSAPP: menú lateral (escritorio) / pestañas deslizables (celular) */}
                    {catalogSection === 'bot' && (
                        <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-4 lg:gap-6 items-start">
                            {/* Celular / tablet */}
                            <SegmentedTabs
                                className="lg:hidden"
                                size="sm"
                                darkMode={darkMode}
                                value={botSection}
                                onChange={setBotSection}
                                tabs={BOT_SECTIONS.map(s => ({ id: s.id, label: s.label, icon: s.icon, activeText: 'text-emerald-400' }))}
                            />
                            {/* Escritorio */}
                            <nav className={`hidden lg:flex flex-col gap-1 p-2 rounded-[1.5rem] border sticky top-4 ${theme.card}`} aria-label="Opciones del bot">
                                <div className="px-3 pt-2 pb-3">
                                    <p className={`text-sm font-black flex items-center gap-2 ${theme.text}`}><Bot size={16} className="text-emerald-500"/> Bot WhatsApp</p>
                                    <p className={`text-[11px] mt-0.5 ${theme.subtext}`}>Automatizaciones del bot</p>
                                </div>
                                {BOT_SECTIONS.map(({ id, label, desc, icon: Icon }) => {
                                    const active = botSection === id;
                                    return (
                                        <button key={id} onClick={() => setBotSection(id)} aria-current={active ? 'page' : undefined}
                                            className={`w-full text-left px-3 py-2.5 rounded-xl flex items-start gap-3 transition-all ${active ? (darkMode ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' : 'bg-emerald-50 ring-1 ring-emerald-200') : (darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50')}`}>
                                            <span className={`p-1.5 rounded-lg shrink-0 ${active ? 'bg-emerald-500 text-white' : (darkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500')}`}><Icon size={14}/></span>
                                            <span className="min-w-0">
                                                <span className={`block text-xs font-bold ${active ? (darkMode ? 'text-emerald-300' : 'text-emerald-700') : theme.text}`}>{label}</span>
                                                <span className={`block text-[10px] leading-snug ${theme.subtext}`}>{desc}</span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </nav>

                            <div className="min-w-0">
                                {/* 🤖 MENSAJES AUTOMÁTICOS */}
                                {botSection === 'messages' && (
                                    <div className={`rounded-[2rem] overflow-hidden border ${theme.card}`}>
                                        <div className={`px-4 sm:px-6 py-4 border-b ${theme.cardHeader}`}>
                                            <h3 className={`font-black text-xs uppercase tracking-wider flex items-center gap-2 ${theme.subtext}`}><Send size={14}/> Mensajes automáticos</h3>
                                        </div>
                                        <BotStatus user={user} darkMode={darkMode} theme={theme} setNotification={setNotification} />
                                        <div className={`divide-y ${darkMode ? 'divide-white/5' : 'divide-slate-100'}`}>
                                            {[
                                                { checked: autoSendData, onChange: setAutoSendData, title: 'Enviar datos de acceso al registrar una venta', desc: 'Al asignar un perfil o cuenta libre a un cliente, el bot le manda correo, perfil y PIN.' },
                                                { checked: autoSendRenewal, onChange: setAutoSendRenewal, title: 'Avisar al cliente al renovar', desc: 'Al tocar "Renovar 1 mes" en el Tablero, el bot le confirma la renovación y su próxima fecha de vencimiento.' }
                                            ].map(opt => (
                                                <label key={opt.title} className={`flex items-center justify-between gap-4 px-4 sm:px-6 py-4 cursor-pointer select-none transition-colors ${darkMode ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'}`}>
                                                    <div className="min-w-0">
                                                        <p className={`text-sm font-bold ${theme.text}`}>{opt.title}</p>
                                                        <p className={`text-xs mt-0.5 ${theme.subtext}`}>{opt.desc}</p>
                                                    </div>
                                                    {/* Interruptor */}
                                                    <span className="relative shrink-0">
                                                        <input type="checkbox" className="peer sr-only" checked={opt.checked} onChange={e => opt.onChange(e.target.checked)} />
                                                        <span className={`block w-11 h-6 rounded-full transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400 ${darkMode ? 'bg-white/10' : 'bg-slate-300'}`} />
                                                        <span className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                        <p className={`px-4 sm:px-6 py-3 text-[10px] border-t ${darkMode ? 'border-white/5 text-slate-500' : 'border-slate-100 text-slate-400'}`}>* Requiere el bot encendido. Esta preferencia se guarda en este navegador.</p>
                                    </div>
                                )}

                                {/* 💬 RESPUESTAS AUTOMÁTICAS POR PALABRA CLAVE */}
                                {botSection === 'rules' && (
                                    <BotRules user={user} darkMode={darkMode} theme={theme} setNotification={setNotification} />
                                )}

                                {/* 🕰️ HORARIO DE ATENCIÓN Y MODO VIAJE */}
                                {botSection === 'hours' && (
                                    <BusinessHours user={user} darkMode={darkMode} theme={theme} setNotification={setNotification} />
                                )}

                                {/* ⏰ COBRANZAS AUTOMÁTICAS */}
                                {botSection === 'billing' && (
                                    <BillingSchedule user={user} darkMode={darkMode} theme={theme} setNotification={setNotification} />
                                )}
                            </div>
                        </div>
                    )}

                    {/* 3. IDENTIDAD DE MARCA */}
                    {catalogSection === 'branding' && (
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
                    )}
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

            {/* --- PESTAÑA HISTORIAL DE MUDANZAS --- */}
            {activeTab === 'history' && <MoveHistory user={user} darkMode={darkMode} theme={theme} sales={sales} setNotification={setNotification} />}

            {/* --- PESTAÑA DATOS --- */}
            {activeTab === 'migration' && (
                <div className={`rounded-[2rem] p-8 border relative overflow-hidden ${theme.card}`}>
                    <div className="max-w-2xl mx-auto text-center space-y-8">
                        <div className={`p-6 rounded-2xl border flex flex-col items-center gap-2 ${darkMode ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                            <Archive className="text-indigo-500" size={24}/><h3 className={`font-black text-lg ${theme.text}`}>Copia de Seguridad</h3>
                            <p className={`text-xs ${theme.subtext}`}>Incluye catálogo completo (también servicios sin stock ni ventas), ventas y stock, clientes, mudanzas, respuestas automáticas del bot y configuración.</p>
                            <div className="flex flex-col sm:flex-row gap-3 mt-4 w-full sm:w-auto">
                                <button onClick={() => downloadFullBackup('excel')} disabled={!!backupBusy} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-wait text-white rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                    <Save size={16}/> {backupBusy === 'excel' ? 'Generando Excel...' : 'Descargar Excel (.xlsx)'}
                                </button>
                                <button onClick={() => downloadFullBackup('json')} disabled={!!backupBusy} className={`px-6 py-3 rounded-xl font-bold text-sm border active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait ${darkMode ? 'border-white/10 text-slate-300 hover:bg-white/5' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                                    <Database size={16}/> {backupBusy === 'json' ? 'Generando...' : 'Backup completo (.json)'}
                                </button>
                            </div>
                            <p className="text-[10px] text-slate-500 mt-1">Excel: para revisar y ordenar. JSON: todos los datos crudos (incluye las imágenes de las respuestas), para restaurar o migrar.</p>
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