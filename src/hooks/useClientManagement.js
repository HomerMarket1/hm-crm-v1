import { useMemo, useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore'; 
import { db } from '../firebase/config'; 

// Lista de estados que no deben ser considerados clientes válidos para guardar en el directorio.
// NOTA: Esta constante debería residir idealmente en src/utils/constants.js
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED'];

export const useClientManagement = (user, userPath, sales, clientsDirectory, setNotification) => {
    
    // 1. LECTURA (Genera la lista combinada y desduplicada de Clientes)
    const allClients = useMemo(() => {
        const fromDir = clientsDirectory.map(c => ({ name: c.name, phone: c.phone }));
        
        // Excluir estados no válidos para clientes
        const fromSales = sales
            .filter(s => s.client && s.client !== 'LIBRE' && s.client !== 'Admin' && !NON_BILLABLE_STATUSES.includes(s.client))
            .map(s => ({ name: s.client, phone: s.phone }));
        
        const combined = [...fromDir, ...fromSales];
        const unique = [];
        const map = new Map();
        
        for (const item of combined) {
            if (!item.name) continue;
            const key = item.name.toLowerCase().trim();
            if(!map.has(key)) { map.set(key, true); unique.push(item); }
        }
        return unique.sort((a, b) => a.name.localeCompare(b.name));
    }, [sales, clientsDirectory]);

    // 2. ESCRITURA (Mutaciones CRUD)

    // A. Guardar cliente si no existe (Usado en handleSaveSale de App.jsx)
    const saveClientIfNew = useCallback(async (clientName, clientPhone) => {
        if (!user || !clientName || clientName === 'LIBRE' || clientName === 'Admin' || NON_BILLABLE_STATUSES.includes(clientName)) return;

        const exists = allClients.some(c => c.name.toLowerCase() === clientName.toLowerCase());
        
        if (!exists) {
            await addDoc(collection(db, userPath, 'clients'), { name: clientName, phone: clientPhone, createdAt: Date.now() });
        }
    }, [user, userPath, allClients]);
    
    // B. Borrar cliente del directorio (Usado en Config.jsx)
    const triggerDeleteClient = useCallback(async (id) => {
        if (!user) return;
        if(window.confirm("¿Eliminar cliente del directorio?")) {
            await deleteDoc(doc(db, userPath, 'clients', id));
            setNotification({ show: true, message: 'Cliente eliminado del directorio.', type: 'success' });
        }
    }, [user, userPath, setNotification]);

    // C. Editar cliente (Usado en Config.jsx)
    const triggerEditClient = useCallback(async (clientId, newName, newPhone, originalName) => {
        if (!user) return;
        
        const batch = writeBatch(db);
        
        // 1. Crear o actualizar el directorio
        if (!clientId) { 
            const ref = doc(collection(db, userPath, 'clients')); 
            batch.set(ref, {name:newName, phone:newPhone, createdAt: Date.now()}); 
        }
        else { 
            batch.update(doc(db, userPath, 'clients', clientId), {name:newName, phone:newPhone}); 
        }
        
        // 2. Actualizar las ventas históricas con el nombre antiguo/original
        const nameToSearch = originalName || newName; 
        sales.filter(s => s.client === nameToSearch).forEach(s => {
            const saleRef = doc(db, userPath, 'sales', s.id);
            batch.update(saleRef, {client:newName, phone:newPhone});
        });
        
        await batch.commit(); 
        setNotification({ show: true, message: 'Cliente actualizado en todo el sistema.', type: 'success' });
    }, [user, userPath, sales, setNotification]);


    return {
        allClients,
        saveClientIfNew,
        triggerDeleteClient,
        triggerEditClient,
    };
};