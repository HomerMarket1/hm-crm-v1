import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
    Search, ChevronDown, ChevronUp, User, CheckCircle2, 
    Copy, Key, PlusCircle, Save, Trash2, Eye, EyeOff, 
    Hash, X, LayoutGrid, Layers, ShieldCheck 
} from 'lucide-react';
import { 
    collection, doc, deleteDoc, writeBatch, 
    query, where, getDocs, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

// Constantes
const PROBLEM_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Seguimiento', 'Garantía'];

const InventoryMaster = ({ sales, catalog, darkMode, setFormData, setView, user, setNotification }) => {
    
    // 🛡️ Blindaje de datos
    const safeSales = useMemo(() => Array.isArray(sales) ? sales : [], [sales]);
    const safeCatalog = useMemo(() => Array.isArray(catalog) ? catalog : [], [catalog]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedService, setSelectedService] = useState('Todos');
    const [selectedStatus, setSelectedStatus] = useState('Todos'); 
    const [hideProblems, setHideProblems] = useState(false); 
    const [expandedAccounts, setExpandedAccounts] = useState({});
    const [editingPass, setEditingPass] = useState({ email: null, value: '', groupKey: null });

    const [deleteModal, setDeleteModal] = useState(null);
    const [displayLimit, setDisplayLimit] = useState(20);
    const observer = useRef();

    const [showNewAccountForm, setShowNewAccountForm] = useState(false);
    
    // Estado del formulario de nuevo stock
    const [newAccData, setNewAccData] = useState({ 
        email: '', pass: '', service: '', slots: 5, type: 'Perfil' 
    });

    // ✅ DETECTOR DE PLATAFORMA (Lógica Especial Disney)
    const getBaseName = useCallback((serviceName) => {
        if (!serviceName) return 'Sin Servicio';
        const lower = serviceName.toLowerCase();
        
        // --- REGLA ESPECIAL DISNEY (Separación Solicitada) ---
        if (lower.includes('disney')) {
            if (lower.includes('vivo')) return 'Disney+ En Vivo';
            // Todo lo que no sea "En Vivo" se agrupa como Básico
            // (Esto agrupa "Disney+ Básico", "Disney+ Basico", "Disney+ Standard", etc.)
            return 'Disney+ Básico';
        }

        // Resto de plataformas (Agrupación Estándar)
        if (lower.includes('netflix')) return 'Netflix';
        if (lower.includes('prime') || lower.includes('amazon')) return 'Prime Video';
        if (lower.includes('max') || lower.includes('hbo')) return 'Max';
        if (lower.includes('paramount')) return 'Paramount+';
        if (lower.includes('vix')) return 'Vix';
        if (lower.includes('plex')) return 'Plex';
        if (lower.includes('iptv') || lower.includes('magis')) return 'IPTV / Magis';
        if (lower.includes('crunchyroll')) return 'Crunchyroll';
        if (lower.includes('spotify')) return 'Spotify';
        if (lower.includes('youtube')) return 'YouTube';
        if (lower.includes('apple')) return 'Apple TV';
        
        // Fallback: Limpieza genérica
        return serviceName.replace(/\s(Paquete|Perfil|Perfiles|Cuenta|Renovación|Pantalla|Dispositivo).*$/gi, '').trim();
    }, []);

    // 🧠 OPCIONES DEL FILTRO
    const filterOptions = useMemo(() => {
        const fromCatalog = safeCatalog.map(s => getBaseName(s.name));
        const fromSales = safeSales.map(s => getBaseName(s.service));
        return [...new Set([...fromCatalog, ...fromSales])].sort();
    }, [safeCatalog, safeSales, getBaseName]);

    // 🧠 DROPDOWN PARA NUEVO STOCK
    const availableServicesForDropdown = useMemo(() => {
        if (newAccData.type === 'Cuenta') {
            const uniqueBases = new Set();
            safeCatalog.forEach(item => {
                const isPackage = item.name.toLowerCase().includes('paquete');
                const isProfileSpecific = item.type === 'Perfil' && item.name.includes('Perfil');
                if (!isPackage && !isProfileSpecific) uniqueBases.add(getBaseName(item.name));
            });
            return Array.from(uniqueBases).sort();
        } else {
            return safeCatalog
                .map(s => s.name)
                .filter(name => !name.toLowerCase().includes('cuenta completa') && !name.toLowerCase().includes('completa'))
                .sort();
        }
    }, [safeCatalog, newAccData.type, getBaseName]);

    // Auto-llenado de slots
    useEffect(() => {
        if (newAccData.service && safeCatalog.length > 0) {
            const serviceMatch = safeCatalog.find(s => s.name === newAccData.service || getBaseName(s.name) === newAccData.service);
            if (serviceMatch && serviceMatch.defaultSlots) {
                setNewAccData(prev => ({ ...prev, slots: serviceMatch.defaultSlots }));
            }
        }
    }, [newAccData.service, safeCatalog, getBaseName]);

    useEffect(() => { setDisplayLimit(20); }, [searchTerm, selectedService, selectedStatus, hideProblems]);

    // ========================================================================
    // 🧠 AGRUPACIÓN INTELIGENTE (Llave: Email + Nombre Base)
    // ========================================================================
    const groupedAccounts = useMemo(() => {
        if (safeSales.length === 0) return [];
        const groups = {};
        
        safeSales.forEach(sale => {
            const email = (sale.email || 'Sin Email').trim();
            
            // Usamos el detector especial que ahora separa Disney Básico de En Vivo
            const baseService = getBaseName(sale.service);
            
            // La llave usa este nombre base diferenciado
            const groupKey = `${email.toLowerCase()}_${baseService.toLowerCase()}`;
            
            if (!groups[groupKey]) {
                groups[groupKey] = { 
                    groupKey,
                    email, 
                    pass: sale.pass || '', 
                    service: baseService, // La tarjeta mostrará "Disney+ En Vivo" o "Disney+ Básico"
                    profiles: [], 
                    freeCount: 0, 
                    totalCount: 0, 
                    status: 'Sano',
                    isMasterAccount: false
                };
            }

            if (sale.type === 'Cuenta' || (sale.service && sale.service.toLowerCase().includes('completa'))) {
                groups[groupKey].isMasterAccount = true;
            }

            groups[groupKey].profiles.push(sale);
            groups[groupKey].totalCount++;
            
            if (PROBLEM_STATUSES.includes(sale.client)) groups[groupKey].status = sale.client;
            if (['LIBRE', 'Espacio Libre', 'disponible'].includes(sale.client)) groups[groupKey].freeCount++;
        });

        return Object.values(groups).sort((a, b) => a.email.localeCompare(b.email));
    }, [safeSales, getBaseName]);

    // 🧠 FILTRADO FINAL
    const filteredAccounts = useMemo(() => {
        return groupedAccounts.filter(acc => {
            const matchesSearch = acc.email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                                 acc.service.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesService = selectedService === 'Todos' || acc.service === selectedService;
            const matchesStatus = selectedStatus === 'Todos' || acc.status === selectedStatus;
            const isHiddenByEye = hideProblems && PROBLEM_STATUSES.includes(acc.status);
            
            return matchesSearch && matchesService && matchesStatus && !isHiddenByEye;
        });
    }, [groupedAccounts, searchTerm, selectedService, selectedStatus, hideProblems]);

    const visibleAccounts = filteredAccounts.slice(0, displayLimit);

    const lastElementRef = useCallback(node => {
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && displayLimit < filteredAccounts.length) {
                setDisplayLimit(prev => prev + 20);
            }
        });
        if (node) observer.current.observe(node);
    }, [displayLimit, filteredAccounts.length]);

    // --- ACCIONES ---

    const requestDelete = (e, acc) => { e.stopPropagation(); setDeleteModal(acc); };

    const confirmDeleteMasterAccount = async () => {
        if (!deleteModal) return;
        try {
            const batch = writeBatch(db);
            deleteModal.profiles.forEach(profile => {
                const docRef = doc(db, `users/${user.uid}/sales`, profile.id);
                batch.delete(docRef);
            });
            await batch.commit();
            setNotification({ show: true, message: 'Cuenta eliminada correctamente', type: 'success' });
            setDeleteModal(null);
        } catch (err) {
            console.error(err);
            setNotification({ show: true, message: 'Error al eliminar', type: 'error' });
        }
    };

    const handleSaveNewMasterAccount = async (e) => {
        e.preventDefault();
        if (!user || !newAccData.email || !newAccData.service) return;
        
        const serviceInCatalog = safeCatalog.find(s => s.name === newAccData.service);
        const baseCost = serviceInCatalog ? parseFloat(serviceInCatalog.cost || 0) : 0;
        
        try {
            const batch = writeBatch(db);
            const salesRef = collection(db, `users/${user.uid}/sales`);
            
            if (newAccData.type === 'Cuenta') {
                const newDocRef = doc(salesRef);
                const baseName = getBaseName(newAccData.service);
                const cleanName = `${baseName} Cuenta Completa`;

                batch.set(newDocRef, { 
                    client: 'LIBRE', service: cleanName, email: newAccData.email, pass: newAccData.pass, 
                    cost: baseCost, type: 'Cuenta', profile: '', pin: '', 
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp() 
                });
            } else {
                for (let i = 1; i <= parseInt(newAccData.slots); i++) {
                    const newDocRef = doc(salesRef);
                    batch.set(newDocRef, { 
                        client: 'LIBRE', service: newAccData.service, email: newAccData.email, pass: newAccData.pass, 
                        cost: 0, type: 'Perfil', profile: `Perfil ${i}`, pin: '', 
                        createdAt: serverTimestamp(), updatedAt: serverTimestamp() 
                    });
                }
            }
            
            await batch.commit();
            setNotification({ show: true, message: 'Stock registrado correctamente', type: 'success' });
            setShowNewAccountForm(false);
            setNewAccData({ email: '', pass: '', service: '', slots: 5, type: 'Perfil' });
        } catch (err) { 
            console.error(err);
            setNotification({ show: true, message: 'Error al guardar stock', type: 'error' }); 
        }
    };

    const handleDeleteProfile = async (id) => {
        if (!window.confirm("¿Eliminar este perfil?")) return;
        try { 
            await deleteDoc(doc(db, `users/${user.uid}/sales`, id)); 
            setNotification({ show: true, message: 'Eliminado', type: 'success' }); 
        } catch (err) { 
            setNotification({ show: true, message: 'Error', type: 'error' }); 
        }
    };

    const handleUpdateGlobalPass = async (acc) => {
        if (!editingPass.value) return;
        try {
            const batch = writeBatch(db);
            const q = query(collection(db, `users/${user.uid}/sales`), 
                where("email", "==", acc.email)
            );
            const snap = await getDocs(q);
            
            // Filtro en memoria para actualizar SOLO la variante correcta (Básico vs En Vivo)
            const baseTarget = getBaseName(acc.service);
            
            snap.forEach(d => { 
                const data = d.data();
                if (getBaseName(data.service) === baseTarget) {
                    batch.update(d.ref, { pass: editingPass.value, updatedAt: serverTimestamp() });
                }
            });
            
            await batch.commit();
            setEditingPass({ email: null, value: '', groupKey: null });
            setNotification({ show: true, message: 'Clave actualizada', type: 'success' });
        } catch (err) { 
            setNotification({ show: true, message: 'Error', type: 'error' }); 
        }
    };

    // THEME
    const theme = {
        card: darkMode ? 'bg-[#161B28] border-white/5' : 'bg-white border-slate-200 shadow-sm',
        text: darkMode ? 'text-white' : 'text-slate-900',
        sub: darkMode ? 'text-slate-300/60' : 'text-slate-500',
        input: darkMode ? 'bg-[#0B0F19] border-[#1E293B] text-white focus:border-cyan-400' : 'bg-white border-slate-200 text-slate-900',
        modal: darkMode ? 'bg-[#0B0F19] border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-2xl',
        label: darkMode ? 'text-slate-300 font-black uppercase text-[10px]' : 'text-slate-500 font-black uppercase text-[10px]'
    };

    return (
        <div className="w-full min-h-screen pb-32 space-y-4 animate-in fade-in">
            
            {/* --- MODAL CONFIRMACIÓN ELIMINAR --- */}
            {deleteModal && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className={`w-full max-w-sm rounded-[2rem] p-6 border shadow-2xl transform transition-all scale-100 ${theme.modal}`}>
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-14 h-14 rounded-full bg-rose-500/10 flex items-center justify-center text-rose-500 mb-2">
                                <Trash2 size={28} />
                            </div>
                            <div>
                                <h3 className={`text-lg font-black ${theme.text}`}>¿Eliminar Cuenta?</h3>
                                <p className={`text-xs mt-2 ${theme.sub}`}>
                                    Borrarás <span className="font-bold text-rose-400">{deleteModal.email}</span> de {deleteModal.service}.
                                </p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button onClick={() => setDeleteModal(null)} className={`flex-1 py-3 rounded-xl font-bold text-xs transition-colors ${darkMode ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>Cancelar</button>
                                <button onClick={confirmDeleteMasterAccount} className="flex-1 py-3 rounded-xl font-bold text-xs bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-600 active:scale-95 transition-all">Sí, Eliminar</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MODAL NUEVO STOCK --- */}
            {showNewAccountForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                    <div className={`w-full max-w-md p-6 md:p-8 rounded-[2.5rem] border animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh] overflow-y-auto ${theme.modal}`}>
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h3 className={`text-2xl font-black ${theme.text}`}>Ingreso de Stock</h3>
                                <p className={theme.sub}>Añadir inventario a la bóveda.</p>
                            </div>
                            <button onClick={() => setShowNewAccountForm(false)} className="p-2 rounded-full hover:bg-rose-500/10 text-rose-500"><X size={24}/></button>
                        </div>
                        
                        <form onSubmit={handleSaveNewMasterAccount} className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/10">
                                <button 
                                    type="button"
                                    onClick={() => setNewAccData({...newAccData, type: 'Perfil', service: ''})} 
                                    className={`py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${newAccData.type === 'Perfil' ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <User size={14} /> Perfiles
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => setNewAccData({...newAccData, type: 'Cuenta', service: ''})} 
                                    className={`py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${newAccData.type === 'Cuenta' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    <Layers size={14} /> Completa
                                </button>
                            </div>

                            <div>
                                <label className={theme.label}>Servicio</label>
                                <select required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.service} onChange={e => setNewAccData({...newAccData, service: e.target.value})}>
                                    <option value="" disabled>Seleccionar Servicio</option>
                                    {availableServicesForDropdown.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div><label className={theme.label}>Correo</label><input type="email" required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.email} onChange={e => setNewAccData({...newAccData, email: e.target.value})} placeholder="email@cuenta.com"/></div>
                            <div><label className={theme.label}>Contraseña</label><input type="text" required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.pass} onChange={e => setNewAccData({...newAccData, pass: e.target.value})} placeholder="Clave"/></div>
                            
                            {newAccData.type === 'Perfil' && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className={theme.label}>Cantidad de Perfiles</label>
                                    <input type="number" required min="1" max="10" className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.slots} onChange={e => setNewAccData({...newAccData, slots: e.target.value})}/>
                                </div>
                            )}

                            {newAccData.type === 'Cuenta' && (
                                <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-medium flex items-center gap-2 animate-in fade-in">
                                    <ShieldCheck size={18} />
                                    <span>Se creará <b>1 Tarjeta Madre</b>.</span>
                                </div>
                            )}

                            <button type="submit" className={`w-full mt-4 py-4 rounded-2xl font-black shadow-xl uppercase tracking-widest text-sm active:scale-95 transition-all ${newAccData.type === 'Cuenta' ? 'bg-indigo-600 text-white' : 'bg-emerald-600 text-white'}`}>
                                GUARDAR {newAccData.type.toUpperCase()}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <header className="px-1 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div><h2 className={`text-2xl font-black ${theme.text}`}>Bóveda Digital 📦</h2><p className={theme.sub}>Inventario maestro de cuentas.</p></div>
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button onClick={() => setShowNewAccountForm(true)} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg uppercase hover:bg-emerald-500 transition-colors"><PlusCircle size={18}/> Nuevo</button>
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-sm border ${theme.card}`}><Hash size={16} className="text-indigo-500"/><span className={theme.text}>{filteredAccounts.length}</span></div>
                    <button onClick={() => setHideProblems(!hideProblems)} className={`p-3 rounded-2xl border transition-all ${hideProblems ? 'bg-rose-500 text-white border-rose-600' : (darkMode ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white text-slate-600')}`}>{hideProblems ? <EyeOff size={20}/> : <Eye size={20}/>}</button>
                </div>
            </header>

            <div className={`grid grid-cols-1 md:grid-cols-12 gap-2 sticky top-0 z-30 py-2 border-b backdrop-blur-xl transition-colors ${darkMode ? 'bg-[#0B0F19]/90 border-white/5' : 'bg-[#F2F2F7]/90 border-slate-200/50'}`}>
                <div className="relative md:col-span-6 group shadow-lg">
                    <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${darkMode ? 'text-slate-500 group-focus-within:text-cyan-400' : 'text-slate-400'}`} size={18}/>
                    <input type="text" placeholder="Buscar cuenta..." className={`w-full pl-11 pr-4 py-3 rounded-2xl font-semibold text-[15px] outline-none transition-all shadow-sm ${theme.input}`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                </div>
                
                <select className={`md:col-span-3 px-4 py-3 rounded-2xl border outline-none font-bold text-xs transition-all ${theme.input}`} value={selectedService} onChange={(e) => setSelectedService(e.target.value)}>
                    <option value="Todos">Todos los Servicios</option>
                    {filterOptions.map(name => (
                        <option key={name} value={name}>{name}</option>
                    ))}
                </select>
                
                <select className={`md:col-span-3 px-4 py-3 rounded-2xl border outline-none font-bold text-xs transition-all ${theme.input}`} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                    <option value="Todos">Todos los Estados</option>
                    {PROBLEM_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
            </div>

            <div className="space-y-3">
                {visibleAccounts.length > 0 ? visibleAccounts.map((acc, index) => {
                    const isProblem = PROBLEM_STATUSES.includes(acc.status);
                    const isExpanded = expandedAccounts[acc.groupKey];

                    return (
                        <div key={acc.groupKey} ref={index === visibleAccounts.length - 1 ? lastElementRef : null} className={`rounded-[2rem] border transition-all duration-300 ${theme.card} ${isProblem ? 'border-rose-500/30' : ''}`}>
                            <div onClick={() => setExpandedAccounts(p => ({...p, [acc.groupKey]: !p[acc.groupKey]}))} className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shrink-0 text-lg ${isProblem ? 'bg-rose-500/20 text-rose-500' : (acc.isMasterAccount ? 'bg-indigo-600 text-white shadow-lg' : 'bg-emerald-500/20 text-emerald-500')}`}>{acc.service.charAt(0)}</div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`font-bold text-sm md:text-base truncate ${theme.text}`}>{acc.email}</h4>
                                            {isProblem && <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-rose-500 text-white">{acc.status}</span>}
                                            {acc.isMasterAccount && !isProblem && <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-indigo-600 text-white flex items-center gap-1"><Layers size={10}/> Completa</span>}
                                        </div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest mt-1 ${theme.sub}`}>{acc.service}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <div className={`text-xs font-black ${acc.freeCount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {acc.isMasterAccount ? (acc.freeCount > 0 ? 'DISPONIBLE' : 'OCUPADA') : `${acc.freeCount} LIBRES`}
                                        </div>
                                        <div className={`text-[9px] font-bold uppercase ${theme.sub}`}>
                                            {acc.isMasterAccount ? 'CUENTA MADRE' : `${acc.totalCount} PERFILES`}
                                        </div>
                                    </div>
                                    
                                    <button onClick={(e) => requestDelete(e, acc)} className={`p-2 rounded-full transition-colors z-10 ${darkMode ? 'hover:bg-rose-500/20 text-slate-500 hover:text-rose-500' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`}><Trash2 size={18}/></button>
                                    {isExpanded ? <ChevronUp size={20} className={theme.sub}/> : <ChevronDown size={20} className={theme.sub}/>}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={`p-6 space-y-5 border-t animate-in slide-in-from-top-2 duration-300 ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50'}`}>
                                    <div className="bg-white/5 p-4 rounded-3xl border border-white/5">
                                        <label className={`${theme.label} block mb-2`}>Credenciales Maestras</label>
                                        <div className="flex gap-2">
                                            <div className="relative flex-1 group">
                                                <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400" size={16}/>
                                                <input type="text" className={`w-full pl-10 pr-4 py-2.5 rounded-xl text-xs font-mono border outline-none transition-all ${theme.input}`} value={editingPass.groupKey === acc.groupKey ? editingPass.value : acc.pass} onChange={(e) => setEditingPass({ email: acc.email, value: e.target.value, groupKey: acc.groupKey })}/>
                                            </div>
                                            {editingPass.groupKey === acc.groupKey && editingPass.value !== acc.pass && <button onClick={() => handleUpdateGlobalPass(acc)} className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg active:scale-95 transition-all"><Save size={18}/></button>}
                                            <button onClick={() => {navigator.clipboard.writeText(`${acc.email}:${acc.pass}`); setNotification({show:true, message:'Copiado'});}} className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg active:scale-95 transition-all"><Copy size={18}/></button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {acc.profiles.map((profile) => {
                                            const isLibre = ['LIBRE', 'Espacio Libre', 'disponible'].includes(profile.client);
                                            return (
                                                <div key={profile.id} className={`p-4 rounded-3xl border flex items-center justify-between group transition-all ${isLibre ? 'bg-emerald-500/5 border-emerald-500/20' : (darkMode ? 'bg-white/5 border-white/5' : 'bg-white shadow-sm')}`}>
                                                    <div className="flex items-center gap-3 truncate">
                                                        <div className={`p-2 rounded-xl ${isLibre ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>{isLibre ? <CheckCircle2 size={16}/> : <User size={16}/>}</div>
                                                        <div className="truncate">
                                                            <p className={`text-xs font-black truncate ${isLibre ? 'text-emerald-500' : (PROBLEM_STATUSES.includes(profile.client) ? 'text-rose-400' : theme.text)}`}>{isLibre ? 'DISPONIBLE' : profile.client}</p>
                                                            <p className={`text-[10px] font-bold font-mono uppercase ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                                                                {/* Aquí mostramos el nombre específico del perfil si es diferente al de la cuenta */}
                                                                {profile.profile} {profile.pin && `| PIN: ${profile.pin}`}
                                                                <span className="block text-[8px] opacity-50">{profile.service}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button onClick={() => { setFormData(profile); setView('form'); }} className="p-2 rounded-xl bg-indigo-500 text-white text-[10px] font-bold shadow-md hover:bg-indigo-600">Asignar</button>
                                                        <button onClick={() => handleDeleteProfile(profile.id)} className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"><Trash2 size={14}/></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {!acc.isMasterAccount && (
                                            <button onClick={() => { setNewAccData({ email: acc.email, pass: acc.pass, service: acc.service, slots: 1, type: 'Perfil' }); setShowNewAccountForm(true); }} className="p-4 rounded-3xl border border-dashed border-indigo-500/40 text-indigo-500 flex items-center justify-center gap-2 text-xs font-bold hover:bg-indigo-500/5 transition-all"><PlusCircle size={16}/> Añadir Slot</button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                }) : (
                    <div className="text-center py-20 flex flex-col items-center justify-center animate-in fade-in">
                        <LayoutGrid size={48} className={`mb-4 opacity-20 ${theme.text}`}/>
                        <p className={theme.sub}>No hay cuentas en el inventario.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InventoryMaster;