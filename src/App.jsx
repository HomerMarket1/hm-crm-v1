// src/App.jsx
import React, { useState, useReducer, useEffect, Suspense, lazy } from 'react';
import { Loader } from 'lucide-react';

// Reducers y Hooks
import { initialUiState, uiReducer, uiActionTypes } from './reducers/uiReducer';
import { useSalesData } from './hooks/useSalesData';
import { useDataSync } from './hooks/useDataSync';
import { useCRMActions } from './hooks/useCRMActions';
import { useClientManagement } from './hooks/useClientManagement';

// Firebase y Utils
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from './firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore'; // 👈 Asegúrate de importar esto
import { sendWhatsApp } from './utils/helpers';

// Layout y Componentes
import MainLayout from './layouts/MainLayout';
import ConfirmModal from './components/ConfirmModal';
import EditAccountModal from './components/EditAccountModal';
import EditClientModal from './components/EditClientModal';

// VISTAS (Lazy Loading)
const LoginScreen = lazy(() => import('./views/LoginScreen'));
const Dashboard = lazy(() => import('./views/Dashboard'));
const StockManager = lazy(() => import('./views/StockManager'));
const Config = lazy(() => import('./views/Config'));
const SaleForm = lazy(() => import('./views/SaleForm'));
const ClientPortal = lazy(() => import('./views/ClientPortal'));

// CONSTANTES
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Vencido', 'Cancelado', 'Problemas', 'Garantía', 'Admin'];

const App = () => {
    // 1. DATA & AUTH
    const { user, authLoading, sales, catalog, clientsDirectory, loadingData, totalRevenue } = useDataSync();

    // 2. UI STATE
    const [uiState, dispatch] = useReducer(uiReducer, initialUiState);
    const { view, stockTab, filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;

    // Modales y Notificaciones
    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' });
    const [confirmModal, setConfirmModal] = useState({ show: false, id: null, type: null, title: '', msg: '', data: null });
    const [editAccountModal, setEditAccountModal] = useState({ show: false, email: '', oldPass: '', newPass: '' });
    const [editClientModal, setEditClientModal] = useState({ show: false, client: null });
    const [openMenuId, setOpenMenuId] = useState(null);

    // MODO NOCTURNO
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('crm_dark_mode') === 'true');
    useEffect(() => { localStorage.setItem('crm_dark_mode', darkMode); }, [darkMode]);

    // 3. LOGIC HOOKS
    const crmActions = useCRMActions(user, setNotification);
    const clientManagement = useClientManagement(user, user ? `users/${user.uid}` : '', sales, clientsDirectory, setNotification);

    // 4. FORM STATES
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState('');

    // Formularios
    const [bulkProfiles, setBulkProfiles] = useState([{ profile: '', pin: '' }]);
    const [formData, setFormData] = useState({ id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1, lastCode: '' });
    const [stockForm, setStockForm] = useState({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
    const [catalogForm, setCatalogForm] = useState({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
    const [packageForm, setPackageForm] = useState({ name: '', cost: '', slots: 2 });

    // 5. COMPUTED DATA
    const {
        filteredSales, totalFilteredMoney, totalItems,
        getClientPreviousProfiles, maxAvailableSlots, accountsInventory, packageCatalog,
        getStatusIcon, getStatusColor, getDaysRemaining,
        expiringToday, expiringTomorrow, overdueSales
    } = useSalesData(sales, catalog, clientManagement.allClients, uiState, formData);

    const sortedCatalog = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
    const hasActiveFilters = filterClient || (filterService && filterService !== 'Todos') || (filterStatus && filterStatus !== 'Todos') || dateFrom || dateTo;
    const moneyToShow = hasActiveFilters ? totalFilteredMoney : (totalRevenue || totalFilteredMoney);

    // --- HANDLERS ---
    const handleLogin = async (e) => {
        e.preventDefault(); setLoginError('');
        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPass);
            setNotification({ show: true, message: '¡Bienvenido a HM Digital!', type: 'success' });
        } catch (error) { setLoginError('Credenciales incorrectas.'); }
    };
    const handleLogout = () => signOut(auth);

    // Catalog & Stock Handlers
    const handleAddServiceToCatalog = async (e) => { e.preventDefault(); if (await crmActions.addCatalogService(catalogForm)) setCatalogForm({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 }); };
    const handleAddPackageToCatalog = async (e) => { e.preventDefault(); if (await crmActions.addCatalogPackage(packageForm)) setPackageForm({ name: '', cost: '', slots: 2 }); };
    const handleEditCatalogService = (serviceId, updatedData) => crmActions.updateCatalogService(serviceId, updatedData);
    const handleGenerateStock = async (data) => {
        if (await crmActions.generateStock(data || stockForm)) {
            dispatch({ type: uiActionTypes.SET_STOCK_TAB, payload: 'manage' });
            setStockForm({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
        }
    };
    const handleStockServiceChange = (e) => {
        const f = catalog.find(s => s.name === e.target.value);
        setStockForm({ ...stockForm, service: f?.name || e.target.value, cost: f?.cost || 0, type: f?.type || 'Perfil', slots: f?.defaultSlots || 1 });
    };

    // Actions & Modals
    const handleConfirmActionWrapper = async () => {
        await crmActions.executeConfirmAction(confirmModal, sales, catalog);
        setConfirmModal({ show: false, id: null, type: null, title: '', msg: '', data: null });
    };
    const handleEditAccountCredentials = async (passwordOverride = null) => {
        const finalPass = typeof passwordOverride === 'string' ? passwordOverride : editAccountModal.newPass;
        if (!finalPass) return setNotification({ show: true, message: 'Contraseña vacía.', type: 'error' });
        await crmActions.editAccountCredentials(editAccountModal.email, editAccountModal.oldPass, finalPass);
        setEditAccountModal({ show: false, email: '', oldPass: '', newPass: '' });
    };
    const handleSaveEditClient = async (clientId, newData) => {
        if (clientManagement.updateClient) {
            const originalName = editClientModal.client ? editClientModal.client.name : null;
            await clientManagement.updateClient(clientId, newData, originalName);
        }
        setEditClientModal({ show: false, client: null });
    };

    // --- 🚀 FUNCIÓN GENÉRICA PARA GUARDAR (ACTUALIZADA: "PROPIA CARPETA DE NÚMEROS") ---
    const handleGenericSave = async (saleData) => {
        if (!user) return false;

        // 1. Guardar en CRM (Firestore Sales - Carpeta Privada del Usuario)
        const originalSale = sales.find(s => s.id === saleData.id);
        const success = await crmActions.processSale(saleData, originalSale, catalog, sales, 1, []); 

        // 2. Actualizar Portal del Cliente (AHORA DENTRO DE LA CARPETA DEL USUARIO)
        if (success && saleData.phone && saleData.phone.length > 5 && saleData.client !== 'LIBRE') {
            try {
                let cleanPhone = saleData.phone.trim().replace(/\D/g, '');
                if (cleanPhone.startsWith('09') && cleanPhone.length === 9) cleanPhone = '598' + cleanPhone.substring(1);
                else if (cleanPhone.startsWith('9') && cleanPhone.length === 8) cleanPhone = '598' + cleanPhone;
                
                // 👇 CAMBIO CLAVE: Usamos una subcolección dentro del usuario
                // Ruta: users/{uid}/client_portal/{telefono}
                const portalRef = doc(db, `users/${user.uid}/client_portal`, cleanPhone);
                
                const portalSnap = await getDoc(portalRef);
                let existingServices = portalSnap.exists() ? portalSnap.data().services : [];

                const newService = {
                    id: saleData.id || Date.now().toString(),
                    service: saleData.service,
                    type: saleData.type || 'Suscripción',
                    email: saleData.email,
                    pass: saleData.pass,
                    profile: saleData.profile || '',
                    pin: saleData.pin || '',
                    endDate: saleData.endDate,
                    lastCode: saleData.lastCode || '',
                    phone: cleanPhone // Guardamos el teléfono dentro para facilitar búsquedas futuras
                };

                const updatedServices = [
                    ...existingServices.filter(s => 
                        s.service !== newService.service || 
                        (s.service === newService.service && s.email !== newService.email)
                    ), 
                    newService
                ];

                await setDoc(portalRef, { 
                    client: saleData.client, // Aquí va "Juan Lalo" (Tu versión del nombre)
                    updatedAt: new Date(),
                    phone: cleanPhone,       // Indexable
                    services: updatedServices
                });
            } catch (err) {
                console.error("Error update portal:", err);
            }
        }
        return success;
    };

    // 🛡️ SALES HANDLER (Formulario Normal)
    const handleSaveSale = async (e) => {
        e.preventDefault(); 
        if (!user) return;

        if (formData.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(formData.client) && formData.client !== 'Admin') {
            await clientManagement.saveClientIfNew(formData.client, formData.phone);
        }
        
        let finalEndDate = formData.endDate;
        const EXEMPT = ['Admin', 'Actualizar', 'Caída', 'Dominio', 'EXPIRED', 'Vencido', 'Problemas', 'Garantía'];
        const isExempt = EXEMPT.some(status => formData.client.trim().toLowerCase() === status.toLowerCase());
        if (!finalEndDate && formData.client !== 'LIBRE' && !isExempt) {
            const d = new Date(); d.setDate(d.getDate() + 30); finalEndDate = d.toISOString().split('T')[0];
        }

        const dataToSave = { ...formData, endDate: finalEndDate };
        
        let success = false;
        if (formData.id) {
            success = await handleGenericSave(dataToSave);
        } else {
            const quantity = parseInt(formData.profilesToBuy || 1);
            const freeRows = sales.filter(s => s.email === formData.email && s.service === formData.service && s.client === 'LIBRE');
            success = await crmActions.processBatchSale(dataToSave, quantity, freeRows, bulkProfiles, catalog);
            
            if (success && quantity === 1) { 
                 await handleGenericSave(dataToSave); // Actualizar portal si es venta unitaria
            }
        }

        if (success) { setView('dashboard'); resetForm(); }
    };

    // Helpers
    const handleWhatsAppShare = (sale, actionType) => {
        if (sale.client === 'LIBRE') return;
        const related = sales.filter(s => s.email === sale.email && s.pass === sale.pass && s.client === sale.client && s.client !== 'LIBRE');
        sendWhatsApp(related.length > 1 ? related : [sale], actionType);
    };
    const resetForm = () => { setFormData({ id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1, lastCode: '' }); setBulkProfiles([{ profile: '', pin: '' }]); };
    const handleClientNameChange = (e) => {
        const name = e.target.value;
        const existing = clientManagement.allClients.find(c => c.name.toLowerCase() === name.toLowerCase());
        setFormData({ ...formData, client: name, phone: existing ? existing.phone : formData.phone });
    };
    const handleBulkProfileChange = (idx, field, val) => {
        const arr = [...bulkProfiles]; arr[idx][field] = val;
        if (field === 'profile') { const m = getClientPreviousProfiles.find(p => p.profile === val); if (m?.pin) arr[idx].pin = m.pin; }
        setBulkProfiles(arr);
    };
    const handleSingleProfileChange = (val) => {
        const m = getClientPreviousProfiles.find(p => p.profile === val);
        setFormData({ ...formData, profile: val, pin: m?.pin || formData.pin });
    };

    const triggerDeleteService = (id) => setConfirmModal({ show: true, id, type: 'delete_service', title: '¿Eliminar Servicio?', msg: 'Esta categoría desaparecerá.' });
    const triggerLiberate = (id) => setConfirmModal({ show: true, id, type: 'liberate', title: '¿Liberar Perfil?', msg: 'Los datos del cliente se borrarán.' });
    const triggerDeleteAccount = (d) => setConfirmModal({ show: true, type: 'delete_account', title: '¿Eliminar Cuenta?', msg: `Se eliminarán los perfiles de ${d.email}.`, data: d.ids });
    const triggerDeleteFreeStock = (email, pass) => {
        const ids = sales.filter(s => s.email === email && s.pass === pass && s.client === 'LIBRE').map(s => s.id);
        if (ids.length) setConfirmModal({ show: true, type: 'delete_free_stock', title: 'Limpiar Stock Libre', msg: `Se eliminarán ${ids.length} perfiles libres.`, data: ids });
        else setNotification({ show: true, message: 'No hay stock libre.', type: 'info' });
    };
    const triggerEditAccount = (d) => setEditAccountModal({ show: true, email: d.email, oldPass: d.pass, newPass: d.pass });
    const triggerOpenEditClient = (client) => setEditClientModal({ show: true, client });

    const setFilter = (k, v) => dispatch({ type: uiActionTypes.SET_FILTER, payload: { key: k, value: v } });
    const setView = (v) => dispatch({ type: uiActionTypes.SET_VIEW, payload: v });
    const setStockTab = (t) => dispatch({ type: uiActionTypes.SET_STOCK_TAB, payload: t });

    useEffect(() => {
        const c = parseInt(formData.profilesToBuy || 1);
        setBulkProfiles(prev => { const n = [...prev]; while (n.length < c) n.push({ profile: '', pin: '' }); return n.length > c ? n.slice(0, c) : n; });
    }, [formData.profilesToBuy]);

    // RENDER PRINCIPAL
    if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F2F2F7] dark:bg-gray-900"><Loader className="animate-spin text-blue-500" /></div>;

    if (view === 'portal') {
        return (
            <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#0B0F19]"><Loader className="text-indigo-500 animate-spin"/></div>}>
                <ClientPortal onBack={() => setView('login')} />
            </Suspense>
        );
    }

    if (!user) {
        return (
            <Suspense fallback={<div className="h-screen flex items-center justify-center"><Loader className="text-indigo-500 animate-spin"/></div>}>
                <LoginScreen
                    loginEmail={loginEmail} setLoginEmail={setLoginEmail}
                    loginPass={loginPass} setLoginPass={setLoginPass}
                    loginError={loginError} handleLogin={handleLogin}
                    onGoToPortal={() => setView('portal')} 
                />
            </Suspense>
        );
    }

    // VISTAS DEL ADMIN
    return (
        <MainLayout
            view={view} setView={setView} handleLogout={handleLogout}
            notification={notification} setNotification={setNotification}
            darkMode={darkMode} setDarkMode={setDarkMode}
            user={user} 
        >
            <datalist id="suggested-profiles">{getClientPreviousProfiles.map((p, i) => <option key={i} value={p.profile}>PIN: {p.pin}</option>)}</datalist>
            <datalist id="clients-suggestions">{clientManagement.allClients.map((c, i) => <option key={i} value={c.name} />)}</datalist>

            <ConfirmModal modal={confirmModal} onClose={() => setConfirmModal({ show: false })} onConfirm={handleConfirmActionWrapper} darkMode={darkMode} />
            {editAccountModal.show && <EditAccountModal modal={editAccountModal} setModal={setEditAccountModal} onConfirm={handleEditAccountCredentials} />}
            {editClientModal.show && <EditClientModal modal={editClientModal} setModal={setEditClientModal} onConfirm={handleSaveEditClient} darkMode={darkMode} />}

            <Suspense fallback={<div className="flex h-full items-center justify-center min-h-[60vh]"><Loader className="animate-spin text-indigo-500 w-10 h-10" /></div>}>
                {view === 'dashboard' && <Dashboard
                    sales={sales} filteredSales={filteredSales} catalog={sortedCatalog}
                    filterClient={filterClient} filterService={filterService} filterStatus={filterStatus} dateFrom={dateFrom} dateTo={dateTo} setFilter={setFilter}
                    totalItems={totalItems} 
                    totalFilteredMoney={moneyToShow} 
                    getStatusIcon={getStatusIcon} getStatusColor={getStatusColor} getDaysRemaining={getDaysRemaining}
                    NON_BILLABLE_STATUSES={NON_BILLABLE_STATUSES} sendWhatsApp={handleWhatsAppShare}
                    handleQuickRenew={(id) => { const s = sales.find(i => i.id === id); crmActions.quickRenew(id, s?.endDate); }}
                    triggerLiberate={triggerLiberate} setFormData={setFormData} setView={setView}
                    openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} setBulkProfiles={setBulkProfiles} loadingData={loadingData}
                    expiringToday={expiringToday} expiringTomorrow={expiringTomorrow} overdueSales={overdueSales}
                    darkMode={darkMode}
                    saveSale={handleGenericSave}
                    onMigrate={crmActions.migrateService}
                />}

                {view === 'config' && <Config
                    sales={sales}
                    catalog={sortedCatalog} catalogForm={catalogForm} setCatalogForm={setCatalogForm} packageForm={packageForm} setPackageForm={setPackageForm}
                    handleAddServiceToCatalog={handleAddServiceToCatalog} handleAddPackageToCatalog={handleAddPackageToCatalog}
                    handleEditCatalogService={handleEditCatalogService}
                    triggerDeleteService={triggerDeleteService} clientsDirectory={clientsDirectory} allClients={clientManagement.allClients}
                    triggerDeleteClient={clientManagement.triggerDeleteClient}
                    triggerEditClient={triggerOpenEditClient}
                    setNotification={setNotification} formData={formData} setFormData={setFormData}
                    darkMode={darkMode}
                />}

                {view === 'add_stock' && <StockManager
                    accountsInventory={accountsInventory} stockTab={stockTab} setStockTab={setStockTab} stockForm={stockForm} setStockForm={setStockForm} catalog={sortedCatalog}
                    handleStockServiceChange={handleStockServiceChange} handleGenerateStock={handleGenerateStock}
                    triggerDeleteAccount={triggerDeleteAccount} triggerDeleteFreeStock={triggerDeleteFreeStock} triggerEditAccount={triggerEditAccount}
                    darkMode={darkMode}
                />}

                {view === 'form' && <SaleForm
                    formData={formData} setFormData={setFormData} bulkProfiles={bulkProfiles} setBulkProfiles={setBulkProfiles}
                    allClients={clientManagement.allClients} packageCatalog={packageCatalog} 
                    maxAvailableSlots={sales} 
                    getClientPreviousProfiles={getClientPreviousProfiles} handleClientNameChange={handleClientNameChange}
                    handleBulkProfileChange={handleBulkProfileChange} handleSingleProfileChange={handleSingleProfileChange}
                    handleSaveSale={handleSaveSale} setView={setView} resetForm={resetForm} catalog={sortedCatalog}
                    darkMode={darkMode}
                />}
            </Suspense>
        </MainLayout>
    );
};

export default App;