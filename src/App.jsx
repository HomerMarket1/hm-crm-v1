// src/App.jsx (CÓDIGO FINAL Y ESTABLE CON USEREDUCER)

import React, { useState, useMemo, useReducer } from 'react';
// Iconos de Lucide: Solo los necesarios para el layout, header y Modal
import { 
    Trash2, RotateCcw, Calendar, LogOut, Loader, CheckCircle, AlertTriangle, 
    RefreshCw, Globe, Shield, Skull, Layers, Box, Settings, X 
} from 'lucide-react'; 

// --- Importaciones de lógica de Reducer ---
import { initialUiState, uiReducer, uiActionTypes } from './reducers/uiReducer'; 

// --- Importación del NUEVO HOOK que contiene toda la lógica de filtrado y useMemo ---
import { useSalesData } from './hooks/useSalesData';

// --- 1. Importaciones de módulos y lógica central ---
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'; 
import { writeBatch, collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore'; 

// Importaciones de Archivos Modulares
import { useDataSync } from './hooks/useDataSync'; 
import { auth, db } from './firebase/config'; 
import { sendWhatsApp } from './utils/helpers'; 

// Importar Vistas y Componentes
import LoginScreen from './components/LoginScreen';
import Sidebar from './components/Sidebar';
import Dashboard from './views/Dashboard';
import StockManager from './views/StockManager';
import Config from './views/Config';
import SaleForm from './views/SaleForm';
import Toast from './components/Toast'; 

// ============================================================================
// LÓGICA DE ESTADO Y ACCIONES CENTRALES
// ============================================================================

const App = () => {
    // --- 1. DATOS DEL HOOK ---
    const { user, authLoading, sales, catalog, clientsDirectory, loadingData } = useDataSync();
    const userPath = user ? `users/${user.uid}` : '';
    
    // ✅ 2. GESTIÓN DE ESTADO DE UI CON USEREDUCER
    const [uiState, dispatch] = useReducer(uiReducer, initialUiState);
    
    // Desestructuración de estados de UI del reducer para usarlos en el Hook de Datos
    const { view, stockTab, filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;
    
    // --- 3. ESTADOS DE FORMULARIO Y MODALES (Se mantienen como useState) ---
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState(''); 

    const [confirmModal, setConfirmModal] = useState({ show: false, id: null, type: null, title: '', msg: '' });
    const [importStatus, setImportStatus] = useState(''); 
    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' }); 

    const [bulkProfiles, setBulkProfiles] = useState([{ profile: '', pin: '' }]);
    const [formData, setFormData] = useState({
        id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1,
    });
    const [stockForm, setStockForm] = useState({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
    const [catalogForm, setCatalogForm] = useState({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
    const [packageForm, setPackageForm] = useState({ name: 'Netflix', cost: 480, slots: 2 });
    
    const [openMenuId, setOpenMenuId] = useState(null);

    // ✅ 4. CONECTAR LOS DATOS Y FILTROS CON EL NUEVO HOOK
    const {
        filteredSales, totalFilteredMoney, totalItems, NON_BILLABLE_STATUSES,
        allClients, getClientPreviousProfiles, maxAvailableSlots, 
        accountsInventory, packageCatalog,
        getStatusIcon, getStatusColor, getDaysRemaining
    } = useSalesData(sales, catalog, clientsDirectory, uiState, formData);


    // --- 5. FUNCIONES DE AUTENTICACIÓN Y ACCIÓN (Wrappers para Reducer) ---
    
    // Funcción principal para cambiar estados de filtro (usada por Dashboard)
    const setFilter = (key, value) => dispatch({ type: uiActionTypes.SET_FILTER, payload: { key, value } });

    // Funcciones wrapper para el Reducer
    const setView = (newView) => dispatch({ type: uiActionTypes.SET_VIEW, payload: newView });
    const setStockTab = (newTab) => dispatch({ type: uiActionTypes.SET_STOCK_TAB, payload: newTab });

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoginError('');
        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPass);
            setNotification({ show: true, message: '¡Bienvenido! Sesión iniciada con éxito.', type: 'success' });
        } catch (error) {
            console.error(error);
            setLoginError('Error: Verifica tu correo y contraseña.');
            setNotification({ show: true, message: 'Error de inicio de sesión: Credenciales incorrectas.', type: 'error' });
        }
    };

    const handleLogout = () => signOut(auth);

    // --- 6. MEMOIZACIÓN (Solo queda la sincronización de profilesToBuy) ---

    React.useEffect(() => { // Sincroniza la cantidad de perfiles en el formulario
        const count = parseInt(formData.profilesToBuy || 1);
        setBulkProfiles(prev => {
            const newArr = [...prev];
            if (newArr.length < count) while(newArr.length < count) newArr.push({ profile: '', pin: '' });
            else if (newArr.length > count) return newArr.slice(0, count);
            return newArr;
        });
    }, [formData.profilesToBuy, formData.client, formData.id]);


    // --- 7. ACCIONES DE FIREBASE (CRUD) ---
    
    const handleAddServiceToCatalog = async (e) => {
        e.preventDefault(); if (!user || !catalogForm.name) return;
        try {
            await addDoc(collection(db, userPath, 'catalog'), { 
                name: catalogForm.name, cost: Number(catalogForm.cost), type: catalogForm.type, defaultSlots: Number(catalogForm.defaultSlots) 
            });
            setCatalogForm({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
            setNotification({ show: true, message: `Servicio '${catalogForm.name}' agregado al catálogo.`, type: 'success' });
        } catch (error) {
            setNotification({ show: true, message: 'Error al agregar servicio al catálogo.', type: 'error' });
        }
    };

    const handleAddPackageToCatalog = async (e) => {
        e.preventDefault();
        if (!user || !packageForm.name || packageForm.slots <= 1) return;
        const packageName = `${packageForm.name} Paquete ${packageForm.slots} Perfiles`;
        try {
            await addDoc(collection(db, userPath, 'catalog'), { 
                name: packageName, 
                cost: Number(packageForm.cost), 
                type: 'Paquete', 
                defaultSlots: Number(packageForm.slots) 
            });
            setPackageForm({ name: 'Netflix', cost: 480, slots: 2 });
            setNotification({ show: true, message: `Paquete '${packageName}' creado.`, type: 'success' });
        } catch (error) {
            setNotification({ show: true, message: 'Error al agregar paquete al catálogo.', type: 'error' });
        }
    };

    const handleImportCSV = (event, type) => {
        const file = event.target.files[0];
        if (!file || !user) return;
        
        setNotification({ show: true, message: 'Cargando datos...', type: 'warning' });

        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result;
            const rows = text.split('\n').map(row => row.split(','));
            const batch = writeBatch(db);
            let count = 0;
            let errors = 0;

            const SALES_MAP = { CLIENT: 0, SERVICE: 1, END_DATE: 2, EMAIL: 3, PASS: 4, PROFILE: 5, PIN: 6, COST: 7, PHONE: 8 };

            try {
                if (type === 'sales') {
                    rows.forEach((row, i) => {
                        if (i === 0 || !row[0] || row[0].toLowerCase().includes('cliente')) return;
                        if (row[SALES_MAP.SERVICE] && row[SALES_MAP.EMAIL]) {
                            const serviceName = row[SALES_MAP.SERVICE].trim();
                            const profileNames = (row[SALES_MAP.PROFILE] || '').split(';').map(p => p.trim()).filter(p => p !== '');
                            const pinCodes = (row[SALES_MAP.PIN] || '').split(';').map(p => p.trim());
                            const quantity = Math.max(profileNames.length, pinCodes.length, 1);
                            const totalCost = Number(row[SALES_MAP.COST] || 0);
                            const costPerProfile = totalCost / quantity;

                            for (let j = 0; j < quantity; j++) {
                                const ref = doc(collection(db, userPath, 'sales'));
                                batch.set(ref, { 
                                    client: row[SALES_MAP.CLIENT] ? row[SALES_MAP.CLIENT].trim() : 'N/A', 
                                    service: serviceName,
                                    endDate: row[SALES_MAP.END_DATE] ? row[SALES_MAP.END_DATE].trim() : null, 
                                    email: row[SALES_MAP.EMAIL].trim(),
                                    pass: row[SALES_MAP.PASS] ? row[SALES_MAP.PASS].trim() : 'N/A',
                                    profile: profileNames[j] || '',
                                    pin: pinCodes[j] || '',
                                    cost: Number(costPerProfile).toFixed(2),
                                    type: serviceName.includes('Cuenta') ? 'Cuenta' : 'Perfil',
                                    createdAt: Date.now() + (i * 100) + j // Unique timestamp
                                });
                                count++;
                            }
                        } else { errors++; }
                    });
                } else if (type === 'catalog') {
                    rows.forEach((row, i) => {
                       if (i === 0 || !row[0] || row[0].toLowerCase().includes('nombre')) return;
                       if (row[0] && row[1]) {
                            const ref = doc(collection(db, userPath, 'catalog'));
                            batch.set(ref, { name: row[0].trim(), cost: Number(row[1] || 0), defaultSlots: Number(row[2] || 4), type: row[3] ? row[3].trim() : 'Perfil' });
                            count++;
                       } else { errors++; }
                    });
                }

                await batch.commit();
                setNotification({ show: true, message: `¡Importación lista! Agregados: ${count}. Errores omitidos: ${errors}.`, type: 'success' });
            } catch (error) {
                setNotification({ show: true, message: `Error al procesar el archivo. Verifique el formato CSV.`, type: 'error' });
            }
        };
        reader.readAsText(file);
    };

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
            if (confirmModal.type === 'delete_service') {
                await deleteDoc(doc(db, userPath, 'catalog', confirmModal.id));
                setNotification({ show: true, message: 'Servicio eliminado correctamente.', type: 'success' });
            }
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
                setNotification({ show: true, message: 'Perfil liberado y marcado como disponible.', type: 'success' });
            }
            else if (confirmModal.type === 'delete_account') {
                const batch = writeBatch(db);
                confirmModal.data.forEach(id => { const docRef = doc(db, userPath, 'sales', id); batch.delete(docRef); });
                await batch.commit();
                setNotification({ show: true, message: 'Cuenta y todos sus perfiles eliminados.', type: 'warning' });
            }
        } catch (error) { 
            console.error("Error en acción:", error); 
            setNotification({ show: true, message: 'Error al ejecutar la acción en la base de datos.', type: 'error' });
        }
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
            setNotification({ show: true, message: 'Venta actualizada correctamente.', type: 'success' });
            setView('dashboard'); resetForm(); return;
        }

        let freeRows = sales.filter(s => s.email === formData.email && s.client === 'LIBRE'); 
        if (quantity > freeRows.length) { 
            setNotification({ show: true, message: `Error: Solo quedan ${freeRows.length} perfiles libres.`, type: 'error' });
            return; 
        }

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
        setNotification({ show: true, message: `¡Venta de ${quantity} perfiles guardada con éxito!`, type: 'success' });
        setView('dashboard'); resetForm();
    };

    const handleGenerateStock = async (e) => {
        e.preventDefault(); if (!user) return;
        try {
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
            setNotification({ show: true, message: `${stockForm.slots} cupos de stock generados.`, type: 'success' });
        } catch (error) {
            setNotification({ show: true, message: 'Error al generar stock.', type: 'error' });
        }
    };

    const handleQuickRenew = async (id) => {
        const sale = sales.find(s => s.id === id);
        if (sale && sale.endDate) {
            try {
                const [year, month, day] = sale.endDate.split('-').map(Number);
                const date = new Date(year, month - 1, day); date.setMonth(date.getMonth() + 1);
                const newEndDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                await updateDoc(doc(db, userPath, 'sales', id), { endDate: newEndDate });
                setNotification({ show: true, message: 'Renovación rápida completada (30 días).', type: 'success' });
            } catch (error) {
                setNotification({ show: true, message: 'Error al renovar rápidamente.', type: 'error' });
            }
        }
    };
    
    // --- 6. MANEJO DE ESTADO DE FORMULARIO ---
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

    // --- 7. ACCIONES CRUD DEL DIRECTORIO DE CLIENTES ---

    const triggerDeleteClient = async (clientId) => {
        if (!user) return;
        if (!window.confirm("¿Seguro que desea eliminar este cliente? Esto NO elimina las ventas asociadas, solo el registro en el directorio.")) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/clients`, clientId));
            setNotification({ show: true, message: "Cliente eliminado correctamente del directorio.", type: "success" });
        } catch (error) {
            console.error("Error al eliminar cliente:", error);
            setNotification({ show: true, message: "Error al eliminar el cliente.", type: "error" });
        }
    };

    const triggerEditClient = async (clientId, newName, newPhone) => {
        if (!user) return;
        try {
            const clientRef = doc(db, `users/${user.uid}/clients`, clientId);
            await updateDoc(clientRef, {
                name: newName, 
                phone: newPhone
            });
            setNotification({ show: true, message: "Cliente editado correctamente.", type: "success" });
        } catch (error) {
            console.error("Error al editar cliente:", error);
            setNotification({ show: true, message: "Error al editar el cliente.", type: "error" });
        }
    };

    // --- 9. RENDERIZADO PRINCIPAL (EL ROUTER) ---
    
    if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F2F2F7]"><Loader className="animate-spin text-blue-500"/></div>;

    if (!user) {
        return (
            <>
                <Toast notification={notification} setNotification={setNotification} /> 
                <LoginScreen 
                    loginEmail={loginEmail} setLoginEmail={setLoginEmail} 
                    loginPass={loginPass} setLoginPass={setLoginPass} 
                    loginError={loginError} handleLogin={handleLogin}
                />
            </>
        );
    }

    return (
        <>
            <Toast notification={notification} setNotification={setNotification} /> 

            <div className="flex flex-col md:flex-row h-full bg-[#F2F2F7] font-sans text-slate-900 overflow-hidden relative selection:bg-blue-100 selection:text-blue-900">
                
                {/* Modal de Confirmación */}
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

                {/* Datalists */}
                <datalist id="suggested-profiles">{getClientPreviousProfiles.map((p, i) => <option key={i} value={p.profile}>PIN: {p.pin}</option>)}</datalist>
                <datalist id="clients-suggestions">{allClients.map((c, i) => <option key={i} value={c.name} />)}</datalist>

                {/* Sidebar (Componente) */}
                <Sidebar view={view} setView={setView} handleLogout={handleLogout}/>

                <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                    <header className="h-14 md:h-20 flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-10 bg-white/50 backdrop-blur-md md:bg-transparent">
                        <div><h2 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">{view === 'dashboard' ? 'Ventas' : view === 'add_stock' ? 'Inventario' : view === 'form' ? 'Cliente' : 'Ajustes'}</h2></div>
                        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur text-slate-500 rounded-full text-xs font-bold border border-white/50 shadow-sm"><Calendar size={14}/> {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
                        <button onClick={handleLogout} className="md:hidden p-2 text-slate-400"><LogOut size={20}/></button>
                    </header>

                    <main className="flex-1 overflow-y-auto p-3 md:p-8 pb-24 md:pb-8 scroll-smooth no-scrollbar">
                        {/* Renderizado de Vistas (El Router) */}
                        
                        {view === 'dashboard' && <Dashboard 
                            sales={sales}
                            filteredSales={filteredSales}
                            catalog={catalog}
                            filterClient={filterClient} 
                            filterService={filterService} 
                            filterStatus={filterStatus} 
                            dateFrom={dateFrom} 
                            dateTo={dateTo} 
                            setFilter={setFilter}
                            
                            totalItems={totalItems} 
                            totalFilteredMoney={totalFilteredMoney}
                            getStatusIcon={getStatusIcon} 
                            getStatusColor={getStatusColor}
                            getDaysRemaining={getDaysRemaining}
                            NON_BILLABLE_STATUSES={NON_BILLABLE_STATUSES} 

                            sendWhatsApp={(sale, actionType) => sendWhatsApp(sale, catalog, sales, actionType)}
                            handleQuickRenew={handleQuickRenew}
                            triggerLiberate={triggerLiberate}
                            setFormData={setFormData} setView={setView}
                            openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
                            setBulkProfiles={setBulkProfiles}
                            loadingData={loadingData}
                        />}

                        {view === 'config' && <Config 
                            catalog={catalog}
                            catalogForm={catalogForm} setCatalogForm={setCatalogForm}
                            packageForm={packageForm} setPackageForm={setPackageForm}
                            handleAddServiceToCatalog={handleAddServiceToCatalog}
                            handleAddPackageToCatalog={handleAddPackageToCatalog}
                            handleImportCSV={handleImportCSV}
                            importStatus={importStatus}
                            triggerDeleteService={triggerDeleteService}
                            
                            // ✅ PROPS PARA DIRECTORIO DE CLIENTES
                            clientsDirectory={clientsDirectory} 
                            allClients={allClients} 
                            triggerDeleteClient={triggerDeleteClient}
                            triggerEditClient={triggerEditClient}
                            setNotification={setNotification} 

                            // ✅ CRÍTICO: Pasar el estado de formulario necesario
                            formData={formData} 
                            setFormData={setFormData}
                        />}

                        {view === 'add_stock' && <StockManager
                            accountsInventory={accountsInventory}
                            stockTab={stockTab} setStockTab={setStockTab}
                            stockForm={stockForm} setStockForm={setStockForm}
                            catalog={catalog}
                            handleStockServiceChange={handleStockServiceChange}
                            handleGenerateStock={handleGenerateStock}
                            triggerDeleteAccount={triggerDeleteAccount}
                        />}

                        {view === 'form' && <SaleForm
                            formData={formData} setFormData={setFormData}
                            bulkProfiles={bulkProfiles} setBulkProfiles={setBulkProfiles}
                            allClients={allClients}
                            packageCatalog={packageCatalog}
                            maxAvailableSlots={maxAvailableSlots}
                            getClientPreviousProfiles={getClientPreviousProfiles}
                            handleClientNameChange={handleClientNameChange}
                            handleBulkProfileChange={handleBulkProfileChange}
                            handleSingleProfileChange={handleSingleProfileChange}
                            handleSaveSale={handleSaveSale}
                            setView={setView}
                            resetForm={resetForm}
                            catalog={catalog}
                        />}
                    </main>

                    {/* BOTTOM NAV (SOLO MOVIL) */}
                    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 p-2 flex justify-around z-40 pb-safe">
                        <button onClick={() => setView('dashboard')} className={`p-3 rounded-2xl ${view === 'dashboard' ? 'bg-[#007AFF] text-white shadow-lg' : 'text-slate-400'}`}><Layers size={24}/></button>
                        <button onClick={() => setView('add_stock')} className={`p-3 rounded-2xl ${view === 'add_stock' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400'}`}><Box size={24}/></button>
                        <button onClick={() => setView('config')} className={`p-3 rounded-2xl ${view === 'config' ? 'bg-slate-100 text-slate-800' : 'text-slate-400'}`}><Settings size={24}/></button>
                    </nav>

                </div>
            </div>
        </>
    );
};

export default App;