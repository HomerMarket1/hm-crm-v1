import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Smartphone, MessageCircle, Lock, Key, Trash2, Edit2, Ban, XCircle, Settings, 
  Save, Calendar, Layers, UserPlus, Box, CheckCircle, Users, Filter, DollarSign, RotateCcw, X, 
  ListPlus, User, History, CalendarPlus, Cloud, Loader, ChevronRight, Play, AlertTriangle, 
  Globe, RefreshCw, Shield, Skull, LogOut, LogIn
} from 'lucide-react';

// --- FIREBASE IMPORTS ---
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch
} from 'firebase/firestore';

// ============================================================================
// ✅ CREDENCIALES CONECTADAS
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBw3xZAm7MIBg5_0wofo9ZLOKdaFqfrtKo",
  authDomain: "hm-digital-b573e.firebaseapp.com",
  projectId: "hm-digital-b573e",
  storageBucket: "hm-digital-b573e.firebasestorage.app",
  messagingSenderId: "913709788584",
  appId: "1:913709788584:web:6814c401e1d495086d019d",
  measurementId: "G-MYN2RPJXF0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ESTADOS "PROBLEMA" ---
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED'];

const App = () => {
  // Estado de Usuario
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  // Datos
  const [sales, setSales] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clientsDirectory, setClientsDirectory] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // UI & Filtros
  const [view, setView] = useState('dashboard'); 
  const [filterClient, setFilterClient] = useState('');
  const [filterService, setFilterService] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos'); 
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null, type: null, title: '', msg: '' }); 

  // Forms
  const [bulkProfiles, setBulkProfiles] = useState([{ profile: '', pin: '' }]);
  const [formData, setFormData] = useState({
    id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1
  });
  const [stockForm, setStockForm] = useState({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
  const [catalogForm, setCatalogForm] = useState({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });

  // --- 1. AUTENTICACIÓN ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async (e) => {
      e.preventDefault();
      setLoginError('');
      try {
          await signInWithEmailAndPassword(auth, loginEmail, loginPass);
      } catch (error) {
          console.error(error);
          setLoginError('Error: Verifica tu correo y contraseña.');
      }
  };

  const handleLogout = () => signOut(auth);

  // --- 2. CARGA DE DATOS ---
  useEffect(() => {
    if (!user) {
        setSales([]); setCatalog([]); setClientsDirectory([]);
        return;
    }
    setLoadingData(true);
    const userPath = `users/${user.uid}`; 

    const salesUnsub = onSnapshot(collection(db, userPath, 'sales'), (s) => {
        setSales(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
        setLoadingData(false);
    });
    const catalogUnsub = onSnapshot(collection(db, userPath, 'catalog'), (s) => {
        setCatalog(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const clientsUnsub = onSnapshot(collection(db, userPath, 'clients'), (s) => {
        setClientsDirectory(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    return () => { salesUnsub(); catalogUnsub(); clientsUnsub(); };
  }, [user]);

  // --- 3. LÓGICA DE NEGOCIO ---
  
  const getFreeSlotsForAccount = (email, service) => {
    if (!sales) return 0;
    return sales.filter(s => s.email === email && s.service === service && s.client === 'LIBRE').length;
  };

  const allClients = useMemo(() => {
      const fromDir = clientsDirectory.map(c => ({ name: c.name, phone: c.phone }));
      const fromSales = sales
          .filter(s => s.client && s.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(s.client))
          .map(s => ({ name: s.client, phone: s.phone }));
      
      const combined = [...fromDir, ...fromSales];
      const unique = [];
      const map = new Map();
      for (const item of combined) {
          if (!item.name) continue;
          const key = item.name.toLowerCase().trim();
          if(!map.has(key)) { map.set(key, true); unique.push(item); }
      }
      return unique.sort((a, b) => a.name.localeCompare(b.name));
  }, [sales, clientsDirectory]);

  const getDaysRemaining = (endDateStr) => {
    if (!endDateStr || typeof endDateStr !== 'string') return null;
    try {
        const [year, month, day] = endDateStr.split('-').map(Number);
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const end = new Date(year, month - 1, day); 
        return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    } catch (e) { return null; }
  };

  const getClientPreviousProfiles = useMemo(() => {
      if (!formData.client || formData.client === 'LIBRE') return [];
      const clientName = formData.client.toLowerCase();
      const history = sales.filter(s => s.client && s.client.toLowerCase() === clientName && s.profile).map(s => ({ profile: s.profile, pin: s.pin }));
      const unique = [];
      const map = new Map();
      for (const item of history) { if(!map.has(item.profile)) { map.set(item.profile, true); unique.push(item); } }
      return unique;
  }, [sales, formData.client]);

  const maxAvailableSlots = useMemo(() => {
      if (formData.client !== 'LIBRE' && formData.id) return 1;
      return sales.filter(s => s.email === formData.email && s.service === formData.service && s.client === 'LIBRE').length;
  }, [sales, formData.email, formData.service, formData.client, formData.id]);

  useEffect(() => {
    if (formData.client === 'LIBRE' || !formData.id) {
        const count = parseInt(formData.profilesToBuy || 1);
        setBulkProfiles(prev => {
            const newArr = [...prev];
            if (newArr.length < count) while(newArr.length < count) newArr.push({ profile: '', pin: '' });
            else if (newArr.length > count) return newArr.slice(0, count);
            return newArr;
        });
    }
  }, [formData.profilesToBuy, formData.client, formData.id]);

  // --- ACTIONS ---
  const userPath = user ? `users/${user.uid}` : '';

  const handleAddServiceToCatalog = async (e) => {
      e.preventDefault(); if (!user || !catalogForm.name) return;
      await addDoc(collection(db, userPath, 'catalog'), { 
          name: catalogForm.name, 
          cost: Number(catalogForm.cost), 
          type: catalogForm.type, 
          defaultSlots: Number(catalogForm.defaultSlots) 
      });
      setCatalogForm({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
  };

  // Modales
  const triggerDeleteService = (id) => {
      setConfirmModal({ show: true, id: id, type: 'delete_service', title: '¿Eliminar Servicio?', msg: 'Esta categoría desaparecerá del catálogo.' });
  };

  const triggerLiberate = (id) => {
      setConfirmModal({ show: true, id: id, type: 'liberate', title: '¿Liberar Perfil?', msg: 'Los datos del cliente se borrarán y el cupo volverá a estar libre.' });
  };

  const handleConfirmAction = async () => {
      if (!user || !confirmModal.id) return;
      
      try {
          if (confirmModal.type === 'delete_service') {
              await deleteDoc(doc(db, userPath, 'catalog', confirmModal.id));
          } 
          else if (confirmModal.type === 'liberate') {
              await updateDoc(doc(db, userPath, 'sales', confirmModal.id), { client: 'LIBRE', phone: '', endDate: '', profile: '', pin: '' });
          }
      } catch (error) {
          console.error("Error en acción:", error);
      }
      setConfirmModal({ show: false, id: null, type: null, title: '', msg: '' });
  };

  const handleSaveSale = async (e) => {
    e.preventDefault(); if (!user) return;
    
    if (formData.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(formData.client) && formData.client !== 'Admin') {
        const exists = clientsDirectory.some(c => c.name.toLowerCase() === formData.client.toLowerCase());
        if (!exists) await addDoc(collection(db, userPath, 'clients'), { name: formData.client, phone: formData.phone });
    }

    if (formData.client !== 'LIBRE' && formData.id && (!formData.profilesToBuy || formData.profilesToBuy === 1)) {
        const pName = bulkProfiles[0]?.profile !== '' ? bulkProfiles[0].profile : formData.profile;
        const pPin = bulkProfiles[0]?.pin !== '' ? bulkProfiles[0].pin : formData.pin;
        await updateDoc(doc(db, userPath, 'sales', formData.id), { ...formData, profile: pName, pin: pPin });
        setView('dashboard'); resetForm(); return;
    }

    const quantity = parseInt(formData.profilesToBuy || 1);
    let freeRows = [];
    if (formData.email) freeRows = sales.filter(s => s.email === formData.email && s.service === formData.service && s.client === 'LIBRE');
    else freeRows = sales.filter(s => s.service === formData.service && s.client === 'LIBRE');

    if (quantity > freeRows.length) { alert(`Error: Solo quedan ${freeRows.length} perfiles libres.`); return; }

    const batch = writeBatch(db);
    freeRows.slice(0, quantity).forEach((row, index) => {
        const specificProfileData = bulkProfiles[index];
        const docRef = doc(db, userPath, 'sales', row.id);
        batch.update(docRef, {
            client: formData.client, phone: formData.phone, endDate: formData.endDate, cost: formData.cost,
            profile: specificProfileData ? specificProfileData.profile : '', pin: specificProfileData ? specificProfileData.pin : '', type: formData.type
        });
    });
    await batch.commit();
    setView('dashboard'); resetForm();
  };

  const handleGenerateStock = async (e) => {
    e.preventDefault(); if (!user) return;
    const batch = writeBatch(db);
    for (let i = 0; i < stockForm.slots; i++) {
        const newDocRef = doc(collection(db, userPath, 'sales'));
        batch.set(newDocRef, {
            client: 'LIBRE', phone: '', service: stockForm.service, endDate: '', email: stockForm.email,
            pass: stockForm.pass, profile: '', pin: '', cost: stockForm.cost, type: stockForm.type, createdAt: Date.now() + i
        });
    }
    await batch.commit();
    setView('dashboard'); setStockForm({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
  };

  const handleQuickRenew = async (id) => {
      const sale = sales.find(s => s.id === id);
      if (sale && sale.endDate) {
          const [year, month, day] = sale.endDate.split('-').map(Number);
          const date = new Date(year, month - 1, day); date.setMonth(date.getMonth() + 1);
          const newEndDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
          await updateDoc(doc(db, userPath, 'sales', id), { endDate: newEndDate });
      }
  };

  // --- UTILS & WHATSAPP ---
  const handleClientNameChange = (e) => {
    const nameInput = e.target.value; let newPhone = formData.phone;
    const existingClient = allClients.find(c => c.name.toLowerCase() === nameInput.toLowerCase());
    if (existingClient) newPhone = existingClient.phone; 
    setFormData({ ...formData, client: nameInput, phone: newPhone });
  };
  const handleBulkProfileChange = (index, field, value) => {
      const newArr = [...bulkProfiles]; newArr[index][field] = value;
      if (field === 'profile') { const matched = getClientPreviousProfiles.find(p => p.profile === value); if (matched && matched.pin) newArr[index].pin = matched.pin; }
      setBulkProfiles(newArr);
  };
  const handleSingleProfileChange = (value) => {
      let newPin = formData.pin; const matched = getClientPreviousProfiles.find(p => p.profile === value);
      if (matched && matched.pin) newPin = matched.pin; 
      setFormData({ ...formData, profile: value, pin: newPin });
  };
  const handleStockServiceChange = (e) => {
    const found = catalog.find(s => s.name === e.target.value);
    if (found) setStockForm({...stockForm, service: found.name, cost: found.cost, type: found.type, slots: found.defaultSlots || 1});
    else setStockForm({...stockForm, service: e.target.value});
  };
  const resetForm = () => { setFormData({ id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1 }); setBulkProfiles([{ profile: '', pin: '' }]); };

  const getGroupedServicesMessage = (clientName, targetDaysCondition) => {
      const relevantSales = sales.filter(s => { if (s.client !== clientName) return false; const days = getDaysRemaining(s.endDate); return targetDaysCondition(days); });
      if (relevantSales.length === 0) return '';
      const serviceCounts = {};
      relevantSales.forEach(s => { let cleanName = s.service.replace(/\s1\sPerfil$/i, '').trim(); if (!serviceCounts[cleanName]) serviceCounts[cleanName] = 0; serviceCounts[cleanName]++; });
      const textParts = Object.keys(serviceCounts).map(name => { const count = serviceCounts[name]; const plural = count > 1 ? 'perfiles' : 'perfil'; return `${name.toUpperCase()} ${count} ${plural.toUpperCase()}`; });
      if (textParts.length === 1) return textParts[0];
      const last = textParts.pop();
      return `${textParts.join(', ')} y ${last}`;
  };
  const sendWhatsApp = (sale, actionType) => {
    const dateText = sale.endDate ? sale.endDate.split('-').reverse().join('/') : ''; const serviceUpper = sale.service.toUpperCase();
    let message = '';
    if (actionType === 'warning_tomorrow') {
        const servicesList = getGroupedServicesMessage(sale.client, (d) => d === 1) || `${serviceUpper} 1 PERFIL`;
        message = `⚠️ Buen Día ${sale.client} ⚠️\nMañana vence su servicio de *${servicesList}*.\n¿Renuevas un mes más? Confirma cuando puedas.\n¡Gracias!`;
    } else if (actionType === 'expired_today') {
        const servicesList = getGroupedServicesMessage(sale.client, (d) => d <= 0) || `${serviceUpper} 1 PERFIL`;
        message = `⚠️ Buen Día ${sale.client} ⚠️\nSu servicio de *${servicesList}* ha vencido *HOY*.\nPor favor confirma para renovar. ¡Gracias!`;
    } else if (actionType === 'account_details') {
        message = `*${serviceUpper}*\n\n*CORREO*:\n${sale.email}\n*CONTRASEÑA*:\n${sale.pass}\n\n☑️ Su Cuenta Vence el día ${dateText} ☑️`;
    } else if (actionType === 'profile_details') {
        message = `*${serviceUpper}*\n\nCORREO:\n${sale.email}\nCONTRASEÑA:\n${sale.pass}\nPERFIL:\n${sale.profile}\nPIN:\n${sale.pin}\n\n☑️ Su Perfil Vence el día ${dateText} ☑️`;
    }
    window.open(`https://wa.me/${sale.phone}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // --- FILTER & TOTALS ---
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const isFree = s.client === 'LIBRE';
      const isProblem = NON_BILLABLE_STATUSES.includes(s.client);
      const matchClient = filterClient === '' || s.client.toLowerCase().includes(filterClient.toLowerCase());
      const matchService = filterService === 'Todos' || s.service === filterService;
      let matchStatus = true;
      if (filterStatus === 'Libres') matchStatus = isFree;
      if (filterStatus === 'Ocupados') matchStatus = !isFree && !isProblem;
      if (filterStatus === 'Problemas') matchStatus = isProblem;
      let matchDate = true;
      if (isFree || isProblem) { if (dateFrom || dateTo) matchDate = false; } 
      else { if (dateFrom && dateTo) matchDate = s.endDate >= dateFrom && s.endDate <= dateTo; else if (dateFrom) matchDate = s.endDate === dateFrom; }
      return matchClient && matchService && matchStatus && matchDate;
    });
  }, [sales, filterClient, filterService, filterStatus, dateFrom, dateTo]);

  const totalFilteredMoney = filteredSales.reduce((acc, curr) => {
      const isExcluded = curr.client === 'LIBRE' || NON_BILLABLE_STATUSES.includes(curr.client) || curr.client === 'Admin';
      return !isExcluded ? acc + (Number(curr.cost) || 0) : acc;
  }, 0);
  const totalItems = filteredSales.length;

  const getStatusIcon = (clientName) => {
      if (clientName === 'LIBRE') return <CheckCircle size={20}/>;
      if (clientName === 'Caída') return <AlertTriangle size={20}/>;
      if (clientName === 'Actualizar') return <RefreshCw size={20}/>;
      if (clientName === 'Dominio') return <Globe size={20}/>;
      if (clientName === 'Admin') return <Shield size={20}/>;
      if (clientName === 'EXPIRED') return <Skull size={20}/>;
      return clientName.charAt(0);
  };
  const getStatusColor = (clientName) => {
      if (clientName === 'LIBRE') return 'bg-emerald-100 text-emerald-600';
      if (clientName === 'Caída') return 'bg-red-100 text-red-600';
      if (clientName === 'Actualizar') return 'bg-blue-100 text-blue-600';
      if (clientName === 'Dominio') return 'bg-violet-100 text-violet-600';
      if (clientName === 'Admin') return 'bg-slate-800 text-white';
      if (clientName === 'EXPIRED') return 'bg-slate-200 text-slate-500';
      return 'bg-[#007AFF] text-white'; 
  };

  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F2F2F7]"><Loader className="animate-spin text-blue-500"/></div>;

  if (!user) {
      return (
          <div className="flex h-screen items-center justify-center bg-[#F2F2F7] p-4">
              <div className="bg-white p-8 rounded-[2rem] shadow-xl w-full max-w-sm text-center">
                  <div className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-500/20 bg-white p-2">
                      <img src="logo1.png" alt="HM" className="w-full h-full object-contain rounded-xl"/>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 mb-2">Bienvenido</h2>
                  <p className="text-slate-500 mb-8 text-sm">Sistema de Gestión HM Digital</p>
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input type="email" placeholder="Correo" className="w-full p-4 bg-[#F2F2F7] rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required/>
                      <input type="password" placeholder="Contraseña" className="w-full p-4 bg-[#F2F2F7] rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium" value={loginPass} onChange={e=>setLoginPass(e.target.value)} required/>
                      {loginError && <p className="text-red-500 text-xs font-bold">{loginError}</p>}
                      <button type="submit" className="w-full py-4 bg-[#007AFF] text-white rounded-xl font-bold shadow-lg hover:opacity-90 transition-opacity">Entrar</button>
                  </form>
              </div>
          </div>
      );
  }

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#F2F2F7] font-sans text-slate-900 overflow-hidden relative selection:bg-blue-100 selection:text-blue-900">
      
      {confirmModal.show && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl max-w-sm w-full border border-white/50 text-center transform scale-100">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 mx-auto shadow-inner ${confirmModal.type === 'delete_service' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                      {confirmModal.type === 'delete_service' ? <Trash2 size={32}/> : <RotateCcw size={32}/>}
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2 tracking-tight">{confirmModal.title}</h3>
                  <p className="text-slate-500 mb-8 text-base font-medium leading-relaxed">{confirmModal.msg}</p>
                  <div className="flex flex-col gap-3">
                      <button onClick={handleConfirmAction} className={`w-full py-4 text-white rounded-2xl font-bold shadow-lg hover:scale-[1.02] active:scale-95 transition-all ${confirmModal.type === 'delete_service' ? 'bg-red-500 hover:bg-red-600 shadow-red-500/30' : 'bg-amber-500 hover:bg-amber-600 shadow-amber-500/30'}`}>Confirmar Acción</button>
                      <button onClick={() => setConfirmModal({show:false, id:null, type:null})} className="w-full py-4 bg-white text-slate-500 rounded-2xl font-bold hover:bg-slate-50 active:scale-95 transition-all border border-slate-200">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      <datalist id="suggested-profiles">{getClientPreviousProfiles.map((p, i) => <option key={i} value={p.profile}>PIN: {p.pin}</option>)}</datalist>
      <datalist id="clients-suggestions">{allClients.map((c, i) => <option key={i} value={c.name} />)}</datalist>

      {/* SIDEBAR */}
      <div className="hidden md:flex w-72 bg-white/80 backdrop-blur-2xl border-r border-white/50 flex-col shadow-xl z-20 relative">
        <div className="p-8 flex flex-col items-center justify-center border-b border-slate-100/50">
          <div className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-4 bg-white overflow-hidden p-2 group cursor-pointer hover:scale-105 transition-transform">
             {/* LOGO */}
             <img src="logo1.png" alt="Logo" className="w-full h-full object-contain rounded-xl"/>
          </div>
          <h1 className="font-bold text-lg text-slate-800">HM Digital</h1>
          <span className="text-xs text-slate-400 font-medium tracking-widest uppercase">Manager Pro</span>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-semibold text-sm ${view === 'dashboard' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30' : 'text-slate-500 hover:bg-white/60'}`}><Layers size={20}/> Tablero</button>
          <button onClick={() => setView('add_stock')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-semibold text-sm ${view === 'add_stock' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60'}`}><Box size={20}/> Stock</button>
          <button onClick={() => setView('config')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-semibold text-sm ${view === 'config' ? 'bg-white text-slate-900 shadow-md border border-slate-100' : 'text-slate-500 hover:bg-white/60'}`}><Settings size={20}/> Ajustes</button>
        </nav>
        <div className="p-6 border-t border-slate-100/50">
            <button onClick={handleLogout} className="w-full py-3 flex items-center justify-center gap-2 text-red-400 hover:text-red-600 font-bold text-xs uppercase tracking-wider transition-colors"><LogOut size={16}/> Salir</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full overflow-hidden relative">
        <header className="h-16 md:h-20 flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-10 bg-white/50 backdrop-blur-md md:bg-transparent">
          <div><h2 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">{view === 'dashboard' ? 'Ventas' : view === 'add_stock' ? 'Inventario' : view === 'form' ? 'Cliente' : 'Ajustes'}</h2></div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur text-slate-500 rounded-full text-xs font-bold border border-white/50 shadow-sm"><Calendar size={14}/> {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <button onClick={handleLogout} className="md:hidden p-2 text-slate-400"><LogOut size={20}/></button>
        </header>

        <main className="flex-1 overflow-y-auto p-3 md:p-8 pb-24 md:pb-8 scroll-smooth no-scrollbar">
          {view === 'dashboard' && (
            // ✅ FULL WIDTH CONTAINER
            <div className="space-y-4 md:space-y-6 w-full pb-20">
              <div className="bg-white/70 backdrop-blur-xl p-1.5 rounded-[1.5rem] shadow-sm border border-white sticky top-0 z-30">
                  <div className="flex flex-col gap-2">
                      <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input type="text" placeholder="Buscar..." className="w-full pl-11 pr-4 h-10 md:h-12 bg-slate-100/50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium" value={filterClient} onChange={e => setFilterClient(e.target.value)} />
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                          <select className="h-8 md:h-10 px-4 bg-slate-100/50 rounded-xl text-xs font-bold text-slate-600 outline-none border-none focus:bg-white cursor-pointer min-w-[120px]" value={filterService} onChange={e => setFilterService(e.target.value)}><option value="Todos">Todos</option>{catalog.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                          <div className="flex bg-slate-100/50 p-1 rounded-xl h-8 md:h-10 flex-shrink-0">
                              {['Todos', 'Libres', 'Ocupados', 'Problemas'].map(status => (
                                  <button key={status} onClick={() => setFilterStatus(status)} className={`px-3 md:px-4 rounded-lg text-[10px] md:text-xs font-bold transition-all ${filterStatus === status ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{status}</button>
                              ))}
                          </div>
                      </div>
                  </div>
              </div>

              <div className="flex justify-between items-center px-2">
                  <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{totalItems} Resultados</div>
                  <div className="flex items-center gap-2"><span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Total:</span><span className="text-base md:text-xl font-black text-slate-800 tracking-tight">${totalFilteredMoney.toLocaleString()}</span></div>
              </div>

              <div className="grid grid-cols-1 gap-2 md:gap-4">
                 <div className="hidden md:grid grid-cols-12 gap-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider pl-8">
                    <div className="col-span-3">Cliente</div>
                    <div className="col-span-4">Servicio & Detalles</div>
                    <div className="col-span-2 text-center">Vencimiento</div>
                    <div className="col-span-1 text-center">Costo</div>
                    <div className="col-span-2 text-right">Controles</div>
                 </div>

                 {filteredSales.map((sale) => {
                      const isFree = sale.client === 'LIBRE';
                      const isProblem = NON_BILLABLE_STATUSES.includes(sale.client);
                      const isAdmin = sale.client === 'Admin';
                      const days = getDaysRemaining(sale.endDate);
                      let cardClass = "bg-white/80 backdrop-blur-sm border border-white hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5";
                      if (isFree) cardClass = "bg-emerald-50/40 border border-emerald-100 border-dashed";
                      if (isProblem) cardClass = "bg-red-50/20 border border-red-100 hover:border-red-200";
                      if (isAdmin) cardClass = "bg-slate-900 border border-slate-700 text-white";

                      return (
                        <div key={sale.id} className={`p-3 md:p-4 rounded-2xl transition-all relative group ${cardClass}`}>
                          <div className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-center">
                              
                              <div className="col-span-12 md:col-span-3 w-full flex items-center gap-3">
                                  <div className={`w-10 h-10 md:w-12 md:h-12 rounded-xl md:rounded-2xl flex items-center justify-center text-lg md:text-xl font-bold shadow-sm flex-shrink-0 ${getStatusColor(sale.client)}`}>{getStatusIcon(sale.client)}</div>
                                  <div className="flex-1 overflow-hidden">
                                      <div className={`font-bold text-sm md:text-base truncate leading-tight ${isAdmin ? 'text-white' : 'text-slate-900'}`}>{isFree ? 'Cupo Disponible' : sale.client}</div>
                                      <div className={`text-[10px] md:text-xs font-medium mt-0.5 truncate ${isAdmin ? 'text-slate-400' : 'text-slate-500'}`}>{sale.service}</div>
                                      {!isFree && !isProblem && <div className="text-[10px] text-blue-500 font-bold mt-1 md:hidden flex items-center gap-1"><Smartphone size={10}/> {sale.phone}</div>}
                                  </div>
                                  <div className={`text-sm font-bold md:hidden ${isAdmin ? 'text-white' : 'text-slate-700'}`}>${(isFree || isProblem || isAdmin) ? 0 : sale.cost}</div>
                              </div>

                              <div className="col-span-12 md:col-span-4 w-full flex flex-col justify-center">
                                  {!isFree && !isProblem ? (
                                      <>
                                          <div className={`text-[10px] md:text-xs font-medium truncate ${isAdmin ? 'text-slate-300' : 'text-slate-600'}`} title={sale.email}>{sale.email}</div>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="bg-blue-50 text-blue-600 text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[100px]">{sale.profile || 'Gral'}</span>
                                            <span className="bg-slate-50 text-slate-500 text-[9px] md:text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200">{sale.pin || '****'}</span>
                                          </div>
                                      </>
                                  ) : isFree && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full w-fit hidden md:block">Disponible para venta</span>}
                              </div>

                              <div className="col-span-6 md:col-span-2 w-full text-left md:text-center flex items-center md:block gap-2">
                                  {!isFree && !isProblem ? (
                                      <>
                                          <div className={`text-xs md:text-sm font-bold ${days <= 3 ? 'text-amber-500' : (isAdmin ? 'text-white' : 'text-slate-800')}`}>{sale.endDate ? sale.endDate.split('-').reverse().slice(0,2).join('/') : '--'}</div>
                                          <div className="text-[10px] font-bold text-slate-400 uppercase md:mt-0.5">{days} Días Rest.</div>
                                      </>
                                  ) : <span className="text-slate-400 text-[10px] font-bold bg-slate-100 px-2 py-1 rounded-full">{isFree ? 'LIBRE' : 'N/A'}</span>}
                              </div>

                              <div className="hidden md:block col-span-1 text-center">
                                  <div className={`text-sm font-bold ${isAdmin ? 'text-white' : 'text-slate-700'}`}>${(isFree || isProblem || isAdmin) ? 0 : sale.cost}</div>
                              </div>

                              <div className="col-span-12 md:col-span-2 w-full flex justify-end gap-1 pt-2 md:pt-0 border-t border-black/5 md:border-none mt-1 md:mt-0">
                                  {isFree ? (
                                      <button onClick={() => { setFormData(sale); setView('form'); }} className="h-8 md:h-9 w-full md:w-auto px-4 bg-black text-white rounded-lg font-bold text-xs shadow-md flex items-center justify-center gap-2 active:scale-95">Asignar <ChevronRight size={12}/></button>
                                  ) : (
                                      // ✅ BOTONES CORREGIDOS: FONDO BLANCO + TEXTO OSCURO
                                      <div className={`flex items-center p-1 gap-1 rounded-lg w-full md:w-auto justify-between md:justify-end ${isAdmin ? 'bg-slate-800' : 'bg-white border border-slate-200 shadow-sm'}`}>
                                          <div className="flex gap-1">
                                              {!isProblem && days <= 3 && (<button onClick={() => sendWhatsApp(sale, days <= 0 ? 'expired_today' : 'warning_tomorrow')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center border shadow-sm transition-colors ${days <= 0 ? 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100' : 'bg-amber-50 text-amber-500 border-amber-100 hover:bg-amber-100'}`}>{days <= 0 ? <XCircle size={14}/> : <Ban size={14}/>}</button>)}
                                              {!isProblem && <button onClick={() => sendWhatsApp(sale, 'account_details')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-blue-600 bg-white border border-slate-100 hover:border-blue-200'}`}><Key size={14}/></button>}
                                              {!isProblem && sale.type === 'Perfil' && <button onClick={() => sendWhatsApp(sale, 'profile_details')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-blue-600 bg-white border border-slate-100 hover:border-blue-200'}`}><Lock size={14}/></button>}
                                          </div>
                                          <div className={`flex gap-1 pl-1 ${isAdmin ? 'border-l border-slate-600' : 'border-l border-slate-100'}`}>
                                              <button onClick={() => { setFormData({...sale, profilesToBuy: 1}); setBulkProfiles([{ profile: sale.profile, pin: sale.pin }]); setView('form'); }} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800 bg-white border border-slate-100 hover:border-slate-300'}`}><Edit2 size={14}/></button>
                                              {!isProblem && <button onClick={() => handleQuickRenew(sale.id)} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-emerald-500 hover:text-emerald-400' : 'text-emerald-500 hover:text-emerald-700 bg-white border border-slate-100 hover:border-emerald-200'}`}><CalendarPlus size={14}/></button>}
                                              <button onClick={() => triggerLiberate(sale.id)} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-red-400 hover:text-red-300' : 'text-red-400 hover:text-red-600 bg-white border border-slate-100 hover:border-red-200'}`}><RotateCcw size={14}/></button>
                                          </div>
                                      </div>
                                  )}
                              </div>
                          </div>
                        </div>
                      );
                 })}
                 {filteredSales.length === 0 && <div className="text-center py-12 text-slate-400">Sin resultados</div>}
              </div>
            </div>
          )}

          {view === 'config' && (
             // ✅ FULL WIDTH CONFIG
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
                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/50 border-b border-slate-100"><tr><th className="px-4 py-3 text-[10px] font-bold text-slate-400">Nombre</th><th className="px-4 py-3 text-[10px] font-bold text-slate-400 text-right">Acción</th></tr></thead>
                        <tbody className="divide-y divide-slate-50">{catalog.map(s => (<tr key={s.id}><td className="px-4 py-3 font-bold text-slate-700 text-xs">{s.name} <span className="text-slate-400 font-normal">(${s.cost})</span></td><td className="px-4 py-3 text-right"><button onClick={() => triggerDeleteService(s.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={16}/></button></td></tr>))}</tbody>
                    </table>
                </div>
             </div>
          )}

          {view === 'add_stock' && (
             // ✅ FULL WIDTH STOCK
             <div className="w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                 <h2 className="text-xl font-black text-slate-800 mb-6">Agregar Stock</h2>
                 <form onSubmit={handleGenerateStock} className="space-y-4">
                    <select className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none" value={stockForm.service} onChange={handleStockServiceChange}><option value="">Seleccionar Servicio...</option>{catalog.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select>
                    <input className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none" value={stockForm.email} onChange={e=>setStockForm({...stockForm, email:e.target.value})} placeholder="Correo"/>
                    <input className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-700 outline-none" value={stockForm.pass} onChange={e=>setStockForm({...stockForm, pass:e.target.value})} placeholder="Contraseña"/>
                    <div className="flex items-center gap-3"><input type="number" className="w-16 p-3 bg-blue-50 text-blue-600 font-bold rounded-xl text-center outline-none border-blue-100 border" value={stockForm.slots} onChange={e=>setStockForm({...stockForm, slots:Number(e.target.value)})}/><span className="text-xs font-bold text-slate-400">Cupos</span></div>
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold shadow-lg active:scale-95">Generar</button>
                 </form>
             </div>
          )}

          {view === 'form' && (
             <div className="w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-100 mb-20 animate-in slide-in-from-bottom-4">
                 <h2 className="text-xl font-black text-slate-800 mb-1">{formData.client === 'LIBRE' ? 'Vender' : 'Editar'}</h2>
                 <p className="text-xs font-mono text-slate-400 bg-slate-50 p-1 rounded w-fit mb-6">{formData.email}</p>
                 <form onSubmit={handleSaveSale} className="space-y-4">
                    {formData.client === 'LIBRE' && (<div className="flex gap-2 overflow-x-auto pb-2">{[1,2,3,4,5].map(num => (<button key={num} type="button" onClick={()=>setFormData({...formData, profilesToBuy: num})} disabled={num > maxAvailableSlots} className={`flex-1 h-10 min-w-[40px] rounded-lg text-xs font-bold border ${formData.profilesToBuy === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'} ${num > maxAvailableSlots ? 'opacity-30' : ''}`}>{num}</button>))}</div>)}
                    <div className="grid grid-cols-2 gap-3">
                        <input list="clients-suggestions" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={formData.client === 'LIBRE' ? '' : formData.client} onChange={handleClientNameChange} placeholder="Cliente" autoFocus/>
                        <input className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} placeholder="Celular"/>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <input type="date" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={formData.endDate} onChange={e=>setFormData({...formData, endDate:e.target.value})}/>
                        <input type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={formData.cost} onChange={e=>setFormData({...formData, cost:e.target.value})} placeholder="$0"/>
                    </div>
                    <div className="space-y-3 pt-2">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Perfiles</div>
                        {(formData.profilesToBuy > 1 ? bulkProfiles : [bulkProfiles[0] || {profile: formData.profile, pin: formData.pin}]).map((p, i) => (
                            <div key={i} className="flex gap-2"><input className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none" placeholder="Nombre Perfil" value={formData.profilesToBuy > 1 ? p.profile : formData.profile} onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'profile', e.target.value) : handleSingleProfileChange(e.target.value)} list="suggested-profiles"/><input className="w-20 p-3 bg-white border border-slate-200 rounded-xl text-xs font-bold text-center outline-none" placeholder="PIN" value={formData.profilesToBuy > 1 ? p.pin : formData.pin} onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'pin', e.target.value) : setFormData({...formData, pin: e.target.value})}/></div>
                        ))}
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={()=>setView('dashboard')} className="flex-1 py-3 font-bold text-slate-400 text-xs bg-slate-50 rounded-xl">Cancelar</button>
                        <button type="submit" className="flex-[2] py-3 bg-black text-white rounded-xl font-bold text-xs shadow-lg active:scale-95">Guardar</button>
                    </div>
                 </form>
             </div>
          )}
        </main>

        {/* BOTTOM NAV (SOLO MOVIL) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 p-2 flex justify-around z-40 pb-safe">
            <button onClick={() => setView('dashboard')} className={`p-3 rounded-2xl ${view === 'dashboard' ? 'bg-[#007AFF] text-white shadow-lg' : 'text-slate-400'}`}><Layers size={24}/></button>
            <button onClick={() => setView('add_stock')} className={`p-3 rounded-2xl ${view === 'add_stock' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400'}`}><Box size={24}/></button>
            <button onClick={() => setView('config')} className={`p-3 rounded-2xl ${view === 'config' ? 'bg-slate-100 text-slate-800' : 'text-slate-400'}`}><Settings size={24}/></button>
        </nav>

      </div>
    </div>
  );
};

export default App;