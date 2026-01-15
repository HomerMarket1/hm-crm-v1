import React, { useState, useMemo } from 'react';
import { 
    Search, ChevronDown, ChevronUp, User, CheckCircle2, 
    Copy, Key, PlusCircle, Save, Trash2, Eye, EyeOff, 
    Hash, X, LayoutGrid 
} from 'lucide-react';
import { 
    addDoc, collection, doc, deleteDoc, writeBatch, 
    query, where, getDocs, serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

const InventoryMaster = ({ sales, catalog, darkMode, setFormData, setView, user, setNotification }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedService, setSelectedService] = useState('Todos');
    const [selectedStatus, setSelectedStatus] = useState('Todos'); 
    const [hideProblems, setHideProblems] = useState(false); 
    const [expandedAccounts, setExpandedAccounts] = useState({});
    const [editingPass, setEditingPass] = useState({ email: null, value: '' });

    const [showNewAccountForm, setShowNewAccountForm] = useState(false);
    const [newAccData, setNewAccData] = useState({ 
        email: '', 
        pass: '', 
        service: '', 
        slots: 5,
        cost: 0 
    });

    const PROBLEM_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED'];

    const getBaseName = (name) => {
        if (!name) return 'Sin Servicio';
        return name.replace(/\s(Paquete|Perfil|Perfiles|Cuenta|Renovación|Pantalla|Dispositivo).*$/gi, '').trim();
    };

    const groupedAccounts = useMemo(() => {
        const groups = {};
        sales.forEach(sale => {
            const email = sale.email || 'Sin Email';
            const baseService = getBaseName(sale.service);
            if (!groups[email]) {
                groups[email] = { 
                    email, pass: sale.pass, service: baseService, profiles: [], 
                    freeCount: 0, totalCount: 0, status: 'Sano' 
                };
            }
            groups[email].profiles.push(sale);
            groups[email].totalCount++;
            if (PROBLEM_STATUSES.includes(sale.client)) groups[email].status = sale.client;
            if (sale.client === 'LIBRE' || sale.client === 'Espacio Libre') groups[email].freeCount++;
        });
        return Object.values(groups).sort((a, b) => a.email.localeCompare(b.email));
    }, [sales]);

    const filteredAccounts = useMemo(() => {
        return groupedAccounts.filter(acc => {
            const matchesSearch = acc.email.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesService = selectedService === 'Todos' || acc.service === selectedService;
            const matchesStatus = selectedStatus === 'Todos' || acc.status === selectedStatus;
            const isHiddenByEye = hideProblems && PROBLEM_STATUSES.includes(acc.status);
            return matchesSearch && matchesService && matchesStatus && !isHiddenByEye;
        });
    }, [groupedAccounts, searchTerm, selectedService, selectedStatus, hideProblems]);

    const handleSaveNewMasterAccount = async (e) => {
        e.preventDefault();
        if (!user || !newAccData.email || !newAccData.service) return;
        try {
            const batch = writeBatch(db);
            const salesRef = collection(db, `users/${user.uid}/sales`);
            for (let i = 1; i <= parseInt(newAccData.slots); i++) {
                const newDocRef = doc(salesRef);
                batch.set(newDocRef, {
                    client: 'LIBRE',
                    service: newAccData.service,
                    email: newAccData.email,
                    pass: newAccData.pass,
                    cost: parseFloat(newAccData.cost) / parseInt(newAccData.slots),
                    type: 'Perfil',
                    profile: `Perfil ${i}`,
                    pin: '',
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
            await batch.commit();
            setNotification({ show: true, message: 'Inventario creado', type: 'success' });
            setShowNewAccountForm(false);
            setNewAccData({ email: '', pass: '', service: '', slots: 5, cost: 0 });
        } catch (err) {
            setNotification({ show: true, message: 'Error al procesar', type: 'error' });
        }
    };

    const handleDeleteProfile = async (id) => {
        if (!window.confirm("¿Eliminar este perfil?")) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/sales`, id));
            setNotification({ show: true, message: 'Perfil eliminado', type: 'success' });
        } catch (err) { setNotification({ show: true, message: 'Error', type: 'error' }); }
    };

    const handleUpdateGlobalPass = async (acc) => {
        if (!editingPass.value) return;
        try {
            const batch = writeBatch(db);
            const q = query(collection(db, `users/${user.uid}/sales`), where("email", "==", acc.email));
            const snap = await getDocs(q);
            snap.forEach(d => { batch.update(d.ref, { pass: editingPass.value, updatedAt: serverTimestamp() }); });
            await batch.commit();
            setEditingPass({ email: null, value: '' });
            setNotification({ show: true, message: 'Clave actualizada', type: 'success' });
        } catch (err) { setNotification({ show: true, message: 'Error', type: 'error' }); }
    };

    // --- CONFIGURACIÓN DE COLORES TIPO NEÓN ---
    const theme = {
        card: darkMode ? 'bg-[#161B28] border-white/5' : 'bg-white border-slate-200 shadow-sm',
        text: darkMode ? 'text-white' : 'text-slate-900',
        sub: darkMode ? 'text-slate-300/60' : 'text-slate-500',
        // Estilos para los Inputs del Modal
        input: darkMode 
            ? 'bg-[#0B0F19] border-[#1E293B] text-white focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.1)]' 
            : 'bg-slate-100 border-slate-200 text-slate-900',
        modal: darkMode ? 'bg-[#0B0F19] border-white/10 shadow-2xl' : 'bg-white border-slate-200 shadow-2xl',
        label: darkMode ? 'text-slate-400 font-black uppercase text-[10px]' : 'text-slate-500 font-black uppercase text-[10px]'
    };

    return (
        <div className="w-full max-w-5xl mx-auto pb-32 animate-in fade-in space-y-4">
            
            {/* MODAL: FORMULARIO NUEVO INGRESO DE STOCK */}
            {showNewAccountForm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
                    <div className={`w-full max-w-md p-8 rounded-[2.5rem] border animate-in zoom-in-95 duration-200 ${theme.modal}`}>
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className={`text-2xl font-black ${theme.text}`}>Ingreso de Stock</h3>
                                <p className={theme.sub}>Cargar nueva cuenta madre</p>
                            </div>
                            <button onClick={() => setShowNewAccountForm(false)} className="p-2 rounded-full hover:bg-rose-500/10 text-rose-500 transition-colors">
                                <X size={24}/>
                            </button>
                        </div>
                        
                        <form onSubmit={handleSaveNewMasterAccount} className="space-y-5">
                            <div className="grid grid-cols-2 gap-5">
                                <div className="col-span-2">
                                    <label className={`${theme.label} ml-2`}>Servicio</label>
                                    <input list="catalog-list" required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.service} onChange={e => setNewAccData({...newAccData, service: e.target.value})} placeholder="Netflix, Disney, etc"/>
                                    <datalist id="catalog-list">{catalog.map(s => <option key={s.id} value={s.name}/>)}</datalist>
                                </div>
                                
                                <div className="col-span-2">
                                    <label className={`${theme.label} ml-2`}>Correo de la cuenta</label>
                                    <input type="email" required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.email} onChange={e => setNewAccData({...newAccData, email: e.target.value})} placeholder="email@cuenta.com"/>
                                </div>
                                
                                <div className="col-span-2">
                                    <label className={`${theme.label} ml-2`}>Contraseña</label>
                                    <input type="text" required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.pass} onChange={e => setNewAccData({...newAccData, pass: e.target.value})} placeholder="Clave de acceso"/>
                                </div>
                                
                                <div>
                                    <label className={`${theme.label} ml-2`}>Perfiles</label>
                                    <input type="number" required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.slots} onChange={e => setNewAccData({...newAccData, slots: e.target.value})}/>
                                </div>
                                
                                <div>
                                    <label className={`${theme.label} ml-2`}>Costo Total</label>
                                    <input type="number" step="0.01" required className={`w-full mt-1 p-4 rounded-2xl outline-none border transition-all ${theme.input}`} value={newAccData.cost} onChange={e => setNewAccData({...newAccData, cost: e.target.value})}/>
                                </div>
                            </div>

                            <button type="submit" className="w-full mt-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_25px_rgba(79,70,229,0.5)] active:scale-95 transition-all uppercase tracking-widest text-sm">
                                Registrar en Bóveda
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* HEADER */}
            <header className="px-2 pt-4 flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className={`text-2xl font-black ${theme.text}`}>Bóveda Digital 📦</h2>
                    <p className={theme.sub}>Inventario maestro de cuentas madre.</p>
                </div>
                
                <div className="flex items-center gap-2 w-full md:w-auto">
                    <button 
                        onClick={() => setShowNewAccountForm(true)} 
                        className="flex-1 md:flex-none flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs shadow-lg hover:scale-105 transition-all uppercase"
                    >
                        <PlusCircle size={18}/> Nuevo Ingreso
                    </button>
                    <div className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-black text-sm border ${theme.card}`}>
                        <Hash size={16} className="text-indigo-500"/><span className={theme.text}>{filteredAccounts.length}</span>
                    </div>
                    <button onClick={() => setHideProblems(!hideProblems)} className={`p-3 rounded-2xl border transition-all ${hideProblems ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 border-rose-600' : (darkMode ? 'bg-white/5 border-white/10 text-slate-400' : 'bg-white text-slate-600')}`}>
                        {hideProblems ? <EyeOff size={20}/> : <Eye size={20}/>}
                    </button>
                </div>
            </header>

            {/* BARRA DE FILTROS */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-2 px-2">
                <div className="relative md:col-span-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input type="text" placeholder="Buscar cuenta por correo..." className={`w-full pl-12 pr-4 py-3 rounded-2xl border outline-none font-medium ${theme.input}`} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                </div>
                <select className={`md:col-span-3 px-4 py-3 rounded-2xl border outline-none font-bold text-xs ${theme.input}`} value={selectedService} onChange={(e) => setSelectedService(e.target.value)}>
                    <option value="Todos">Todos los Servicios</option>
                    {[...new Set(catalog.map(s => getBaseName(s.name)))].map(name => <option key={name} value={name}>{name}</option>)}
                </select>
                <select className={`md:col-span-3 px-4 py-3 rounded-2xl border outline-none font-bold text-xs ${theme.input}`} value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                    <option value="Todos">Cualquier Estado</option>
                    {PROBLEM_STATUSES.map(status => <option key={status} value={status}>{status}</option>)}
                </select>
            </div>

            {/* LISTADO DE CUENTAS */}
            <div className="space-y-3 px-2">
                {filteredAccounts.map((acc) => {
                    const isProblem = PROBLEM_STATUSES.includes(acc.status);
                    const isExpanded = expandedAccounts[acc.email];

                    return (
                        <div key={acc.email} className={`rounded-[2rem] border transition-all duration-300 ${theme.card} ${isProblem ? 'border-rose-500/30' : ''}`}>
                            <div 
                                onClick={() => setExpandedAccounts(p => ({...p, [acc.email]: !p[acc.email]}))} 
                                className="p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black shrink-0 text-lg ${isProblem ? 'bg-rose-500/20 text-rose-500' : 'bg-indigo-500/20 text-indigo-500'}`}>
                                        {acc.service.charAt(0)}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className={`font-bold text-sm md:text-base truncate ${theme.text}`}>{acc.email}</h4>
                                            {isProblem && <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-rose-500 text-white">{acc.status}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <p className={`text-[10px] font-black uppercase tracking-widest ${theme.sub}`}>{acc.service}</p>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                    <div className="text-right hidden sm:block">
                                        <div className={`text-xs font-black ${acc.freeCount > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{acc.freeCount} DISPONIBLES</div>
                                        <div className={`text-[9px] font-bold uppercase ${theme.sub}`}>{acc.totalCount} PERFILES TOTALES</div>
                                    </div>
                                    {isExpanded ? <ChevronUp size={20} className={theme.sub}/> : <ChevronDown size={20} className={theme.sub}/>}
                                </div>
                            </div>

                            {isExpanded && (
                                <div className={`p-6 space-y-5 border-t animate-in slide-in-from-top-2 duration-300 ${darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50'}`}>
                                    <div className="flex flex-col md:flex-row gap-4 items-end bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <div className="flex-1 w-full">
                                            <label className="text-[9px] font-black uppercase ml-1 opacity-40">Cambiar Clave de la Cuenta</label>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Key className="text-slate-400" size={16}/>
                                                <input 
                                                    type="text" 
                                                    className={`flex-1 p-2.5 rounded-xl text-xs font-mono border outline-none ${theme.input}`} 
                                                    value={editingPass.email === acc.email ? editingPass.value : acc.pass} 
                                                    onChange={(e) => setEditingPass({ email: acc.email, value: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex gap-2">
                                            {editingPass.email === acc.email && editingPass.value !== acc.pass && (
                                                <button onClick={() => handleUpdateGlobalPass(acc)} className="p-3 bg-emerald-500 text-white rounded-xl shadow-lg hover:scale-105 transition-all"><Save size={18}/></button>
                                            )}
                                            <button 
                                                onClick={() => {navigator.clipboard.writeText(`${acc.email}:${acc.pass}`); setNotification({show:true, message:'Acceso Copiado'});}} 
                                                className="p-3 bg-indigo-500 text-white rounded-xl shadow-lg hover:scale-105 transition-all"
                                                title="Copiar Correo:Clave"
                                            >
                                                <Copy size={18}/>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {acc.profiles.map((profile) => {
                                            const isLibre = profile.client === 'LIBRE' || profile.client === 'Espacio Libre';
                                            return (
                                                <div key={profile.id} className={`p-4 rounded-[1.5rem] border flex items-center justify-between group transition-all ${isLibre ? 'bg-emerald-500/5 border-emerald-500/20' : (darkMode ? 'bg-white/5 border-white/5' : 'bg-white border-slate-200 shadow-sm')}`}>
                                                    <div className="flex items-center gap-3 truncate">
                                                        <div className={`p-2 rounded-xl ${isLibre ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                                                            {isLibre ? <CheckCircle2 size={16}/> : <User size={16}/>}
                                                        </div>
                                                        <div className="truncate">
                                                            <p className={`text-xs font-black truncate ${isLibre ? 'text-emerald-500' : (PROBLEM_STATUSES.includes(profile.client) ? 'text-rose-400' : theme.text)}`}>
                                                                {isLibre ? 'DISPONIBLE' : profile.client}
                                                            </p>
                                                            <p className={`text-[9px] font-bold font-mono opacity-50 uppercase`}>{profile.profile} {profile.pin && `| PIN: ${profile.pin}`}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                                                        <button 
                                                            onClick={() => { setFormData(profile); setView('form'); }} 
                                                            className="p-2 rounded-xl bg-indigo-500 text-white text-[10px] font-bold shadow-md hover:bg-indigo-600"
                                                        >
                                                            Asignar
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteProfile(profile.id)} 
                                                            className="p-2 rounded-xl bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors"
                                                        >
                                                            <Trash2 size={14}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <button 
                                            onClick={() => {
                                                setNewAccData({ email: acc.email, pass: acc.pass, service: acc.service, slots: 1, cost: 0 });
                                                setShowNewAccountForm(true);
                                            }}
                                            className="p-4 rounded-[1.5rem] border border-dashed border-indigo-500/40 text-indigo-500 flex items-center justify-center gap-2 text-xs font-bold hover:bg-indigo-500/5 transition-all"
                                        >
                                            <PlusCircle size={16}/> Añadir Slot Extra
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default InventoryMaster;