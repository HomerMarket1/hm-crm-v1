// src/hooks/useCRMActions.js
import { addDoc, collection, doc, writeBatch, serverTimestamp, updateDoc } from 'firebase/firestore'; 
import { db } from '../firebase/config';

const findIndividualServiceName = (currentServiceName, catalog) => {
    const baseName = currentServiceName.split(' ')[0]; 
    const individual = catalog.find(c => c.name.includes(baseName) && c.type === 'Perfil');
    return individual ? individual.name : currentServiceName;
};

export const useCRMActions = (user, setNotification) => {
    if (!user) return {
        addCatalogService: async () => false,
        addCatalogPackage: async () => false,
        generateStock: async () => false,
        executeConfirmAction: async () => false,
        processSale: async () => false,
        processBatchSale: async () => false,
        quickRenew: async () => false,
        editAccountCredentials: async () => false,
        updateCatalogService: async () => false,
    };

    const userPath = `users/${user.uid}`;
    const notify = (msg, type = 'success') => setNotification({ show: true, message: msg, type });

    // --- 1. ACCIONES DE CUENTA ---
    const editAccountCredentials = async (email, oldPass, newPass, sales) => {
        try {
            if (newPass === oldPass) { notify('La contraseña es la misma.', 'info'); return true; }
            const batch = writeBatch(db);
            const salesToUpdate = sales.filter(sale => sale.email === email && sale.pass === oldPass);

            if (salesToUpdate.length === 0) {
                const freeStockRef = sales.find(s => s.email === email && s.pass === oldPass && s.client === 'LIBRE');
                if (freeStockRef) {
                     batch.update(doc(db, userPath, 'sales', freeStockRef.id), { pass: newPass, updatedAt: serverTimestamp() });
                    await batch.commit(); return true;
                }
                notify('No se encontraron registros.', 'error'); return false;
            }

            salesToUpdate.forEach(sale => {
                batch.update(doc(db, userPath, 'sales', sale.id), { pass: newPass, updatedAt: serverTimestamp() });
            });
            await batch.commit();
            notify(`Contraseña actualizada en ${salesToUpdate.length} registros.`, 'success');
            return true;
        } catch (error) {
            console.error(error); notify('Fallo al editar credenciales.', 'error'); return false;
        }
    };

    // --- 2. LÓGICA MAESTRA DE VENTA ---
    const processSale = async (formData, originalSale, catalog, sales, profilesToSell = 1, bulkProfiles = []) => {
        try {
            if (!originalSale || !originalSale.id) { notify('Error: Venta original no encontrada.', 'error'); return false; }
            
            const batch = writeBatch(db);
            const totalCost = Number(formData.cost) || 0; 

            // Datos de destino y origen
            const targetCatalogItem = catalog.find(c => c.name === formData.service);
            const targetType = targetCatalogItem ? targetCatalogItem.type : 'Perfil'; 
            const originalType = originalSale.type || 'Perfil';

            // =======================================================================
            // ESCENARIO 1: UNIFICACIÓN (Solo si el destino es explícitamente CUENTA)
            // =======================================================================
            // CORRECCIÓN: Quitamos 'Paquete' de aquí. Los paquetes se tratan como fragmentación.
            if (targetType === 'Cuenta') {
                
                const siblings = sales.filter(s => 
                    s.email === originalSale.email && 
                    s.pass === originalSale.pass && 
                    s.id !== originalSale.id && 
                    (s.client === 'LIBRE' || s.client === originalSale.client || s.client === formData.client)
                );

                siblings.forEach(sib => {
                    batch.delete(doc(db, userPath, 'sales', sib.id));
                });

                const survivorRef = doc(db, userPath, 'sales', originalSale.id);
                batch.update(survivorRef, {
                    ...formData,
                    type: 'Cuenta', 
                    profile: 'General', 
                    pin: '',
                    cost: totalCost,
                    updatedAt: serverTimestamp()
                });

                notify(`¡Cuenta Unificada! ${siblings.length + 1} perfiles fusionados.`, 'success');
                await batch.commit();
                return true;
            }

            // =======================================================================
            // ESCENARIO 2: FRAGMENTACIÓN (Cuenta -> Paquete o Perfiles)
            // =======================================================================
            // Si el origen es Cuenta y el destino es Perfil O Paquete... DIVIDIMOS.
            if (originalType === 'Cuenta' && (targetType === 'Perfil' || targetType === 'Paquete')) {
                
                if (totalCost <= 0) { notify('Asigna un costo para fragmentar.', 'warning'); return false; }

                // 1. OBTENER LOS CUPOS TOTALES DE LA CUENTA ORIGINAL (IMPORTANTE)
                // Buscamos en el catálogo cuántos cupos tiene la "Netflix Cuenta Completa" (origen)
                // NO cuántos tiene el paquete que estoy vendiendo.
                let totalSlotsOfMotherAccount = 5; // Default seguro
                const originCatalogItem = catalog.find(c => c.name === originalSale.service); // Buscamos por el servicio ORIGINAL
                
                if (originCatalogItem && originCatalogItem.defaultSlots) {
                    totalSlotsOfMotherAccount = Number(originCatalogItem.defaultSlots);
                }

                // 2. Calcular costo unitario para la venta
                const unitCostForSold = totalCost / profilesToSell;
                
                // 3. Nombre para los perfiles que queden LIBRES
                const freeServiceName = findIndividualServiceName(originalSale.service, catalog);

                const salesCollection = collection(db, userPath, 'sales');

                // 4. BUCLE MAESTRO: Crear/Actualizar las 5 tarjetas
                for (let i = 0; i < totalSlotsOfMotherAccount; i++) {
                    const isSoldSlot = i < profilesToSell; // ¿Este índice es parte de la venta?
                    const currentProfileData = bulkProfiles[i] || {};
                    
                    // Datos comunes para LIBRES
                    const freeData = {
                        client: 'LIBRE', 
                        phone: '', 
                        service: freeServiceName, 
                        type: 'Perfil', 
                        cost: 0, // Los libres no tienen costo asignado aun
                        email: formData.email, 
                        pass: formData.pass, 
                        profile: `Perfil ${i + 1}`, 
                        pin: '', 
                        endDate: '',
                    };

                    // Datos comunes para VENDIDOS
                    const soldData = {
                        ...formData,
                        type: 'Perfil', // Aunque sea paquete, se comporta como perfil individual visualmente
                        service: formData.service, // Mantiene nombre "Paquete 2..." para saber qué se vendió
                        cost: unitCostForSold,
                        profile: currentProfileData.profile || `Perfil ${i + 1}`,
                        pin: currentProfileData.pin || '',
                    };

                    if (i === 0) {
                        // LA TARJETA SOBREVIVIENTE (Actualizamos la original)
                        const survivorRef = doc(db, userPath, 'sales', originalSale.id);
                        batch.update(survivorRef, {
                            ...(isSoldSlot ? soldData : freeData),
                            updatedAt: serverTimestamp()
                        });
                    } else {
                        // TARJETAS NUEVAS (Clones)
                        const newDocRef = doc(salesCollection);
                        const creationDate = new Date(Date.now() + i * 50);
                        batch.set(newDocRef, {
                            ...(isSoldSlot ? soldData : freeData),
                            createdAt: creationDate
                        });
                    }
                }

                notify(`Cuenta dividida: ${profilesToSell} vendidos, ${totalSlotsOfMotherAccount - profilesToSell} libres.`, 'success');
                await batch.commit();
                return true;
            }

            // =======================================================================
            // ESCENARIO 3: VENTA NORMAL
            // =======================================================================
            // Lógica existente para ventas simples o múltiples desde libres ya fragmentados
            const saleRef = doc(db, userPath, 'sales', originalSale.id);
            
            if (profilesToSell > 1 && originalSale.client === 'LIBRE') {
                const otherFreeSlots = sales.filter(s => s.client === 'LIBRE' && s.email === originalSale.email && s.pass === originalSale.pass && s.id !== originalSale.id).slice(0, profilesToSell - 1); 
                
                if ((1 + otherFreeSlots.length) < profilesToSell) { notify(`Stock insuficiente.`, 'error'); return false; }

                const slotsToUpdate = [originalSale, ...otherFreeSlots];
                const finalUnitCost = targetType === 'Paquete' ? totalCost / profilesToSell : totalCost;

                slotsToUpdate.forEach((slot, index) => { 
                    const currentBulkProfile = bulkProfiles[index] || {};
                    batch.update(doc(db, userPath, 'sales', slot.id), { 
                        client: formData.client, phone: formData.phone, endDate: formData.endDate, cost: finalUnitCost,
                        profile: currentBulkProfile.profile || slot.profile || '', pin: currentBulkProfile.pin || slot.pin || '',     
                        service: formData.service, updatedAt: serverTimestamp() 
                    });
                });
                notify(`Venta de ${profilesToSell} perfiles registrada.`, 'success');

            } else {
                batch.update(saleRef, { ...formData, cost: totalCost, updatedAt: serverTimestamp() });
                if (formData.client === 'LIBRE') notify('Servicio liberado.', 'success');
                else notify('Venta registrada.', 'success');
            }

            await batch.commit(); return true;

        } catch (error) {
            console.error("Error processSale:", error); notify('Error al procesar venta.', 'error'); return false;
        }
    };

    // --- MANTENER RESTO DE FUNCIONES IGUALES ---
    const processBatchSale = async (f, q, r, b, c) => { try { if (q > r.length) { notify(`Stock insuficiente. Solo quedan ${r.length}.`, 'error'); return false; } const batch = writeBatch(db); const profilesToSell = r.slice(0, q); const totalCost = Number(f.cost) || 0; const selectedService = c.find(cat => cat.name === f.service); const isPackage = selectedService && selectedService.type === 'Paquete'; const unitCost = (q > 1 && isPackage) ? (totalCost / q).toFixed(2) : totalCost; profilesToSell.forEach((docSnap, index) => { const currentBulkProfile = b[index] || {}; batch.update(doc(db, userPath, 'sales', docSnap.id), { client: f.client, phone: f.phone || '', endDate: f.endDate, cost: Number(unitCost), type: f.type, soldAt: new Date(), profile: currentBulkProfile.profile || docSnap.profile || '', pin: currentBulkProfile.pin || docSnap.pin || '' }); }); await batch.commit(); notify(`¡Venta de ${q} perfiles exitosa!`, 'success'); return true; } catch (error) { console.error(error); notify('Error venta masiva.', 'error'); return false; } };
    const quickRenew = async (saleId, currentEndDate) => { if (!saleId || !currentEndDate) return false; try { const [y, m, d] = currentEndDate.split('-').map(Number); const currentDate = new Date(y, m - 1, d); const nextDate = new Date(currentDate); nextDate.setMonth(nextDate.getMonth() + 1); if (currentDate.getDate() !== nextDate.getDate()) { nextDate.setDate(0); } await updateDoc(doc(db, userPath, 'sales', saleId), { endDate: nextDate.toISOString().split('T')[0] }); notify('Renovado +1 mes exacto.', 'success'); return true; } catch (error) { notify('Error al renovar.', 'error'); return false; } };
    const addCatalogService = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { ...f, cost: Number(f.cost), defaultSlots: Number(f.defaultSlots), createdAt: serverTimestamp() }); notify('Servicio agregado.'); return true; } catch (e) { return false; } };
    const addCatalogPackage = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { name: `${f.name} Paquete ${f.slots}`, cost: Number(f.cost), type: 'Paquete', defaultSlots: Number(f.slots), createdAt: serverTimestamp() }); notify('Paquete creado.'); return true; } catch (e) { return false; } };
    const updateCatalogService = async (id, data) => { try { await updateDoc(doc(db, userPath, 'catalog', id), data); notify('Servicio actualizado.'); return true; } catch (e) { return false; } };
    const generateStock = async (f) => { try { const b = writeBatch(db); const r = collection(db, userPath, 'sales'); for(let i=0; i<f.slots; i++) b.set(doc(r), {client:'LIBRE', phone:'', service:f.service, email:f.email, pass:f.pass, profile:'', pin:'', cost:Number(f.cost), type:f.type, createdAt:new Date(Date.now()+i)}); await b.commit(); notify('Stock generado.'); return true; } catch(e){ return false; } };
    const executeConfirmAction = async (d, s, c) => { try { const batch = writeBatch(db); if(d.type==='delete_service') batch.delete(doc(db, userPath, 'catalog', d.id)); else if(d.type==='liberate') { const cur = s.find(i=>i.id===d.id); const svc = (cur.type?.toLowerCase() === 'perfil') ? findIndividualServiceName(cur.service, c) : cur.service; batch.update(doc(db, userPath, 'sales', d.id), {client:'LIBRE', phone:'', endDate:'', profile:'', pin:'', service: svc, updatedAt:serverTimestamp()}); } else if (d.type === 'delete_account' || d.type === 'delete_free_stock') d.data.forEach(id => batch.delete(doc(db, userPath, 'sales', id))); await batch.commit(); notify('Éxito.', 'success'); return true; } catch(e){ notify('Error al borrar.', 'error'); return false; } };

    return { addCatalogService, addCatalogPackage, generateStock, executeConfirmAction, editAccountCredentials, processSale, processBatchSale, quickRenew, updateCatalogService };
};