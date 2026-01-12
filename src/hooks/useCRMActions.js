import { addDoc, collection, doc, writeBatch, serverTimestamp, updateDoc, query, where, getDocs, getDoc } from 'firebase/firestore'; 
import { db } from '../firebase/config';

const findBaseServiceName = (serviceName) => {
    if (!serviceName) return '';
    return serviceName.split(' ')[0]; 
};

const MAINTENANCE_STATUSES = ['caída', 'caida', 'actualizar', 'dominio', 'reposicion', 'garantía', 'garantia', 'problemas', 'admin'];

export const useCRMActions = (user, setNotification) => {
    if (!user) return {};

    const userPath = `users/${user.uid}`;
    const notify = (msg, type = 'success') => setNotification({ show: true, message: msg, type });

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
                    const isAccount = (saleToFree.type === 'Cuenta' || saleToFree.service.toLowerCase().includes('cuenta completa')) && !isPackage;

                    let finalServiceName = saleToFree.service;
                    let targetType = 'Perfil';
                    let targetProfile = ''; 

                    if (isAccount) {
                        targetType = 'Cuenta';
                        targetProfile = 'Cuenta Completa'; 
                        finalServiceName = saleToFree.service; 
                    } else {
                        targetType = 'Perfil';
                        targetProfile = ''; 
                        const cleanName = saleToFree.service.replace(/paquete\s*\d*/gi, '').trim();
                        const originalService = currentCatalog.find(c => c.name === cleanName && c.type === 'Perfil');
                        if (originalService) {
                            finalServiceName = originalService.name;
                        } else {
                            const baseName = findBaseServiceName(saleToFree.service);
                            const fuzzyService = currentCatalog.find(c => c.name.includes(baseName) && c.type === 'Perfil');
                            finalServiceName = fuzzyService ? fuzzyService.name : baseName;
                        }
                    }

                    batch.update(doc(db, userPath, 'sales', modalData.id), {
                        client: 'LIBRE', phone: '', endDate: '', cost: 0, service: finalServiceName, updatedAt: serverTimestamp(), type: targetType, profile: targetProfile, pin: ''
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
        } catch (error) {
            console.error("Error crítico:", error);
            notify('Error al ejecutar la acción.', 'error');
            return false;
        }
    };

    const generateStock = async (form) => {
        try {
            const batch = writeBatch(db);
            const isAccountType = form.type === 'Cuenta' || form.service.toLowerCase().includes('cuenta completa');
            const loops = isAccountType ? 1 : (Number(form.slots) || 1);
            
            for(let i=0; i < loops; i++) {
                const newDocRef = doc(collection(db, userPath, 'sales'));
                const profileName = isAccountType ? 'Cuenta Completa' : `Perfil ${i+1}`;

                batch.set(newDocRef, {
                    client: 'LIBRE', service: form.service, email: form.email, pass: form.pass, cost: 0,
                    type: isAccountType ? 'Cuenta' : (form.type || 'Perfil'), createdAt: serverTimestamp(), profile: profileName, pin: ''
                });
            }
            await batch.commit();
            notify(isAccountType ? `Cuenta agregada.` : `Generados ${loops} perfiles.`, 'success');
            return true;
        } catch(e) { return false; }
    };

    const processSale = async (formData, originalSale, catalog, sales, profilesToSell = 1, bulkProfiles = []) => {
        try {
            if (!originalSale?.id) throw new Error("ID no encontrado");
            const batch = writeBatch(db);
            const totalCost = Number(formData.cost) || 0;
            
            const cleanFormData = { ...formData };
            Object.keys(cleanFormData).forEach(key => cleanFormData[key] === undefined && delete cleanFormData[key]);

            const targetCatalogItem = catalog.find(c => c.name === formData.service);
            const targetType = targetCatalogItem?.type || 'Perfil';
            const originalType = originalSale.type || 'Perfil';

            // 🔥 CORRECCIÓN LÓGICA: SOLO proteger si NO es una cuenta completa siendo fragmentada 🔥
            const isMaintenanceStatus = MAINTENANCE_STATUSES.includes(formData.client.toLowerCase().trim());
            const isSameService = formData.service === originalSale.service;
            
            // Si ya era un Perfil o Paquete (cuenta fragmentada) y solo cambiamos a Admin/Caída, es Edición Simple.
            if (formData.id && originalType !== 'Cuenta' && (isMaintenanceStatus || isSameService)) {
                batch.update(doc(db, userPath, 'sales', originalSale.id), { 
                    ...cleanFormData, 
                    cost: totalCost, 
                    updatedAt: serverTimestamp() 
                });
                await batch.commit();
                notify('Cambios guardados.', 'success');
                return true;
            }

            const siblings = sales.filter(s => s.email === originalSale.email && s.pass === originalSale.pass && s.id !== originalSale.id);

            // A. UNIFICACIÓN
            if (targetType === 'Cuenta') {
                siblings.forEach(sib => batch.delete(doc(db, userPath, 'sales', sib.id)));
                batch.update(doc(db, userPath, 'sales', originalSale.id), { ...cleanFormData, type: 'Cuenta', profile: 'General', pin: '', cost: totalCost, updatedAt: serverTimestamp() });
                await batch.commit(); 
                notify('Cuenta Unificada.', 'success'); 
                return true;
            }

            // B. FRAGMENTACIÓN / VENTA NUEVA
            const isComplexOperation = targetType === 'Paquete' || originalType === 'Cuenta' || profilesToSell > 1;

            if (isComplexOperation) {
                let slotsToOccupy = profilesToSell;
                if (targetType === 'Paquete' && profilesToSell === 1) {
                     const pkgSlots = Number(targetCatalogItem?.defaultSlots || 2);
                     slotsToOccupy = pkgSlots;
                }
                const unitCost = totalCost / (slotsToOccupy > 0 ? slotsToOccupy : 1);

                if (originalType === 'Cuenta') {
                    siblings.forEach(sib => batch.delete(doc(db, userPath, 'sales', sib.id)));
                    
                    let realBaseName = formData.service
                        .replace(/paquete\s*\d*/gi, '')
                        .replace(/cuenta\s*completa/gi, '')
                        .trim();

                    const isNetflix = realBaseName.toLowerCase().includes('netflix');
                    let defaultCapacity = isNetflix ? 5 : 4;
                    
                    const accountCatalogItem = catalog.find(c => c.name === `${realBaseName} Cuenta Completa` || (c.name.includes(realBaseName) && c.type === 'Cuenta'));
                    if (accountCatalogItem && accountCatalogItem.defaultSlots) {
                        defaultCapacity = Number(accountCatalogItem.defaultSlots);
                    } else {
                        const baseCatalogItem = catalog.find(c => c.name === realBaseName && c.type === 'Perfil');
                        if (baseCatalogItem?.defaultSlots && Number(baseCatalogItem.defaultSlots) > 1) {
                            defaultCapacity = Number(baseCatalogItem.defaultSlots);
                        }
                    }

                    const accountCapacity = Math.max(siblings.length + 1, defaultCapacity);
                    const freeServiceName = realBaseName; 

                    for (let i = 0; i < accountCapacity; i++) {
                        const isSold = i < slotsToOccupy;
                        const pData = bulkProfiles[i] || {}; 
                        let slotData = {};
                        if (isSold) {
                            const profileName = (profilesToSell === 1) 
                                ? (pData.profile || cleanFormData.profile || `Perfil ${i+1}`)
                                : (pData.profile || `Perfil ${i+1}`);
                            const pinCode = (pData.pin) ? pData.pin : cleanFormData.pin;
                            slotData = { ...cleanFormData, cost: unitCost, profile: profileName, pin: pinCode || '', type: 'Perfil' };
                        } else {
                            slotData = { client: 'LIBRE', phone: '', service: freeServiceName, type: 'Perfil', cost: 0, email: cleanFormData.email, pass: cleanFormData.pass, profile: `Perfil ${i+1}`, pin: '', endDate: '' };
                        }
                        if (i === 0) batch.update(doc(db, userPath, 'sales', originalSale.id), { ...slotData, updatedAt: serverTimestamp() });
                        else { const newDoc = doc(collection(db, userPath, 'sales')); batch.set(newDoc, { ...slotData, createdAt: new Date(Date.now() + i*50) }); }
                    }
                } else {
                    const availableSiblings = siblings.filter(s => s.client === 'LIBRE' || s.client === '' || s.client === 'Espacio Libre');
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

            batch.update(doc(db, userPath, 'sales', originalSale.id), { ...cleanFormData, cost: totalCost, updatedAt: serverTimestamp() });
            await batch.commit(); notify('Guardado correctamente.', 'success'); return true;
        } catch (error) { console.error("Error:", error); notify('Error al guardar.', 'error'); return false; }
    };

    const migrateService = async (sourceInput, targetInput, oldSlotStatus = 'LIBRE') => {
        try {
            const sourceId = (typeof sourceInput === 'object' && sourceInput !== null) ? sourceInput.id : sourceInput;
            const targetId = (typeof targetInput === 'object' && targetInput !== null) ? targetInput.id : targetInput;

            if (!sourceId || !targetId || typeof sourceId !== 'string') {
                notify('IDs de migración inválidos.', 'error');
                return false;
            }

            const sourceRef = doc(db, userPath, 'sales', sourceId);
            const targetRef = doc(db, userPath, 'sales', targetId);
            const sourceSnap = await getDoc(sourceRef);
            const targetSnap = await getDoc(targetRef);

            if (!sourceSnap.exists() || !targetSnap.exists()) { notify('Datos no encontrados.', 'error'); return false; }

            const sourceData = sourceSnap.data();
            const batch = writeBatch(db);

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
            await batch.commit();
            notify('Migración completada.', 'success');
            return true;
        } catch (error) { console.error(error); notify('Error al migrar.', 'error'); return false; }
    };

    const addCatalogService = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { ...f, cost: Number(f.cost), defaultSlots: Number(f.defaultSlots), createdAt: serverTimestamp() }); notify('Servicio creado.'); return true; } catch(e){ return false; } };
    const addCatalogPackage = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { name: `${f.name} Paquete ${f.slots}`, cost: Number(f.cost), type: 'Paquete', defaultSlots: Number(f.slots), createdAt: serverTimestamp() }); notify('Paquete creado.'); return true; } catch(e){ return false; } };
    const updateCatalogService = async (id, d) => { try { await updateDoc(doc(db, userPath, 'catalog', id), d); notify('Actualizado.'); return true; } catch(e){ return false; } };
    const quickRenew = async (id, date) => { if(!id || !date) return; try { const d = new Date(date); d.setMonth(d.getMonth()+1); d.setDate(d.getDate()+1); await updateDoc(doc(db, userPath, 'sales', id), { endDate: d.toISOString().split('T')[0] }); notify('Renovado.'); return true; } catch(e){ return false; } };
    const editAccountCredentials = async (e,o,n) => { try { if (n===o) return true; const q = query(collection(db, userPath, 'sales'), where('email', '==', e), where('pass', '==', o)); const snap = await getDocs(q); if (snap.empty) { notify('No encontrado.', 'error'); return false; } const b = writeBatch(db); snap.forEach(d => b.update(d.ref, { pass: n, updatedAt: serverTimestamp() })); await b.commit(); notify('Credenciales actualizadas.', 'success'); return true; } catch(e) { notify('Error.', 'error'); return false; } };
    const processBatchSale = async (f,q,r,b,c) => { return true; };

    return { 
        processSale, generateStock, executeConfirmAction, 
        addCatalogService, addCatalogPackage, updateCatalogService, 
        quickRenew, editAccountCredentials, migrateService, processBatchSale 
    };
};