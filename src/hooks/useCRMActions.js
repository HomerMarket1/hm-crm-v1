import { addDoc, collection, doc, writeBatch, serverTimestamp, updateDoc, query, where, getDocs, getDoc } from 'firebase/firestore'; 
import { db } from '../firebase/config';

// Helper para limpiar nombres básicos
const findBaseServiceName = (serviceName) => {
    if (!serviceName) return '';
    return serviceName.replace(/\s(Cuenta|Completa|Paquete|Perfil|Perfiles|Renovación|Pantalla|Dispositivo).*$/gi, '').trim();
};

// LISTA DE ESTADOS SEGUROS
const SAFE_STATUSES = [
    'libre', 'espacio libre', 'disponible', '', 
    'caída', 'caida', 'actualizar', 'dominio', 'reposicion', 
    'garantía', 'garantia', 'problemas', 'stock', 'seguimiento'
];

export const useCRMActions = (user, setNotification) => {
    if (!user) return {};

    const userPath = `users/${user.uid}`;
    const notify = (msg, type = 'success') => setNotification({ show: true, message: msg, type });

    // --- 1. GESTOR DE CONFIRMACIONES ---
    const executeConfirmAction = async (modalData, currentSales, currentCatalog) => {
        if (!user || !modalData) return false;
        try {
            const batch = writeBatch(db);
            let operationCount = 0;

            if (modalData.type === 'delete_service') {
                batch.delete(doc(db, userPath, 'catalog', modalData.id));
                operationCount++;
            }
            else if (modalData.type === 'liberate') {
                const saleToFree = currentSales.find(i => i.id === modalData.id);
                if (saleToFree) {
                    const isPackage = saleToFree.service.toLowerCase().includes('paquete');
                    const typeLower = (saleToFree.type || '').toLowerCase();
                    const serviceLower = (saleToFree.service || '').toLowerCase();
                    const isAccount = (typeLower.includes('cuenta') || serviceLower.includes('cuenta completa') || serviceLower.includes('completa')) && !isPackage;

                    let finalServiceName = saleToFree.service;
                    let targetType = 'Perfil';
                    let targetProfile = ''; 
                    
                    if (isAccount) {
                        const baseName = findBaseServiceName(saleToFree.service);
                        finalServiceName = `${baseName} Cuenta Completa`;
                        targetType = 'Cuenta';
                        targetProfile = ''; 
                    } else {
                        const cleanName = saleToFree.service.replace(/paquete\s*\d*/gi, '').trim();
                        const originalService = currentCatalog.find(c => c.name === cleanName && c.type === 'Perfil');
                        finalServiceName = originalService ? originalService.name : findBaseServiceName(saleToFree.service);
                    }

                    // ✅ AL LIBERAR: Borramos `clientSince` para que, si el slot se reusa, empiece de cero.
                    batch.update(doc(db, userPath, 'sales', modalData.id), {
                        client: 'LIBRE', phone: '', endDate: '', cost: 0, 
                        service: finalServiceName, updatedAt: serverTimestamp(), 
                        type: targetType, profile: targetProfile, pin: '',
                        clientSince: null // 🧹 Limpiamos el historial
                    });
                    operationCount++;
                }
            }
            else if (['delete_account', 'delete_free_stock'].includes(modalData.type)) {
                const idsToDelete = modalData.data;
                if (Array.isArray(idsToDelete) && idsToDelete.length > 0) {
                    idsToDelete.forEach(id => batch.delete(doc(db, userPath, 'sales', id)));
                    operationCount = idsToDelete.length;
                }
            }

            if (operationCount > 0) {
                await batch.commit();
                notify('Acción realizada correctamente.', 'success');
                return true;
            }
            return false;
        } catch (error) { console.error(error); notify('Error al ejecutar la acción.', 'error'); return false; }
    };

    // --- 2. GENERAR STOCK ---
    const generateStock = async (form) => {
        try {
            const batch = writeBatch(db);
            const typeLower = (form.type || '').toLowerCase();
            const serviceLower = (form.service || '').toLowerCase();
            const isAccountStrategy = typeLower.includes('cuenta') || typeLower.includes('completa') || serviceLower.includes('cuenta completa');
            
            if (isAccountStrategy) {
                const baseName = findBaseServiceName(form.service);
                const cleanServiceName = `${baseName} Cuenta Completa`;
                const newDocRef = doc(collection(db, userPath, 'sales'));
                batch.set(newDocRef, {
                    client: 'LIBRE', service: cleanServiceName, email: form.email, pass: form.pass, cost: 0,
                    type: 'Cuenta', createdAt: serverTimestamp(), profile: '', pin: ''
                });
                notify(`Cuenta Madre agregada.`, 'success');
            } else {
                const loops = Number(form.slots) || 1;
                for(let i=0; i < loops; i++) {
                    const newDocRef = doc(collection(db, userPath, 'sales'));
                    batch.set(newDocRef, {
                        client: 'LIBRE', service: form.service, email: form.email, pass: form.pass, cost: 0,
                        type: form.type || 'Perfil', createdAt: serverTimestamp(), profile: `Perfil ${i+1}`, pin: ''
                    });
                }
                notify(`Generados ${loops} perfiles.`, 'success');
            }
            await batch.commit();
            return true;
        } catch(e) { console.error(e); notify('Error al agregar stock.', 'error'); return false; }
    };

    // --- 3. PROCESAR VENTA (FIX PRECIO + FIX CREDENCIALES + FIX LEALTAD) ---
    const processSale = async (formData, originalSale, catalog, sales, profilesToSell = 1, bulkProfiles = []) => {
        try {
            if (!originalSale?.id) throw new Error("ID no encontrado");
            const batch = writeBatch(db);
            const totalCost = Number(formData.cost) || 0;
            const cleanFormData = { ...formData };
            Object.keys(cleanFormData).forEach(key => cleanFormData[key] === undefined && delete cleanFormData[key]);

            const finalEmail = cleanFormData.email !== undefined ? cleanFormData.email : originalSale.email;
            const finalPass = cleanFormData.pass !== undefined ? cleanFormData.pass : originalSale.pass;

            // ✅ SELLO DE LEALTAD: Si el cliente de origen era "LIBRE" (es decir, estamos asignando a alguien nuevo en esta cuenta)
            // guardamos la fecha de hoy. Si ya era de alguien (ej: solo estamos editando precio), conservamos su fecha.
            const isAssigningNewClient = SAFE_STATUSES.includes((originalSale.client || '').toLowerCase());
            if (isAssigningNewClient && cleanFormData.client && !SAFE_STATUSES.includes(cleanFormData.client.toLowerCase())) {
                cleanFormData.clientSince = new Date().toISOString(); 
            } else if (originalSale.clientSince) {
                // Mantenemos la fecha original si solo estamos editando
                cleanFormData.clientSince = originalSale.clientSince;
            }

            // 1. Detección del Tipo DESTINO
            const targetCatalogItem = catalog.find(c => c.name === formData.service);
            let targetType = targetCatalogItem?.type || 'Perfil';
            
            // Forzamos 'Cuenta' solo si el nombre lo dice explícitamente
            if (formData.service.toLowerCase().includes('cuenta completa') || formData.service.toLowerCase().includes('completa')) {
                targetType = 'Cuenta';
            }

            // 2. Detección del Tipo ORIGEN
            const originalTypeRaw = (originalSale.type || 'Perfil').toLowerCase();
            const isOriginalAccount = originalTypeRaw.includes('cuenta') || (originalSale.service || '').toLowerCase().includes('cuenta completa'); 
            const originalType = isOriginalAccount ? 'Cuenta' : (originalTypeRaw.includes('paquete') ? 'Paquete' : 'Perfil');

            // 3. Chequeo de Estado Seguro
            const clientLower = (formData.client || '').toLowerCase().trim();
            const isSafeStatus = SAFE_STATUSES.includes(clientLower);

            const isReturningAccountToStock = 
                isOriginalAccount && 
                isSafeStatus && 
                targetType === 'Cuenta';

            if (isReturningAccountToStock) {
                const baseName = findBaseServiceName(formData.service);
                const cleanName = `${baseName} Cuenta Completa`;
                batch.update(doc(db, userPath, 'sales', originalSale.id), { 
                    ...cleanFormData, service: cleanName, cost: 0, type: 'Cuenta', profile: '', updatedAt: serverTimestamp(),
                    clientSince: null // Borramos el sello si vuelve al stock
                });
                await batch.commit();
                notify('Cuenta actualizada (Unidad Mantenida).', 'success');
                return true;
            }

            // 4. BÚSQUEDA DE HERMANOS
            const siblings = sales.filter(s => 
                s.email === originalSale.email && 
                s.id !== originalSale.id &&
                (s.pass === originalSale.pass || !s.pass || !originalSale.pass)
            );

            // =================================================================
            // CASO A: UNIFICACIÓN (CORRECCIÓN DE PRECIO APLICADA AQUÍ 📉)
            // =================================================================
            if (targetType === 'Cuenta') {
                siblings.forEach(sib => batch.delete(doc(db, userPath, 'sales', sib.id)));
                
                const baseName = findBaseServiceName(formData.service);
                const cleanName = `${baseName} Cuenta Completa`;

                const realUnitCost = (profilesToSell > 1 && totalCost > 0) 
                    ? (totalCost / profilesToSell) 
                    : totalCost;

                batch.update(doc(db, userPath, 'sales', originalSale.id), { 
                    ...cleanFormData, 
                    email: finalEmail, pass: finalPass,
                    service: cleanName, type: 'Cuenta', profile: '', pin: '', 
                    cost: realUnitCost, 
                    updatedAt: serverTimestamp() 
                });
                await batch.commit(); 
                notify('Cuenta Unificada correctamente.', 'success'); 
                return true;
            }

            // =================================================================
            // CASO B: FRAGMENTACIÓN / VENTA COMPLEJA (LÓGICA ORIGINAL RESTAURADA)
            // =================================================================
            const isComplexOperation = targetType === 'Paquete' || originalType === 'Cuenta' || profilesToSell > 1;

            if (isComplexOperation) {
                let slotsToOccupy = profilesToSell;
                if (targetType === 'Paquete' && profilesToSell === 1) {
                     const pkgSlots = Number(targetCatalogItem?.defaultSlots || 2);
                     slotsToOccupy = pkgSlots;
                }
                const unitCost = totalCost / (slotsToOccupy > 0 ? slotsToOccupy : 1);

                if (originalType === 'Cuenta') {
                    // FRAGMENTAR CUENTA MADRE
                    siblings.forEach(sib => batch.delete(doc(db, userPath, 'sales', sib.id)));
                    
                    let realBaseName = findBaseServiceName(formData.service);
                    const isNetflix = realBaseName.toLowerCase().includes('netflix');
                    let defaultCapacity = isNetflix ? 5 : 4;
                    
                    const accountCatalogItem = catalog.find(c => c.name === `${realBaseName} Cuenta Completa`);
                    if (accountCatalogItem && accountCatalogItem.defaultSlots) {
                        defaultCapacity = Number(accountCatalogItem.defaultSlots);
                    }

                    const accountCapacity = Math.max(siblings.length + 1, defaultCapacity);
                    const freeServiceName = realBaseName; 

                    for (let i = 0; i < accountCapacity; i++) {
                        const isSold = i < slotsToOccupy;
                        const pData = bulkProfiles[i] || {}; 
                        let slotData = {};
                        
                        if (isSold) {
                            const profileName = (profilesToSell === 1) ? (pData.profile || cleanFormData.profile || `Perfil ${i+1}`) : (pData.profile || `Perfil ${i+1}`);
                            const pinCode = (pData.pin) ? pData.pin : cleanFormData.pin;
                            slotData = { 
                                ...cleanFormData, 
                                email: finalEmail, pass: finalPass,
                                cost: unitCost, profile: profileName, pin: pinCode || '', type: 'Perfil' 
                            };
                        } else {
                            slotData = { 
                                client: 'LIBRE', phone: '', service: freeServiceName, type: 'Perfil', cost: 0, 
                                email: finalEmail, pass: finalPass,
                                profile: `Perfil ${i+1}`, pin: '', endDate: '', clientSince: null
                            };
                        }
                        if (i === 0) batch.update(doc(db, userPath, 'sales', originalSale.id), { ...slotData, updatedAt: serverTimestamp() });
                        else { const newDoc = doc(collection(db, userPath, 'sales')); batch.set(newDoc, { ...slotData, createdAt: new Date(Date.now() + i*50) }); }
                    }
                } else {
                    // VENTA MULTIPLE DESDE PERFILES SUELTOS
                    const availableSiblings = siblings.filter(s => SAFE_STATUSES.includes((s.client || '').toLowerCase()));
                    if (1 + availableSiblings.length < slotsToOccupy) { notify(`No hay suficientes slots libres.`, 'error'); return false; }
                    
                    const pData0 = bulkProfiles[0] || {};
                    batch.update(doc(db, userPath, 'sales', originalSale.id), { 
                        ...cleanFormData, 
                        email: finalEmail, pass: finalPass,
                        cost: unitCost, profile: pData0.profile || cleanFormData.profile, pin: pData0.pin || cleanFormData.pin || '', updatedAt: serverTimestamp() 
                    });
                    
                    for (let i = 1; i < slotsToOccupy; i++) {
                        const targetDoc = availableSiblings[i-1];
                        const pData = bulkProfiles[i] || {};
                        batch.update(doc(db, userPath, 'sales', targetDoc.id), { 
                            ...cleanFormData, 
                            email: finalEmail, pass: finalPass,
                            cost: unitCost, profile: pData.profile || `Perfil ${i+1}`, pin: pData.pin || '', updatedAt: serverTimestamp() 
                        });
                    }
                }
                await batch.commit(); notify(`Venta registrada.`, 'success'); return true;
            }

            // Actualización simple
            batch.update(doc(db, userPath, 'sales', originalSale.id), { 
                ...cleanFormData, 
                cost: totalCost, updatedAt: serverTimestamp() 
            });
            await batch.commit(); notify('Guardado correctamente.', 'success'); return true;
        } catch (error) { console.error("Error:", error); notify('Error al guardar.', 'error'); return false; }
    };

    const migrateService = async (source, target, oldStatus = 'LIBRE') => {
        try {
            const batch = writeBatch(db);
            const userPath = `users/${user.uid}`;
            const sId = source?.id || source;
            const tId = target?.id || target;
            if (!sId || !tId) return false;

            const sRef = doc(db, userPath, 'sales', sId);
            const tRef = doc(db, userPath, 'sales', tId);
            const sSnap = await getDoc(sRef);
            if (!sSnap.exists()) return;
            const sData = sSnap.data();

            // ✅ AL MIGRAR: Heredamos la antigüedad (clientSince) a la nueva cuenta
            batch.update(tRef, {
                client: sData.client, phone: sData.phone || '', endDate: sData.endDate || '', cost: sData.cost || 0,
                profile: sData.profile || '', pin: sData.pin || '', updatedAt: serverTimestamp(),
                clientSince: sData.clientSince || sData.createdAt // Traspasamos la memoria
            });

            // Y la cuenta vieja la reseteamos
            const resetData = oldStatus === 'LIBRE' 
                ? { client: 'LIBRE', phone: '', endDate: '', cost: 0, profile: '', pin: '', lastCode: '', clientSince: null }
                : { client: oldStatus, phone: '', endDate: '', cost: 0, clientSince: null };

            batch.update(sRef, { ...resetData, updatedAt: serverTimestamp() });
            await batch.commit(); notify('Migración exitosa.', 'success'); return true;
        } catch (e) { notify('Error migrando.', 'error'); return false; }
    };

    // --- 4. RENOVACIÓN RÁPIDA INTELIGENTE (FIX 30 FEB) ---
    const quickRenew = async (id, dateString) => {
        if (!id || !dateString) return;
        try {
            const [y, m, d] = dateString.split('-').map(Number);
            const date = new Date(y, m - 1, d);
            date.setMonth(date.getMonth() + 1);

            if (date.getDate() !== d) {
                date.setDate(0);
            }

            const nextYear = date.getFullYear();
            const nextMonth = String(date.getMonth() + 1).padStart(2, '0');
            const nextDay = String(date.getDate()).padStart(2, '0');
            const finalDate = `${nextYear}-${nextMonth}-${nextDay}`;

            await updateDoc(doc(db, userPath, 'sales', id), { 
                endDate: finalDate, 
                updatedAt: serverTimestamp() 
            });
            
            notify(`Renovado hasta el ${finalDate}`, 'success'); 
            return true;

        } catch (e) { 
            console.error("Error renovando:", e); 
            notify('Error al renovar.', 'error'); 
            return false; 
        }
    };

    const addCatalogService = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { ...f, cost: Number(f.cost), defaultSlots: Number(f.defaultSlots), createdAt: serverTimestamp() }); notify('Servicio creado.'); return true; } catch(e){ return false; } };
    const addCatalogPackage = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { name: `${f.name} Paquete ${f.slots}`, cost: Number(f.cost), type: 'Paquete', defaultSlots: Number(f.slots), createdAt: serverTimestamp() }); notify('Paquete creado.'); return true; } catch(e){ return false; } };
    const updateCatalogService = async (id, d) => { try { await updateDoc(doc(db, userPath, 'catalog', id), d); notify('Actualizado.'); return true; } catch(e){ return false; } };
    const editAccountCredentials = async (e,o,n) => { try { if (n===o) return true; const q = query(collection(db, userPath, 'sales'), where('email', '==', e), where('pass', '==', o)); const snap = await getDocs(q); if (snap.empty) { notify('No encontrado.', 'error'); return false; } const b = writeBatch(db); snap.forEach(d => b.update(d.ref, { pass: n, updatedAt: serverTimestamp() })); await b.commit(); notify('Credenciales actualizadas.', 'success'); return true; } catch(e) { notify('Error.', 'error'); return false; } };
    const processBatchSale = async (f,q,r,b,c) => { return true; };

    return { 
        processSale, generateStock, executeConfirmAction, 
        addCatalogService, addCatalogPackage, updateCatalogService, 
        quickRenew, editAccountCredentials, migrateService, processBatchSale 
    };
};