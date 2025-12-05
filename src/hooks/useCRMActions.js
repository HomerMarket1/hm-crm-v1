// src/hooks/useCRMActions.js
import { addDoc, collection, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

export const useCRMActions = (user, userPath, setNotification) => {

    // --- ACCIONES DE CATÁLOGO ---
    const addCatalogService = async (catalogForm) => {
        if (!user || !catalogForm.name) return false;
        try {
            await addDoc(collection(db, userPath, 'catalog'), { 
                name: catalogForm.name, 
                cost: Number(catalogForm.cost), 
                type: catalogForm.type, 
                defaultSlots: Number(catalogForm.defaultSlots) 
            });
            setNotification({ show: true, message: `Servicio agregado correctamente.`, type: 'success' });
            return true;
        } catch (error) {
            console.error(error);
            setNotification({ show: true, message: 'Error al agregar servicio.', type: 'error' });
            return false;
        }
    };

    const addCatalogPackage = async (packageForm) => {
        if (!user || !packageForm.name || packageForm.slots <= 1) return false;
        const packageName = `${packageForm.name} Paquete ${packageForm.slots} Perfiles`;
        try {
            await addDoc(collection(db, userPath, 'catalog'), { 
                name: packageName, 
                cost: Number(packageForm.cost), 
                type: 'Paquete', 
                defaultSlots: Number(packageForm.slots) 
            });
            setNotification({ show: true, message: `Paquete creado exitosamente.`, type: 'success' });
            return true;
        } catch (error) {
            setNotification({ show: true, message: 'Error al crear paquete.', type: 'error' });
            return false;
        }
    };

    // --- ACCIONES DE STOCK ---
    const generateStock = async (stockForm) => {
        if (!user) return false;
        try {
            const batch = writeBatch(db);
            for (let i = 0; i < stockForm.slots; i++) {
                const newDocRef = doc(collection(db, userPath, 'sales'));
                batch.set(newDocRef, {
                    client: 'LIBRE', phone: '', service: stockForm.service, endDate: '', email: stockForm.email,
                    pass: stockForm.pass, profile: '', pin: '', cost: stockForm.cost, type: stockForm.type, createdAt: Date.now() + i
                });
            }
            await batch.commit();
            setNotification({ show: true, message: `${stockForm.slots} cupos generados.`, type: 'success' });
            return true;
        } catch (error) {
            setNotification({ show: true, message: 'Error al generar stock.', type: 'error' });
            return false;
        }
    };

    // --- ACCIONES GENERALES (ELIMINAR / LIBERAR) ---
    const executeConfirmAction = async (modalData, sales, catalog) => {
        if (!user) return;
        try {
            if (modalData.type === 'delete_service') {
                await deleteDoc(doc(db, userPath, 'catalog', modalData.id));
                setNotification({ show: true, message: 'Servicio eliminado.', type: 'success' });
            }
            else if (modalData.type === 'liberate') {
                const currentSale = sales.find(s => s.id === modalData.id);
                // Lógica inteligente para renombrar el servicio al liberar
                let newServiceName = 'Netflix 1 Perfil'; 
                if (currentSale?.service?.toLowerCase().includes('paquete')) {
                    const baseName = currentSale.service.replace(/ Paquete \d+ Perfiles/i, '').trim();
                    const individualService = catalog.find(c => c.name.toLowerCase().includes(`${baseName.toLowerCase()} 1 perfil`));
                    newServiceName = individualService ? individualService.name : 'LIBRE 1 Perfil';
                } else {
                    newServiceName = 'LIBRE 1 Perfil';
                }

                await updateDoc(doc(db, userPath, 'sales', modalData.id), { 
                    client: 'LIBRE', phone: '', endDate: '', profile: '', pin: '', 
                    service: newServiceName 
                });
                setNotification({ show: true, message: 'Perfil liberado y disponible.', type: 'success' });
            }
            else if (modalData.type === 'delete_account') {
                const batch = writeBatch(db);
                modalData.data.forEach(id => { 
                    const docRef = doc(db, userPath, 'sales', id); 
                    batch.delete(docRef); 
                });
                await batch.commit();
                setNotification({ show: true, message: 'Cuenta completa eliminada.', type: 'warning' });
            }
            return true;
        } catch (error) {
            console.error(error);
            setNotification({ show: true, message: 'Error al ejecutar la acción.', type: 'error' });
            return false;
        }
    };

    return {
        addCatalogService,
        addCatalogPackage,
        generateStock,
        executeConfirmAction
        // (Nota: handleSaveSale y handleImportCSV son muy complejos y dependen mucho del estado del formulario,
        //  por seguridad los dejaremos en App.jsx por ahora, o los moveremos en un paso 3 avanzado).
    };
};