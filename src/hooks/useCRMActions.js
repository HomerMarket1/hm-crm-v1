// src/hooks/useCRMActions.js
import { addDoc, collection, doc, writeBatch, serverTimestamp, updateDoc, query, where, getDocs } from 'firebase/firestore'; 
import { db } from '../firebase/config';

// Helper para encontrar nombres base
const findIndividualServiceName = (currentServiceName, catalog) => {
    const baseName = currentServiceName.split(' ')[0]; 
    const individual = catalog.find(c => c.name.includes(baseName) && c.type === 'Perfil');
    return individual ? individual.name : currentServiceName;
};

// Helper interno para fechas
const parseFlexibleDate = (dateStr) => {
    if (!dateStr) return null;
    try {
        if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) return dateStr;
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) return `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        }
        return null;
    } catch (e) { return null; }
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
        importLegacyPortfolio: async () => false,
        migrateService: async () => false,
    };

    const userPath = `users/${user.uid}`;
    const notify = (msg, type = 'success') => setNotification({ show: true, message: msg, type });

    // --- 1. MIGRACIÓN MASIVA (IMPORTADOR) ---
    const importLegacyPortfolio = async (dataList) => {
        if (!user) return false;
        try {
            const batchSize = 400;
            const chunks = [];
            for (let i = 0; i < dataList.length; i += batchSize) chunks.push(dataList.slice(i, i + batchSize));

            let totalProcessed = 0;
            for (const chunk of chunks) {
                const batch = writeBatch(db);
                chunk.forEach(row => {
                    const saleRef = doc(collection(db, userPath, 'sales'));
                    const saleData = {
                        client: row.client || 'Cliente Importado',
                        phone: row.phone || '',
                        service: row.service || 'Servicio Desconocido',
                        email: row.email || '',
                        pass: row.pass || '',
                        profile: row.profile || '',
                        pin: row.pin || '',
                        cost: Number(row.cost) || 0,
                        endDate: parseFlexibleDate(row.endDate) || '',
                        imported: true,
                        createdAt: serverTimestamp(),
                        type: 'Perfil'
                    };
                    batch.set(saleRef, saleData);
                    if (row.client && row.client.toUpperCase() !== 'LIBRE') {
                        const safeId = row.client.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
                        batch.set(doc(db, userPath, 'clients', safeId), { name: row.client, phone: row.phone || '', updatedAt: serverTimestamp() }, { merge: true });
                    }
                });
                await batch.commit();
                totalProcessed += chunk.length;
            }
            notify(`Migración completada: ${totalProcessed} registros.`, 'success');
            return true;
        } catch (error) { console.error(error); notify('Error crítico en importación.', 'error'); return false; }
    };

    // --- 2. ACCIONES DE CUENTA ---
    const editAccountCredentials = async (email, oldPass, newPass) => {
        try {
            if (newPass === oldPass) return true;
            const q = query(collection(db, userPath, 'sales'), where('email', '==', email), where('pass', '==', oldPass));
            const querySnapshot = await getDocs(q);
            if (querySnapshot.empty) { notify('No se encontraron registros.', 'error'); return false; }
            const batch = writeBatch(db);
            querySnapshot.forEach((docSnap) => batch.update(docSnap.ref, { pass: newPass, updatedAt: serverTimestamp() }));
            await batch.commit();
            notify(`Contraseña actualizada en ${querySnapshot.size} registros.`, 'success');
            return true;
        } catch (error) { console.error(error); notify('Fallo al editar credenciales.', 'error'); return false; }
    };

    // --- 3. LÓGICA DE VENTA ---
    const processSale = async (formData, originalSale, catalog, sales, profilesToSell = 1, bulkProfiles = []) => {
        try {
            if (!originalSale?.id) { notify('Error: Venta no encontrada.', 'error'); return false; }
            const batch = writeBatch(db);
            const totalCost = Number(formData.cost) || 0;
            const targetType = catalog.find(c => c.name === formData.service)?.type || 'Perfil';
            const originalType = originalSale.type || 'Perfil';

            // UNIFICACIÓN
            if (targetType === 'Cuenta') {
                const siblings = sales.filter(s => s.email === originalSale.email && s.pass === originalSale.pass && s.id !== originalSale.id);
                siblings.forEach(sib => batch.delete(doc(db, userPath, 'sales', sib.id)));
                batch.update(doc(db, userPath, 'sales', originalSale.id), { ...formData, type: 'Cuenta', profile: 'General', pin: '', cost: totalCost, updatedAt: serverTimestamp() });
                await batch.commit(); notify(`Cuenta Unificada.`, 'success'); return true;
            }

            // FRAGMENTACIÓN
            if ((originalType === 'Cuenta' || originalType === 'Paquete') && targetType === 'Perfil') {
                const totalSlots = Number(catalog.find(c => c.name === originalSale.service)?.defaultSlots || 5);
                const unitCost = totalCost / profilesToSell;
                const freeName = findIndividualServiceName(originalSale.service, catalog);
                
                sales.filter(s => s.email === originalSale.email && s.pass === originalSale.pass && s.id !== originalSale.id).forEach(g => batch.delete(doc(db, userPath, 'sales', g.id)));

                for (let i = 0; i < totalSlots; i++) {
                    const isSold = i < profilesToSell;
                    const pData = bulkProfiles[i] || {};
                    const baseData = isSold 
                        ? { ...formData, cost: unitCost, profile: (profilesToSell===1 ? formData.profile : pData.profile) || `Perfil ${i+1}`, pin: (profilesToSell===1 ? formData.pin : pData.pin) || '' }
                        : { client: 'LIBRE', phone: '', service: freeName, type: 'Perfil', cost: 0, email: formData.email, pass: formData.pass, profile: `Perfil ${i+1}`, pin: '', endDate: '' };
                    
                    if (i === 0) batch.update(doc(db, userPath, 'sales', originalSale.id), { ...baseData, updatedAt: serverTimestamp() });
                    else batch.set(doc(collection(db, userPath, 'sales')), { ...baseData, createdAt: new Date(Date.now() + i*50) });
                }
                await batch.commit(); notify(`Fragmentación exitosa.`, 'success'); return true;
            }

            // VENTA NORMAL
            const saleRef = doc(db, userPath, 'sales', originalSale.id);
            batch.update(saleRef, { ...formData, cost: totalCost, updatedAt: serverTimestamp() });
            notify(formData.client === 'LIBRE' ? 'Servicio liberado.' : 'Venta registrada.', 'success');
            await batch.commit(); return true;

        } catch (error) { console.error(error); notify('Error procesando venta.', 'error'); return false; }
    };

    // --- 4. 🚚 MUDANZA EXPRESS (Ahora copia PERFIL y PIN) ---
    const migrateService = async (sourceSale, targetSale, sourceNewStatus = 'Caída') => {
        if (!sourceSale || !targetSale || !user) return false;
        
        try {
            const batch = writeBatch(db);

            // A. TARGET: Recibe al cliente + SUS DATOS DE PERFIL
            const targetRef = doc(db, userPath, 'sales', targetSale.id);
            batch.update(targetRef, {
                client: sourceSale.client,
                phone: sourceSale.phone || '',
                endDate: sourceSale.endDate || '',
                cost: Number(sourceSale.cost) || 0,
                // 👇 AQUÍ ESTÁ LA CORRECCIÓN: Copiamos los datos del perfil original
                profile: sourceSale.profile || '', 
                pin: sourceSale.pin || '',
                // -----------------------------------------------------------
                updatedAt: serverTimestamp(),
                notes: `Migrado desde ${sourceSale.email} el ${new Date().toLocaleDateString()}. ${sourceSale.notes || ''}` 
            });

            // B. SOURCE: Limpieza según elección
            const sourceRef = doc(db, userPath, 'sales', sourceSale.id);
            let sourceUpdates = {};

            if (sourceNewStatus === 'LIBRE') {
                // Borrón total
                sourceUpdates = {
                    client: 'LIBRE',
                    phone: '',
                    endDate: '',
                    cost: 0,
                    notes: '', 
                    updatedAt: serverTimestamp()
                    // Mantiene su email/pass original, pero liberamos los datos del perfil
                    // OJO: Si quieres que el "Nombre de Perfil" se resetee a algo genérico, descomenta abajo:
                    // profile: 'Perfil Libre', pin: '' 
                };
            } else {
                // Dejar rastro para revisión
                sourceUpdates = {
                    client: sourceNewStatus,
                    phone: '',       
                    endDate: '',     
                    cost: 0,
                    updatedAt: serverTimestamp(),
                    notes: `Cliente ${sourceSale.client} movido a ${targetSale.email}.`
                };
            }

            batch.update(sourceRef, sourceUpdates);

            await batch.commit();
            notify(`Mudanza completa: ${sourceSale.client} con datos copiados.`, 'success');
            return true;

        } catch (error) {
            console.error("Error en migración:", error);
            notify('Error al realizar la mudanza.', 'error');
            return false;
        }
    };

    // --- UTILS ---
    const processBatchSale = async (f, q, r, b, c) => { try { if (q > r.length) return false; const batch = writeBatch(db); const cost = (Number(f.cost)/q).toFixed(2); r.slice(0,q).forEach((d,i) => batch.update(doc(db, userPath, 'sales', d.id), { ...f, cost: Number(cost), profile: b[i]?.profile || d.profile || '', pin: b[i]?.pin || d.pin || '', soldAt: new Date() })); await batch.commit(); notify('Venta masiva OK.'); return true; } catch(e){ return false; } };
    const quickRenew = async (id, date) => { if(!id || !date) return; try { const d = new Date(date); d.setMonth(d.getMonth()+1); d.setDate(d.getDate()+1); await updateDoc(doc(db, userPath, 'sales', id), { endDate: d.toISOString().split('T')[0] }); notify('Renovado.'); return true; } catch(e){ return false; } };
    const addCatalogService = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { ...f, cost: Number(f.cost), defaultSlots: Number(f.defaultSlots), createdAt: serverTimestamp() }); notify('Servicio creado.'); return true; } catch(e){ return false; } };
    const addCatalogPackage = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { name: `${f.name} Paquete ${f.slots}`, cost: Number(f.cost), type: 'Paquete', defaultSlots: Number(f.slots), createdAt: serverTimestamp() }); notify('Paquete creado.'); return true; } catch(e){ return false; } };
    const updateCatalogService = async (id, d) => { try { await updateDoc(doc(db, userPath, 'catalog', id), d); notify('Actualizado.'); return true; } catch(e){ return false; } };
    const generateStock = async (f) => { try { const b = writeBatch(db); for(let i=0; i<f.slots; i++) b.set(doc(collection(db, userPath, 'sales')), {client:'LIBRE', service:f.service, email:f.email, pass:f.pass, cost:Number(f.cost), type:f.type, createdAt:new Date(Date.now()+i)}); await b.commit(); notify('Stock generado.'); return true; } catch(e){ return false; } };
    const executeConfirmAction = async (d, s, c) => { try { const b = writeBatch(db); if(d.type==='delete_service') b.delete(doc(db,userPath,'catalog',d.id)); else if(d.type==='liberate') { const cur=s.find(i=>i.id===d.id); const svc = (cur.type==='Perfil') ? findIndividualServiceName(cur.service, c) : cur.service; b.update(doc(db,userPath,'sales',d.id),{client:'LIBRE',phone:'',endDate:'',cost:0,service:svc}); } else if(d.type.includes('delete')) d.data.forEach(id=>b.delete(doc(db,userPath,'sales',id))); await b.commit(); notify('Hecho.'); return true; } catch(e){ return false; } };

    return { 
        addCatalogService, addCatalogPackage, generateStock, executeConfirmAction, editAccountCredentials, 
        processSale, processBatchSale, quickRenew, updateCatalogService, importLegacyPortfolio,
        migrateService 
    };
};