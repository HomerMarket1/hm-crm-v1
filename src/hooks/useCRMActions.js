import { addDoc, collection, doc, deleteDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';
import { findIndividualServiceName } from '../utils/helpers'; 

// Objeto de acciones "no-operacionales" para devolver si el usuario no está autenticado
const NO_OP_ACTIONS = {
    addCatalogService: async () => false,
    addCatalogPackage: async () => false,
    generateStock: async () => false,
    executeConfirmAction: async () => false,
};

export const useCRMActions = (user, userPath, setNotification) => {
    
    // Devolver acciones no-operacionales si no hay usuario (protege contra errores de ejecución)
    if (!user) return NO_OP_ACTIONS;

    // --- ACCIONES DE CATÁLOGO ---
    const addCatalogService = async (catalogForm) => {
        if (!catalogForm.name) return false; 
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
        if (!packageForm.name || packageForm.slots <= 1) return false;
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
        try {
            const batch = writeBatch(db);
            let successMessage = null;

            if (modalData.type === 'delete_service') {
                // ✅ CORRECCIÓN: Usar batch.delete en lugar de deleteDoc para uniformizar la operación.
                batch.delete(doc(db, userPath, 'catalog', modalData.id));
                successMessage = 'Servicio eliminado.';
            }
            else if (modalData.type === 'liberate') {
                const currentSale = sales.find(s => s.id === modalData.id);
                
                let newServiceName = 'LIBRE 1 Perfil (Error)';
                
                if (currentSale) {
                    newServiceName = findIndividualServiceName(currentSale.service, catalog); 
                }

                batch.update(doc(db, userPath, 'sales', modalData.id), { 
                    client: 'LIBRE', phone: '', endDate: '', profile: '', pin: '', 
                    service: newServiceName 
                });
                successMessage = `Perfil liberado (${newServiceName}).`;
            }
            else if (modalData.type === 'delete_account') {
                modalData.data.forEach(id => { 
                    const docRef = doc(db, userPath, 'sales', id); 
                    batch.delete(docRef); 
                });
                successMessage = 'Cuenta completa eliminada.';
            }
            
            await batch.commit();
            
            // Notificaciones después del commit
            if (successMessage) {
                // Las notificaciones de delete_account pueden ser 'warning'
                const type = (modalData.type === 'delete_account') ? 'warning' : 'success';
                setNotification({ show: true, message: successMessage, type: type });
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
    };
};