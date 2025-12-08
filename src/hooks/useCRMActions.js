// src/hooks/useCRMActions.js (VERSIÓN SOPORTE PAQUETES)
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

    const notify = (msg, type = 'success') => {
        setNotification({ show: true, message: msg, type });
    };

    // =========================================================
    // 1. FUNCIÓN DE GUARDADO (FRAGMENTACIÓN + PAQUETES)
    // =========================================================
    // Aceptamos un nuevo argumento: profilesToSell (Cantidad a vender)
    const handleSave = async (formData, originalSale, catalog, profilesToSell = 1) => {
        try {
            const batch = writeBatch(db);
            const saleRef = doc(db, userPath, 'sales', originalSale.id);

            // --- DETECCIÓN DE MADRE ---
            let totalSlots = 1;
            
            // 1. Buscar coincidencia exacta
            const exactMatch = catalog.find(c => c.name === originalSale.service);
            if (exactMatch && Number(exactMatch.defaultSlots) > 1) {
                totalSlots = Number(exactMatch.defaultSlots);
            }

            // 2. Si no, buscar "Madre" por nombre base
            if (totalSlots === 1) {
                const baseName = originalSale.service.split(' ')[0]; 
                const candidates = catalog.filter(c => 
                    c.name.includes(baseName) && Number(c.defaultSlots) > 1
                );
                if (candidates.length > 0) {
                    candidates.sort((a, b) => Number(b.defaultSlots) - Number(a.defaultSlots));
                    totalSlots = Number(candidates[0].defaultSlots);
                }
            }

            // --- CONDICIÓN: ¿FRAGMENTAMOS? ---
            // Si es cuenta madre Y (se está vendiendo O se están pidiendo más de 1 perfil)
            const isSelling = originalSale.client === 'LIBRE' && formData.client !== 'LIBRE';
            const isFragmentation = (totalSlots > 1) && (isSelling || profilesToSell > 1);

            if (isFragmentation) {
                console.log(`⚡ FRAGMENTANDO: Madre de ${totalSlots} slots. Vendiendo ${profilesToSell}.`);

                const individualServiceName = findIndividualServiceName(originalSale.service, catalog);

                // A. ACTUALIZAR LA MADRE (Perfil #1 Vendido)
                batch.update(saleRef, {
                    ...formData,
                    service: individualServiceName, 
                    type: 'Perfil',
                    profile: formData.profile || 'Perfil 1', // Asegurar nombre si es paquete
                    updatedAt: serverTimestamp()
                });

                // B. CREAR LOS RESTANTES (Bucle Inteligente)
                const salesCollection = collection(db, userPath, 'sales');
                
                // Iteramos desde el slot 1 hasta el final (0 es la madre)
                for (let i = 1; i < totalSlots; i++) {
                    const newDocRef = doc(salesCollection);
                    const creationDate = new Date(Date.now() + i * 50);

                    // ¿Este clon también es parte de la venta?
                    // Si profilesToSell es 3:
                    // i=0 (Madre) -> Vendido
                    // i=1 -> Vendido (1 < 3)
                    // i=2 -> Vendido (2 < 3)
                    // i=3 -> LIBRE
                    const isSoldClone = i < profilesToSell;

                    if (isSoldClone) {
                        // CLON VENDIDO (Parte del paquete)
                        batch.set(newDocRef, {
                            ...formData, // Copia todos los datos del cliente
                            service: individualServiceName,
                            type: 'Perfil',
                            profile: `Perfil ${i + 1}`, // Autoincremental
                            pin: '', // Sin PIN por defecto en clones (o podrías pasar un array)
                            soldAt: new Date(),
                            createdAt: creationDate
                        });
                    } else {
                        // CLON LIBRE (Stock restante)
                        batch.set(newDocRef, {
                            client: 'LIBRE',
                            phone: '',
                            service: individualServiceName,
                            type: 'Perfil',
                            cost: Number(formData.cost),
                            email: formData.email,
                            pass: formData.pass,
                            profile: `Perfil ${i + 1}`,
                            pin: '',
                            endDate: '',
                            createdAt: creationDate
                        });
                    }
                }
                
                const libres = totalSlots - profilesToSell;
                notify(`Venta procesada: ${profilesToSell} perfiles entregados + ${libres > 0 ? libres : 0} libres creados.`, 'success');

            } else {
                // GUARDADO NORMAL
                batch.update(saleRef, { ...formData, updatedAt: serverTimestamp() });
                if (formData.client === 'LIBRE') notify('Servicio liberado.', 'success');
                else notify('Cambios guardados.', 'success');
            }

            await batch.commit();
            return true;

        } catch (error) {
            console.error("Error handleSave:", error);
            notify('Error al guardar.', 'error');
            return false;
        }
    };

    // --- DEMÁS FUNCIONES IGUALES ---
    const addCatalogService = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { ...f, cost: Number(f.cost), defaultSlots: Number(f.defaultSlots), createdAt: serverTimestamp() }); notify('Servicio agregado.'); return true; } catch (e) { return false; } };
    const addCatalogPackage = async (f) => { try { await addDoc(collection(db, userPath, 'catalog'), { name: `${f.name} Paquete ${f.slots}`, cost: Number(f.cost), type: 'Paquete', defaultSlots: Number(f.slots), createdAt: serverTimestamp() }); notify('Paquete creado.'); return true; } catch (e) { return false; } };
    const generateStock = async (f) => { try { const b = writeBatch(db); const r = collection(db, userPath, 'sales'); for(let i=0; i<f.slots; i++) b.set(doc(r), {client:'LIBRE', phone:'', service:f.service, email:f.email, pass:f.pass, profile:'', pin:'', cost:Number(f.cost), type:f.type, createdAt:new Date(Date.now()+i)}); await b.commit(); notify('Stock generado.'); return true; } catch(e){ return false; } };
    const executeConfirmAction = async (d, s, c) => { try { const b = writeBatch(db); if(d.type==='delete_service') b.delete(doc(db, userPath, 'catalog', d.id)); else if(d.type==='liberate') { const cur = s.find(i=>i.id===d.id); let n='LIBRE'; if(cur) n=findIndividualServiceName(cur.service, c); b.update(doc(db, userPath, 'sales', d.id), {client:'LIBRE', phone:'', endDate:'', profile:'', pin:'', service:n, updatedAt:serverTimestamp()}); } else if(d.type==='delete_account') d.data.forEach(id=>b.delete(doc(db, userPath, 'sales', id))); await b.commit(); notify('Éxito.'); return true; } catch(e){ return false; } };

    return { addCatalogService, addCatalogPackage, generateStock, executeConfirmAction, handleSave };
};