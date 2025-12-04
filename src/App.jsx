import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Smartphone, MessageCircle, Lock, Key, Trash2, Edit2, Ban, XCircle, Settings, 
  Save, Calendar, Layers, UserPlus, Box, CheckCircle, Users, Filter, DollarSign, RotateCcw, X, 
  ListPlus, User, History, CalendarPlus, Cloud, Loader, ChevronRight, Play, AlertTriangle, 
  Globe, RefreshCw, Shield, Skull, LogOut, LogIn
} from 'lucide-react';

// --- IMPORTANTE: INSTALAR FIREBASE ---
// En tu proyecto real ejecuta: npm install firebase
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, // Login real
  signOut,
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, writeBatch
} from 'firebase/firestore';

// ============================================================================
// ⚠️ PEGA AQUÍ TUS CLAVES DE FIREBASE (Del Paso 1)
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

// Inicialización segura (evita errores si no hay config)
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
          setLoginError('Error: Verifica tu correo y contraseña.');
      }
  };

  const handleLogout = () => signOut(auth);

  // --- 2. CARGA DE DATOS (Solo si hay usuario) ---
  useEffect(() => {
    if (!user) {
        setSales([]); setCatalog([]); setClientsDirectory([]);
        return;
    }
    setLoadingData(true);
    
    // Usamos una colección raíz por usuario para seguridad
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
    if (!endDateStr) return null;
    const [year, month, day] = endDateStr.split('-').map(Number);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(year, month - 1, day); 
    return Math.ceil((end - today) / (1000 * 60 * 60 * 24));
  };

  const getFreeSlotsForAccount = (email, service) => sales.filter(s => s.email === email && s.service === service && s.client === 'LIBRE').length;

  const getClientPreviousProfiles = useMemo(() => {
      if (!formData.client || formData.client === 'LIBRE') return [];
      const clientName = formData.client.toLowerCase();
      const history = sales.filter(s => s.client.toLowerCase() === clientName && s.profile).map(s => ({ profile: s.profile, pin: s.pin }));
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
      await addDoc(collection(db, userPath, 'catalog'), { name: catalogForm.name, cost: Number(catalogForm.cost), type: catalogForm.type, defaultSlots: Number(catalogForm.defaultSlots) });
      setCatalogForm({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
  };

  const handleConfirmAction = async () => {
      if (!user || !confirmModal.id) return;
      if (confirmModal.type === 'delete_service') await deleteDoc(doc(db, userPath, 'catalog', confirmModal.id));
      else if (confirmModal.type === 'liberate') await updateDoc(doc(db, userPath, 'sales', confirmModal.id), { client: 'LIBRE', phone: '', endDate: '', profile: '', pin: '' });
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

  // --- UTILS & WHATSAPP (Mismo que antes) ---
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
      if (clientName === 'LIBRE') return <CheckCircle size={28}/>;
      if (clientName === 'Caída') return <AlertTriangle size={24}/>;
      if (clientName === 'Actualizar') return <RefreshCw size={24}/>;
      if (clientName === 'Dominio') return <Globe size={24}/>;
      if (clientName === 'Admin') return <Shield size={24}/>;
      if (clientName === 'EXPIRED') return <Skull size={24}/>;
      return clientName.charAt(0);
  };
  const getStatusColor = (clientName) => {
      if (clientName === 'LIBRE') return 'bg-emerald-100 text-emerald-600';
      if (clientName === 'Caída') return 'bg-red-100 text-red-600';
      if (clientName === 'Actualizar') return 'bg-blue-100 text-blue-600';
      if (clientName === 'Dominio') return 'bg-violet-100 text-violet-600';
      if (clientName === 'Admin') return 'bg-slate-800 text-white';
      if (clientName === 'EXPIRED') return 'bg-slate-200 text-slate-500';
      return 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white';
  };

  // --- RENDERIZADO CONDICIONAL (LOGIN vs APP) ---
  if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#f2f2f7]"><Loader className="animate-spin text-blue-500"/></div>;

  // 🔒 PANTALLA DE LOGIN
  if (!user) {
      return (
          <div className="flex h-screen items-center justify-center bg-slate-900 p-4">
              <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md text-center">
                  <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/40">
                      <span className="text-white font-black text-2xl">HM</span>
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 mb-2">Bienvenido</h2>
                  <p className="text-slate-500 mb-8">Inicia sesión para gestionar tu negocio</p>
                  
                  <form onSubmit={handleLogin} className="space-y-4">
                      <input type="email" placeholder="Correo" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} required/>
                      <input type="password" placeholder="Contraseña" className="w-full p-4 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-900 placeholder:text-slate-400" value={loginPass} onChange={e=>setLoginPass(e.target.value)} required/>
                      {loginError && <p className="text-red-500 text-sm font-bold">{loginError}</p>}
                      <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg hover:scale-[1.02] transition-transform">Entrar</button>
                  </form>
              </div>
          </div>
      );
  }

  // 📱 APLICACIÓN PRINCIPAL
  return (
    <div className="flex h-screen bg-[#f2f2f7] font-sans text-slate-900 overflow-hidden relative">
      
      {/* MODALES */}
      {confirmModal.show && (
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
              <div className="bg-white/90 backdrop-blur-xl rounded-[2rem] p-8 shadow-2xl max-w-sm w-full border border-white/50 text-center transform scale-100">
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-5 mx-auto shadow-inner ${confirmModal.type === 'delete_service' ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}>
                      {confirmModal.type === 'delete_service' ? <Trash2 size={32}/> : <RotateCcw size={32}/>}
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-2">{confirmModal.title}</h3>
                  <p className="text-slate-500 mb-8 text-base font-medium">{confirmModal.msg}</p>
                  <div className="flex flex-col gap-3">
                      <button onClick={handleConfirmAction} className={`w-full py-4 text-white rounded-2xl font-bold shadow-lg hover:scale-[1.02] transition-transform ${confirmModal.type === 'delete_service' ? 'bg-red-500' : 'bg-amber-500'}`}>Confirmar</button>
                      <button onClick={() => setConfirmModal({show:false, id:null, type:null})} className="w-full py-4 bg-white text-slate-500 rounded-2xl font-bold hover:bg-slate-50 transition-colors border border-slate-200">Cancelar</button>
                  </div>
              </div>
          </div>
      )}

      {/* DATALISTS */}
      <datalist id="suggested-profiles">{getClientPreviousProfiles.map((p, i) => <option key={i} value={p.profile}>PIN: {p.pin}</option>)}</datalist>
      <datalist id="clients-suggestions">{allClients.map((c, i) => <option key={i} value={c.name} />)}</datalist>

      {/* SIDEBAR */}
      <div className="w-20 md:w-72 bg-white/70 backdrop-blur-2xl border-r border-white/20 flex flex-col shadow-xl z-20 relative">
        <div className="p-8 flex flex-col items-center justify-center border-b border-slate-200/50">
          <div className="w-28 h-28 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-4 bg-white overflow-hidden p-2">
             {/* 💡 TU LOGO AQUÍ */}
             <img src="/logo1.png" alt="Logo HM" className="w-full h-full object-contain rounded-2xl"/>
          </div>
          <div className="hidden md:block text-center">
              <h1 className="font-bold text-lg tracking-tight text-slate-800">HM Digital</h1>
              <span className="text-xs text-slate-400 font-medium tracking-widest uppercase">Manager Pro</span>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button onClick={() => setView('dashboard')} className={`w-full flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/30' : 'text-slate-500 hover:bg-white/60'}`}><Layers size={20}/> <span className="hidden md:inline font-semibold">Tablero</span></button>
          <button onClick={() => setView('add_stock')} className={`w-full flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'add_stock' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60'}`}><Box size={20}/> <span className="hidden md:inline font-semibold">Stock</span></button>
          <button onClick={() => setView('config')} className={`w-full flex items-center justify-center md:justify-start gap-3 px-4 py-3 rounded-2xl transition-all ${view === 'config' ? 'bg-white text-slate-900 shadow-md' : 'text-slate-500 hover:bg-white/60'}`}><Settings size={20}/> <span className="hidden md:inline font-semibold">Ajustes</span></button>
        </nav>
        <div className="p-6 border-t border-slate-200/50">
            <button onClick={handleLogout} className="w-full py-3 flex items-center justify-center gap-2 text-red-400 hover:text-red-600 font-bold text-xs uppercase tracking-wider transition-colors"><LogOut size={16}/> Salir</button>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#f2f2f7]">
        <header className="h-20 flex items-center justify-between px-8 flex-shrink-0 z-10">
          <div><h2 className="text-3xl font-bold text-slate-900 tracking-tight">{view === 'dashboard' ? 'Ventas' : view === 'add_stock' ? 'Inventario' : view === 'form' ? 'Gestión' : 'Configuración'}</h2></div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur text-slate-500 rounded-full text-xs font-bold border border-white/50 shadow-sm"><Calendar size={14}/> {new Date().toLocaleDateString()}</div>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8 relative scroll-smooth no-scrollbar">
          {view === 'dashboard' && (
            <div className="space-y-8 max-w-[1600px] mx-auto pb-20">
              <div className="bg-white/80 backdrop-blur-xl p-1 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-white">
                  <div className="flex flex-col md:flex-row gap-2 p-3">
                      <div className="relative group flex-1">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                          <input type="text" placeholder="Buscar..." className="w-full pl-12 pr-4 h-12 bg-slate-100/50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium" value={filterClient} onChange={e => setFilterClient(e.target.value)} />
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                          <select className="h-12 px-6 bg-slate-100/50 rounded-2xl text-sm font-bold text-slate-600 outline-none border-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 cursor-pointer min-w-[180px]" value={filterService} onChange={e => setFilterService(e.target.value)}><option value="Todos">Todos los Servicios</option>{catalog.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                          <div className="flex bg-slate-100/80 p-1 rounded-2xl h-12">
                              {['Todos', 'Libres', 'Ocupados', 'Problemas'].map(status => (
                                  <button key={status} onClick={() => setFilterStatus(status)} className={`px-5 rounded-xl text-xs font-bold transition-all ${filterStatus === status ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{status}</button>
                              ))}
                          </div>
                      </div>
                  </div>
                  <div className="flex flex-col md:flex-row justify-between items-center px-4 pb-2 mt-1 gap-4">
                      <div className="flex items-center gap-2 bg-slate-100/50 px-3 py-1.5 rounded-xl">
                           <span className="text-[10px] font-bold text-slate-400 uppercase">Fecha:</span>
                           <input type="date" className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                           <span className="text-slate-300">-</span>
                           <input type="date" className="bg-transparent text-xs font-bold text-slate-600 outline-none cursor-pointer" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                           {(dateFrom || dateTo) && (<button onClick={() => {setDateFrom(''); setDateTo('');}} className="ml-2 text-slate-400 hover:text-red-500"><X size={14}/></button>)}
                      </div>
                      <div className="flex items-center gap-2"><span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Real</span><span className="text-xl font-black text-slate-800 tracking-tight">${totalFilteredMoney.toLocaleString()}</span></div>
                  </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                 {filteredSales.map((sale) => {
                      const isFree = sale.client === 'LIBRE';
                      const isProblem = NON_BILLABLE_STATUSES.includes(sale.client);
                      const isAdmin = sale.client === 'Admin';
                      const days = getDaysRemaining(sale.endDate);
                      let cardClass = "bg-white/80 backdrop-blur-sm border border-white hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5";
                      if (isFree) cardClass = "bg-white/40 border border-dashed border-emerald-300/50 hover:bg-emerald-50/50 hover:border-emerald-300";
                      if (isProblem) cardClass = "bg-red-50/20 border border-red-100 hover:border-red-200";
                      if (isAdmin) cardClass = "bg-slate-900 border border-slate-700 text-white";

                      return (
                        <div key={sale.id} className={`p-5 rounded-3xl transition-all duration-300 shadow-sm group ${cardClass}`}>
                          <div className="flex flex-col md:flex-row items-center gap-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-lg shadow-black/5 ${getStatusColor(sale.client)}`}>{getStatusIcon(sale.client)}</div>
                              <div className="flex-1 text-center md:text-left min-w-[200px]">
                                  <div className={`font-bold text-lg leading-tight ${isAdmin ? 'text-white' : 'text-slate-800'}`}>{isFree ? 'Cupo Disponible' : sale.client}</div>
                                  <div className={`text-sm font-medium mt-0.5 ${isAdmin ? 'text-slate-400' : 'text-slate-400'}`}>{sale.service}</div>
                                  {!isFree && !isProblem && <div className="text-xs text-blue-500 font-bold mt-1 flex items-center justify-center md:justify-start gap-1"><Smartphone size={10}/> {sale.phone}</div>}
                              </div>
                              <div className={`hidden md:block flex-1 border-l pl-6 ${isAdmin ? 'border-slate-700' : 'border-slate-100'}`}>
                                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Credenciales</div>
                                  <div className={`text-sm font-medium truncate max-w-[200px] ${isAdmin ? 'text-slate-300' : 'text-slate-600'}`} title={sale.email}>{sale.email}</div>
                                  {!isFree && !isProblem && (<div className="flex items-center gap-2 mt-1"><span className="bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-0.5 rounded-md border border-blue-100">{sale.profile || 'General'}</span><span className="bg-slate-50 text-slate-500 text-[10px] font-mono px-2 py-0.5 rounded-md border border-slate-200 tracking-wider">{sale.pin || '****'}</span></div>)}
                              </div>
                              <div className="text-center w-24">
                                  {!isFree && !isProblem ? (
                                      <>
                                          <div className={`text-2xl font-black ${days <= 3 ? 'text-amber-500' : (isAdmin ? 'text-white' : 'text-slate-800')}`}>{days}</div>
                                          <div className="text-[10px] font-bold text-slate-400 uppercase">Días Rest.</div>
                                          <div className="text-[10px] text-slate-300 font-medium">{sale.endDate.split('-').reverse().slice(0,2).join('/')}</div>
                                      </>
                                  ) : <span className="text-slate-400 text-xs font-bold bg-slate-100 px-3 py-1 rounded-full">{isFree ? 'LIBRE' : 'N/A'}</span>}
                              </div>
                              <div className="text-right w-20 hidden md:block">
                                  <div className={`text-lg font-bold ${isAdmin ? 'text-white' : 'text-slate-700'}`}>${(isFree || isProblem || isAdmin) ? 0 : sale.cost}</div>
                              </div>
                              <div className="flex gap-2">
                                  {isFree ? (
                                      <button onClick={() => { setFormData(sale); setView('form'); }} className="h-10 px-5 bg-black text-white rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-black/20 flex items-center gap-2">Asignar <ChevronRight size={14}/></button>
                                  ) : (
                                      <div className={`flex items-center p-1 rounded-2xl backdrop-blur-md ${isAdmin ? 'bg-slate-800' : 'bg-slate-100/80'}`}>
                                          {!isProblem && days <= 3 && (<button onClick={() => sendWhatsApp(sale, days <= 0 ? 'expired_today' : 'warning_tomorrow')} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${days <= 0 ? 'text-red-500 hover:bg-white shadow-sm' : 'text-amber-500 hover:bg-white shadow-sm'}`}>{days <= 0 ? <XCircle size={18}/> : <Ban size={18}/>}</button>)}
                                          {!isProblem && <button onClick={() => sendWhatsApp(sale, 'account_details')} className="w-9 h-9 text-slate-400 hover:text-blue-500 hover:bg-white hover:shadow-sm rounded-xl transition-all"><Key size={18}/></button>}
                                          {!isProblem && sale.type === 'Perfil' && <button onClick={() => sendWhatsApp(sale, 'profile_details')} className="w-9 h-9 text-slate-400 hover:text-blue-500 hover:bg-white hover:shadow-sm rounded-xl transition-all"><Lock size={18}/></button>}
                                          {!isProblem && <div className="w-px h-4 bg-slate-300 mx-1"></div>}
                                          <button onClick={() => { setFormData({...sale, profilesToBuy: 1}); setBulkProfiles([{ profile: sale.profile, pin: sale.pin }]); setView('form'); }} className="w-9 h-9 text-slate-600 hover:bg-white hover:shadow-sm rounded-xl transition-all"><Edit2 size={18}/></button>
                                          {!isProblem && <button onClick={() => handleQuickRenew(sale.id)} className="w-9 h-9 text-emerald-600 hover:bg-white hover:shadow-sm rounded-xl transition-all"><CalendarPlus size={18}/></button>}
                                          <button onClick={() => triggerLiberate(sale.id)} className="w-9 h-9 text-red-400 hover:text-red-600 hover:bg-white hover:shadow-sm rounded-xl transition-all"><RotateCcw size={18}/></button>
                                      </div>
                                  )}
                              </div>
                          </div>
                        </div>
                      );
                 })}
                 {filteredSales.length === 0 && (<div className="flex flex-col items-center justify-center py-20 opacity-50"><div className="w-20 h-20 bg-slate-200 rounded-full flex items-center justify-center mb-4"><Search size={30} className="text-slate-400"/></div><p className="font-bold text-slate-400">Sin resultados</p></div>)}
              </div>
            </div>
          )}

          {view === 'config' && (
             <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-500">
                <div className="flex items-center justify-between"><div><h2 className="text-3xl font-black text-slate-800 tracking-tight">Configuración</h2><p className="text-slate-500 font-medium">Gestiona tu catálogo.</p></div><div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm border border-slate-100"><Settings size={24} className="text-slate-400 animate-spin-slow"/></div></div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-1">
                        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/50 border border-slate-100 sticky top-8">
                            <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2"><span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center"><Plus size={18}/></span>Nuevo Servicio</h3>
                            <form onSubmit={handleAddServiceToCatalog} className="space-y-4">
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Nombre</label><input required type="text" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20" value={catalogForm.name} onChange={e => setCatalogForm({...catalogForm, name: e.target.value})} /></div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Costo</label><input required type="number" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700" value={catalogForm.cost} onChange={e => setCatalogForm({...catalogForm, cost: e.target.value})} /></div>
                                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Cupos</label><input required type="number" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700" value={catalogForm.defaultSlots} onChange={e => setCatalogForm({...catalogForm, defaultSlots: e.target.value})} /></div>
                                </div>
                                <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Tipo</label><div className="flex bg-slate-50 p-1 rounded-2xl">{['Perfil', 'Cuenta'].map(t => (<button key={t} type="button" onClick={() => setCatalogForm({...catalogForm, type: t})} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${catalogForm.type === t ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>{t}</button>))}</div></div>
                                <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-bold text-sm hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-black/20 mt-2">Agregar</button>
                            </form>
                        </div>
                    </div>
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50/50 border-b border-slate-100"><tr><th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre</th><th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tipo</th><th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cupos</th><th className="px-6 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Precio</th><th className="px-6 py-5 text-right"></th></tr></thead>
                                <tbody className="divide-y divide-slate-50">{catalog.map(s => (<tr key={s.id} className="group hover:bg-blue-50/30 transition-colors"><td className="px-6 py-4 font-bold text-slate-700">{s.name}</td><td className="px-6 py-4"><span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-1 rounded-lg uppercase">{s.type}</span></td><td className="px-6 py-4 font-medium text-slate-500">{s.defaultSlots}</td><td className="px-6 py-4 font-mono font-bold text-slate-700">${s.cost}</td><td className="px-6 py-4 text-right"><button onClick={() => triggerDeleteService(s.id)} className="w-8 h-8 rounded-full flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 size={16}/></button></td></tr>))}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
             </div>
          )}

          {view === 'add_stock' && (
             <div className="max-w-2xl mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100">
                 <div className="flex items-center gap-4 mb-8"><div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-slate-900/20"><Box size={24}/></div><div><h2 className="text-2xl font-black text-slate-800 tracking-tight">Agregar Stock</h2><p className="text-slate-500 font-medium">Ingresa cuenta madre.</p></div></div>
                 <form onSubmit={handleGenerateStock} className="space-y-6">
                    <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 mb-2 block">Servicio</label><div className="relative"><select className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 appearance-none outline-none" value={stockForm.service} onChange={handleStockServiceChange}><option value="">Seleccionar...</option>{catalog.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}</select><ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90" size={16}/></div></div>
                    <div className="grid grid-cols-2 gap-4"><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 mb-2 block">Correo</label><input className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none" value={stockForm.email} onChange={e=>setStockForm({...stockForm, email:e.target.value})} placeholder="email@tv.com"/></div><div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 mb-2 block">Contraseña</label><input className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none" value={stockForm.pass} onChange={e=>setStockForm({...stockForm, pass:e.target.value})}/></div></div>
                    <div className="p-4 bg-blue-50 rounded-2xl flex items-center gap-4 border border-blue-100"><input type="number" className="w-16 p-3 bg-white rounded-xl text-center font-black text-lg text-blue-600 outline-none" value={stockForm.slots} onChange={e=>setStockForm({...stockForm, slots:Number(e.target.value)})}/><div className="text-sm font-bold text-blue-800">Cupos a Generar <span className="block text-[10px] font-normal opacity-70">Se crearán como "LIBRE".</span></div></div>
                    <div className="flex gap-4 pt-4"><button type="button" onClick={()=>setView('dashboard')} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">Cancelar</button><button type="submit" className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-xl shadow-blue-600/30">Guardar Stock</button></div>
                 </form>
             </div>
          )}

          {view === 'form' && (
             <div className="max-w-2xl mx-auto bg-white p-8 rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 animate-in zoom-in-95 duration-300">
                 <div className="flex justify-between items-start mb-8"><div><h2 className="text-2xl font-black text-slate-800 tracking-tight">{formData.client === 'LIBRE' ? 'Vender' : 'Editar'}</h2><p className="text-slate-500 font-medium font-mono text-xs mt-1 bg-slate-100 w-fit px-2 py-1 rounded-lg">{formData.email}</p></div>{formData.client === 'LIBRE' && <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">Stock: {getFreeSlotsForAccount(formData.email, formData.service)}</span>}</div>
                 <form onSubmit={handleSaveSale} className="space-y-6">
                    {formData.client === 'LIBRE' && (<div className="p-1 bg-slate-100 rounded-2xl flex">{[1,2,3,4,5].map(num => (<button key={num} type="button" onClick={()=>setFormData({...formData, profilesToBuy: num})} disabled={num > maxAvailableSlots} className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${formData.profilesToBuy === num ? 'bg-white text-slate-900 shadow-md transform scale-[1.02]' : 'text-slate-400'} ${num > maxAvailableSlots ? 'opacity-20 cursor-not-allowed' : ''}`}>{num}</button>))}</div>)}
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 mb-2 block">Cliente</label><input list="clients-suggestions" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none" value={formData.client === 'LIBRE' ? '' : formData.client} onChange={handleClientNameChange} autoFocus placeholder="Nombre"/></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 mb-2 block">Celular</label><input className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none" value={formData.phone} onChange={e=>setFormData({...formData, phone:e.target.value})} placeholder="598..."/></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 mb-2 block">Vencimiento</label><input type="date" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none" value={formData.endDate} onChange={e=>setFormData({...formData, endDate:e.target.value})}/></div>
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2 mb-2 block">Costo</label><input type="number" className="w-full p-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500/20 outline-none" value={formData.cost} onChange={e=>setFormData({...formData, cost:e.target.value})}/></div>
                    </div>
                    <div className="space-y-3">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-2">Detalles Perfiles</div>
                        {(formData.profilesToBuy > 1 ? bulkProfiles : [bulkProfiles[0] || {profile: formData.profile, pin: formData.pin}]).map((p, i) => (
                            <div key={i} className="flex gap-3"><div className="w-8 flex items-center justify-center font-bold text-slate-300 text-xs">{i+1}</div><input className="flex-1 p-3 bg-white border border-slate-200 rounded-xl text-sm font-medium focus:border-blue-500 outline-none transition-colors" placeholder="Nombre Perfil" value={formData.profilesToBuy > 1 ? p.profile : formData.profile} onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'profile', e.target.value) : handleSingleProfileChange(e.target.value)} list="suggested-profiles"/><input className="w-24 p-3 bg-white border border-slate-200 rounded-xl text-sm font-mono text-center focus:border-blue-500 outline-none transition-colors" placeholder="PIN" value={formData.profilesToBuy > 1 ? p.pin : formData.pin} onChange={(e) => formData.profilesToBuy > 1 ? handleBulkProfileChange(i, 'pin', e.target.value) : setFormData({...formData, pin: e.target.value})}/></div>
                        ))}
                    </div>
                    <div className="flex gap-4 pt-4 border-t border-slate-100 mt-4"><button type="button" onClick={()=>setView('dashboard')} className="flex-1 py-4 font-bold text-slate-400 hover:text-slate-600">Cancelar</button><button type="submit" className="flex-[2] py-4 bg-black text-white rounded-2xl font-bold hover:scale-[1.02] transition-transform shadow-xl shadow-black/20">Guardar Venta</button></div>
                 </form>
             </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;