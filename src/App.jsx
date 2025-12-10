// src/App.jsx (CÓDIGO CONSOLIDADO FINAL)

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
    const [loginPass, setLoginPass] = useState(''); // Estado de la Contraseña
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
        try { 
            // Usa los estados loginEmail y loginPass
            await signInWithEmailAndPassword(auth, loginEmail, loginPass); 
            setNotification({ show: true, message: '¡Bienvenido!', type: 'success' }); 
        } 
        catch (error) { 
            console.error("Login Error:", error);
            setLoginError('Error credenciales. Verifica Email y Contraseña.'); 
        }
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

    // -----------------------------------------------------------
    // ✅ HANDLER PARA WHATSAPP: Agrupa todos los perfiles de la venta
    // -----------------------------------------------------------
    const handleWhatsAppShare = (sale, actionType) => {
        if (sale.client === 'LIBRE') return; 
        
        // 1. Filtrar todos los perfiles que pertenecen a este mismo cliente, email, y contraseña
        const relatedProfiles = sales.filter(s => 
            s.email === sale.email && 
            s.pass === sale.pass && 
            s.client === sale.client &&
            s.client !== 'LIBRE' // Aseguramos que solo sean perfiles vendidos
        );

        // 2. Si es una venta de grupo, enviar el array completo.
        if (relatedProfiles.length > 1) {
            sendWhatsApp(relatedProfiles, actionType);
        } else {
            // Si es una venta individual, enviar solo el perfil actual.
            sendWhatsApp([sale], actionType);
        }
    };
    // -----------------------------------------------------------


    // --- LÓGICA DE VENTAS ---
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
        const costToSaveInDB = totalCost; 

        // Calcular vencimiento por defecto
        let finalEndDate = formData.endDate;
        if (!finalEndDate && formData.client !== 'LIBRE') {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            finalEndDate = d.toISOString().split('T')[0];
        }

        // --- A. MODO EDICIÓN / VENTA ESPECÍFICA (Con ID) ---
        if (formData.id) {
            const originalSale = sales.find(s => s.id === formData.id);
            if (!originalSale) return;

            const dataToSave = {
                ...formData,
                cost: costToSaveInDB, // ENVIAMOS EL PRECIO TOTAL
                endDate: finalEndDate
            };

            // ✅ CONEXIÓN FINAL: Pasamos bulkProfiles al hook
            const success = await handleSave(dataToSave, originalSale, catalog, sales, quantity, bulkProfiles);

            if (success) { setView('dashboard'); resetForm(); }
            return; 
        }

        // --- B. MODO VENTA MASIVA (Desde Stock LIBRE, sin ID) ---
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

        // Determinación del costo unitario para el batch
        const selectedService = catalog.find(c => c.name === formData.service);
        const isSelectedServicePackage = selectedService && selectedService.type === 'Paquete';
        
        let individualCostForStock;

        if (quantity > 1 && isSelectedServicePackage) {
            individualCostForStock = (totalCost / quantity).toFixed(2);
        } else {
            individualCostForStock = totalCost; 
        }

        try {
            const batch = writeBatch(db);

            profilesToSell.forEach((docSnap, index) => {
                const docRef = doc(db, userPath, 'sales', docSnap.id);
                
                // ✅ FIX: Asignamos perfil y PIN directamente desde bulkProfiles para todas las unidades
                const currentBulkProfile = bulkProfiles[index] || {};
                
                // Prioridad: bulkProfiles > docSnap.profile (el nombre de la tarjeta libre) > default
                const assignedProfile = currentBulkProfile.profile || docSnap.profile || '';
                const assignedPin = currentBulkProfile.pin || docSnap.pin || '';


                batch.update(docRef, {
                    client: formData.client,
                    phone: formData.phone || '',
                    endDate: finalEndDate,
                    cost: Number(individualCostForStock), 
                    type: formData.type,
                    profile: assignedProfile, // ✅ Asignado
                    pin: assignedPin,         // ✅ Asignado
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

    // --- RENOVACIÓN RÁPIDA (LÓGICA EXACTA DE MES) ---
    const handleQuickRenew = async (id) => {
        const sale = sales.find(s => s.id === id);
        if (sale && sale.endDate) {
             try {
                const [y, m, d] = sale.endDate.split('-').map(Number);
                const currentDate = new Date(y, m - 1, d);
                const nextDate = new Date(currentDate);
                nextDate.setMonth(nextDate.getMonth() + 1);

                if (currentDate.getDate() !== nextDate.getDate()) {
                    nextDate.setDate(0); // Retrocede al último día del mes
                }

                await updateDoc(doc(db, userPath, 'sales', id), {
                    endDate: nextDate.toISOString().split('T')[0]
                });
                setNotification({ show: true, message: 'Renovado +1 mes exacto.', type: 'success' });
            } catch (error) { setNotification({ show: true, message: 'Error al renovar.', type: 'error' }); }
        }
    };

    const handleImportCSV = (event) => console.log("Import CSV Logic Placeholder");

    const triggerDeleteService = (id) => { setConfirmModal({ show: true, id: id, type: 'delete_service', title: '¿Eliminar Servicio?', msg: 'Esta categoría desaparecerá del catálogo.' }); };
    const triggerLiberate = (id) => { setConfirmModal({ show: true, id: id, type: 'liberate', title: '¿Liberar Perfil?', msg: 'Los datos del cliente se borrarán.' }); };
    const triggerDeleteAccount = (accountData) => { setConfirmModal({ show: true, type: 'delete_account', title: '¿Eliminar Cuenta?', msg: `Se eliminarán los perfiles de ${accountData.email}.`, data: accountData.ids }); };
    
    // ✅ NUEVO TRIGGER PARA ELIMINAR SOLO STOCK LIBRE
    const triggerDeleteFreeStock = (accountEmail, accountPass) => {
        const freeProfilesToDelete = sales.filter(s => 
            s.email === accountEmail && 
            s.pass === accountPass && 
            s.client === 'LIBRE' 
        ).map(s => s.id);
        
        if (freeProfilesToDelete.length === 0) {
             setNotification({ show: true, message: 'No se encontró stock libre para eliminar en esta cuenta.', type: 'info' });
             return;
        }

        setConfirmModal({ 
            show: true, 
            type: 'delete_free_stock', 
            title: 'Limpiar Stock Libre', 
            msg: `Se eliminarán ${freeProfilesToDelete.length} perfiles LIBRES de ${accountEmail}.`, 
            data: freeProfilesToDelete 
        });
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
                sendWhatsApp={handleWhatsAppShare} // ✅ Llama al handler que agrupa
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
                triggerDeleteFreeStock={triggerDeleteFreeStock}
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