import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, Plus, Smartphone, MessageCircle, Lock, Key, Trash2, Edit2, Ban, XCircle, Settings, 
  Save, Calendar, Layers, UserPlus, Box, CheckCircle, Users, Filter, DollarSign, RotateCcw, X, 
  ListPlus, User, History, CalendarPlus, Cloud, Loader, ChevronRight, PackageX, LogOut, Image,
  LayoutList, Upload, FileText, AlertTriangle, Copy, Package, MoreVertical, Menu
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
  appId: "1:913709788584:web:6814c401e1d495019d",
  measurementId: "G-MYN2RPJXF0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- ESTADOS "PROBLEMA" ---
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED'];

const App = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [loginError, setLoginError] = useState('');

  const [sales, setSales] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clientsDirectory, setClientsDirectory] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  const [view, setView] = useState('dashboard'); 
  const [stockTab, setStockTab] = useState('add'); 
  const [filterClient, setFilterClient] = useState('');
  const [filterService, setFilterService] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos'); 
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [confirmModal, setConfirmModal] = useState({ show: false, id: null, type: null, title: '', msg: '' }); 
  const [logoError, setLogoError] = useState(false);
  const [importStatus, setImportStatus] = useState('');

  const [bulkProfiles, setBulkProfiles] = useState([{ profile: '', pin: '' }]);
  const [formData, setFormData] = useState({
    id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1, 
  });
  const [stockForm, setStockForm] = useState({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
  const [catalogForm, setCatalogForm] = useState({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
  const [packageForm, setPackageForm] = useState({ name: 'Netflix', cost: 480, slots: 2 }); 

  // --- UI State for Menu ---
  const [openMenuId, setOpenMenuId] = useState(null);

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
    return sales.filter(s => s.email === email && s.client === 'LIBRE').length; 
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
      return sales.filter(s => s.email === formData.email && s.client === 'LIBRE').length; 
  }, [sales, formData.email, formData.id]);

  useEffect(() => {
    const count = parseInt(formData.profilesToBuy || 1);
    setBulkProfiles(prev => {
        const newArr = [...prev];
        if (newArr.length < count) while(newArr.length < count) newArr.push({ profile: '', pin: '' });
        else if (newArr.length > count) return newArr.slice(0, count);
        return newArr;
    });
  }, [formData.profilesToBuy, formData.client, formData.id]);

  // Inventario agrupado por cuentas
  const accountsInventory = useMemo(() => {
      const groups = {};
      sales.forEach(sale => {
          if (!sale.email) return; 
          if (!groups[sale.email]) {
              groups[sale.email] = {
                  email: sale.email,
                  service: sale.service,
                  pass: sale.pass,
                  total: 0,
                  free: 0,
                  ids: [] 
              };
          }
          groups[sale.email].total++;
          if (sale.client === 'LIBRE') groups[sale.email].free++;
          groups[sale.email].ids.push(sale.id);
      });
      return Object.values(groups);
  }, [sales]);

  // Paquetes disponibles en el Catálogo
  const packageCatalog = useMemo(() => {
      return catalog.filter(s => s.type === 'Paquete' || s.name.toLowerCase().includes('paquete'));
  }, [catalog]);

  // --- ACTIONS ---
  const userPath = user ? `users/${user.uid}` : '';

  const handleAddServiceToCatalog = async (e) => {
      e.preventDefault(); if (!user || !catalogForm.name) return;
      await addDoc(collection(db, userPath, 'catalog'), { 
          name: catalogForm.name, cost: Number(catalogForm.cost), type: catalogForm.type, defaultSlots: Number(catalogForm.defaultSlots) 
      });
      setCatalogForm({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
  };

  const handleAddPackageToCatalog = async (e) => {
      e.preventDefault();
      if (!user || !packageForm.name || packageForm.slots <= 1) return;

      const packageName = `${packageForm.name} Paquete ${packageForm.slots} Perfiles`;

      await addDoc(collection(db, userPath, 'catalog'), { 
          name: packageName, 
          cost: Number(packageForm.cost), 
          type: 'Paquete', 
          defaultSlots: Number(packageForm.slots) 
      });
      setPackageForm({ name: 'Netflix', cost: 480, slots: 2 });
  };


  const handleImportCSV = (event, type) => {
      const file = event.target.files[0];
      if (!file || !user) return;
      setImportStatus('Cargando...');

      const reader = new FileReader();
      reader.onload = async (e) => {
          const text = e.target.result;
          const rows = text.split('\n').map(row => row.split(','));
          const batch = writeBatch(db);
          let count = 0;
          let errors = 0;

          const SALES_MAP = { CLIENT: 0, SERVICE: 1, END_DATE: 2, EMAIL: 3, PASS: 4, PROFILE: 5, PIN: 6, COST: 7, PHONE: 8 };

          try {
              rows.forEach((row, i) => {
                  if (i === 0 || !row[0] || row[0].trim() === 'Nombre') return;

                  if (type === 'clients') {
                      if (row[0] && row[1]) {
                          const ref = doc(collection(db, userPath, 'clients'));
                          batch.set(ref, { name: row[0].trim(), phone: row[1].trim() });
                          count++;
                      } else { errors++; }
                  } else if (type === 'catalog') {
                      if (row[0] && row[1]) {
                          const ref = doc(collection(db, userPath, 'catalog'));
                          batch.set(ref, { name: row[0].trim(), cost: Number(row[1] || 0), defaultSlots: Number(row[2] || 4), type: row[3] ? row[3].trim() : 'Perfil' });
                          count++;
                      } else { errors++; }
                  } else if (type === 'sales') {
                      if (row[SALES_MAP.SERVICE] && row[SALES_MAP.EMAIL]) {
                          const ref = doc(collection(db, userPath, 'sales'));
                          batch.set(ref, { 
                              client: row[SALES_MAP.CLIENT] ? row[SALES_MAP.CLIENT].trim() : 'N/A', 
                              service: row[SALES_MAP.SERVICE].trim(),
                              endDate: row[SALES_MAP.END_DATE] ? row[SALES_MAP.END_DATE].trim() : null, 
                              email: row[SALES_MAP.EMAIL].trim(),
                              pass: row[SALES_MAP.PASS] ? row[SALES_MAP.PASS].trim() : 'N/A',
                              profile: row[SALES_MAP.PROFILE] ? row[SALES_MAP.PROFILE].trim() : '',
                              pin: row[SALES_MAP.PIN] ? row[SALES_MAP.PIN].trim() : '',
                              cost: Number(row[SALES_MAP.COST] || 0),
                              type: row[SALES_MAP.SERVICE].includes('Cuenta') ? 'Cuenta' : 'Perfil',
                              createdAt: Date.now() + i
                          });
                          count++;
                      } else { errors++; }
                  }
              });

              await batch.commit();
              setImportStatus(`¡Importación lista! Agregados: ${count}. Errores omitidos: ${errors}.`);
          } catch (error) {
              setImportStatus(`Error al procesar el archivo. Verifique el formato CSV.`);
          }
      };
      reader.readAsText(file);
  };

  // Modales
  const triggerDeleteService = (id) => { setConfirmModal({ show: true, id: id, type: 'delete_service', title: '¿Eliminar Servicio?', msg: 'Esta categoría desaparecerá del catálogo.' }); };
  const triggerLiberate = (id) => { setConfirmModal({ show: true, id: id, type: 'liberate', title: '¿Liberar Perfil?', msg: 'Los datos del cliente se borrarán y el cupo volverá a estar libre.' }); };
  const triggerDeleteAccount = (accountData) => {
      setConfirmModal({ 
          show: true, type: 'delete_account', title: '¿Eliminar Cuenta Completa?', 
          msg: `Se eliminarán los ${accountData.total} perfiles asociados a ${accountData.email}. Esta acción no se puede deshacer.`,
          data: accountData.ids 
      });
  };

  const handleConfirmAction = async () => {
      if (!user) return;
      try {
          if (confirmModal.type === 'delete_service') await deleteDoc(doc(db, userPath, 'catalog', confirmModal.id));
          else if (confirmModal.type === 'liberate') {
              const currentSale = sales.find(s => s.id === confirmModal.id);
              let newServiceName = 'Netflix 1 Perfil'; 

              if (currentSale.service && currentSale.service.toLowerCase().includes('paquete')) {
                  const baseName = currentSale.service.replace(/ Paquete \d+ Perfiles/i, '').trim();
                  const individualService = catalog.find(c => c.name.toLowerCase().includes(`${baseName.toLowerCase()} 1 perfil`));
                  
                  newServiceName = individualService ? individualService.name : 'LIBRE 1 Perfil'; 
              } else {
                  newServiceName = 'LIBRE 1 Perfil';
              }
              
              await updateDoc(doc(db, userPath, 'sales', confirmModal.id), { 
                  client: 'LIBRE', phone: '', endDate: '', profile: '', pin: '', 
                  service: newServiceName 
              });
          }
          else if (confirmModal.type === 'delete_account') {
              const batch = writeBatch(db);
              confirmModal.data.forEach(id => { const docRef = doc(db, userPath, 'sales', id); batch.delete(docRef); });
              await batch.commit();
          }
      } catch (error) { console.error("Error en acción:", error); }
      setConfirmModal({ show: false, id: null, type: null, title: '', msg: '', data: null });
  };

  const handleSaveSale = async (e) => {
    e.preventDefault(); if (!user) return;
    
    if (formData.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(formData.client) && formData.client !== 'Admin') {
        const exists = allClients.some(c => c.name.toLowerCase() === formData.client.toLowerCase());
        if (!exists) await addDoc(collection(db, userPath, 'clients'), { name: formData.client, phone: formData.phone });
    }

    const isSingleEdit = formData.client !== 'LIBRE' && formData.id && (!formData.profilesToBuy || formData.profilesToBuy === 1);
    
    const quantity = parseInt(formData.profilesToBuy || 1);
    
    const costPerProfile = (quantity > 1)
        ? Number(formData.cost / quantity).toFixed(2)
        : Number(formData.cost).toFixed(2);
    
    if (isSingleEdit) {
        const pName = bulkProfiles[0]?.profile !== '' ? bulkProfiles[0].profile : formData.profile;
        const pPin = bulkProfiles[0]?.pin !== '' ? bulkProfiles[0].pin : formData.pin;
        await updateDoc(doc(db, userPath, 'sales', formData.id), { ...formData, profile: pName, pin: pPin, cost: costPerProfile }); 
        setView('dashboard'); resetForm(); return;
    }

    // Venta Nueva
    let freeRows = sales.filter(s => s.email === formData.email && s.client === 'LIBRE'); 
    if (quantity > freeRows.length) { alert(`Error: Solo quedan ${freeRows.length} perfiles libres.`); return; }

    const batch = writeBatch(db);
    freeRows.slice(0, quantity).forEach((row, index) => {
        const specificProfileData = bulkProfiles[index];
        const docRef = doc(db, userPath, 'sales', row.id);
        batch.update(docRef, {
            client: formData.client, phone: formData.phone, endDate: formData.endDate, 
            cost: costPerProfile, 
            service: formData.service,
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
    setStockTab('manage'); 
    setStockForm({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
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
      relevantSales.forEach(s => { 
          let cleanName = s.service.replace(/\s1\sPerfil$/i, '').trim(); 
          if (s.service.toLowerCase().includes('paquete')) {
              const packageDetails = catalog.find(p => p.name === s.service);
              cleanName = packageDetails ? packageDetails.name.replace(/ Paquete \d+ Perfiles/i, '') : s.service;
          }
          if (!serviceCounts[cleanName]) serviceCounts[cleanName] = 0; 
          
          serviceCounts[cleanName] += 1; 
      });
      
      const textParts = Object.keys(serviceCounts).map(name => { 
          const count = serviceCounts[name]; 
          const plural = count > 1 ? 'perfiles' : 'perfil'; 
          return `${name.toUpperCase()} ${count} ${plural.toUpperCase()}`; 
      });
      
      if (textParts.length === 1) return textParts[0];
      const last = textParts.pop();
      return `${textParts.join(', ')} y ${last}`;
  };

  const sendWhatsApp = (sale, actionType) => {
    const dateText = sale.endDate ? sale.endDate.split('-').reverse().join('/') : ''; 
    let serviceUpper = sale.service.toUpperCase();
    let message = '';
    
    if (sale.service.toLowerCase().includes('paquete')) {
        serviceUpper = sale.service.toUpperCase().replace(/\s*PAQUETE\s*\d+\s*PERFILES/i, 'PAQUETE');
    }

    if (actionType === 'warning_tomorrow' || actionType === 'expired_today') {
        const servicesList = getGroupedServicesMessage(sale.client, (d) => actionType === 'warning_tomorrow' ? d === 1 : d <= 0) || `${serviceUpper}`;
        
        let headerEmoji = actionType === 'warning_tomorrow' ? '⚠️' : '❌';
        let headerText = actionType === 'warning_tomorrow' ? 'Mañana vence su servicio de' : 'Su servicio de';
        let bodyText = actionType === 'warning_tomorrow' ? '¿Renuevas un mes más? Confirma cuando puedas.' : 'ha vencido *HOY*. Por favor confirma para renovar.';

        message = `${headerEmoji} Buen Día ${sale.client} ${headerEmoji}\n${headerText} *${servicesList}*.\n${bodyText}\n¡Gracias!`;
    } else if (actionType === 'account_details') {
        message = `*${serviceUpper}*\n\n*CORREO*:\n${sale.email}\n*CONTRASEÑA*:\n${sale.pass}\n\n☑️ Su Cuenta Vence el día ${dateText} ☑️`;
    } else if (actionType === 'profile_details') {
        message = `*${serviceUpper}*\n\nCORREO:\n${sale.email}\nCONTRASEÑA:\n${sale.pass}\nPERFIL:\n${sale.profile}\nPIN:\n${sale.pin}\n\n☑️ Su Perfil Vence el día ${dateText} ☑️`;
    }
    
    window.open(`https://api.whatsapp.com/send?phone=${sale.phone}&text=${encodeURIComponent(message)}`, '_blank');
  };

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const isFree = s.client === 'LIBRE';
      const isProblem = NON_BILLABLE_STATUSES.includes(s.client);
      
      // BÚSQUEDA UNIFICADA: Por Nombre O Correo
      const matchSearch = filterClient === '' || 
                          s.client.toLowerCase().includes(filterClient.toLowerCase()) ||
                          s.email.toLowerCase().includes(filterClient.toLowerCase()); 
      
      const matchService = filterService === 'Todos' || s.service === filterService;
      let matchStatus = true;
      if (filterStatus === 'Libres') matchStatus = isFree;
      if (filterStatus === 'Ocupados') matchStatus = !isFree && !isProblem;
      if (filterStatus === 'Problemas') matchStatus = isProblem;
      
      // FILTRO DE FECHAS AVANZADO (DESDE... HASTA...)
      let matchDate = true;
      if (s.endDate) {
          const endDate = new Date(s.endDate);
          endDate.setHours(0, 0, 0, 0);

          if (dateFrom && dateTo) {
              const dateF = new Date(dateFrom); dateF.setHours(0, 0, 0, 0);
              const dateT = new Date(dateTo); dateT.setHours(0, 0, 0, 0);
              matchDate = endDate >= dateF && endDate <= dateT;
          } else if (dateFrom) {
              const dateF = new Date(dateFrom); dateF.setHours(0, 0, 0, 0);
              matchDate = endDate.getTime() === dateF.getTime(); 
          }
      } else if (dateFrom || dateTo) {
          matchDate = false;
      }
      
      return matchSearch && matchService && matchStatus && matchDate;
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
                      <img src="/logo1.png" alt="HM" className="w-full h-full object-contain rounded-xl"/>
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
    <div className="flex flex-col md:flex-row h-full bg-[#F2F2F7] font-sans text-slate-900 overflow-hidden relative selection:bg-blue-100 selection:text-blue-900">
      
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

      <div className="hidden md:flex w-72 bg-white/80 backdrop-blur-2xl border-r border-white/50 flex-col shadow-xl z-20 relative">
        <div className="p-8 flex flex-col items-center justify-center border-b border-slate-100/50">
          <div className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-4 bg-white overflow-hidden p-2 group cursor-pointer hover:scale-105 transition-transform">
             <img src="/logo1.png" alt="Logo" className="w-full h-full object-contain rounded-xl"/>
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
        <header className="h-14 md:h-20 flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-10 bg-white/50 backdrop-blur-md md:bg-transparent">
          <div><h2 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">{view === 'dashboard' ? 'Ventas' : view === 'add_stock' ? 'Inventario' : view === 'form' ? 'Cliente' : 'Ajustes'}</h2></div>
          <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur text-slate-500 rounded-full text-xs font-bold border border-white/50 shadow-sm"><Calendar size={14}/> {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <button onClick={handleLogout} className="md:hidden p-2 text-slate-400"><LogOut size={20}/></button>
        </header>

        <main className="flex-1 overflow-y-auto p-3 md:p-8 pb-24 md:pb-8 scroll-smooth no-scrollbar">
          {view === 'dashboard' && (
            <div className="space-y-4 md:space-y-6 w-full pb-20">
              <div className="bg-white/70 backdrop-blur-xl p-1.5 rounded-[1.5rem] shadow-sm border border-white sticky top-0 z-30">
                  <div className="flex flex-col gap-2">
                      <div className="relative group">
                          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                          <input type="text" placeholder="Buscar Cliente o Correo..." className="w-full pl-11 pr-4 h-10 md:h-12 bg-slate-100/50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium" value={filterClient} onChange={e => setFilterClient(e.target.value)} />
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

              {/* FILTRO AVANZADO DE FECHAS */}
              <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl p-2 rounded-xl border border-white/50">
                   <Calendar size={16} className="text-slate-400 flex-shrink-0"/>
                   <span className="text-xs font-bold text-slate-500 uppercase flex-shrink-0">Vence:</span>
                   <input type="date" className="bg-slate-100/50 p-1 rounded-lg text-xs font-medium text-slate-700 outline-none w-1/2 cursor-pointer" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                   <span className="text-slate-400 text-xs">-</span>
                   <input type="date" className="bg-slate-100/50 p-1 rounded-lg text-xs font-medium text-slate-700 outline-none w-1/2 cursor-pointer" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                   {(dateFrom || dateTo) && (<button onClick={() => {setDateFrom(''); setDateTo('');}} className="p-1 text-red-400 hover:text-red-600 rounded-lg"><X size={14}/></button>)}
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
                        <div key={sale.id} className={`p-3 rounded-2xl transition-all relative group ${cardClass}`}>
                          <div className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-center">
                              
                              <div className="col-span-12 md:col-span-3 w-full flex items-center gap-3">
                                  <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center text-lg md:text-xl font-bold shadow-sm flex-shrink-0 ${getStatusColor(sale.client)}`}>{getStatusIcon(sale.client)}</div>
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
                                      <div className={`flex items-center p-1 gap-1 rounded-lg w-full md:w-auto justify-between md:justify-end ${isAdmin ? 'bg-slate-800' : 'bg-white border border-slate-200 shadow-sm'}`}>
                                          {/* ✅ MENÚ DE OPCIONES RETRÁCTIL EN MÓVIL */}
                                          <div className="flex md:hidden">
                                              <button onClick={() => setOpenMenuId(openMenuId === sale.id ? null : sale.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 active:scale-95 transition-all ${openMenuId === sale.id ? 'bg-slate-100' : 'bg-transparent'}`}><MoreVertical size={16}/></button>
                                          </div>
                                          
                                          <div className={`fixed inset-0 bg-black/20 z-40 transition-opacity duration-300 ${openMenuId === sale.id ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`} onClick={() => setOpenMenuId(null)}></div>
                                          
                                          <div className={`md:flex absolute md:relative top-0 right-10 md:right-0 bg-white md:bg-transparent rounded-xl md:p-0 transition-all duration-200 shadow-xl md:shadow-none p-2 space-x-1 ${openMenuId === sale.id ? 'flex' : 'hidden'}`}>
                                              
                                              <div className="flex gap-1">
                                                  {!isProblem && days <= 3 && (<button onClick={() => sendWhatsApp(sale, days <= 0 ? 'expired_today' : 'warning_tomorrow')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center border shadow-sm transition-colors ${days <= 0 ? 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100' : 'bg-amber-50 text-amber-500 border-amber-100 hover:bg-amber-100'}`}>{days <= 0 ? <XCircle size={14}/> : <Ban size={14}/>}</button>)}
                                                  {!isProblem && <button onClick={() => sendWhatsApp(sale, 'account_details')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-blue-600 bg-white border border-slate-100 hover:border-blue-200 shadow-sm'}`}><Key size={14}/></button>}
                                                  {!isProblem && sale.type === 'Perfil' && <button onClick={() => sendWhatsApp(sale, 'profile_details')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-blue-600 bg-white border border-slate-100 hover:border-blue-200 shadow-sm'}`}><Lock size={14}/></button>}
                                              </div>
                                              <div className={`flex gap-1 pl-1 ${isAdmin ? 'border-l border-slate-600' : 'border-l border-slate-100'}`}>
                                                  <button onClick={() => { setFormData({...sale, profilesToBuy: 1}); setBulkProfiles([{ profile: sale.profile, pin: sale.pin }]); setView('form'); }} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800 bg-white border border-slate-100 hover:border-slate-300 shadow-sm'}`}><Edit2 size={14}/></button>
                                                  {!isProblem && <button onClick={() => handleQuickRenew(sale.id)} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-emerald-500 hover:text-emerald-400' : 'text-emerald-500 hover:text-emerald-700 bg-white border border-slate-100 hover:border-emerald-200 shadow-sm'}`}><CalendarPlus size={14}/></button>}
                                                  <button onClick={() => triggerLiberate(sale.id)} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-red-400 hover:text-red-300' : 'text-red-400 hover:text-red-600 bg-white border border-slate-100 hover:border-red-200 shadow-sm'}`}><RotateCcw size={14}/></button>
                                              </div>
                                              
                                              {/* BOTÓN CERRAR MENÚ (Solo en Móvil) */}
                                              <button onClick={() => setOpenMenuId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 md:hidden"><X size={16}/></button>
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

                {/* REGISTRO DE PAQUETES (MÁS SENCILLO Y VISIBLE) */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2"><PackageX size={16} className="text-blue-600"/> Registrar Paquete Fijo</h3>
                    <form onSubmit={handleAddPackageToCatalog} className="space-y-3">
                        <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Nombre Base (Ej: Netflix)</label><input required type="text" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" value={packageForm.name} onChange={e => setPackageForm({...packageForm, name: e.target.value})} /></div>
                        <div className="grid grid-cols-2 gap-3">
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Costo TOTAL ($)</label><input required type="number" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" placeholder="480" value={packageForm.cost} onChange={e => setPackageForm({...packageForm, cost: e.target.value})} /></div>
                            <div><label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pl-1 mb-1 block">Slots / Cupos</label><input required type="number" min="2" max="5" className="w-full p-3 bg-slate-50 rounded-xl text-xs font-bold outline-none" placeholder="2 o 3" value={packageForm.slots} onChange={e => setPackageForm({...packageForm, slots: Number(e.target.value)})} /></div>
                        </div>
                        <button type="submit" className="w-full py-3 bg-[#007AFF] text-white rounded-xl font-bold text-xs shadow-lg active:scale-95">Crear Paquete</button>
                    </form>
                </div>


                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                   <div className="md:hidden">
                       {catalog.map(s => (
                           <div key={s.id} className="flex items-center justify-between p-3 border-b border-slate-50 last:border-0">
                               <div>
                                   <div className="font-bold text-sm text-slate-800">{s.name}</div>
                                   <div className="text-xs text-slate-400 mt-0.5 flex gap-2">
                                       <span className="bg-slate-100 px-1.5 rounded text-[10px] font-bold uppercase">{s.type}</span>
                                       <span>{s.defaultSlots} slots</span>
                                   </div>
                               </div>
                               <div className="flex items-center gap-3">
                                   <span className="font-mono font-bold text-slate-700 text-sm">${s.cost}</span>
                                   <button onClick={() => triggerDeleteService(s.id)} className="p-2 text-red-500 rounded-lg hover:bg-red-50"><Trash2 size={16}/></button>
                               </div>
                           </div>
                       ))}
                   </div>

                   <table className="w-full text-left hidden md:table">
                        <thead className="bg-slate-50/50 border-b border-slate-100"><tr><th className="px-4 py-3 text-[10px] font-bold text-slate-400">Nombre</th><th className="px-4 py-3 text-[10px] font-bold text-slate-400">Tipo</th><th className="px-4 py-3 text-[10px] font-bold text-slate-400">Cupos</th><th className="px-4 py-3 text-[10px] font-bold text-slate-400">Precio</th><th className="px-4 py-3 text-right"></th></tr></thead>
                        <tbody className="divide-y divide-slate-50">{catalog.map(s => (<tr key={s.id}><td className="px-4 py-3 font-bold text-slate-700 text-xs">{s.name}</td><td className="px-4 py-3 text-slate-400 text-xs font-bold">{s.type}</td><td className="px-4 py-3 text-slate-400 text-xs font-bold">{s.defaultSlots}</td><td className="px-4 py-3 font-mono font-bold text-slate-700">${s.cost}</td><td className="px-4 py-3 text-right"><button onClick={() => triggerDeleteService(s.id)} type="button" className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16}/></button></td></tr>))}</tbody>
                    </table>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100">
                    <h3 className="text-xl font-black text-blue-600 mb-4 flex items-center gap-3"><FileText size={20}/> Utilidades de Importación</h3>
                    <p className="text-xs text-slate-500 mb-4">Carga tus datos de tu hoja de Excel guardados como archivos **CSV**.</p>
                    <div className="space-y-4">
                        <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                            <label className="flex items-center gap-2 mb-2 font-bold text-sm text-emerald-800 cursor-pointer">
                                <Upload size={16}/> Importar VENTAS Masivas
                            </label>
                            <p className="text-xs text-emerald-600 mb-3 font-medium">Sube tu hoja de ventas completa. <br/>Formato: [Cliente], [Servicio], [FechaVencimiento], [Email], [Pass], [Perfil], [Pin], [Costo], [Celular]</p>
                            <input type="file" accept=".csv" onChange={(e) => handleImportCSV(e, 'sales')} className="text-xs w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-emerald-100 file:text-emerald-700 hover:file:bg-emerald-200 cursor-pointer"/>
                        </div>
                        {importStatus && (<div className="p-3 bg-yellow-50 text-yellow-800 rounded-xl text-sm font-medium flex items-center gap-2"><AlertTriangle size={16}/> {importStatus}</div>)}
                    </div>
                </div>
             </div>
          )}

          {view === 'add_stock' && (
             <div className="space-y-6 w-full pb-20">
                 {/* PESTAÑAS DE NAVEGACIÓN DENTRO DE STOCK */}
                <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
                    <button onClick={() => setStockTab('add')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${stockTab === 'add' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>➕ Agregar Stock</button>
                    <button onClick={() => setStockTab('manage')} className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${stockTab === 'manage' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400'}`}>📋 Gestionar Cuentas</button>
                </div>

                {stockTab === 'add' ? (
                    // FORMULARIO AGREGAR
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
                ) : (
                    // GESTOR DE CUENTAS (Borrado Masivo)
                    <div className="space-y-3">
                        <div className="flex justify-between items-center px-2">
                             <h3 className="text-sm font-bold text-slate-500 uppercase">Cuentas Registradas ({accountsInventory.length})</h3>
                        </div>
                        {accountsInventory.length === 0 && <p className="text-center text-slate-400 text-xs py-8 bg-white rounded-xl">No hay cuentas madre registradas.</p>}
                        {accountsInventory.map((acc, i) => (
                            <div key={i} className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
                                <div className="overflow-hidden">
                                    <div className="font-bold text-slate-800 text-sm truncate">{acc.service}</div>
                                    <div className="text-xs text-slate-500 truncate">{acc.email}</div>
                                    <div className="flex gap-2 mt-1">
                                        <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-lg font-bold">Libres: {acc.free}</span>
                                        <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-lg font-bold">Total: {acc.total}</span>
                                    </div>
                                </div>
                                <button onClick={() => triggerDeleteAccount(acc)} className="p-2 bg-red-50 text-red-600 border border-red-100 rounded-xl shadow-sm hover:bg-red-100 active:scale-95"><Trash2 size={16}/></button>
                            </div>
                        ))}
                    </div>
                )}
             </div>
          )}

          {view === 'form' && (
             <div className="w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-100 mb-20 animate-in slide-in-from-bottom-4">
                 <h2 className="text-xl font-black text-slate-800 mb-1">{formData.client === 'LIBRE' ? 'Vender' : 'Editar'}</h2>
                 <p className="text-xs font-mono text-slate-400 bg-slate-50 p-1 rounded w-fit mb-6">
                     <button onClick={(e) => {
                         e.preventDefault();
                         navigator.clipboard.writeText(`${formData.email}:${formData.pass}`);
                         e.currentTarget.querySelector('span').textContent = '¡Copiado!'; 
                         setTimeout(() => {
                            e.currentTarget.querySelector('span').textContent = `${formData.email} | ${formData.pass}`;
                         }, 1500);
                     }} className="text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                         <span>{formData.email} | {formData.pass}</span> <Copy size={12}/>
                     </button>
                 </p>
                 <form onSubmit={handleSaveSale} className="space-y-4">
                    
                    {/* Botones de Cantidad */}
                    {(formData.client === 'LIBRE' || formData.id) && (
                        <div className="p-1 bg-slate-100 rounded-2xl flex">
                            {[1,2,3,4,5].map(num => (<button key={num} type="button" onClick={()=>setFormData({...formData, profilesToBuy: num})} disabled={num > maxAvailableSlots && formData.client === 'LIBRE'} className={`flex-1 h-10 min-w-[40px] rounded-lg text-xs font-bold border ${formData.profilesToBuy === num ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-400 border-slate-200'} ${num > maxAvailableSlots && formData.client === 'LIBRE' ? 'opacity-30' : ''}`}>{num}</button>))}
                        </div>
                    )}
                    
                    {/* SELECTOR DE PAQUETE (Visible en Venta Libre y Edición) */}
                    {packageCatalog.length > 0 && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                             <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1 flex items-center gap-1"><Package size={12}/> {formData.client === 'LIBRE' ? 'Venta Rápida Paquete' : 'Cambiar Tipo de Servicio'}</label>
                             <select 
                                 onChange={(e) => {
                                     const selectedName = e.target.value;
                                     const selected = catalog.find(s => s.name === selectedName);
                                     
                                     if (selected) {
                                         setFormData(prev => ({ 
                                             ...prev, 
                                             service: selected.name,
                                             cost: selected.cost,
                                             profilesToBuy: selected.defaultSlots 
                                         }));
                                     } else {
                                         const baseService = catalog.find(s => s.name.toLowerCase().includes('1 perfil') && s.type !== 'Paquete');
                                         setFormData(prev => ({ 
                                            ...prev, 
                                            service: baseService ? baseService.name : 'Netflix 1 Perfil',
                                            profilesToBuy: 1,
                                            cost: baseService ? baseService.cost : prev.cost
                                         }));
                                     }
                                 }} 
                                 className="w-full p-2 bg-white rounded-lg text-sm font-medium"
                                 value={formData.service}
                                 
                             >
                                 <option value={formData.service}>
                                    {formData.service.toLowerCase().includes('paquete') 
                                        ? `${formData.service} (Actual)`
                                        : `${formData.service} (Individual)`
                                    }
                                 </option>
                                 <option value="">--- Opciones de Conversión ---</option>

                                 {packageCatalog.map(pkg => (
                                     <option key={pkg.id} value={pkg.name}>
                                         {pkg.name} ({pkg.defaultSlots} slots | ${pkg.cost})
                                     </option>
                                 ))}
                                  {/* Opción Manual: Permite al usuario volver a Individual manualmente si la detección automática falla */}
                                  {catalog.filter(s => s.type !== 'Paquete').map(ind => (
                                    <option key={`ind-${ind.id}`} value={ind.name}>
                                        {ind.name} (Individual)
                                    </option>
                                  ))}
                             </select>
                         </div>
                    )}


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