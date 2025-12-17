// src/App.jsx
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
import { auth } from './firebase/config'; 
import { sendWhatsApp } from './utils/helpers'; 

// Layout y Vistas
import MainLayout from './layouts/MainLayout';
import ConfirmModal from './components/ConfirmModal';
import EditAccountModal from './components/EditAccountModal';
import LoginScreen from './views/LoginScreen';
import Dashboard from './views/Dashboard';
import StockManager from './views/StockManager';
import Config from './views/Config';
import SaleForm from './views/SaleForm';
import Toast from './components/Toast'; 

// Intentamos importar constantes, si falla usamos un fallback seguro
let NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Vencido', 'Cancelado', 'Problemas', 'Garantía'];
try {
    const constants = require('./config/constants');
    if (constants.NON_BILLABLE_STATUSES) NON_BILLABLE_STATUSES = constants.NON_BILLABLE_STATUSES;
} catch (e) {
    // Si no existe el archivo, usamos el array por defecto definido arriba
}

const App = () => {
    // 1. DATA & AUTH
    const { user, authLoading, sales, catalog, clientsDirectory, loadingData } = useDataSync();
    
    // 2. UI STATE & HELPERS
    const [uiState, dispatch] = useReducer(uiReducer, initialUiState);
    const { view, stockTab, filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;
    const [notification, setNotification] = useState({ show: true, message: '', type: 'success' }); 
    const [confirmModal, setConfirmModal] = useState({ show: false, id: null, type: null, title: '', msg: '', data: null });
    const [openMenuId, setOpenMenuId] = useState(null);
    const [editAccountModal, setEditAccountModal] = useState({ show: false, email: '', oldPass: '', newPass: '' });

    // 3. LOGIC HOOKS (El Cerebro)
    const crmActions = useCRMActions(user, setNotification);
    const clientManagement = useClientManagement(user, user ? `users/${user.uid}` : '', sales, clientsDirectory, setNotification);

    // 4. FORM STATES
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');
    const [loginError, setLoginError] = useState(''); 
    const [bulkProfiles, setBulkProfiles] = useState([{ profile: '', pin: '' }]);
    const [formData, setFormData] = useState({ id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1 });
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

    // --- HANDLERS SIMPLIFICADOS (Delegación) ---
    const handleLogin = async (e) => {
        e.preventDefault(); setLoginError('');
        try { await signInWithEmailAndPassword(auth, loginEmail, loginPass); setNotification({ show: true, message: '¡Bienvenido!', type: 'success' }); } 
        catch (error) { setLoginError('Error credenciales.'); }
    };
    const handleLogout = () => signOut(auth);

    // Acciones de Catálogo y Stock
    const handleAddServiceToCatalog = async (e) => { e.preventDefault(); if(await crmActions.addCatalogService(catalogForm)) setCatalogForm({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 }); };
    const handleAddPackageToCatalog = async (e) => { e.preventDefault(); if(await crmActions.addCatalogPackage(packageForm)) setPackageForm({ name: '', cost: '', slots: 2 }); };
    
    // Edición de Servicio del Catálogo (Restaurada)
    const handleEditCatalogService = async (serviceId, updatedData) => {
        return await crmActions.updateCatalogService(serviceId, updatedData);
    };

    const handleGenerateStock = async (data) => { if(await crmActions.generateStock(data || stockForm)) { dispatch({type:uiActionTypes.SET_STOCK_TAB, payload:'manage'}); setStockForm({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' }); }};
    
    // Acción Confirmar (Borrar/Liberar)
    const handleConfirmActionWrapper = async () => {
        await crmActions.executeConfirmAction(confirmModal, sales, catalog);
        setConfirmModal({ show: false, id: null, type: null, title: '', msg: '', data: null });
    };

    // Edición de Cuenta
    const handleEditAccountCredentials = async () => {
        if (!editAccountModal.newPass) return setNotification({ show: true, message: 'Contraseña vacía.', type: 'error' });
        await crmActions.editAccountCredentials(editAccountModal.email, editAccountModal.oldPass, editAccountModal.newPass, sales);
        setEditAccountModal({ show: false, email: '', oldPass: '', newPass: '' });
    };

    // --- EL GRAN HANDLER DE VENTA (Simplificado y Robusto) ---
    const handleSaveSale = async (e) => {
        e.preventDefault(); if (!user) return;
        
        // A. Guardar Cliente (si no es un estado especial)
        if (formData.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(formData.client) && formData.client !== 'Admin') {
            await clientManagement.saveClientIfNew(formData.client, formData.phone); 
        }

        // B. Calcular Vencimiento Default (LÓGICA MEJORADA) 🛡️
        let finalEndDate = formData.endDate;
        
        // Lista de clientes exentos de fecha automática
        const EXEMPT_FROM_AUTO_DATE = ['Admin', 'Actualizar', 'Caída', 'Dominio', 'EXPIRED', 'Vencido', 'Problemas', 'Garantía'];
        
        // Verificamos si el cliente actual es exento (insensible a mayúsculas)
        const isExempt = EXEMPT_FROM_AUTO_DATE.some(status => 
            formData.client.trim().toLowerCase() === status.toLowerCase()
        );

        // Solo asignamos 30 días automáticos si:
        // 1. No tiene fecha puesta
        // 2. NO es un espacio LIBRE
        // 3. NO es un cliente exento (Admin, Caída, etc)
        if (!finalEndDate && formData.client !== 'LIBRE' && !isExempt) {
            const d = new Date(); d.setDate(d.getDate() + 30); finalEndDate = d.toISOString().split('T')[0];
        }
        
        const dataToSave = { ...formData, endDate: finalEndDate };
        const quantity = parseInt(formData.profilesToBuy || 1);

        let success = false;

        // C. Delegar a crmActions
        if (formData.id) {
            // Venta Específica / Edición
            const originalSale = sales.find(s => s.id === formData.id);
            success = await crmActions.processSale(dataToSave, originalSale, catalog, sales, quantity, bulkProfiles);
        } else {
            // Venta Batch (Desde Stock Libre)
            const freeRows = sales.filter(s => s.email === formData.email && s.service === formData.service && s.client === 'LIBRE');
            success = await crmActions.processBatchSale(dataToSave, quantity, freeRows, bulkProfiles, catalog);
        }

        if (success) { setView('dashboard'); resetForm(); }
    };

    // --- UTILS UI ---
    const handleWhatsAppShare = (sale, actionType) => {
        if (sale.client === 'LIBRE') return; 
        const related = sales.filter(s => s.email === sale.email && s.pass === sale.pass && s.client === sale.client && s.client !== 'LIBRE');
        sendWhatsApp(related.length > 1 ? related : [sale], actionType);
    };
    
    // Triggers UI
    const triggerDeleteService = (id) => setConfirmModal({ show: true, id, type: 'delete_service', title: '¿Eliminar Servicio?', msg: 'Esta categoría desaparecerá.' });
    const triggerLiberate = (id) => setConfirmModal({ show: true, id, type: 'liberate', title: '¿Liberar Perfil?', msg: 'Los datos del cliente se borrarán.' });
    const triggerDeleteAccount = (d) => setConfirmModal({ show: true, type: 'delete_account', title: '¿Eliminar Cuenta?', msg: `Se eliminarán los perfiles de ${d.email}.`, data: d.ids });
    const triggerDeleteFreeStock = (email, pass) => {
        const ids = sales.filter(s => s.email === email && s.pass === pass && s.client === 'LIBRE').map(s => s.id);
        if(ids.length) setConfirmModal({ show: true, type: 'delete_free_stock', title: 'Limpiar Stock Libre', msg: `Se eliminarán ${ids.length} perfiles libres.`, data: ids });
        else setNotification({ show: true, message: 'No hay stock libre.', type: 'info' });
    };
    const triggerEditAccount = (d) => setEditAccountModal({ show: true, email: d.email, oldPass: d.pass, newPass: d.pass });

    // Form Helpers
    const handleClientNameChange = (e) => {
        const name = e.target.value; 
        const existing = clientManagement.allClients.find(c => c.name.toLowerCase() === name.toLowerCase());
        setFormData({ ...formData, client: name, phone: existing ? existing.phone : formData.phone });
    };
    const handleBulkProfileChange = (idx, field, val) => {
        const arr = [...bulkProfiles]; arr[idx][field] = val;
        if(field==='profile'){ const m = getClientPreviousProfiles.find(p=>p.profile===val); if(m?.pin) arr[idx].pin = m.pin; }
        setBulkProfiles(arr);
    };
    const handleSingleProfileChange = (val) => {
        const m = getClientPreviousProfiles.find(p => p.profile === val);
        setFormData({ ...formData, profile: val, pin: m?.pin || formData.pin });
    };
    const resetForm = () => { setFormData({ id: null, client: '', phone: '', service: '', endDate: '', email: '', pass: '', profile: '', pin: '', cost: '', type: 'Perfil', profilesToBuy: 1 }); setBulkProfiles([{ profile: '', pin: '' }]); };
    const handleStockServiceChange = (e) => { const f = catalog.find(s=>s.name===e.target.value); setStockForm({...stockForm, service: f?.name||e.target.value, cost: f?.cost||0, type: f?.type||'Perfil', slots: f?.defaultSlots||1}); };

    // Effects & Dispatchers
    useEffect(() => { 
        const c = parseInt(formData.profilesToBuy || 1);
        setBulkProfiles(prev => { const n = [...prev]; while(n.length < c) n.push({profile:'',pin:''}); return n.length > c ? n.slice(0, c) : n; });
    }, [formData.profilesToBuy]);

    const setFilter = (k, v) => dispatch({ type: uiActionTypes.SET_FILTER, payload: { key: k, value: v } });
    const setView = (v) => dispatch({ type: uiActionTypes.SET_VIEW, payload: v });
    const setStockTab = (t) => dispatch({ type: uiActionTypes.SET_STOCK_TAB, payload: t });

    if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F2F2F7]"><Loader className="animate-spin text-blue-500"/></div>;
    if (!user) return <><Toast notification={notification} setNotification={setNotification} /><LoginScreen loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginPass={loginPass} setLoginPass={setLoginPass} loginError={loginError} handleLogin={handleLogin}/></>;

    return (
        <MainLayout view={view} setView={setView} handleLogout={handleLogout} notification={notification} setNotification={setNotification}>
            <datalist id="suggested-profiles">{getClientPreviousProfiles.map((p, i) => <option key={i} value={p.profile}>PIN: {p.pin}</option>)}</datalist>
            <datalist id="clients-suggestions">{clientManagement.allClients.map((c, i) => <option key={i} value={c.name} />)}</datalist>

            <ConfirmModal modal={confirmModal} onClose={() => setConfirmModal({show:false})} onConfirm={handleConfirmActionWrapper} />
            {editAccountModal.show && <EditAccountModal modal={editAccountModal} setModal={setEditAccountModal} onConfirm={handleEditAccountCredentials} />}

            {view === 'dashboard' && <Dashboard 
                sales={sales} filteredSales={filteredSales} catalog={sortedCatalog}
                filterClient={filterClient} filterService={filterService} filterStatus={filterStatus} dateFrom={dateFrom} dateTo={dateTo} setFilter={setFilter}
                totalItems={totalItems} totalFilteredMoney={totalFilteredMoney}
                getStatusIcon={getStatusIcon} getStatusColor={getStatusColor} getDaysRemaining={getDaysRemaining}
                NON_BILLABLE_STATUSES={NON_BILLABLE_STATUSES} sendWhatsApp={handleWhatsAppShare} 
                handleQuickRenew={(id) => { const s = sales.find(i=>i.id===id); crmActions.quickRenew(id, s?.endDate); }} 
                triggerLiberate={triggerLiberate} setFormData={setFormData} setView={setView}
                openMenuId={openMenuId} setOpenMenuId={setOpenMenuId} setBulkProfiles={setBulkProfiles} loadingData={loadingData}
                expiringToday={expiringToday} expiringTomorrow={expiringTomorrow} overdueSales={overdueSales}
            />}

            {view === 'config' && <Config 
                catalog={sortedCatalog} catalogForm={catalogForm} setCatalogForm={setCatalogForm} packageForm={packageForm} setPackageForm={setPackageForm}
                handleAddServiceToCatalog={handleAddServiceToCatalog} handleAddPackageToCatalog={handleAddPackageToCatalog}
                handleEditCatalogService={handleEditCatalogService} 
                triggerDeleteService={triggerDeleteService} clientsDirectory={clientsDirectory} allClients={clientManagement.allClients} 
                triggerDeleteClient={clientManagement.triggerDeleteClient} triggerEditClient={clientManagement.triggerEditClient}
                setNotification={setNotification} formData={formData} setFormData={setFormData}
            />}

            {view === 'add_stock' && <StockManager
                accountsInventory={accountsInventory} stockTab={stockTab} setStockTab={setStockTab} stockForm={stockForm} setStockForm={setStockForm} catalog={sortedCatalog}
                handleStockServiceChange={handleStockServiceChange} handleGenerateStock={handleGenerateStock}
                triggerDeleteAccount={triggerDeleteAccount} triggerDeleteFreeStock={triggerDeleteFreeStock} triggerEditAccount={triggerEditAccount}
            />}

            {view === 'form' && <SaleForm
                formData={formData} setFormData={setFormData} bulkProfiles={bulkProfiles} setBulkProfiles={setBulkProfiles}
                allClients={clientManagement.allClients} packageCatalog={packageCatalog} maxAvailableSlots={maxAvailableSlots}
                getClientPreviousProfiles={getClientPreviousProfiles} handleClientNameChange={handleClientNameChange}
                handleBulkProfileChange={handleBulkProfileChange} handleSingleProfileChange={handleSingleProfileChange}
                handleSaveSale={handleSaveSale} setView={setView} resetForm={resetForm} catalog={sortedCatalog}
            />}
        </MainLayout>
    );
};

export default App;