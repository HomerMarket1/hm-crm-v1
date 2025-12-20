// src/hooks/useCRMActions.js
import { addDoc, collection, doc, writeBatch, serverTimestamp, updateDoc, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../firebase/config';

// Helper para encontrar nombres base (ej: "Netflix 1 Palla" -> "Netflix")
const findIndividualServiceName = (currentServiceName, catalog) => {
    const baseName = currentServiceName.split(' ')[0]; 
    const individual = catalog.find(c => c.name.includes(baseName) && c.type === 'Perfil');
    return individual ? individual.name : currentServiceName;
};

// Helper interno para fechas (Soporta YYYY-MM-DD y DD/MM/YYYY)
const parseFlexibleDate = (dateStr) => {
    if (!dateStr) return null;
    try {
        // Formato ISO
        if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) return dateStr;
        // Formato Latino
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        return null;
    } catch (e) { return null; }
};

export const useCRMActions = (user, setNotification) => {
    // Retorno seguro si no hay usuario
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
        importLegacyPortfolio: async () => false, // ✅ Agregado al fallback
    };

    const userPath = `users/${user.uid}`;
    const notify = (msg, type = 'success') => setNotification({ show: true, message: msg, type });

    // --- 1. MIGRACIÓN MASIVA (IMPORTADOR EXCEL) ---
    const importLegacyPortfolio = async (dataList) => {
        if (!user) return false;
        try {
            const batchSize = 400; // Límite seguro de Firebase (max 500)
            const chunks = [];
            
            // Dividimos los datos en trozos manejables
            for (let i = 0; i < dataList.length; i += batchSize) {
                chunks.push(dataList.slice(i, i + batchSize));
            }

            let totalProcessed = 0;

            for (const chunk of chunks) {
                const batch = writeBatch(db);
                
                chunk.forEach(row => {
                    // A. Crear documento de Venta
                    const saleRef = doc(collection(db, userPath, 'sales'));
                    const formattedDate = parseFlexibleDate(row.endDate);
                    
                    const saleData = {
                        client: row.client || 'Cliente Importado',
                        phone: row.phone || '',
                        service: row.service || 'Servicio Desconocido',
                        email: row.email || '',
                        pass: row.pass || '',
                        profile: row.profile || '',
                        pin: row.pin || '',
                        cost: Number(row.cost) || 0,
                        endDate: formattedDate || '', // Si es inválida, queda vacío (vencido)
                        imported: true,
                        createdAt: serverTimestamp(),
                        type: 'Perfil' // Asumimos perfil por defecto en importación
                    };
                    batch.set(saleRef, saleData);

                    // B. Actualizar Directorio de Clientes (Si no es LIBRE)
                    if (row.client && row.client.toUpperCase() !== 'LIBRE') {
                        // Usamos un ID sanitizado basado en el nombre para evitar duplicados en el directorio
                        const safeId = row.client.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                        const clientRef = doc(db, userPath, 'clients', safeId);
                        batch.set(clientRef, {
                            name: row.client,
                            phone: row.phone || '',
                            updatedAt: serverTimestamp()
                        }, { merge: true });
                    }
                });

                await batch.commit();
                totalProcessed += chunk.length;
                console.log(`Lote migrado: ${totalProcessed} registros.`);
            }

            notify(`Migración completada: ${totalProcessed} clientes importados.`, 'success');
            return true;

        } catch (error) {
            console.error("Error en migración:", error);
            notify('Error crítico durante la migración.', 'error');
            return false;
        }
    };

    // --- 2. ACCIONES DE CUENTA (OPTIMIZADO) ---
    const editAccountCredentials = async (email, oldPass, newPass) => {
        try {
            if (newPass === oldPass) { notify('La contraseña es la misma.', 'info'); return true; }
            
            const q = query(
                collection(db, userPath, 'sales'),
                where('email', '==', email),
                where('pass', '==', oldPass)
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                notify('No se encontraron registros coincidentes.', 'error'); 
                return false;
            }

            const batch = writeBatch(db);
            let count = 0;

            querySnapshot.forEach((docSnap) => {
                batch.update(docSnap.ref, { pass: newPass, updatedAt: serverTimestamp() });
                count++;
            });

            await batch.commit();
            notify(`Contraseña actualizada en ${count} registros.`, 'success');
            return true;

        } catch (error) {
            console.error(error); notify('Fallo al editar credenciales.', 'error'); return false;
        }
    };

    // --- 3. LÓGICA MAESTRA DE VENTA ---
    const processSale = async (formData, originalSale, catalog, sales, profilesToSell = 1, bulkProfiles = []) => {
        try {
            if (!originalSale || !originalSale.id) { notify('Error: Venta original no encontrada.', 'error'); return false; }
            
            const batch = writeBatch(db);
            const totalCost = Number(formData.cost) || 0; 

            const targetCatalogItem = catalog.find(c => c.name === formData.service);
            const targetType = targetCatalogItem ? targetCatalogItem.type : 'Perfil'; 
            const originalType = originalSale.type || 'Perfil';

            // ESCENARIO 1: UNIFICACIÓN (Destino es CUENTA)
            if (targetType === 'Cuenta') {
                const siblings = sales.filter(s => 
                    s.email === originalSale.email && 
                    s.pass === originalSale.pass && 
                    s.id !== originalSale.id && 
                    (s.client === 'LIBRE' || s.client === originalSale.client || s.client === formData.client)
                );
                siblings.forEach(sib => { batch.delete(doc(db, userPath, 'sales', sib.id)); });
                const survivorRef = doc(db, userPath, 'sales', originalSale.id);
                batch.update(survivorRef, { ...formData, type: 'Cuenta', profile: 'General', pin: '', cost: totalCost, updatedAt: serverTimestamp() });
                notify(`¡Cuenta Unificada! ${siblings.length + 1} perfiles fusionados.`, 'success');
                await batch.commit(); return true;
            }

            // ESCENARIO 2: FRAGMENTACIÓN (Origen Cuenta -> Destino Perfil/Paquete)
            if ((originalType === 'Cuenta' || originalType === 'Paquete') && (targetType === 'Perfil' || targetType === 'Paquete')) {
                if (totalCost <= 0) { notify('Asigna un costo para fragmentar.', 'warning'); return false; }

                const ghostSiblings = sales.filter(s => s.email === originalSale.email && s.pass === originalSale.pass && s.id !== originalSale.id);
                ghostSiblings.forEach(ghost => { batch.delete(doc(db, userPath, 'sales', ghost.id)); });

                let totalSlots = 1;
                const originCatalogItem = catalog.find(c => c.name === originalSale.service);
                if (originCatalogItem && originCatalogItem.defaultSlots) { totalSlots = Number(originCatalogItem.defaultSlots); } else { totalSlots = 5; }

                const unitCostForSold = totalCost / profilesToSell;
                const freeServiceName = findIndividualServiceName(originalSale.service, catalog);
                const salesCollection = collection(db, userPath, 'sales');

                for (let i = 0; i < totalSlots; i++) {
                    const isSoldSlot = i < profilesToSell; 
                    const currentProfileData = bulkProfiles[i] || {};
                    
                    const freeData = { client: 'LIBRE', phone: '', service: freeServiceName, type: 'Perfil', cost: 0, email: formData.email, pass: formData.pass, profile: `Perfil ${i + 1}`, pin: '', endDate: '' };

                    let finalProfileName = `Perfil ${i + 1}`; 
                    let finalPin = '';

                    if (isSoldSlot) {
                        if (profilesToSell === 1) {
                            finalProfileName = formData.profile || finalProfileName;
                            finalPin = formData.pin || '';
                        } else {
                            finalProfileName = currentProfileData.profile || finalProfileName;
                            finalPin = currentProfileData.pin || '';
                        }
                    }

                    const soldData = {
                        ...formData,
                        type: 'Perfil', 
                        service: formData.service,
                        cost: unitCostForSold,
                        profile: finalProfileName, 
                        pin: finalPin,             
                    };

                    if (i === 0) {
                        const survivorRef = doc(db, userPath, 'sales', originalSale.id);
                        batch.update(survivorRef, { ...(isSoldSlot ? soldData : freeData), updatedAt: serverTimestamp() });
                    } else {
                        const newDocRef = doc(salesCollection);
                        const creationDate = new Date(Date.now() + i * 50);
                        batch.set(newDocRef, { ...(isSoldSlot ? soldData : freeData), createdAt: creationDate });
                    }
                }
                notify(`Cuenta reorganizada: ${profilesToSell} vendidos, ${totalSlots - profilesToSell} libres.`, 'success');
                await batch.commit(); return true;
            }

            // ESCENARIO 3: VENTA NORMAL
            const saleRef = doc(db, userPath, 'sales', originalSale.id);
            if (profilesToSell > 1 && originalSale.client === 'LIBRE') {
                const otherFreeSlots = sales.filter(s => s.client === 'LIBRE' && s.email === originalSale.email && s.pass === originalSale.pass && s.id !== originalSale.id).slice(0, profilesToSell - 1); 
                if ((1 + otherFreeSlots.length) < profilesToSell) { notify(`Stock insuficiente.`, 'error'); return false; }
                const slotsToUpdate = [originalSale, ...otherFreeSlots];
                const finalUnitCost = totalCost / profilesToSell;
                slotsToUpdate.forEach((slot, index) => { 
                    const currentBulkProfile = bulkProfiles[index] || {};
                    batch.update(doc(db, userPath, 'sales', slot.id), { client: formData.client, phone: formData.phone, endDate: formData.endDate, cost: finalUnitCost, profile: currentBulkProfile.profile || slot.profile || '', pin: currentBulkProfile.pin || slot.pin || '', service: formData.service, updatedAt: serverTimestamp() });
                });
                notify(`Venta de ${profilesToSell} perfiles registrada.`, 'success');
            } else {
                batch.update(saleRef, { ...formData, cost: totalCost, updatedAt: serverTimestamp() });
                if (formData.client === 'LIBRE') notify('Servicio liberado.', 'success');
                else notify('Venta registrada.', 'success');
            }
            await batch.commit(); return true;
        } catch (error) { console.error("Error processSale:", error); notify('Error al procesar venta.', 'error'); return false; }
    };

    // --- FUNCIONES COMPACTAS ---
    const processBatchSale = async (f, q, r, b, c) => { try { if (q > r.length) { notify(`Stock insuficiente.`, 'error'); return false; } const batch = writeBatch(db); const profilesToSell = r.slice(0, q); const totalCost = Number(f.cost) || 0; const unitCost = (totalCost / q).toFixed(2); profilesToSell.forEach((docSnap, index) => { const currentBulkProfile = b[index] || {}; batch.update(doc(db, userPath, 'sales', docSnap.id), { client: f.client, phone: f.phone || '', endDate: f.endDate, cost: Number(unitCost), type: f.type, soldAt: new Date(), profile: currentBulkProfile.profile || docSnap.profile || '', pin: currentBulkProfile.pin || docSnap.pin || '' }); }); await batch.commit(); notify(`¡Venta de ${q} perfiles exitosa!`, 'success'); return true; } catch (error) { console.error(error); notify('Error venta masiva.', 'error'); return false; } };
    const quickRenew = async (saleId, currentEndDate) => { if (!saleId || !currentEndDate) return false; try { const [y, m, d] = currentEndDate.split('-').map(Number); const currentDate = new Date(y, m - 1, d); const nextDate = new Date(currentDate); nextDate.setMonth(nextDate.getMonth() + 1); if (currentDate.getDate() !== nextDate.getDate()) { nextDate.setDate(0); } await updateDoc(doc(db, userPath, 'sales', saleId), { endDate: nextDate.toISOString().split('T')[0] }); notify('Renovado +1 mes exacto.', 'success'); return true; } catch (error) { notify('Error al renovar.', 'error'); return false; } };
    const addCatalogService = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { ...f, cost: Number(f.cost), defaultSlots: Number(f.defaultSlots), createdAt: serverTimestamp() }); notify('Servicio agregado.'); return true; } catch (e) { return false; } };
    const addCatalogPackage = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { name: `${f.name} Paquete ${f.slots}`, cost: Number(f.cost), type: 'Paquete', defaultSlots: Number(f.slots), createdAt: serverTimestamp() }); notify('Paquete creado.'); return true; } catch (e) { return false; } };
    const updateCatalogService = async (id, data) => { try { await updateDoc(doc(db, userPath, 'catalog', id), data); notify('Servicio actualizado.'); return true; } catch (e) { return false; } };
    const generateStock = async (f) => { try { const b = writeBatch(db); const r = collection(db, userPath, 'sales'); for(let i=0; i<f.slots; i++) b.set(doc(r), {client:'LIBRE', phone:'', service:f.service, email:f.email, pass:f.pass, profile:'', pin:'', cost:Number(f.cost), type:f.type, createdAt:new Date(Date.now()+i)}); await b.commit(); notify('Stock generado.'); return true; } catch(e){ return false; } };
    
    const executeConfirmAction = async (d, s, c) => { 
        try { 
            const batch = writeBatch(db);
            if(d.type==='delete_service') batch.delete(doc(db, userPath, 'catalog', d.id));
            else if(d.type==='liberate') { 
                const cur = s.find(i=>i.id===d.id); 
                const svc = (cur.type?.toLowerCase() === 'perfil') ? findIndividualServiceName(cur.service, c) : cur.service;
                batch.update(doc(db, userPath, 'sales', d.id), { client:'LIBRE', phone:'', endDate:'', profile:'', pin:'', service: svc, cost: 0, updatedAt:serverTimestamp() }); 
            } 
            else if (d.type === 'delete_account' || d.type === 'delete_free_stock') d.data.forEach(id => batch.delete(doc(db, userPath, 'sales', id)));
            await batch.commit(); notify('Éxito.', 'success'); return true; 
        } catch(e){ notify('Error al borrar.', 'error'); return false; } 
    };

    return { 
        addCatalogService, 
        addCatalogPackage, 
        generateStock, 
        executeConfirmAction, 
        editAccountCredentials, 
        processSale, 
        processBatchSale, 
        quickRenew, 
        updateCatalogService,
        importLegacyPortfolio // ✅ EXPORTADO PARA QUE LA VISTA LO USE
    };
};