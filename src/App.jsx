import React, { useState, useReducer, useEffect } from 'react';
import { Loader } from 'lucide-react'; 

// Reducers y Hooks
import { initialUiState, uiReducer, uiActionTypes } from './reducers/uiReducer'; 
import { useSalesData } from './hooks/useSalesData';
import { useDataSync } from './hooks/useDataSync'; 
import { useCRMActions } from './hooks/useCRMActions';

// Firebase y Utils
import { signInWithEmailAndPassword, signOut } from 'firebase/auth'; 
import { writeBatch, collection, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore'; 
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
    const userPath = user ? `users/${user.uid}` : '';
    
    // 2. UI STATE
    const [uiState, dispatch] = useReducer(uiReducer, initialUiState);
    const { view, stockTab, filterClient, filterService, filterStatus, dateFrom, dateTo } = uiState;
    const [notification, setNotification] = useState({ show: false, message: '', type: 'success' }); 
    const [confirmModal, setConfirmModal] = useState({ show: false, id: null, type: null, title: '', msg: '' });
    const [openMenuId, setOpenMenuId] = useState(null);

    // 3. ACTIONS HOOK (Lógica limpia)
    const crmActions = useCRMActions(user, userPath, setNotification);

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
    
    // ✅ CORRECCIÓN AQUÍ: Inicializamos vacío para que se vean los placeholders
    const [packageForm, setPackageForm] = useState({ name: '', cost: '', slots: 2 });
    
    // 5. COMPUTED DATA
    const {
        filteredSales, totalFilteredMoney, totalItems, NON_BILLABLE_STATUSES,
        allClients, getClientPreviousProfiles, maxAvailableSlots, 
        accountsInventory, packageCatalog,
        getStatusIcon, getStatusColor, getDaysRemaining
    } = useSalesData(sales, catalog, clientsDirectory, uiState, formData);

    // --- HANDLERS SIMPLIFICADOS ---

    const handleLogin = async (e) => {
        e.preventDefault(); setLoginError('');
        try { await signInWithEmailAndPassword(auth, loginEmail, loginPass); setNotification({ show: true, message: '¡Bienvenido!', type: 'success' }); } 
        catch (error) { setLoginError('Error credenciales.'); }
    };
    const handleLogout = () => signOut(auth);

    const handleAddServiceToCatalog = async (e) => {
        e.preventDefault();
        const success = await crmActions.addCatalogService(catalogForm);
        if (success) setCatalogForm({ name: '', cost: '', type: 'Perfil', defaultSlots: 4 });
    };

    const handleAddPackageToCatalog = async (e) => {
        e.preventDefault();
        const success = await crmActions.addCatalogPackage(packageForm);
        // Al guardar, limpiamos el formulario nuevamente
        if (success) setPackageForm({ name: '', cost: '', slots: 2 });
    };

    const handleGenerateStock = async (e) => {
        e.preventDefault();
        const success = await crmActions.generateStock(stockForm);
        if (success) {
            setStockTab('manage');
            setStockForm({ service: '', email: '', pass: '', slots: 4, cost: 0, type: 'Perfil' });
        }
    };

    const handleConfirmActionWrapper = async () => {
        const success = await crmActions.executeConfirmAction(confirmModal, sales, catalog);
        if (success || !success) setConfirmModal({ show: false, id: null, type: null, title: '', msg: '', data: null });
    };

    // --- ACCIONES COMPLEJAS (Restauradas) ---

    const handleSaveSale = async (e) => {
        e.preventDefault(); if (!user) return;
        
        if (formData.client !== 'LIBRE' && !NON_BILLABLE_STATUSES.includes(formData.client) && formData.client !== 'Admin') {
            const exists = allClients.some(c => c.name.toLowerCase() === formData.client.toLowerCase());
            if (!exists) await addDoc(collection(db, userPath, 'clients'), { name: formData.client, phone: formData.phone });
        }

        const isSingleEdit = formData.client !== 'LIBRE' && formData.id && (!formData.profilesToBuy || formData.profilesToBuy === 1);
        const quantity = parseInt(formData.profilesToBuy || 1);
        const costPerProfile = (quantity > 1) ? Number(formData.cost / quantity).toFixed(2) : Number(formData.cost).toFixed(2);
        
        if (isSingleEdit) {
            const pName = bulkProfiles[0]?.profile !== '' ? bulkProfiles[0].profile : formData.profile;
            const pPin = bulkProfiles[0]?.pin !== '' ? bulkProfiles[0].pin : formData.pin;
            await updateDoc(doc(db, userPath, 'sales', formData.id), { ...formData, profile: pName, pin: pPin, cost: costPerProfile }); 
            setNotification({ show: true, message: 'Venta actualizada.', type: 'success' });
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
                client: formData.client, phone: formData.phone, endDate: formData.endDate, cost: costPerProfile, service: formData.service,
                profile: specificProfileData ? specificProfileData.profile : '', pin: specificProfileData ? specificProfileData.pin : '', type: formData.type
            });
        });
        await batch.commit();
        setNotification({ show: true, message: `¡Venta de ${quantity} perfiles guardada!`, type: 'success' });
        setView('dashboard'); resetForm();
    };

    const handleQuickRenew = async (id) => {
        const sale = sales.find(s => s.id === id);
        if (sale && sale.endDate) {
            try {
                const [year, month, day] = sale.endDate.split('-').map(Number);
                const date = new Date(year, month - 1, day); date.setMonth(date.getMonth() + 1);
                const newEndDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                await updateDoc(doc(db, userPath, 'sales', id), { endDate: newEndDate });
                setNotification({ show: true, message: 'Renovado (30 días).', type: 'success' });
            } catch (error) { setNotification({ show: true, message: 'Error al renovar.', type: 'error' }); }
        }
    };

    const handleImportCSV = (event, type) => {
        const file = event.target.files[0]; if (!file || !user) return;
        setNotification({ show: true, message: 'Cargando datos...', type: 'warning' });
        const reader = new FileReader();
        reader.onload = async (e) => {
            const text = e.target.result; const rows = text.split('\n').map(row => row.split(','));
            const batch = writeBatch(db); let count = 0; let errors = 0;
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
                            const totalCost = Number(row[SALES_MAP.COST] || 0); const costPerProfile = totalCost / quantity;

                            for (let j = 0; j < quantity; j++) {
                                const ref = doc(collection(db, userPath, 'sales'));
                                batch.set(ref, { 
                                    client: row[SALES_MAP.CLIENT] ? row[SALES_MAP.CLIENT].trim() : 'N/A', service: serviceName, endDate: row[SALES_MAP.END_DATE] ? row[SALES_MAP.END_DATE].trim() : null, email: row[SALES_MAP.EMAIL].trim(), pass: row[SALES_MAP.PASS] ? row[SALES_MAP.PASS].trim() : 'N/A', profile: profileNames[j] || '', pin: pinCodes[j] || '', cost: Number(costPerProfile).toFixed(2), type: serviceName.includes('Cuenta') ? 'Cuenta' : 'Perfil', createdAt: Date.now() + (i * 100) + j
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
                       }
                    });
                }
                await batch.commit(); setNotification({ show: true, message: `Importación lista: ${count} agregados.`, type: 'success' });
            } catch (error) { setNotification({ show: true, message: `Error CSV.`, type: 'error' }); }
        };
        reader.readAsText(file);
    };

    // --- TRIGGERS DEL MODAL ---
    const triggerDeleteService = (id) => { setConfirmModal({ show: true, id: id, type: 'delete_service', title: '¿Eliminar Servicio?', msg: 'Esta categoría desaparecerá del catálogo.' }); };
    const triggerLiberate = (id) => { setConfirmModal({ show: true, id: id, type: 'liberate', title: '¿Liberar Perfil?', msg: 'Los datos del cliente se borrarán.' }); };
    const triggerDeleteAccount = (accountData) => { setConfirmModal({ show: true, type: 'delete_account', title: '¿Eliminar Cuenta?', msg: `Se eliminarán los perfiles de ${accountData.email}.`, data: accountData.ids }); };
    
    // --- MANEJO DE CLIENTES ---
    const triggerDeleteClient = async (id) => { if(window.confirm("¿Eliminar cliente?")) await deleteDoc(doc(db, userPath, 'clients', id)); };
    const triggerEditClient = async (clientId, newName, newPhone) => {
        const batch = writeBatch(db);
        let targetId = clientId;
        if (!clientId) { const ref = doc(collection(db, userPath, 'clients')); batch.set(ref, {name:newName, phone:newPhone}); targetId = ref.id; }
        else { batch.update(doc(db, userPath, 'clients', clientId), {name:newName, phone:newPhone}); }
        const oldName = clientsDirectory.find(c => c.id === targetId)?.name || newName;
        sales.filter(s => s.client === oldName).forEach(s => batch.update(doc(db, userPath, 'sales', s.id), {client:newName, phone:newPhone}));
        await batch.commit(); setNotification({ show: true, message: 'Cliente actualizado.', type: 'success' });
    };

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

    // --- RENDERIZADO FINAL ---

    if (authLoading) return <div className="flex h-screen items-center justify-center bg-[#F2F2F7]"><Loader className="animate-spin text-blue-500"/></div>;

    if (!user) return <><Toast notification={notification} setNotification={setNotification} /><LoginScreen loginEmail={loginEmail} setLoginEmail={setLoginEmail} loginPass={loginPass} setLoginPass={setLoginPass} loginError={loginError} handleLogin={handleLogin}/></>;

    return (
        <MainLayout view={view} setView={setView} handleLogout={handleLogout} notification={notification} setNotification={setNotification}>
            
            <datalist id="suggested-profiles">{getClientPreviousProfiles.map((p, i) => <option key={i} value={p.profile}>PIN: {p.pin}</option>)}</datalist>
            <datalist id="clients-suggestions">{allClients.map((c, i) => <option key={i} value={c.name} />)}</datalist>

            <ConfirmModal modal={confirmModal} onClose={() => setConfirmModal({show:false})} onConfirm={handleConfirmActionWrapper} />

            {view === 'dashboard' && <Dashboard 
                sales={sales} filteredSales={filteredSales} catalog={catalog}
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
            />}

            {view === 'config' && <Config 
                catalog={catalog} catalogForm={catalogForm} setCatalogForm={setCatalogForm}
                packageForm={packageForm} setPackageForm={setPackageForm}
                handleAddServiceToCatalog={handleAddServiceToCatalog}
                handleAddPackageToCatalog={handleAddPackageToCatalog}
                handleImportCSV={handleImportCSV} importStatus={importStatus}
                triggerDeleteService={triggerDeleteService}
                clientsDirectory={clientsDirectory} allClients={allClients} 
                triggerDeleteClient={triggerDeleteClient} triggerEditClient={triggerEditClient}
                setNotification={setNotification} formData={formData} setFormData={setFormData}
            />}

            {view === 'add_stock' && <StockManager
                accountsInventory={accountsInventory} stockTab={stockTab} setStockTab={setStockTab}
                stockForm={stockForm} setStockForm={setStockForm} catalog={catalog}
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
                setView={setView} resetForm={resetForm} catalog={catalog}
            />}
        </MainLayout>
    );
};

export default App;