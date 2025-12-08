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

    const handleSave = async (formData, originalSale, catalog, sales, profilesToSell = 1) => {
        try {
            if (!originalSale || !originalSale.id) {
                notify('Error: No se encontró la ID de la venta original.', 'error');
                return false;
            }
            
            const batch = writeBatch(db);
            const saleRef = doc(db, userPath, 'sales', originalSale.id);

            // 1. INVESTIGACIÓN DE CAPACIDAD
            let totalSlots = 1;
            const exactMatch = catalog.find(c => c.name === originalSale.service);
            if (exactMatch && Number(exactMatch.defaultSlots) > 1) { totalSlots = Number(exactMatch.defaultSlots); }
            if (totalSlots === 1) {
                const baseName = originalSale.service.split(' ')[0];
                const candidates = catalog.filter(c => c.name.includes(baseName) && Number(c.defaultSlots) > 1);
                // Aquí se corrige un error de sintaxis en el código que me enviaste (a.s no existe)
                if (candidates.length > 0) { candidates.sort((a, b) => Number(b.defaultSlots) - Number(a.defaultSlots)); totalSlots = Number(candidates[0].defaultSlots); }
            }

            // 2. CÁLCULO Y CONDICIÓN
            const totalCost = Number(formData.cost) || 0;
            const individualCost = profilesToSell > 0 ? (totalCost / profilesToSell) : 0; 
            
            const wasFree = originalSale.client === 'LIBRE'; 
            const isSellingNow = formData.client !== 'LIBRE';
            const isPartialSale = profilesToSell < totalSlots; 
            
            // ✅ CONDICIÓN CRÍTICA: Solo fragmentar si es la tarjeta madre virgen
            const isMotherType = originalSale.type && 
                                 (originalSale.type.toLowerCase() === 'cuenta' || 
                                  originalSale.type.toLowerCase() === 'paquete');
            
            const shouldFragment = (totalSlots > 1) && wasFree && isSellingNow && isPartialSale && isMotherType;
            const isSellingPackage = isSellingNow && profilesToSell > 1 && !isMotherType; 


            if (shouldFragment) {
                // SCENARIO 1: FRAGMENTACIÓN DE CUENTA MADRE VIRGEN
                if (totalCost <= 0) { notify('Advertencia: Asigna un costo para fragmentar.', 'warning'); return false; }
                
                const individualServiceName = findIndividualServiceName(originalSale.service, catalog);

                batch.update(saleRef, {
                    ...formData, service: originalSale.service, 
                    type: 'Perfil', 
                    profile: profilesToSell > 1 ? `Perfil 1-${profilesToSell}` : (formData.profile || 'Perfil 1'),
                    cost: individualCost, updatedAt: serverTimestamp()
                });

                const salesCollection = collection(db, userPath, 'sales');
                for (let i = 1; i < totalSlots; i++) {
                    const newDocRef = doc(salesCollection);
                    const creationDate = new Date(Date.now() + i * 50);
                    const isPartOfSale = i < profilesToSell; 
                    
                    if (isPartOfSale) { batch.set(newDocRef, { ...formData, service: individualServiceName, type: 'Perfil', profile: `Perfil ${i + 1}`, cost: individualCost, pin: '', soldAt: new Date(), createdAt: creationDate }); } 
                    else { batch.set(newDocRef, { client: 'LIBRE', phone: '', service: individualServiceName, type: 'Perfil', cost: individualCost, email: formData.email, pass: formData.pass, profile: `Perfil ${i + 1}`, pin: '', endDate: '', createdAt: creationDate }); }
                }
                const libres = totalSlots - profilesToSell;
                notify(`Venta parcial: ${profilesToSell} ocupados, ${libres} libres generados.`, 'success');

            } else if (isSellingPackage) {
                // SCENARIO 2: VENTA DE PAQUETE EN POOL DE CLONES LIBERADOS
                
                if (originalSale.client !== 'LIBRE') { notify('Error: El perfil inicial seleccionado no está libre para una venta de paquete.', 'error'); return false; }
                
                const otherFreeSlots = sales.filter(sale => sale.client === 'LIBRE' && sale.email === originalSale.email && sale.pass === originalSale.pass && sale.id !== originalSale.id).slice(0, profilesToSell - 1); 

                const neededSlots = profilesToSell;
                const availableSlots = 1 + otherFreeSlots.length;

                if (availableSlots < neededSlots) { notify(`Error: Solo se encontraron ${availableSlots} perfiles libres para esta venta de ${neededSlots}.`, 'error'); return false; }

                const slotsToUpdate = [originalSale, ...otherFreeSlots];
                const individualCostPackage = (totalCost) / neededSlots; 

                slotsToUpdate.forEach((slot) => {
                    const updateRef = doc(db, userPath, 'sales', slot.id);
                    batch.update(updateRef, { 
                        ...formData,
                        cost: individualCostPackage,
                        updatedAt: serverTimestamp() 
                    });
                });
                
                notify(`Venta de paquete de ${neededSlots} perfiles registrada.`, 'success');

            } else {
                // SCENARIO 3: EDICIÓN SIMPLE / VENTA INDIVIDUAL DE CLON LIBRE (El botón 'Asignar' llega aquí)
                
                let finalCost = totalCost;
                if (!wasFree) { 
                    finalCost = Number(formData.cost); 
                }

                batch.update(saleRef, { 
                    ...formData, 
                    cost: finalCost,
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
            const b = writeBatch(db); 
            if(d.type==='delete_service') { b.delete(doc(db, userPath, 'catalog', d.id)); } 
            else if(d.type==='liberate') { 
                const cur = s.find(i=>i.id===d.id); let n='LIBRE'; if(cur) n=findIndividualServiceName(cur.service, c); 
                b.update(doc(db, userPath, 'sales', d.id), {client:'LIBRE', phone:'', endDate:'', profile:'', pin:'', service:n, updatedAt:serverTimestamp()}); 
            } else if (d.type === 'delete_account') {
                d.data.forEach(id => b.delete(doc(db, userPath, 'sales', id)));
            } else if (d.type === 'delete_free_stock') {
                 d.data.forEach(id => b.delete(doc(db, userPath, 'sales', id)));
            }
            await b.commit(); notify('Éxito.', 'success'); return true; 
        } catch(e){ 
            console.error("CRITICAL ERROR IN executeConfirmAction:", e);
            notify('Error al borrar. Revisa la consola para más detalles.', 'error'); return false; 
        } 
    };

    return { addCatalogService, addCatalogPackage, generateStock, executeConfirmAction, handleSave };
};