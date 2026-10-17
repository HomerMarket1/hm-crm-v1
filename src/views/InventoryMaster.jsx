import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { 
    Search, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, User, CheckCircle2, 
    Copy, Key, PlusCircle, Save, Trash2, Eye, EyeOff, 
    Hash, X, LayoutGrid, Layers, ShieldCheck, Edit2, Check, RefreshCw
} from 'lucide-react';
import {
    collection, doc, deleteDoc, updateDoc, writeBatch,
    query, where, getDocs, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import SearchableSelect from '../components/SearchableSelect';

// Constantes
const PROBLEM_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Seguimiento', 'Garantía'];
const FREE_STATUSES = ['LIBRE', 'Espacio Libre', 'disponible'];

const InventoryMaster = ({ sales, catalog, darkMode, setFormData, setView, user, setNotification }) => {
    
    // 🛡️ Blindaje de datos
    const safeSales = useMemo(() => Array.isArray(sales) ? sales : [], [sales]);
    const safeCatalog = useMemo(() => Array.isArray(catalog) ? catalog : [], [catalog]);

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedService, setSelectedService] = useState('Todos');
    const [serviceQuery, setServiceQuery] = useState('');
    const [serviceOpen, setServiceOpen] = useState(false);
    const [selectedStatus, setSelectedStatus] = useState('Todos'); 
    const [hideProblems, setHideProblems] = useState(false); 
    const [expandedAccounts, setExpandedAccounts] = useState({});
    const [editingPass, setEditingPass] = useState({ email: null, value: '', groupKey: null });
    const [editingProfile, setEditingProfile] = useState(null); // { id, profile, pin }

    const [deleteModal, setDeleteModal] = useState(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const listTopRef = useRef(null);

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
            if (lower.includes('premium')) return 'Disney+ Premium';
            // Todo lo que no sea "En Vivo" ni "Premium" se agrupa como Básico
            // (Esto agrupa "Disney+ Básico", "Disney+ Basico", "Disney+ Standard", etc.)
            return 'Disney+ Básico';
        }

        // Resto de plataformas (Agrupación Estándar)
        if (lower.includes('netflix')) return 'Netflix';
        if (lower.includes('prime') || lower.includes('amazon')) return 'Prime Video';
        if (lower.includes('hbomax')) return 'HBOmax';
        if (lower.includes('paramount')) return 'Paramount+';
        if (lower.includes('vix')) return 'Vix';
        if (lower.includes('plex')) return 'Plex';
        if (lower.includes('iptv')) return 'IPTV';
        if (lower.includes('flujo')) return 'FlujoTv';
        if (lower.includes('crunchyroll')) return 'Crunchyroll';
        if (lower.includes('spotify')) return 'Spotify';
        if (lower.includes('youtube')) return 'Youtube';
        if (lower.includes('apple')) return 'Apple TV';
        if (lower.includes('flow')) return 'Flow';
        if (lower.includes('universal')) return 'Universal+';
        if (lower.includes('max')) return 'Max';
        
        // Fallback: Limpieza genérica
        return serviceName.replace(/\s(Paquete|Perfil|Perfiles|Cuenta|Completa|Renovación|Pantalla|Dispositivo).*$/gi, '').trim();
    }, []);

    // 🧠 ¿El nombre guardado en la venta corresponde a este servicio del catálogo?
    // Cubre nombres derivados: "Netflix Cuenta Completa" (stock de "Netflix Completa")
    // y "Netflix" (perfiles libres que quedan al dividir una cuenta).
    const serviceBelongsTo = useCallback((saleService, catalogItem) => {
        if (!saleService || !catalogItem) return false;
        if (saleService === catalogItem.name) return true;
        const base = getBaseName(catalogItem.name);
        if (getBaseName(saleService) !== base) return false;
        if (catalogItem.type === 'Cuenta') return saleService.toLowerCase().includes('completa');
        if (catalogItem.type === 'Perfil') return saleService === base;
        return false;
    }, [getBaseName]);

    // 🧠 OPCIONES DEL FILTRO: nombres reales del catálogo + servicios antiguos que ya no están en él
    const filterOptions = useMemo(() => {
        const fromCatalog = safeCatalog.map(s => s.name);
        const orphanSales = [...new Set(safeSales.map(s => s.service).filter(Boolean))]
            .filter(name => !safeCatalog.some(c => serviceBelongsTo(name, c)));
        return [...new Set([...fromCatalog, ...orphanSales])].sort();
    }, [safeCatalog, safeSales, serviceBelongsTo]);

    const serviceMatches = useMemo(() => {
        const q = serviceQuery.trim().toLowerCase();
        return q ? filterOptions.filter(name => name.toLowerCase().includes(q)) : filterOptions;
    }, [filterOptions, serviceQuery]);

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

    // Auto-llenado de slots: en modo Perfiles usa la capacidad de la Cuenta Completa
    // de la misma plataforma (ej: "Netflix Completa" = 5), no los cupos del perfil suelto.
    const getDefaultSlots = useCallback((serviceName) => {
        const base = getBaseName(serviceName);
        const accountItem = safeCatalog.find(s => s.type === 'Cuenta' && getBaseName(s.name) === base);
        if (Number(accountItem?.profileCapacity)) return Number(accountItem.profileCapacity);
        if (Number(accountItem?.defaultSlots) > 1) return Number(accountItem.defaultSlots); // formato antiguo
        const serviceMatch = safeCatalog.find(s => s.name === serviceName);
        if (Number(serviceMatch?.defaultSlots) > 1) return Number(serviceMatch.defaultSlots);
        return base.toLowerCase().includes('netflix') ? 5 : 4;
    }, [safeCatalog, getBaseName]);

    // Capacidad máxima definida en Ajustes (Cuenta Completa de la plataforma). null = sin límite configurado
    const getAccountCapacity = useCallback((serviceName) => {
        const base = getBaseName(serviceName);
        const accountItem = safeCatalog.find(s => s.type === 'Cuenta' && getBaseName(s.name) === base);
        if (!accountItem) return null;
        if (Number(accountItem.profileCapacity)) return Number(accountItem.profileCapacity);
        if (Number(accountItem.defaultSlots) > 1) return Number(accountItem.defaultSlots); // formato antiguo
        return null;
    }, [safeCatalog, getBaseName]);

    // Perfiles que ya existen para ese correo en la misma plataforma
    const getExistingProfiles = useCallback((email, serviceName) => {
        const base = getBaseName(serviceName);
        const mail = (email || '').trim().toLowerCase();
        if (!mail) return [];
        return safeSales.filter(s => (s.email || '').trim().toLowerCase() === mail && getBaseName(s.service) === base);
    }, [safeSales, getBaseName]);

    // Cantidad a crear: si la cuenta ya existe, solo los que faltan para completar la capacidad
    const getSlotsToCreate = useCallback((email, serviceName) => {
        const existing = getExistingProfiles(email, serviceName).length;
        if (existing === 0) return getDefaultSlots(serviceName);
        const capacity = getAccountCapacity(serviceName);
        return capacity ? Math.max(1, capacity - existing) : 1;
    }, [getExistingProfiles, getDefaultSlots, getAccountCapacity]);

    const handleServiceChange = (serviceName) => {
        setNewAccData(prev => ({ ...prev, service: serviceName, slots: getSlotsToCreate(prev.email, serviceName) }));
    };

    const openAddSlot = (acc) => {
        // Usar el servicio Perfil del catálogo para que aparezca seleccionado en el desplegable
        const perfiles = safeCatalog.filter(s => s.type === 'Perfil' && getBaseName(s.name) === acc.service);
        const profileService = perfiles.find(s => Number(s.defaultSlots) === 1) || perfiles[0];
        const service = profileService?.name || acc.profiles[0]?.service || acc.service;
        setNewAccData({ email: acc.email, pass: acc.pass, service, slots: getSlotsToCreate(acc.email, service), type: 'Perfil' });
        setShowNewAccountForm(true);
    };

    useEffect(() => { setPage(1); }, [searchTerm, selectedService, selectedStatus, hideProblems, pageSize]);

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
            
            const selectedItem = safeCatalog.find(c => c.name === selectedService);
            const matchesService = selectedService === 'Todos' || acc.profiles.some(p =>
                selectedItem ? serviceBelongsTo(p.service, selectedItem) : p.service === selectedService
            );
            const matchesStatus = selectedStatus === 'Todos' || acc.status === selectedStatus;
            const isHiddenByEye = hideProblems && PROBLEM_STATUSES.includes(acc.status);
            
            return matchesSearch && matchesService && matchesStatus && !isHiddenByEye;
        });
    }, [groupedAccounts, searchTerm, selectedService, selectedStatus, hideProblems, safeCatalog, serviceBelongsTo]);

    // 📄 PAGINACIÓN
    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageStart = (currentPage - 1) * pageSize;
    const visibleAccounts = filteredAccounts.slice(pageStart, pageStart + pageSize);

    const goToPage = (p) => {
        setPage(Math.min(Math.max(1, p), totalPages));
        listTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // Números visibles: 1 … 4 5 6 … 57
    const pageNumbers = useMemo(() => {
        const nums = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
        const sorted = [...nums].filter(n => n >= 1 && n <= totalPages).sort((a, b) => a - b);
        const out = [];
        sorted.forEach((n, i) => {
            if (i > 0 && n - sorted[i - 1] > 1) out.push('…' + n);
            out.push(n);
        });
        return out;
    }, [currentPage, totalPages]);

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
        if (!user || !newAccData.email) return;
        // El buscador de servicio no es un <select required>: validamos aquí
        if (!newAccData.service) {
            setNotification({ show: true, message: 'Selecciona un servicio.', type: 'error' });
            return;
        }
        
        const serviceInCatalog = safeCatalog.find(s => s.name === newAccData.service);
        const baseCost = serviceInCatalog ? parseFloat(serviceInCatalog.cost || 0) : 0;

        // 🚫 No superar los perfiles definidos para la cuenta
        if (newAccData.type === 'Perfil') {
            const capacity = getAccountCapacity(newAccData.service);
            const base = getBaseName(newAccData.service);
            const existing = safeSales.filter(s =>
                (s.email || '').trim().toLowerCase() === newAccData.email.trim().toLowerCase() && getBaseName(s.service) === base
            ).length;
            if (capacity && existing + parseInt(newAccData.slots) > capacity) {
                const left = Math.max(0, capacity - existing);
                setNotification({ show: true, message: left > 0 ? `Esta cuenta admite ${capacity} perfiles: solo puedes añadir ${left} más.` : `Esta cuenta ya tiene sus ${capacity} perfiles completos.`, type: 'error' });
                return;
            }
        }
        
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
                // Numerar sin repetir: rellena huecos (si borraste "Perfil 5", el nuevo será "Perfil 5")
                const usedNames = new Set(getExistingProfiles(newAccData.email, newAccData.service).map(p => (p.profile || '').trim().toLowerCase()));
                let nextNum = 1;
                const nextProfileName = () => {
                    while (usedNames.has(`perfil ${nextNum}`)) nextNum++;
                    usedNames.add(`perfil ${nextNum}`);
                    return `Perfil ${nextNum}`;
                };
                for (let i = 1; i <= parseInt(newAccData.slots); i++) {
                    const newDocRef = doc(salesRef);
                    const isAdminSlot = newAccData.reserveAdmin && i === 1;
                    const profileName = nextProfileName();
                    batch.set(newDocRef, {
                        client: isAdminSlot ? 'ADMIN' : 'LIBRE', service: newAccData.service, email: newAccData.email, pass: newAccData.pass,
                        cost: 0, type: 'Perfil', profile: profileName, pin: '',
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

    const handleSaveProfile = async () => {
        if (!editingProfile) return;
        try {
            await updateDoc(doc(db, `users/${user.uid}/sales`, editingProfile.id), {
                profile: editingProfile.profile.trim(),
                pin: editingProfile.pin.trim(),
                updatedAt: serverTimestamp()
            });
            setEditingProfile(null);
            setNotification({ show: true, message: 'Perfil actualizado', type: 'success' });
        } catch (err) {
            console.error(err);
            setNotification({ show: true, message: 'Error al actualizar perfil', type: 'error' });
        }
    };

    // 🔄 CONVERTIR CUENTA: Completa <-> Perfiles (solo si no hay nada vendido)
    const handleConvertAccount = async (acc) => {
        const busy = acc.profiles.filter(p => !FREE_STATUSES.includes(p.client) && p.client !== 'ADMIN');
        if (busy.length > 0) {
            setNotification({ show: true, message: `No se puede convertir: hay ${busy.length} ocupados. Libéralos primero.`, type: 'error' });
            return;
        }

        const toProfiles = acc.isMasterAccount;
        let profileService = null;
        let slots = 1;
        if (toProfiles) {
            const perfiles = safeCatalog.filter(s => s.type === 'Perfil' && getBaseName(s.name) === acc.service);
            profileService = perfiles.find(s => Number(s.defaultSlots) === 1) || perfiles[0];
            if (!profileService) {
                setNotification({ show: true, message: `Crea primero un servicio tipo Perfil de ${acc.service} en Ajustes.`, type: 'error' });
                return;
            }
            slots = getDefaultSlots(profileService.name);
        }

        const msg = toProfiles
            ? `¿Convertir ${acc.email} en ${slots} perfiles de "${profileService.name}"?`
            : `¿Convertir ${acc.email} en Cuenta Completa? Se eliminarán sus ${acc.profiles.length} perfiles libres.`;
        if (!window.confirm(msg)) return;

        try {
            const batch = writeBatch(db);
            const salesRef = collection(db, `users/${user.uid}/sales`);
            acc.profiles.forEach(p => batch.delete(doc(db, `users/${user.uid}/sales`, p.id)));

            if (toProfiles) {
                for (let i = 1; i <= slots; i++) {
                    batch.set(doc(salesRef), {
                        client: 'LIBRE', service: profileService.name, email: acc.email, pass: acc.pass,
                        cost: 0, type: 'Perfil', profile: `Perfil ${i}`, pin: '',
                        createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                    });
                }
            } else {
                batch.set(doc(salesRef), {
                    client: 'LIBRE', service: `${acc.service} Cuenta Completa`, email: acc.email, pass: acc.pass,
                    cost: 0, type: 'Cuenta', profile: '', pin: '',
                    createdAt: serverTimestamp(), updatedAt: serverTimestamp()
                });
            }

            await batch.commit();
            setNotification({ show: true, message: toProfiles ? `Convertida en ${slots} perfiles` : 'Convertida en Cuenta Completa', type: 'success' });
        } catch (err) {
            console.error(err);
            setNotification({ show: true, message: 'Error al convertir la cuenta', type: 'error' });
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
                                <div className="mt-1">
                                    <SearchableSelect
                                        value={newAccData.service}
                                        options={availableServicesForDropdown}
                                        onChange={(v) => v ? handleServiceChange(v) : setNewAccData(prev => ({ ...prev, service: '' }))}
                                        darkMode={darkMode}
                                        allValue=""
                                        allLabel="Seleccionar Servicio"
                                        placeholder="Escribe para buscar..."
                                        showAllOption={false}
                                        highlightActive={false}
                                        size="lg"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className={theme.label}>Correo / Usuario</label>
                                {/* ✅ CORRECCIÓN: type="text" para aceptar usuarios sin arroba */}
                                <input type="text" required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.email} onChange={e => setNewAccData({...newAccData, email: e.target.value})} onBlur={() => setNewAccData(prev => (prev.type === 'Perfil' && prev.service) ? { ...prev, slots: getSlotsToCreate(prev.email, prev.service) } : prev)} placeholder="Correo o Usuario (IPTV)"/>
                            </div>

                            <div><label className={theme.label}>Contraseña</label><input type="text" required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.pass} onChange={e => setNewAccData({...newAccData, pass: e.target.value})} placeholder="Clave"/></div>
                            
                            {newAccData.type === 'Perfil' && (
                                <div className="animate-in slide-in-from-top-2">
                                    <label className={theme.label}>Cantidad de Perfiles</label>
                                    <input type="number" readOnly tabIndex={-1} className={`w-full mt-1 p-4 rounded-2xl outline-none border cursor-not-allowed opacity-60 ${theme.input}`} value={newAccData.slots} title="Definido por los cupos del servicio en Ajustes"/>
                                    <p className={`text-[10px] mt-1 ml-1 ${theme.sub}`}>Se toma de los cupos configurados en Ajustes.</p>
                                    <label className={`flex items-center gap-2 mt-3 ml-1 text-xs font-bold cursor-pointer ${theme.sub}`}>
                                        <input type="checkbox" className="accent-emerald-500 w-4 h-4" checked={!!newAccData.reserveAdmin} onChange={e => setNewAccData({...newAccData, reserveAdmin: e.target.checked})}/>
                                        Reservar Perfil 1 como ADMIN
                                    </label>
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
                
                {/* 🔎 BUSCADOR DE SERVICIOS EN VIVO */}
                <div className="relative md:col-span-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={14}/>
                    <input
                        type="text"
                        className={`w-full pl-9 pr-9 py-3 rounded-2xl border outline-none font-bold text-xs transition-all ${theme.input}`}
                        placeholder={selectedService === 'Todos' ? 'Todos los Servicios' : selectedService}
                        value={serviceOpen ? serviceQuery : (selectedService === 'Todos' ? '' : selectedService)}
                        onFocus={() => { setServiceOpen(true); setServiceQuery(''); }}
                        onBlur={() => setServiceOpen(false)}
                        onChange={(e) => setServiceQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') e.currentTarget.blur();
                            if (e.key === 'Enter' && serviceMatches.length > 0) { setSelectedService(serviceMatches[0]); e.currentTarget.blur(); }
                        }}
                    />
                    {selectedService !== 'Todos' && !serviceOpen && (
                        <button onClick={() => setSelectedService('Todos')} title="Quitar filtro" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"><X size={14}/></button>
                    )}
                    {serviceOpen && (
                        <div className={`absolute z-40 mt-1 w-full max-h-72 overflow-y-auto rounded-2xl border shadow-2xl py-1 custom-scrollbar ${theme.modal}`}>
                            {!serviceQuery && (
                                <button onMouseDown={(e) => { e.preventDefault(); setSelectedService('Todos'); e.currentTarget.closest('div.relative').querySelector('input').blur(); }} className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-indigo-500/10 ${selectedService === 'Todos' ? 'text-indigo-400' : theme.text}`}>Todos los Servicios</button>
                            )}
                            {serviceMatches.map(name => (
                                <button key={name} onMouseDown={(e) => { e.preventDefault(); setSelectedService(name); e.currentTarget.closest('div.relative').querySelector('input').blur(); }} className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-indigo-500/10 ${selectedService === name ? 'text-indigo-400' : theme.text}`}>{name}</button>
                            ))}
                            {serviceMatches.length === 0 && <p className={`px-4 py-3 text-xs ${theme.sub}`}>Sin resultados</p>}
                        </div>
                    )}
                </div>
                
                <select className={`md:col-span-3 px-4 py-3 rounded-2xl border outline-none font-bold text-xs transition-all ${theme.input}`} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                    <option value="Todos">Todos los Estados</option>
                    {PROBLEM_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
            </div>

            <div ref={listTopRef} className="space-y-2 scroll-mt-24">
                {visibleAccounts.length > 0 ? visibleAccounts.map((acc) => {
                    const isProblem = PROBLEM_STATUSES.includes(acc.status);
                    const isExpanded = expandedAccounts[acc.groupKey];

                    return (
                        <div key={acc.groupKey} className={`rounded-2xl border overflow-hidden transition-all duration-300 ${theme.card} ${isProblem ? 'border-rose-500/30' : ''}`}>
                            <div onClick={() => setExpandedAccounts(p => ({...p, [acc.groupKey]: !p[acc.groupKey]}))} className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-black shrink-0 text-sm ${isProblem ? 'bg-rose-500/20 text-rose-500' : (acc.isMasterAccount ? 'bg-indigo-600 text-white shadow-lg' : 'bg-emerald-500/20 text-emerald-500')}`}>{acc.service.charAt(0)}</div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`font-bold text-sm truncate ${theme.text}`}>{acc.email}</h4>
                                            {isProblem && <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-rose-500 text-white">{acc.status}</span>}
                                            {acc.isMasterAccount && !isProblem && <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-indigo-600 text-white flex items-center gap-1"><Layers size={10}/> Completa</span>}
                                        </div>
                                        <p className={`text-[10px] font-black uppercase tracking-widest ${theme.sub}`}>{acc.service}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <div className={`text-xs font-black ${acc.freeCount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                            {acc.isMasterAccount ? (acc.freeCount > 0 ? 'DISPONIBLE' : 'OCUPADA') : `${acc.freeCount} LIBRES`}
                                        </div>
                                        <div className={`text-[9px] font-bold uppercase ${theme.sub}`}>
                                            {acc.isMasterAccount ? 'CUENTA MADRE' : `${acc.totalCount} PERFILES`}
                                        </div>
                                    </div>
                                    
                                    <button onClick={(e) => requestDelete(e, acc)} className={`p-1.5 rounded-full transition-colors z-10 ${darkMode ? 'hover:bg-rose-500/20 text-slate-500 hover:text-rose-500' : 'hover:bg-rose-50 text-slate-400 hover:text-rose-600'}`}><Trash2 size={16}/></button>
                                    {isExpanded ? <ChevronUp size={18} className={theme.sub}/> : <ChevronDown size={18} className={theme.sub}/>}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={`px-4 py-3 space-y-3 border-t animate-in slide-in-from-top-2 duration-300 ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50'}`}>
                                    {/* Credenciales + acciones en una sola fila */}
                                    <div className="flex flex-wrap sm:flex-nowrap gap-2">
                                        <div className="relative flex-1 min-w-[180px] group">
                                            <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400" size={14}/>
                                            <input type="text" title="Clave maestra" className={`w-full pl-9 pr-3 py-2 rounded-xl text-xs font-mono border outline-none transition-all ${theme.input}`} value={editingPass.groupKey === acc.groupKey ? editingPass.value : acc.pass} onChange={(e) => setEditingPass({ email: acc.email, value: e.target.value, groupKey: acc.groupKey })}/>
                                        </div>
                                        {editingPass.groupKey === acc.groupKey && editingPass.value !== acc.pass && <button onClick={() => handleUpdateGlobalPass(acc)} title="Guardar clave" className="p-2 bg-emerald-500 text-white rounded-xl active:scale-95 transition-all"><Save size={16}/></button>}
                                        <button onClick={() => {navigator.clipboard.writeText(`${acc.email}:${acc.pass}`); setNotification({show:true, message:'Copiado'});}} title="Copiar correo:clave" className="p-2 bg-indigo-600 text-white rounded-xl active:scale-95 transition-all"><Copy size={16}/></button>
                                        <button onClick={() => handleConvertAccount(acc)} title={acc.isMasterAccount ? 'Convertir a Perfiles' : 'Convertir a Completa'} className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 border whitespace-nowrap transition-all active:scale-95 ${acc.isMasterAccount ? 'border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10' : 'border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10'}`}>
                                            <RefreshCw size={12}/> {acc.isMasterAccount ? 'A Perfiles' : 'A Completa'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                        {[...acc.profiles].sort((a, b) => (a.profile || '').localeCompare(b.profile || '', undefined, { numeric: true })).map((profile) => {
                                            const isLibre = FREE_STATUSES.includes(profile.client);
                                            const isEditing = editingProfile?.id === profile.id;
                                            if (isEditing) {
                                                return (
                                                    <div key={profile.id} className={`p-2 rounded-xl border border-cyan-400/40 flex items-center gap-1.5 ${darkMode ? 'bg-white/5' : 'bg-white shadow-sm'}`}>
                                                        <input autoFocus type="text" placeholder="Nombre" className={`flex-1 min-w-0 px-3 py-2 rounded-xl text-xs font-bold border outline-none ${theme.input}`} value={editingProfile.profile} onChange={e => setEditingProfile({ ...editingProfile, profile: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setEditingProfile(null); }}/>
                                                        <input type="text" placeholder="PIN" className={`w-20 px-3 py-2 rounded-xl text-xs font-mono border outline-none ${theme.input}`} value={editingProfile.pin} onChange={e => setEditingProfile({ ...editingProfile, pin: e.target.value })} onKeyDown={e => { if (e.key === 'Enter') handleSaveProfile(); if (e.key === 'Escape') setEditingProfile(null); }}/>
                                                        <button onClick={handleSaveProfile} className="p-2 rounded-xl bg-emerald-500 text-white"><Check size={14}/></button>
                                                        <button onClick={() => setEditingProfile(null)} className="p-2 rounded-xl bg-white/10 text-slate-400"><X size={14}/></button>
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={profile.id} title={profile.service} className={`px-2.5 py-2 rounded-xl border flex items-center justify-between gap-2 group transition-all ${isLibre ? 'bg-emerald-500/5 border-emerald-500/20' : (darkMode ? 'bg-white/5 border-white/5' : 'bg-white shadow-sm')}`}>
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`p-1.5 rounded-lg shrink-0 ${isLibre ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>{isLibre ? <CheckCircle2 size={14}/> : <User size={14}/>}</div>
                                                        <div className="min-w-0">
                                                            <p className={`text-xs font-black truncate ${isLibre ? 'text-emerald-500' : (PROBLEM_STATUSES.includes(profile.client) ? 'text-rose-400' : theme.text)}`}>{isLibre ? 'DISPONIBLE' : profile.client}</p>
                                                            <p className={`text-[10px] font-bold font-mono uppercase truncate ${darkMode ? 'text-slate-300' : 'text-slate-500'}`}>
                                                                {profile.profile} {profile.pin && `| PIN: ${profile.pin}`}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button onClick={() => { setFormData(profile); setView('form'); }} className="px-2 py-1.5 rounded-lg bg-indigo-500 text-white text-[10px] font-bold hover:bg-indigo-600">Asignar</button>
                                                        {profile.type !== 'Cuenta' && (
                                                            <button onClick={() => setEditingProfile({ id: profile.id, profile: profile.profile || '', pin: profile.pin || '' })} title="Editar nombre y PIN" className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500 hover:text-white transition-colors"><Edit2 size={12}/></button>
                                                        )}
                                                        <button onClick={() => handleDeleteProfile(profile.id)} title="Eliminar" className="p-1.5 rounded-lg bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"><Trash2 size={12}/></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        
                                        {!acc.isMasterAccount && (() => {
                                            const capacity = getAccountCapacity(acc.service);
                                            if (capacity && acc.totalCount >= capacity) {
                                                return <div className={`px-2.5 py-2 rounded-xl border border-dashed flex items-center justify-center text-[10px] font-black uppercase ${darkMode ? 'border-white/10 text-slate-500' : 'border-slate-200 text-slate-400'}`}>Cuenta llena · {acc.totalCount}/{capacity}</div>;
                                            }
                                            return (
                                            <button onClick={() => openAddSlot(acc)} className="px-2.5 py-2 rounded-xl border border-dashed border-indigo-500/40 text-indigo-500 flex items-center justify-center gap-2 text-xs font-bold hover:bg-indigo-500/5 transition-all"><PlusCircle size={14}/> Añadir Slot{capacity ? ` (${acc.totalCount}/${capacity})` : ''}</button>
                                            );
                                        })()}
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

            {/* 📄 CONTROLES DE PAGINACIÓN */}
            {filteredAccounts.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                    <div className={`flex items-center gap-2 text-xs font-bold ${theme.sub}`}>
                        <span>{pageStart + 1}–{Math.min(pageStart + pageSize, filteredAccounts.length)} de {filteredAccounts.length}</span>
                        <select className={`px-2 py-1.5 rounded-lg border outline-none text-xs font-bold ${theme.input}`} value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
                            {[10, 20, 50, 100].map(n => <option key={n} value={n}>{n} / pág</option>)}
                        </select>
                    </div>
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)} className={`p-2 rounded-lg border disabled:opacity-30 ${theme.card}`}><ChevronLeft size={14} className={theme.text}/></button>
                            {pageNumbers.map(n => typeof n === 'string' ? (
                                <span key={n} className={`px-1 text-xs ${theme.sub}`}>…</span>
                            ) : (
                                <button key={n} onClick={() => goToPage(n)} className={`min-w-[32px] py-1.5 rounded-lg text-xs font-black border transition-all ${n === currentPage ? 'bg-indigo-600 border-indigo-600 text-white' : `${theme.card} ${theme.text} hover:border-indigo-500/50`}`}>{n}</button>
                            ))}
                            <button disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)} className={`p-2 rounded-lg border disabled:opacity-30 ${theme.card}`}><ChevronRight size={14} className={theme.text}/></button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default InventoryMaster;