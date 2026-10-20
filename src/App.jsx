import React, { useState, useReducer, useEffect, Suspense, lazy, useCallback } from 'react';
import { Loader } from 'lucide-react';

// Reducers y Hooks
import { initialUiState, uiReducer, uiActionTypes, VIEW_PATHS, viewFromPath } from './reducers/uiReducer';
import { useSalesData } from './hooks/useSalesData';
import { useDataSync } from './hooks/useDataSync';
import { useCRMActions } from './hooks/useCRMActions';
import { useClientManagement } from './hooks/useClientManagement';

// Firebase y Utils
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth, db } from './firebase/config';
import { doc, setDoc, getDoc } from 'firebase/firestore'; 
import { sendWhatsApp } from './utils/helpers';
import { sendViaBot } from './utils/botOutbox';
import { buildAccessMessage, buildRenewalMessage } from './utils/accessMessage';

// Layout y Componentes
import MainLayout from './layouts/MainLayout';
import ConfirmModal from './components/ConfirmModal';
import EditAccountModal from './components/EditAccountModal';
import EditClientModal from './components/EditClientModal';

// VISTAS (Lazy Loading)
const LoginScreen = lazy(() => import('./views/LoginScreen'));
const Dashboard = lazy(() => import('./views/Dashboard'));
const Config = lazy(() => import('./views/Config'));
const SaleForm = lazy(() => import('./views/SaleForm'));
const ClientPortal = lazy(() => import('./views/ClientPortal'));
const InventoryMaster = lazy(() => import('./views/InventoryMaster'));

// CONSTANTES
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Vencido', 'Cancelado', 'Problemas', 'Garantía', 'Admin'];

const App = () => {
    // 1. DATA & AUTH
    const { user, authLoading, sales, catalog, clientsDirectory, loadingData, totalRevenue, branding } = useDataSync();

    // 2. UI STATE
    const [uiState, dispatch] = useReducer(uiReducer, initialUiState);
    const { view, filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;

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
    const [catalogForm, setCatalogForm] = useState({ name: '', cost: '', type: 'Perfil', defaultSlots: 4, profileCapacity: 5 });
    const [packageForm, setPackageForm] = useState({ name: '', cost: '', slots: 2 });

    // 🤖 Enviar datos por el bot al registrar una venta (preferencia guardada en este navegador)
    const [autoSendData, setAutoSendDataState] = useState(() => {
        try { return localStorage.getItem('hm_autoSendData') !== 'false'; } catch { return true; }
    });
    const setAutoSendData = (value) => {
        setAutoSendDataState(value);
        try { localStorage.setItem('hm_autoSendData', String(value)); } catch { /* sin almacenamiento */ }
    };
    // 🤖 Avisar al cliente por el bot al renovar (con su próxima fecha)
    const [autoSendRenewal, setAutoSendRenewalState] = useState(() => {
        try { return localStorage.getItem('hm_autoSendRenewal') !== 'false'; } catch { return true; }
    });
    const setAutoSendRenewal = (value) => {
        setAutoSendRenewalState(value);
        try { localStorage.setItem('hm_autoSendRenewal', String(value)); } catch { /* sin almacenamiento */ }
    };

    // 5. COMPUTED DATA
    const {
        filteredSales, totalFilteredMoney, totalItems,
        getClientPreviousProfiles, maxAvailableSlots, packageCatalog,
        getStatusIcon, getStatusColor, getDaysRemaining,
        expiringToday, expiringTomorrow, overdueSales,
        getClientLoyalty
    } = useSalesData(sales, catalog, clientManagement.allClients, uiState, formData);

    const sortedCatalog = [...catalog].sort((a, b) => a.name.localeCompare(b.name));
    const hasActiveFilters = filterClient || (filterService && filterService !== 'Todos') || (filterStatus && filterStatus !== 'Todos') || dateFrom || dateTo;
    const moneyToShow = hasActiveFilters ? totalFilteredMoney : (totalRevenue || totalFilteredMoney);

    // --- HANDLERS ---
    const handleLogin = async (e) => {
        e.preventDefault(); setLoginError('');
        try {
            await signInWithEmailAndPassword(auth, loginEmail, loginPass);
            setNotification({ show: true, message: '¡Bienvenido!', type: 'success' });
        } catch (error) { setLoginError('Credenciales incorrectas.'); }
    };
    // Al volver a entrar se empieza en el Tablero, no en la última sección
    const handleLogout = () => { dispatch({ type: uiActionTypes.SET_VIEW, payload: 'dashboard' }); return signOut(auth); };

    const handleAddServiceToCatalog = async (e) => { e.preventDefault(); if (await crmActions.addCatalogService(catalogForm)) setCatalogForm({ name: '', cost: '', type: 'Perfil', defaultSlots: 4, profileCapacity: 5 }); };
    const handleAddPackageToCatalog = async (e) => { e.preventDefault(); if (await crmActions.addCatalogPackage(packageForm)) setPackageForm({ name: '', cost: '', slots: 2 }); };
    const handleEditCatalogService = (serviceId, updatedData) => crmActions.updateCatalogService(serviceId, updatedData);
    
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

    const handleClientNameChange = (e) => {
        const name = e.target.value;
        const lowerName = name.toLowerCase().trim();
        const SYSTEM_CLIENTS = ['admin', 'caída', 'caida', 'actualizar', 'dominio', 'garantía', 'garantia', 'problemas', 'vencido', 'cancelado', 'expired'];
        
        if (SYSTEM_CLIENTS.includes(lowerName)) {
             setFormData({ ...formData, client: name, phone: '' });
             return;
        }

        const existing = clientManagement.allClients.find(c => c.name.toLowerCase() === lowerName);
        setFormData({ ...formData, client: name, phone: existing ? existing.phone : '' });
    };

    const handleGenericSave = async (saleData) => {
        if (!user) return false;
        let originalSale = sales.find(s => s.id === saleData.id);
        if (!originalSale) originalSale = { ...saleData, type: saleData.type || 'Perfil' };

        const qty = parseInt(saleData.profilesToBuy || 1);
        let finalCost = Number(saleData.cost) || 0;
        const isPackage = saleData.service.toLowerCase().includes('paquete') || (saleData.type && saleData.type.toLowerCase() === 'paquete');
        if (qty > 1 && !isPackage) finalCost = finalCost * qty;

        const dataToProcess = { ...saleData, cost: finalCost };
        const success = await crmActions.processSale(dataToProcess, originalSale, catalog, sales, qty, bulkProfiles); 

        if (success && saleData.phone && saleData.phone.length > 5 && saleData.client !== 'LIBRE') {
            try {
                let cleanPhone = saleData.phone.trim().replace(/\D/g, '');
                if (cleanPhone.startsWith('09') && cleanPhone.length === 9) cleanPhone = '598' + cleanPhone.substring(1);
                else if (cleanPhone.startsWith('9') && cleanPhone.length === 8) cleanPhone = '598' + cleanPhone;
                
                const portalRef = doc(db, `users/${user.uid}/client_portal`, cleanPhone);
                const portalSnap = await getDoc(portalRef);
                let existingServices = portalSnap.exists() ? portalSnap.data().services : [];

                const newService = { id: saleData.id || Date.now().toString(), service: saleData.service, type: saleData.type || 'Suscripción', email: saleData.email, pass: saleData.pass, profile: saleData.profile || '', pin: saleData.pin || '', endDate: saleData.endDate, lastCode: saleData.lastCode || '', phone: cleanPhone };
                const updatedServices = [...existingServices.filter(s => s.id !== newService.id), newService];
                await setDoc(portalRef, { client: saleData.client, updatedAt: new Date(), phone: cleanPhone, services: updatedServices });
            } catch (err) { console.error("Error portal:", err); }
        }
        return success;
    };

    const handleSaveSale = async (e) => {
        e.preventDefault(); 
        if (!user) return;

        if (formData.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(formData.client) && formData.client !== 'Admin') {
            await clientManagement.saveClientIfNew(formData.client, formData.phone);
        }
        
        let finalEndDate = formData.endDate;
        const EXEMPT = ['Admin', 'Actualizar', 'Caída', 'Dominio', 'EXPIRED', 'Vencido', 'Problemas', 'Garantía'];
        const isExempt = EXEMPT.some(status => formData.client.trim().toLowerCase() === status.toLowerCase());

        // 🧠 FECHA SEGURA 2.0: Sin bug de febrero Y sin bug de zona horaria (UTC)
        if (!finalEndDate && formData.client !== 'LIBRE' && !isExempt) {
            const now = new Date();
            const currentDay = now.getDate();
            
            // 1. Sumamos el mes
            now.setMonth(now.getMonth() + 1);
            
            // 2. Corrección "30 de febrero": Si el día cambió, volvemos al último día válido
            if (now.getDate() !== currentDay) {
                now.setDate(0); 
            }

            // 3. ✅ CORRECCIÓN UTC: Usamos componentes locales para evitar el cambio de día después de las 7 PM
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0'); // Meses van de 0 a 11
            const day = String(now.getDate()).padStart(2, '0');
            
            finalEndDate = `${year}-${month}-${day}`;
        }

        const dataToSave = { ...formData, endDate: finalEndDate };
        const quantity = parseInt(formData.profilesToBuy || 1);
        let success = false;

        // 🤖 ¿Es una venta nueva a un cliente real? (stock libre -> cliente). Se decide ANTES de guardar.
        const originalSale = formData.id ? sales.find(s => s.id === formData.id) : null;
        const FREE = ['', 'libre', 'espacio libre', 'disponible'];
        const wasFree = !originalSale || FREE.includes((originalSale.client || '').trim().toLowerCase());
        const clientLower = (formData.client || '').trim().toLowerCase();
        const isRealClient = clientLower && !FREE.includes(clientLower) && clientLower !== 'admin' && !isExempt
            && !NON_BILLABLE_STATUSES.some(s => String(s).toLowerCase() === clientLower);
        const shouldAutoSend = autoSendData && formData.id && wasFree && isRealClient && (formData.phone || '').replace(/\D/g, '').length > 5;
        
        // 🛡️ Toda venta parte de un perfil o cuenta que ya existe (Asignar / Editar).
        // Sin id no hay dónde guardarla: avisamos en vez de fingir que se guardó.
        if (!formData.id) {
            setNotification({ show: true, message: 'No se pudo guardar: asigna la venta desde un perfil o cuenta del stock (Tablero o Bóveda).', type: 'error' });
            return;
        }
        success = await handleGenericSave(dataToSave);

        if (success) {
            if (shouldAutoSend) autoSendAccessData(dataToSave, quantity);
            setView('dashboard'); resetForm();
        }
    };

    // 🤖 ENVÍO AUTOMÁTICO DE DATOS AL REGISTRAR UNA VENTA (en segundo plano, no bloquea el formulario)
    const autoSendAccessData = async (saleData, quantity) => {
        const catalogItem = catalog.find(c => c.name === saleData.service);
        const isFull = catalogItem?.type === 'Cuenta' || /completa/i.test(saleData.service || '');
        const profiles = (!isFull && quantity > 1)
            ? bulkProfiles.slice(0, quantity).map((p, i) => ({ profile: p.profile || `Perfil ${i + 1}`, pin: p.pin || '' }))
            : null;
        const single = { profile: bulkProfiles[0]?.profile || saleData.profile || '', pin: bulkProfiles[0]?.pin || saleData.pin || '' };
        const message = buildAccessMessage({ ...saleData, ...single, type: isFull ? 'Cuenta' : (saleData.type || 'Perfil') }, profiles);

        try {
            const result = await sendViaBot({ uid: user.uid, phone: saleData.phone, text: message, saleId: saleData.id, kind: 'data-auto' });
            if (result.status === 'sent') {
                setNotification({ show: true, message: `Venta guardada y datos enviados a ${saleData.client} ✅`, type: 'success' });
            } else {
                const reason = result.status === 'error' ? result.error : 'El bot no respondió.';
                setNotification({ show: true, message: `Venta guardada, pero no se enviaron los datos: ${reason} Usa el 🔒 para reenviar.`, type: 'error' });
            }
        } catch (err) {
            console.error('Error en envío automático:', err);
            setNotification({ show: true, message: 'Venta guardada, pero no se enviaron los datos. Usa el 🔒 para reenviar.', type: 'error' });
        }
    };

    // ⚡ CALLBACK: Optimizado para no renderizar Dashboard en cada letra
    // El Tablero pasa la venta completa (o un id): se acepta cualquiera de los dos
    const handleDashboardRenew = useCallback(async (saleOrId) => {
        const sale = typeof saleOrId === 'string' ? sales.find(i => i.id === saleOrId) : saleOrId;
        if (!sale) return;
        const newEndDate = await crmActions.quickRenew(sale);
        if (!newEndDate || !autoSendRenewal || !user) return;

        // 🤖 Mensaje de renovación con la próxima fecha (solo clientes reales con celular)
        const clientLower = (sale.client || '').trim().toLowerCase();
        const isRealClient = clientLower && !['libre', 'espacio libre', 'disponible', 'admin'].includes(clientLower)
            && !NON_BILLABLE_STATUSES.some(s => String(s).toLowerCase() === clientLower);
        if (!isRealClient || (sale.phone || '').replace(/\D/g, '').length <= 5) return;

        try {
            const text = buildRenewalMessage(sale, newEndDate, branding?.name || 'HM Digital');
            const result = await sendViaBot({ uid: user.uid, phone: sale.phone, text, saleId: sale.id, kind: 'renewal' });
            if (result.status === 'sent') {
                setNotification({ show: true, message: `Renovado y aviso enviado a ${sale.client} ✅`, type: 'success' });
            } else {
                const reason = result.status === 'error' ? result.error : 'El bot no respondió.';
                setNotification({ show: true, message: `Renovado, pero no se envió el aviso: ${reason}`, type: 'error' });
            }
        } catch (err) {
            console.error('Error enviando aviso de renovación:', err);
            setNotification({ show: true, message: 'Renovado, pero no se envió el aviso al cliente.', type: 'error' });
        }
    }, [sales, crmActions, autoSendRenewal, user, branding]);

    const handleWhatsAppShare = (sale, actionType) => {
        if (sale.client === 'LIBRE') return;
        const related = sales.filter(s => s.email === sale.email && s.pass === sale.pass && s.client === sale.client && s.client !== 'LIBRE');
        sendWhatsApp(related.length > 1 ? related : [sale], actionType);
    };

    const resetForm = () => { 
        setFormData({ id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1, lastCode: '' }); 
        setBulkProfiles([{ profile: '', pin: '' }]); 
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

    const triggerDeleteService = (id) => {
        // No permitir borrar un servicio/paquete que tenga ventas o stock asociados
        const item = catalog.find(c => c.id === id);
        const inUse = item ? sales.filter(s => s.service === item.name) : [];
        if (inUse.length > 0) {
            const sold = inUse.filter(s => s.client !== 'LIBRE').length;
            const free = inUse.length - sold;
            setNotification({ show: true, message: `No se puede eliminar "${item.name}": tiene ${sold} vendidos y ${free} libres en stock.`, type: 'error' });
            return;
        }
        setConfirmModal({ show: true, id, type: 'delete_service', title: '¿Eliminar Servicio?', msg: 'Esta categoría desaparecerá.' });
    };
    const triggerLiberate = (id) => setConfirmModal({ show: true, id, type: 'liberate', title: '¿Liberar Perfil?', msg: 'Los datos del cliente se borrarán.' });
    const triggerDeleteAccount = (d) => setConfirmModal({ show: true, type: 'delete_account', title: '¿Eliminar Cuenta?', msg: `Se eliminarán los perfiles de ${d.email}.`, data: d.ids });
    const triggerEditAccount = (d) => setEditAccountModal({ show: true, email: d.email, oldPass: d.pass, newPass: d.pass });
    const triggerOpenEditClient = (client) => setEditClientModal({ show: true, client });

    const setFilter = (k, v) => dispatch({ type: uiActionTypes.SET_FILTER, payload: { key: k, value: v } });
    const setView = (v) => dispatch({ type: uiActionTypes.SET_VIEW, payload: v });

    // URL ↔ vista del menú: la URL refleja la vista (/boveda...) y Atrás/Adelante cambian de vista.
    // Sin sesión la URL queda en "/" (se espera a authLoading para no perder la ruta al recargar)
    useEffect(() => {
        if (authLoading) return;
        const path = user ? VIEW_PATHS[view] : '/';
        if (!path || window.location.pathname === path) return;
        if (user) window.history.pushState(null, '', path);
        else window.history.replaceState(null, '', path);
    }, [view, user, authLoading]);
    useEffect(() => {
        const onPopState = () => setView(viewFromPath());
        window.addEventListener('popstate', onPopState);
        return () => window.removeEventListener('popstate', onPopState);
    }, []);

    useEffect(() => {
        const c = parseInt(formData.profilesToBuy || 1);
        setBulkProfiles(prev => { const n = [...prev]; while (n.length < c) n.push({ profile: '', pin: '' }); return n.length > c ? n.slice(0, c) : n; });
    }, [formData.profilesToBuy]);

    if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F2F2F7] dark:bg-gray-900"><Loader className="animate-spin text-blue-500" /></div>;

    if (view === 'portal') return <Suspense fallback={<Loader className="animate-spin"/>}><ClientPortal onBack={() => setView('login')} /></Suspense>;

    if (!user) return <Suspense fallback={<Loader className="animate-spin"/>}><LoginScreen loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginPass={loginPass} setLoginPass={setLoginPass} loginError={loginError} handleLogin={handleLogin} onGoToPortal={() => setView('portal')} /></Suspense>;

    return (
        <MainLayout view={view} setView={setView} handleLogout={handleLogout} notification={notification} setNotification={setNotification} darkMode={darkMode} setDarkMode={setDarkMode} user={user} branding={branding}>
            <datalist id="suggested-profiles">{getClientPreviousProfiles.map((p, i) => <option key={i} value={p.profile}>PIN: {p.pin}</option>)}</datalist>
            <datalist id="clients-suggestions">{clientManagement.allClients.map((c, i) => <option key={i} value={c.name} />)}</datalist>
            <ConfirmModal modal={confirmModal} onClose={() => setConfirmModal({ show: false })} onConfirm={handleConfirmActionWrapper} darkMode={darkMode} />
            {editAccountModal.show && <EditAccountModal modal={editAccountModal} setModal={setEditAccountModal} onConfirm={handleEditAccountCredentials} />}
            {editClientModal.show && <EditClientModal modal={editClientModal} setModal={setEditClientModal} onConfirm={handleSaveEditClient} darkMode={darkMode} />}

            <Suspense fallback={<div className="flex h-full items-center justify-center min-h-[60vh]"><Loader className="animate-spin text-indigo-500 w-10 h-10" /></div>}>
                {view === 'dashboard' && <Dashboard sales={sales} filteredSales={filteredSales} catalog={sortedCatalog} filterClient={filterClient} filterService={filterService} filterStatus={filterStatus} dateFrom={dateFrom} dateTo={dateTo} setFilter={setFilter} totalItems={totalItems} totalFilteredMoney={moneyToShow} getStatusIcon={getStatusIcon} getStatusColor={getStatusColor} getDaysRemaining={getDaysRemaining} NON_BILLABLE_STATUSES={NON_BILLABLE_STATUSES} sendWhatsApp={handleWhatsAppShare} handleQuickRenew={handleDashboardRenew} triggerLiberate={triggerLiberate} setFormData={setFormData} setView={setView} openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} setBulkProfiles={setBulkProfiles} loadingData={loadingData} expiringToday={expiringToday} expiringTomorrow={expiringTomorrow} overdueSales={overdueSales} darkMode={darkMode} saveSale={handleSaveSale} onMigrate={crmActions.migrateService} getClientLoyalty={getClientLoyalty} setNotification={setNotification} />}
                {view === 'inventory' && <InventoryMaster sales={sales} catalog={sortedCatalog} darkMode={darkMode} setFormData={setFormData} setView={setView} user={user} setNotification={setNotification} />}
                {view === 'config' && <Config sales={sales} catalog={sortedCatalog} catalogForm={catalogForm} setCatalogForm={setCatalogForm} packageForm={packageForm} setPackageForm={setPackageForm} handleAddServiceToCatalog={handleAddServiceToCatalog} handleAddPackageToCatalog={handleAddPackageToCatalog} handleEditCatalogService={handleEditCatalogService} triggerDeleteService={triggerDeleteService} clientsDirectory={clientsDirectory} allClients={clientManagement.allClients} triggerDeleteClient={clientManagement.triggerDeleteClient} triggerEditClient={triggerOpenEditClient} setNotification={setNotification} formData={formData} setFormData={setFormData} darkMode={darkMode} user={user} branding={branding} autoSendData={autoSendData} setAutoSendData={setAutoSendData} autoSendRenewal={autoSendRenewal} setAutoSendRenewal={setAutoSendRenewal} />}
                {view === 'form' && <SaleForm formData={formData} setFormData={setFormData} bulkProfiles={bulkProfiles} setBulkProfiles={setBulkProfiles} allClients={clientManagement.allClients} packageCatalog={packageCatalog} maxAvailableSlots={sales} getClientPreviousProfiles={getClientPreviousProfiles} handleClientNameChange={handleClientNameChange} handleBulkProfileChange={handleBulkProfileChange} handleSingleProfileChange={handleSingleProfileChange} handleSaveSale={handleSaveSale} setView={setView} resetForm={resetForm} catalog={sortedCatalog} darkMode={darkMode} autoSendData={autoSendData} setAutoSendData={setAutoSendData} />}
            </Suspense>
        </MainLayout>
    );
};

export default App;