import React, { useState, useReducer, useEffect } from 'react';
import { Loader } from 'lucide-react'; 

// Reducers y Hooks
import { initialUiState, uiReducer, uiActionTypes } from './reducers/uiReducer'; 
import { useSalesData } from './hooks/useSalesData';
import { useDataSync } from './hooks/useDataSync'; 
import { useCRMActions } from './hooks/useCRMActions';
import { useClientManagement } from './hooks/useClientManagement'; 

// Firebase y Utils
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'; 
import { doc, updateDoc } from 'firebase/firestore'; 
import { auth, db } from './firebase/config'; 
import { sendWhatsApp, findIndividualServiceName } from './utils/helpers'; 

// Layout y Componentes
import MainLayout from './layouts/MainLayout';
import ConfirmModal from './components/ConfirmModal';
import LoginScreen from './components/LoginScreen';
import Dashboard from './views/Dashboard';
import StockManager from './views/StockManager';
import Config from './views/Config';
import SaleForm from './views/SaleForm';
import Toast from './components/Toast'; 

const App = () => {
    // 1. DATA & AUTH
    const { user, authLoading, sales, catalog, clientsDirectory, loadingData } = useDataSync();
    const userPath = user ? `users/${user.uid}` : '';
    
    // 2. UI STATE
    const [uiState, dispatch] = useReducer(uiReducer, initialUiState);
    const { view, stockTab, filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;
    const [notification, setNotification] = useState({ show: true, message: '', type: 'success' }); 
    const [confirmModal, setConfirmModal] = useState({ show: false, id: null, type: null, title: '', msg: '' });
    const [openMenuId, setOpenMenuId] = useState(null);

    // 3. ACTION HOOKS Y CLIENT MANAGEMENT
    const crmActions = useCRMActions(user, userPath, setNotification);
    const clientManagement = useClientManagement(user, userPath, sales, clientsDirectory, setNotification);

    const { 
        allClients, 
        saveClientIfNew, 
        triggerDeleteClient, 
        triggerEditClient 
    } = clientManagement;

    const { 
        addCatalogService, 
        addCatalogPackage, 
        generateStock,
        executeConfirmAction
    } = crmActions;

    // 4. FORM STATES
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState(''); 
    const [importStatus, setImportStatus] = useState(''); 
    
    const [bulkProfiles, setBulkProfiles] = useState([{ profile: '', pin: '' }]);
    const [formData, setFormData] = useState({
        id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1,
    });
    const [stockForm, setStockForm] = useState({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
    const [catalogForm, setCatalogForm] = useState({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
    const [packageForm, setPackageForm] = useState({ name: '', cost: '', slots: 2 });
    
    // 5. COMPUTED DATA
    const {
        filteredSales, totalFilteredMoney, totalItems, NON_BILLABLE_STATUSES,
        getClientPreviousProfiles, maxAvailableSlots, 
        accountsInventory, packageCatalog,
        getStatusIcon, getStatusColor, getDaysRemaining,
        // ✅ PASO 2: IMPORTAMOS LAS NUEVAS LISTAS DE useSalesData
        expiringToday, 
        expiringTomorrow,
        overdueSales
    } = useSalesData(sales, catalog, allClients, uiState, formData); 

    // Catálogo Ordenado Alfabéticamente (usado en props)
    const sortedCatalog = [...catalog].sort((a, b) => a.name.localeCompare(b.name)); 
    
    // --- HANDLERS SIMPLIFICADOS ---

    const handleLogin = async (e) => {
        e.preventDefault(); setLoginError('');
        try { await signInWithEmailAndPassword(auth, loginEmail, loginPass); setNotification({ show: true, message: '¡Bienvenido!', type: 'success' }); } 
        catch (error) { setLoginError('Error credenciales.'); }
    };
    const handleLogout = () => signOut(auth);

    const handleAddServiceToCatalog = async (e) => {
        e.preventDefault();
        const success = await addCatalogService(catalogForm); 
        if (success) setCatalogForm({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
    };

    const handleAddPackageToCatalog = async (e) => {
        e.preventDefault();
        const success = await addCatalogPackage(packageForm);
        if (success) setPackageForm({ name: '', cost: '', slots: 2 });
    };

    const handleEditCatalogService = async (serviceId, updatedData) => {
        if (!user || !serviceId) return;
        try {
            await updateDoc(doc(db, userPath, 'catalog', serviceId), updatedData);
            setNotification({ show: true, message: 'Servicio de catálogo actualizado.', type: 'success' });
            return true;
        } catch (error) {
            setNotification({ show: true, message: 'Error al actualizar servicio.', type: 'error' });
            console.error(error);
            return false;
        }
    };
    
    const handleGenerateStock = async (e) => {
        e.preventDefault();
        const success = await generateStock(stockForm);
        if (success) {
            setStockTab('manage');
            setStockForm({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
        }
    };

    const handleConfirmActionWrapper = async () => {
        const success = await executeConfirmAction(confirmModal, sales, catalog);
        if (success || !success) setConfirmModal({ show: false, id: null, type: null, title: '', msg: '', data: null });
    };

    // --- ACCIONES COMPLEJAS CON LÓGICA DE NEGOCIO ---

    const handleSaveSale = async (e) => {
        e.preventDefault(); if (!user) return;
        
        if (formData.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(formData.client) && formData.client !== 'Admin') {
            await saveClientIfNew(formData.client, formData.phone); 
        }

        const isSingleEdit = formData.client !== 'LIBRE' && formData.id && (!formData.profilesToBuy || formData.profilesToBuy === 1);
        const quantity = parseInt(formData.profilesToBuy || 1);
        const costPerProfile = (quantity > 1) ? Number(formData.cost / quantity).toFixed(2) : Number(formData.cost).toFixed(2);
        
        // --- A. EDICIÓN / FRAGMENTACIÓN SIMPLE ---
        if (isSingleEdit) {
            const originalSale = sales.find(s => s.id === formData.id);
            
            if (originalSale && originalSale.type === 'Cuenta' && (formData.type === 'Perfil' || formData.client !== 'LIBRE')) {
                if (window.confirm("⚠️ ESTÁS VENDIENDO UNA CUENTA COMPLETA.\n\n¿Deseas fragmentarla y generar los cupos libres automáticamente?")) {
                    
                    const targetServiceName = findIndividualServiceName(originalSale.service, catalog);
                    // ... (Lógica de fragmentación y commit del batch) ...

                    setNotification({ show: true, message: `Cuenta fragmentada.`, type: 'success' }); 
                    setView('dashboard'); resetForm(); return;
                }
            }
            await updateDoc(doc(db, userPath, 'sales', formData.id), { 
                ...formData, 
                cost: costPerProfile
            }); 
            setNotification({ show: true, message: 'Venta actualizada.', type: 'success' });
            setView('dashboard'); resetForm(); return;
        }

        // --- B. VENTA MÚLTIPLE (FRAGMENTACIÓN AUTOMÁTICA) ---
        let freeRows = sales.filter(s => s.email === formData.email && s.client === 'LIBRE'); 
        
        if (freeRows.length === 1 && freeRows[0].type === 'Cuenta' && quantity > 1) {
            const accountCard = freeRows[0];
            const totalSlots = catalog.find(c => c.name === accountCard.service)?.defaultSlots || 4; 
            
            if (totalSlots >= quantity) { 
                if (window.confirm(`⚠️ Esta es una CUENTA COMPLETA.\n\n¿Fragmentar automáticamente en ${totalSlots} perfiles?`)) {
                    const targetServiceName = findIndividualServiceName(accountCard.service, catalog);

                    // ... (Lógica de creación de perfiles y commit del batch) ...

                    setNotification({ show: true, message: 'Cuenta fragmentada. Confirma la venta de nuevo.', type: 'success' });
                    return; 
                 } else { return; } 
            }
        }

        if (quantity > freeRows.length) { 
            setNotification({ show: true, message: `Error: Solo quedan ${freeRows.length} perfiles libres.`, type: 'error' });
            return; 
        }

        // ... (Lógica de venta múltiple final y commit del batch) ...
        setNotification({ show: true, message: `¡Venta de ${quantity} perfiles guardada!`, type: 'success' });
        setView('dashboard'); resetForm();
    };

    const handleQuickRenew = async (id) => {
        const sale = sales.find(s => s.id === id);
        if (sale && sale.endDate) {
            try {
                // ... (Lógica de manipulación de fechas y updateDoc) ...
                setNotification({ show: true, message: 'Renovado (30 días).', type: 'success' });
            } catch (error) { setNotification({ show: true, message: 'Error al renovar.', type: 'error' }); }
        }
    };

    const handleImportCSV = (event, type) => {
        console.log("Lógica de importación CSV ejecutada.");
    };

    // --- TRIGGERS DEL MODAL ---
    const triggerDeleteService = (id) => { setConfirmModal({ show: true, id: id, type: 'delete_service', title: '¿Eliminar Servicio?', msg: 'Esta categoría desaparecerá del catálogo.' }); };
    const triggerLiberate = (id) => { setConfirmModal({ show: true, id: id, type: 'liberate', title: '¿Liberar Perfil?', msg: 'Los datos del cliente se borrarán.' }); };
    const triggerDeleteAccount = (accountData) => { setConfirmModal({ show: true, type: 'delete_account', title: '¿Eliminar Cuenta?', msg: `Se eliminarán los perfiles de ${accountData.email}.`, data: accountData.ids }); };
    
    // --- MANEJO DEL FORMULARIO ---
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

    useEffect(() => { 
        const count = parseInt(formData.profilesToBuy || 1);
        setBulkProfiles(prev => {
            const newArr = [...prev];
            if (newArr.length < count) while(newArr.length < count) newArr.push({ profile: '', pin: '' });
            else if (newArr.length > count) return newArr.slice(0, count);
            return newArr;
        });
    }, [formData.profilesToBuy, formData.client, formData.id]);

    const setFilter = (key, value) => dispatch({ type: uiActionTypes.SET_FILTER, payload: { key, value } });
    const setView = (newView) => dispatch({ type: uiActionTypes.SET_VIEW, payload: newView });
    const setStockTab = (newTab) => dispatch({ type: uiActionTypes.SET_STOCK_TAB, payload: newTab });

    // --- RENDERIZADO ---

    if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F2F2F7]"><Loader className="animate-spin text-blue-500"/></div>;

    if (!user) return <><Toast notification={notification} setNotification={setNotification} /><LoginScreen loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginPass={loginPass} setLoginPass={setLoginPass} loginError={loginError} handleLogin={handleLogin}/></>;

    return (
        <MainLayout view={view} setView={setView} handleLogout={handleLogout} notification={notification} setNotification={setNotification}>
            
            <datalist id="suggested-profiles">{getClientPreviousProfiles.map((p, i) => <option key={i} value={p.profile}>PIN: {p.pin}</option>)}</datalist>
            <datalist id="clients-suggestions">{allClients.map((c, i) => <option key={i} value={c.name} />)}</datalist>

            <ConfirmModal modal={confirmModal} onClose={() => setConfirmModal({show:false})} onConfirm={() => handleConfirmActionWrapper()} />

            {view === 'dashboard' && <Dashboard 
                sales={sales} filteredSales={filteredSales} catalog={sortedCatalog}
                filterClient={filterClient} filterService={filterService} filterStatus={filterStatus} dateFrom={dateFrom} dateTo={dateTo} setFilter={setFilter}
                totalItems={totalItems} totalFilteredMoney={totalFilteredMoney}
                getStatusIcon={getStatusIcon} getStatusColor={getStatusColor} getDaysRemaining={getDaysRemaining}
                NON_BILLABLE_STATUSES={NON_BILLABLE_STATUSES} 
                sendWhatsApp={(sale, actionType) => sendWhatsApp(sale, catalog, sales, actionType)}
                handleQuickRenew={handleQuickRenew}
                triggerLiberate={triggerLiberate}
                setFormData={setFormData} setView={setView}
                openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
                setBulkProfiles={setBulkProfiles} loadingData={loadingData}
                // ✅ PASO 3: PASAMOS LAS LISTAS MEMORIZADAS AL DASHBOARD
                expiringToday={expiringToday}
                expiringTomorrow={expiringTomorrow}
                overdueSales={overdueSales}
            />}

            {view === 'config' && <Config 
                catalog={sortedCatalog} catalogForm={catalogForm} setCatalogForm={setCatalogForm}
                packageForm={packageForm} setPackageForm={setPackageForm}
                handleAddServiceToCatalog={handleAddServiceToCatalog}
                handleAddPackageToCatalog={handleAddPackageToCatalog}
                handleEditCatalogService={handleEditCatalogService}
                handleImportCSV={handleImportCSV} importStatus={importStatus}
                triggerDeleteService={triggerDeleteService}
                clientsDirectory={clientsDirectory} allClients={allClients} 
                triggerDeleteClient={triggerDeleteClient} 
                triggerEditClient={triggerEditClient}
                setNotification={setNotification} formData={formData} setFormData={setFormData}
            />}

            {view === 'add_stock' && <StockManager
                accountsInventory={accountsInventory} stockTab={stockTab} setStockTab={setStockTab}
                stockForm={stockForm} setStockForm={setStockForm} catalog={sortedCatalog}
                handleStockServiceChange={handleStockServiceChange}
                handleGenerateStock={handleGenerateStock}
                triggerDeleteAccount={triggerDeleteAccount}
            />}

            {view === 'form' && <SaleForm
                formData={formData} setFormData={setFormData}
                bulkProfiles={bulkProfiles} setBulkProfiles={setBulkProfiles}
                allClients={allClients} packageCatalog={packageCatalog} maxAvailableSlots={maxAvailableSlots}
                getClientPreviousProfiles={getClientPreviousProfiles}
                handleClientNameChange={handleClientNameChange}
                handleBulkProfileChange={handleBulkProfileChange}
                handleSingleProfileChange={handleSingleProfileChange}
                handleSaveSale={handleSaveSale}
                setView={setView} resetForm={resetForm} catalog={sortedCatalog}
            />}
        </MainLayout>
    );
};

export default App;