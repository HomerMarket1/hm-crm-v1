import { addDoc, collection, doc, writeBatch, serverTimestamp, updateDoc, query, where, getDocs, getDoc } from 'firebase/firestore'; 
import { db } from '../firebase/config';

// Helper para limpiar nombres básicos
const findBaseServiceName = (serviceName) => {
    if (!serviceName) return '';
    return serviceName.replace(/\s(Cuenta|Completa|Paquete|Perfil|Perfiles|Renovación|Pantalla|Dispositivo).*$/gi, '').trim();
};

// LISTA DE ESTADOS SEGUROS (MANTENIMIENTO/STOCK)
// ⚠️ NOTA: 'Admin' ya NO está aquí, para permitir venderle perfiles sueltos.
const SAFE_STATUSES = [
    'libre', 'espacio libre', 'disponible', '', 
    'caída', 'caida', 'actualizar', 'dominio', 'reposicion', 
    'garantía', 'garantia', 'problemas', 'stock', 'seguimiento'
];

export const useCRMActions = (user, setNotification) => {
    if (!user) return {};

    const userPath = `users/${user.uid}`;
    const notify = (msg, type = 'success') => setNotification({ show: true, message: msg, type });

    // --- 1. GESTOR DE CONFIRMACIONES (LIBERAR / ELIMINAR) ---
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
                        // Limpieza de nombre y mantenimiento de unidad
                        const baseName = findBaseServiceName(saleToFree.service);
                        finalServiceName = `${baseName} Cuenta Completa`;
                        targetType = 'Cuenta';
                        targetProfile = ''; // Perfil vacío para estética limpia
                    } else {
                        const cleanName = saleToFree.service.replace(/paquete\s*\d*/gi, '').trim();
                        const originalService = currentCatalog.find(c => c.name === cleanName && c.type === 'Perfil');
                        finalServiceName = originalService ? originalService.name : findBaseServiceName(saleToFree.service);
                    }

                    batch.update(doc(db, userPath, 'sales', modalData.id), {
                        client: 'LIBRE', phone: '', endDate: '', cost: 0, 
                        service: finalServiceName, updatedAt: serverTimestamp(), 
                        type: targetType, profile: targetProfile, pin: ''
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

    // --- 3. PROCESAR VENTA (LÓGICA BLINDADA V3) ---
    const processSale = async (formData, originalSale, catalog, sales, profilesToSell = 1, bulkProfiles = []) => {
        try {
            if (!originalSale?.id) throw new Error("ID no encontrado");
            const batch = writeBatch(db);
            const totalCost = Number(formData.cost) || 0;
            const cleanFormData = { ...formData };
            Object.keys(cleanFormData).forEach(key => cleanFormData[key] === undefined && delete cleanFormData[key]);

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

            // 🛑 GUARDIA DE SEGURIDAD (SOLO si vamos a Mantenimiento Y el destino sigue siendo Cuenta)
            // Si cambias el servicio a "Perfil" manualmente, te dejamos fragmentar incluso en Mantenimiento.
            const isReturningAccountToStock = 
                isOriginalAccount && 
                isSafeStatus && 
                targetType === 'Cuenta';

            if (isReturningAccountToStock) {
                // Mantenimiento de Unidad
                const baseName = findBaseServiceName(formData.service);
                const cleanName = `${baseName} Cuenta Completa`;
                
                batch.update(doc(db, userPath, 'sales', originalSale.id), { 
                    ...cleanFormData, service: cleanName, cost: 0, type: 'Cuenta', profile: '', updatedAt: serverTimestamp() 
                });
                await batch.commit();
                notify('Cuenta actualizada (Unidad Mantenida).', 'success');
                return true;
            }

            // 4. BÚSQUEDA DE HERMANOS (Para Unificar o Fragmentar)
            const siblings = sales.filter(s => 
                s.email === originalSale.email && 
                s.id !== originalSale.id &&
                (s.pass === originalSale.pass || !s.pass || !originalSale.pass)
            );

            // A. UNIFICACIÓN (Si el destino es Cuenta Completa -> Borramos todo lo demás)
            // Esto cubre "Asignar Cuenta Completa a Admin"
            if (targetType === 'Cuenta') {
                siblings.forEach(sib => batch.delete(doc(db, userPath, 'sales', sib.id)));
                
                const baseName = findBaseServiceName(formData.service);
                const cleanName = `${baseName} Cuenta Completa`;

                batch.update(doc(db, userPath, 'sales', originalSale.id), { 
                    ...cleanFormData, service: cleanName, type: 'Cuenta', profile: '', pin: '', cost: totalCost, updatedAt: serverTimestamp() 
                });
                await batch.commit(); 
                notify('Cuenta Unificada correctamente.', 'success'); 
                return true;
            }

            // B. FRAGMENTACIÓN / VENTA
            // Si llegamos aquí, NO es Cuenta Completa, así que es Perfil o Paquete.
            // Admin cae aquí si eliges "Netflix" (Perfil) como servicio.
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
                    
                    // Intentamos buscar capacidad en catálogo
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
                            slotData = { ...cleanFormData, cost: unitCost, profile: profileName, pin: pinCode || '', type: 'Perfil' };
                        } else {
                            slotData = { client: 'LIBRE', phone: '', service: freeServiceName, type: 'Perfil', cost: 0, email: cleanFormData.email, pass: cleanFormData.pass, profile: `Perfil ${i+1}`, pin: '', endDate: '' };
                        }
                        if (i === 0) batch.update(doc(db, userPath, 'sales', originalSale.id), { ...slotData, updatedAt: serverTimestamp() });
                        else { const newDoc = doc(collection(db, userPath, 'sales')); batch.set(newDoc, { ...slotData, createdAt: new Date(Date.now() + i*50) }); }
                    }
                } else {
                    // VENTA MULTIPLE DESDE PERFILES SUELTOS
                    const availableSiblings = siblings.filter(s => SAFE_STATUSES.includes((s.client || '').toLowerCase()));
                    if (1 + availableSiblings.length < slotsToOccupy) { notify(`No hay suficientes slots libres.`, 'error'); return false; }
                    
                    const pData0 = bulkProfiles[0] || {};
                    batch.update(doc(db, userPath, 'sales', originalSale.id), { ...cleanFormData, cost: unitCost, profile: pData0.profile || cleanFormData.profile, pin: pData0.pin || cleanFormData.pin || '', updatedAt: serverTimestamp() });
                    
                    for (let i = 1; i < slotsToOccupy; i++) {
                        const targetDoc = availableSiblings[i-1];
                        const pData = bulkProfiles[i] || {};
                        batch.update(doc(db, userPath, 'sales', targetDoc.id), { ...cleanFormData, cost: unitCost, profile: pData.profile || `Perfil ${i+1}`, pin: pData.pin || '', updatedAt: serverTimestamp() });
                    }
                }
                await batch.commit(); notify(`Venta registrada.`, 'success'); return true;
            }

            // Actualización simple
            batch.update(doc(db, userPath, 'sales', originalSale.id), { ...cleanFormData, cost: totalCost, updatedAt: serverTimestamp() });
            await batch.commit(); notify('Guardado correctamente.', 'success'); return true;
        } catch (error) { console.error("Error:", error); notify('Error al guardar.', 'error'); return false; }
    };

    const migrateService = async (sourceInput, targetInput, oldSlotStatus = 'LIBRE') => {
        try {
            const sourceId = (typeof sourceInput === 'object' && sourceInput !== null) ? sourceInput.id : sourceInput;
            const targetId = (typeof targetInput === 'object' && targetInput !== null) ? targetInput.id : targetInput;
            if (!sourceId || !targetId || typeof sourceId !== 'string') { notify('IDs inválidos.', 'error'); return false; }
            const sourceRef = doc(db, userPath, 'sales', sourceId);
            const targetRef = doc(db, userPath, 'sales', targetId);
            const batch = writeBatch(db);
            const sourceSnap = await getDoc(sourceRef);
            if (!sourceSnap.exists()) return;
            const sourceData = sourceSnap.data();

            batch.update(targetRef, {
                client: sourceData.client, phone: sourceData.phone || '', endDate: sourceData.endDate || '', cost: sourceData.cost || 0,
                profile: sourceData.profile || '', pin: sourceData.pin || '', lastCode: sourceData.lastCode || '', updatedAt: serverTimestamp()
            });

            let newSourceData = { client: oldSlotStatus, updatedAt: serverTimestamp() };
            if (oldSlotStatus === 'LIBRE') {
                newSourceData = { ...newSourceData, phone: '', endDate: '', cost: 0, profile: '', pin: '', lastCode: '' };
            } else {
                newSourceData = { ...newSourceData, phone: '', endDate: '', cost: 0 };
            }
            batch.update(sourceRef, newSourceData);
            await batch.commit(); notify('Migración completada.', 'success'); return true;
        } catch (error) { console.error(error); notify('Error al migrar.', 'error'); return false; }
    };

    const quickRenew = async (id, date) => {
        if(!id || !date) return;
        try {
            const [y, m, d] = date.split('-').map(Number);
            const currentEndDate = new Date(y, m - 1, d);
            currentEndDate.setMonth(currentEndDate.getMonth() + 1);
            const nextYear = currentEndDate.getFullYear();
            const nextMonth = String(currentEndDate.getMonth() + 1).padStart(2, '0');
            const nextDay = String(currentEndDate.getDate()).padStart(2, '0');
            const finalDate = `${nextYear}-${nextMonth}-${nextDay}`;
            await updateDoc(doc(db, userPath, 'sales', id), { endDate: finalDate, updatedAt: serverTimestamp() });
            notify('Renovado: Mismo día, próximo mes.', 'success'); return true;
        } catch(e) { console.error("Error renovando:", e); notify('Error al renovar.', 'error'); return false; }
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