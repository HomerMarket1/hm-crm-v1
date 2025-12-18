// src/hooks/useClientManagement.js
import { useState, useEffect } from 'react';
// ✅ Importamos updateDoc para poder editar
import { collection, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'; 
import { db } from '../firebase/config';

export const useClientManagement = (user, basePath, sales, clientsDirectory, setNotification) => {
    
    // Lista local de clientes
    const [allClients, setAllClients] = useState([]);

    // Mantiene la lista sincronizada con lo que descarga useDataSync
    useEffect(() => {
        if (clientsDirectory) {
            setAllClients(clientsDirectory);
        }
    }, [clientsDirectory]);

    // 1. CREAR CLIENTE (Si no existe)
    const saveClientIfNew = async (clientName, clientPhone) => {
        if (!user || !clientName) return;
        
        // Normalizamos nombre para evitar duplicados por mayúsculas
        const cleanName = clientName.trim();
        const exists = allClients.find(c => c.name.toLowerCase() === cleanName.toLowerCase());

        if (!exists) {
            try {
                await addDoc(collection(db, `users/${user.uid}/clients`), {
                    name: cleanName,
                    phone: clientPhone || '',
                    createdAt: new Date().toISOString()
                });
                // No mostramos notificación para no interrumpir el flujo de venta rápida
            } catch (error) {
                console.error("Error guardando cliente:", error);
            }
        }
    };

    // 2. ELIMINAR CLIENTE
    const triggerDeleteClient = async (clientId) => {
        if (!user) return;
        if (window.confirm("¿Estás seguro de eliminar este cliente del directorio?")) {
            try {
                await deleteDoc(doc(db, `users/${user.uid}/clients`, clientId));
                setNotification({ show: true, message: 'Cliente eliminado del directorio', type: 'success' });
            } catch (error) {
                console.error("Error eliminando cliente:", error);
                setNotification({ show: true, message: 'Error al eliminar cliente', type: 'error' });
            }
        }
    };

    // 3. ✅ EDITAR CLIENTE (La función que faltaba)
    const updateClient = async (clientId, updatedData) => {
        if (!user) return;
        try {
            const clientRef = doc(db, `users/${user.uid}/clients`, clientId);
            await updateDoc(clientRef, {
                name: updatedData.name,
                phone: updatedData.phone
            });
            setNotification({ show: true, message: 'Cliente actualizado correctamente', type: 'success' });
            return true;
        } catch (error) {
            console.error("Error actualizando cliente:", error);
            setNotification({ show: true, message: 'Error al actualizar datos', type: 'error' });
            return false;
        }
    };

    // Función auxiliar (ya no se usa directamente aquí porque el modal está en App.jsx, pero la mantenemos por compatibilidad)
    const triggerEditClient = (client) => {
        console.log("Solicitud de edición para:", client);
    };

    return {
        allClients,
        saveClientIfNew,
        triggerDeleteClient,
        triggerEditClient,
        updateClient // ✅ Exportamos la nueva función para que App.jsx la pueda usar
    };
};