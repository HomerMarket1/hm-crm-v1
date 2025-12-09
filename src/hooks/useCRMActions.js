import { addDoc, collection, doc, writeBatch, serverTimestamp } from 'firebase/firestore'; 
import { db } from '../firebase/config';
import { findIndividualServiceName } from '../utils/helpers'; 

const NO_OP_ACTIONS = {
    addCatalogService: async () => false,
    addCatalogPackage: async () => false,
    generateStock: async () => false,
    executeConfirmAction: async () => false,
    handleSave: async () => false,
};

export const useCRMActions = (user, setNotification) => {
    if (!user) return NO_OP_ACTIONS;
    const userPath = `users/${user.uid}`;
    const notify = (msg, type = 'success') => setNotification({ show: true, message: msg, type });

    const handleSave = async (formData, originalSale, catalog, sales, profilesToSell = 1, bulkProfiles = []) => {
        try {
            if (!originalSale || !originalSale.id) {
                notify('Error: No se encontró la ID de la venta original.', 'error');
                return false;
            }
            
            const batch = writeBatch(db);
            const totalCost = Number(formData.cost) || 0; 
            
            // 1. INVESTIGACIÓN DE CAPACIDAD Y TIPO DE SERVICIO
            let totalSlots = 1;
            const currentServiceInCatalog = catalog.find(c => c.name === originalSale.service);
            const serviceInFormCatalog = catalog.find(c => c.name === formData.service);
            const isFormServicePackage = serviceInFormCatalog && serviceInFormCatalog.type === 'Paquete'; 

            if (currentServiceInCatalog && Number(currentServiceInCatalog.defaultSlots) > 1) { totalSlots = Number(currentServiceInCatalog.defaultSlots); }
            if (totalSlots === 1) {
                const baseName = originalSale.service.split(' ')[0];
                const candidates = catalog.filter(c => c.name.includes(baseName) && Number(c.defaultSlots) > 1);
                if (candidates.length > 0) { 
                    const maxSlotsCandidate = candidates.reduce((max, current) => 
                        (Number(current.defaultSlots) > Number(max.defaultSlots) ? current : max), candidates[0]
                    );
                    totalSlots = Number(maxSlotsCandidate.defaultSlots); 
                }
            }

            // 2. CONDICIONES GLOBALES DE VENTA
            const wasFree = originalSale.client === 'LIBRE'; 
            const isSellingNow = formData.client !== 'LIBRE';
            const isPartialSale = profilesToSell < totalSlots; 
            const isMotherType = currentServiceInCatalog && 
                                 (currentServiceInCatalog.type.toLowerCase() === 'cuenta' || 
                                  currentServiceInCatalog.type.toLowerCase() === 'paquete');
            
            let shouldFragment = isMotherType && isPartialSale && isSellingNow; 
            const isMultiProfileSale = isSellingNow && profilesToSell > 1; 
            const isUpgradeSale = !wasFree && isMultiProfileSale;

            const saleRef = doc(db, userPath, 'sales', originalSale.id);
            const isMergeAttempt = originalSale.type === 'Perfil' && formData.service.toLowerCase().includes('cuenta completa');

            if (shouldFragment && profilesToSell <= 1) {
                shouldFragment = false; 
            }


            if (isMergeAttempt) {
                // SCENARIO 5: FUSIÓN DE CLONES EN UNA CUENTA MADRE NUEVA
                
                const allRelatedIds = sales.filter(s => s.email === originalSale.email && s.pass === originalSale.pass).map(s => s.id);
                allRelatedIds.forEach(id => batch.delete(doc(db, userPath, 'sales', id)));

                const newMotherRef = doc(collection(db, userPath, 'sales'));
                const motherCatalogEntry = catalog.find(c => c.name === formData.service);
                
                batch.set(newMotherRef, {
                    client: formData.client, phone: formData.phone, service: formData.service,
                    email: formData.email, pass: formData.pass, endDate: formData.endDate,
                    cost: motherCatalogEntry ? Number(motherCatalogEntry.cost) : totalCost, 
                    type: motherCatalogEntry ? motherCatalogEntry.type : 'Cuenta',
                    profile: '', pin: '', createdAt: serverTimestamp()
                });
                
                notify(`Cuentas fusionadas exitosamente. Nuevo registro madre creado.`, 'success');
                await batch.commit();
                return true;
            }

            if (shouldFragment) {
                // SCENARIO 1: FRAGMENTACIÓN 
                if (totalCost <= 0) { notify('Advertencia: Asigna un costo para fragmentar.', 'warning'); return false; }
                
                let individualCostFragment;
                if (isFormServicePackage) {
                    individualCostFragment = profilesToSell > 0 ? (totalCost / profilesToSell) : 0;
                } else {
                    individualCostFragment = totalCost; 
                }
                
                const individualServiceName = findIndividualServiceName(originalSale.service, catalog);

                const firstProfile = bulkProfiles[0] || {};
                const profileName1 = firstProfile.profile || formData.profile || '';
                const profilePin1 = firstProfile.pin || formData.pin || '';


                batch.update(saleRef, {
                    ...formData, service: originalSale.service, 
                    type: 'Perfil', 
                    profile: profilesToSell > 1 ? profileName1 : profileName1,
                    pin: profilesToSell > 1 ? profilePin1 : profilePin1,
                    cost: individualCostFragment, 
                    updatedAt: serverTimestamp()
                });

                const salesCollection = collection(db, userPath, 'sales');
                for (let i = 1; i < totalSlots; i++) {
                    const newDocRef = doc(salesCollection);
                    const creationDate = new Date(Date.now() + i * 50);
                    const isPartOfSale = i < profilesToSell; 
                    
                    const bulkIndex = i; 
                    const currentCloneProfile = bulkProfiles[bulkIndex] || {};
                    const cloneName = currentCloneProfile.profile || `Perfil ${i + 1}`;
                    const clonePin = currentCloneProfile.pin || '';


                    if (isPartOfSale) { 
                        batch.set(newDocRef, { ...formData, service: individualServiceName, type: 'Perfil', profile: cloneName, cost: individualCostFragment, pin: clonePin, soldAt: new Date(), createdAt: creationDate }); 
                    } else { 
                        batch.set(newDocRef, { client: 'LIBRE', phone: '', service: individualServiceName, type: 'Perfil', cost: individualCostFragment, email: formData.email, pass: formData.pass, profile: `Perfil ${i + 1}`, pin: '', endDate: '', createdAt: creationDate }); 
                    }
                }
                const libres = totalSlots - profilesToSell;
                notify(`Venta parcial: ${profilesToSell} ocupados, ${libres} libres generados.`, 'success');

            } else if (isMultiProfileSale) {
                // SCENARIO 2/3 CONSOLIDADO: VENTA MULTI-PERFIL (Paquete, Individual de Clones, o UPGRADE)
                
                if (originalSale.client !== 'LIBRE' && !isUpgradeSale) { 
                    notify('Error: El perfil inicial seleccionado no está libre para una venta múltiple.', 'error'); 
                    return false; 
                }
                
                const otherFreeSlots = sales.filter(s => s.client === 'LIBRE' && s.email === originalSale.email && s.pass === originalSale.pass && s.id !== originalSale.id).slice(0, profilesToSell - 1); 
                const neededSlots = profilesToSell;
                const availableSlots = 1 + otherFreeSlots.length;

                if (availableSlots < neededSlots) { 
                    notify(`Error: Solo se encontraron ${availableSlots} perfiles disponibles para esta venta de ${neededSlots}.`, 'error'); 
                    return false; 
                }

                const slotsToUpdate = [originalSale, ...otherFreeSlots];
                
                let finalUnitCost;
                if (isFormServicePackage) {
                    finalUnitCost = totalCost / neededSlots; 
                } else {
                    finalUnitCost = totalCost; 
                }
                
                const assignedClient = isUpgradeSale ? originalSale.client : formData.client;

                slotsToUpdate.forEach((slot, index) => { 
                    const updateRef = doc(db, userPath, 'sales', slot.id);
                    
                    // LECTURA DEL NOMBRE Y PIN ASIGNADO
                    const currentBulkProfile = bulkProfiles[index] || {};
                    
                    // ✅ FIX DE PRIORIDAD: Usamos el dato de bulkProfiles si existe, si no, usamos el dato existente en la tarjeta (slot.profile).
                    // Si el usuario ingresó un valor (aunque sea una cadena vacía en bulkProfiles), el dato debe ser ese.
                    const profileName = currentBulkProfile.profile !== undefined ? currentBulkProfile.profile : slot.profile || ''; 
                    const profilePin = currentBulkProfile.pin !== undefined ? currentBulkProfile.pin : slot.pin || ''; 
                    
                    if (slot.id === originalSale.id || slot.client === 'LIBRE') {
                         batch.update(updateRef, { 
                            client: assignedClient,
                            phone: formData.phone,
                            endDate: formData.endDate,
                            cost: finalUnitCost,
                            profile: profileName, 
                            pin: profilePin,     
                            service: formData.service,
                            updatedAt: serverTimestamp() 
                        });
                    }
                });
                
                notify(`Venta de ${neededSlots} perfiles registrada.`, 'success');

            } else {
                // SCENARIO 4: EDICIÓN SIMPLE / VENTA DE 1 PERFIL
                
                const finalCostToSave = totalCost; 

                batch.update(saleRef, { 
                    ...formData, 
                    cost: finalCostToSave, 
                    updatedAt: serverTimestamp() 
                });
                
                if (formData.client === 'LIBRE') notify('Servicio liberado.', 'success');
                else notify('Venta registrada/editada.', 'success');
            }

            await batch.commit();
            return true;

        } catch (error) {
            console.error("CRITICAL ERROR IN handleSave:", error);
            notify('Error CRÍTICO al guardar. Revisa la consola para más detalles.', 'error');
            return false;
        }
    };

    // Funciones auxiliares
    const addCatalogService = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { ...f, cost: Number(f.cost), defaultSlots: Number(f.defaultSlots), createdAt: serverTimestamp() }); notify('Servicio agregado.'); return true; } catch (e) { return false; } };
    const addCatalogPackage = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { name: `${f.name} Paquete ${f.slots}`, cost: Number(f.cost), type: 'Paquete', defaultSlots: Number(f.slots), createdAt: serverTimestamp() }); notify('Paquete creado.'); return true; } catch (e) { return false; } };
    const generateStock = async (f) => { try { const b = writeBatch(db); const r = collection(db, userPath, 'sales'); for(let i=0; i<f.slots; i++) b.set(doc(r), {client:'LIBRE', phone:'', service:f.service, email:f.email, pass:f.pass, profile:'', pin:'', cost:Number(f.cost), type:f.type, createdAt:new Date(Date.now()+i)}); await b.commit(); notify('Stock generado.'); return true; } catch(e){ return false; } };
    const executeConfirmAction = async (d, s, c) => { 
        try { 
            const batch = writeBatch(db);
            if(d.type==='delete_service') { batch.delete(doc(db, userPath, 'catalog', d.id)); } 
            else if(d.type==='liberate') { 
                const cur = s.find(i=>i.id===d.id); 
                
                let serviceToSave = cur.service;
                if (cur.type && cur.type.toLowerCase() === 'perfil') {
                    serviceToSave = findIndividualServiceName(cur.service, c); 
                } 
                
                batch.update(doc(db, userPath, 'sales', d.id), {client:'LIBRE', phone:'', endDate:'', profile:'', pin:'', service: serviceToSave, updatedAt:serverTimestamp()}); 
            } else if (d.type === 'delete_account') {
                d.data.forEach(id => batch.delete(doc(db, userPath, 'sales', id)));
            } else if (d.type === 'delete_free_stock') {
                 d.data.forEach(id => batch.delete(doc(db, userPath, 'sales', id)));
            }
            await batch.commit(); notify('Éxito.', 'success'); return true; 
        } catch(e){ 
            console.error("CRITICAL ERROR IN executeConfirmAction:", e);
            notify('Error al borrar. Revisa la consola para más detalles.', 'error'); return false; 
        } 
    };

    return { addCatalogService, addCatalogPackage, generateStock, executeConfirmAction, handleSave };
};