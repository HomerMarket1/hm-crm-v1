// src/App.jsx (VERSIÓN FINAL MAESTRA - CONEXIÓN DE FRAGMENTACIÓN)

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
import { doc, updateDoc, writeBatch } from 'firebase/firestore'; 
import { auth, db } from './firebase/config'; 
import { sendWhatsApp } from './utils/helpers'; 

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
    
    // 2. UI STATE
    const [uiState, dispatch] = useReducer(uiReducer, initialUiState);
    const { view, stockTab, filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;
    const [notification, setNotification] = useState({ show: true, message: '', type: 'success' }); 
    const [confirmModal, setConfirmModal] = useState({ show: false, id: null, type: null, title: '', msg: '' });
    const [openMenuId, setOpenMenuId] = useState(null);

    // 3. ACTION HOOKS
    const crmActions = useCRMActions(user, setNotification);
    
    // ✅ IMPORTANTE: Extraemos handleSave para usarlo en el botón de guardar
    const { 
        addCatalogService, 
        addCatalogPackage, 
        generateStock, 
        executeConfirmAction,
        handleSave 
    } = crmActions;
    
    const userPath = user ? `users/${user.uid}` : ''; 
    const clientManagement = useClientManagement(user, userPath, sales, clientsDirectory, setNotification);

    const { 
        allClients, 
        saveClientIfNew, 
        triggerDeleteClient, 
        triggerEditClient 
    } = clientManagement;

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
        expiringToday, expiringTomorrow, overdueSales
    } = useSalesData(sales, catalog, allClients, uiState, formData); 

    const sortedCatalog = [...catalog].sort((a, b) => a.name.localeCompare(b.name)); 
    
    // --- HANDLERS BÁSICOS ---

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
            setNotification({ show: true, message: 'Servicio actualizado.', type: 'success' });
            return true;
        } catch (error) {
            setNotification({ show: true, message: 'Error al actualizar.', type: 'error' });
            console.error(error);
            return false;
        }
    };
    
    const handleGenerateStock = async (dataFromChild) => {
        const dataToSubmit = (dataFromChild && dataFromChild.service) ? dataFromChild : stockForm;
        const success = await generateStock(dataToSubmit);
        if (success) {
            setStockTab('manage');
            setStockForm({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
        }
    };

    const handleConfirmActionWrapper = async () => {
        const success = await executeConfirmAction(confirmModal, sales, catalog);
        setConfirmModal({ show: false, id: null, type: null, title: '', msg: '', data: null });
    };

    // --- LÓGICA DE VENTAS (AQUÍ ESTABA EL CAMBIO CLAVE) ---

    const handleSaveSale = async (e) => {
        e.preventDefault(); 
        if (!user) return;
        
        // 1. Guardar cliente si es nuevo
        if (formData.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(formData.client) && formData.client !== 'Admin') {
            await saveClientIfNew(formData.client, formData.phone); 
        }

        const quantity = parseInt(formData.profilesToBuy || 1);
        
        // Calcular costo
        const totalCost = Number(formData.cost) || 0;
        const costPerProfile = (quantity > 1) ? (totalCost / quantity).toFixed(2) : totalCost;

        // Calcular vencimiento por defecto (30 días)
        let finalEndDate = formData.endDate;
        if (!finalEndDate && formData.client !== 'LIBRE') {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            finalEndDate = d.toISOString().split('T')[0];
        }

        // --- A. MODO EDICIÓN / VENTA INDIVIDUAL (FRAGMENTACIÓN) ---
        const isSingleEdit = formData.id && quantity === 1;

        // También entramos aquí si estamos editando una tarjeta específica aunque quantity > 1 (Paquete sobre Madre)
        // La condición de 'quantity === 1' a veces bloqueaba la venta de paquetes sobre madres.
        // MEJOR: Si hay un ID, usamos el hook inteligente.
        if (formData.id) {
            // Buscamos la venta original para compararla
            const originalSale = sales.find(s => s.id === formData.id);
            if (!originalSale) return;

            // Preparamos los datos limpios para enviar al hook
            const dataToSave = {
                ...formData,
                cost: Number(costPerProfile),
                endDate: finalEndDate
            };

            // 🔥 LLAMADA AL MOTOR NUEVO 🔥
            // Le pasamos 'quantity' para que sepa si es 1 perfil o un paquete de 3
            const success = await handleSave(dataToSave, originalSale, catalog, quantity);

            if (success) {
                setView('dashboard'); 
                resetForm(); 
            }
            return; 
        }

        // --- B. MODO VENTA MASIVA (Desde Stock LIBRE) ---
        // Esto busca múltiples tarjetas libres. Solo se usa si NO seleccionaste una tarjeta específica.
        let freeRows = sales.filter(s => 
            s.email === formData.email && 
            s.service === formData.service && 
            s.client === 'LIBRE'
        ); 
        
        if (quantity > freeRows.length) { 
            setNotification({ show: true, message: `Stock insuficiente. Solo quedan ${freeRows.length} libres.`, type: 'error' });
            return; 
        }

        const profilesToSell = freeRows.slice(0, quantity);

        try {
            const batch = writeBatch(db);

            profilesToSell.forEach((docSnap, index) => {
                const docRef = doc(db, userPath, 'sales', docSnap.id);
                
                let assignedProfile = formData.profile;
                let assignedPin = formData.pin;

                if (quantity > 1 && bulkProfiles[index]) {
                    assignedProfile = bulkProfiles[index].profile || '';
                    assignedPin = bulkProfiles[index].pin || '';
                }

                batch.update(docRef, {
                    client: formData.client,
                    phone: formData.phone || '',
                    endDate: finalEndDate,
                    cost: Number(costPerProfile),
                    type: formData.type,
                    profile: assignedProfile,
                    pin: assignedPin,
                    soldAt: new Date()
                });
            });

            await batch.commit();
            
            setNotification({ show: true, message: `¡Venta de ${quantity} perfiles exitosa!`, type: 'success' });
            setView('dashboard'); 
            resetForm();

        } catch (error) {
            console.error("Error batch venta:", error);
            setNotification({ show: true, message: 'Error al procesar la venta.', type: 'error' });
        }
    };

    const handleQuickRenew = async (id) => {
        const sale = sales.find(s => s.id === id);
        if (sale && sale.endDate) {
             try {
                const currentEnd = new Date(sale.endDate);
                const newEnd = new Date(currentEnd);
                newEnd.setDate(newEnd.getDate() + 30);
                
                await updateDoc(doc(db, userPath, 'sales', id), {
                    endDate: newEnd.toISOString().split('T')[0]
                });
                setNotification({ show: true, message: 'Renovado +30 días.', type: 'success' });
            } catch (error) { setNotification({ show: true, message: 'Error al renovar.', type: 'error' }); }
        }
    };

    const handleImportCSV = (event) => console.log("Import CSV Logic Placeholder");

    const triggerDeleteService = (id) => { setConfirmModal({ show: true, id: id, type: 'delete_service', title: '¿Eliminar Servicio?', msg: 'Esta categoría desaparecerá del catálogo.' }); };
    const triggerLiberate = (id) => { setConfirmModal({ show: true, id: id, type: 'liberate', title: '¿Liberar Perfil?', msg: 'Los datos del cliente se borrarán.' }); };
    const triggerDeleteAccount = (accountData) => { setConfirmModal({ show: true, type: 'delete_account', title: '¿Eliminar Cuenta?', msg: `Se eliminarán los perfiles de ${accountData.email}.`, data: accountData.ids }); };
    
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
                sendWhatsApp={(sale, actionType) => sendWhatsApp(sale, actionType)}
                handleQuickRenew={handleQuickRenew}
                triggerLiberate={triggerLiberate}
                setFormData={setFormData} setView={setView}
                openMenuId={openMenuId} setOpenMenuId={setOpenMenuId}
                setBulkProfiles={setBulkProfiles} loadingData={loadingData}
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