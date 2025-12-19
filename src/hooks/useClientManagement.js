// src/hooks/useClientManagement.js
import { useState, useEffect } from 'react';
import { collection, addDoc, deleteDoc, doc, updateDoc, query, where, getDocs, writeBatch } from 'firebase/firestore'; 
import { db } from '../firebase/config';

export const useClientManagement = (user, basePath, sales, clientsDirectory, setNotification) => {
    
    const [allClients, setAllClients] = useState([]);

    useEffect(() => {
        if (clientsDirectory) {
            setAllClients(clientsDirectory);
        }
    }, [clientsDirectory]);

    // 1. CREAR CLIENTE
    const saveClientIfNew = async (clientName, clientPhone) => {
        if (!user || !clientName) return;
        const cleanName = clientName.trim();
        const exists = allClients.find(c => c.name.toLowerCase() === cleanName.toLowerCase());

        if (!exists) {
            try {
                await addDoc(collection(db, `users/${user.uid}/clients`), {
                    name: cleanName,
                    phone: clientPhone || '',
                    createdAt: new Date().toISOString()
                });
            } catch (error) {
                console.error("Error guardando cliente:", error);
            }
        }
    };

    // 2. ELIMINAR CLIENTE
    const triggerDeleteClient = async (clientId) => {
        if (!user) return;
        if (window.confirm("¿Estás seguro de eliminar este cliente del directorio? (Sus ventas no se borrarán)")) {
            try {
                await deleteDoc(doc(db, `users/${user.uid}/clients`, clientId));
                setNotification({ show: true, message: 'Cliente eliminado del directorio', type: 'success' });
            } catch (error) {
                console.error("Error eliminando cliente:", error);
                setNotification({ show: true, message: 'Error al eliminar cliente', type: 'error' });
            }
        }
    };

    // 3. ✅ EDITAR CLIENTE (SINCRONIZACIÓN TOTAL)
    const updateClient = async (clientId, newData, originalName) => {
        if (!user) return false;
        
        try {
            // A. Actualizar en el Directorio (Siempre se hace)
            const clientRef = doc(db, `users/${user.uid}/clients`, clientId);
            await updateDoc(clientRef, {
                name: newData.name,
                phone: newData.phone
            });

            // B. Actualizar ventas asociadas (Cascada)
            // Si recibimos el "Nombre Viejo" (originalName), buscamos todas las ventas que lo tengan
            // y les pegamos el nombre nuevo y el teléfono nuevo.
            if (originalName) {
                const batch = writeBatch(db);
                const salesRef = collection(db, `users/${user.uid}/sales`);
                
                // Buscar ventas que tengan el nombre antiguo
                const q = query(salesRef, where('client', '==', originalName));
                const snapshot = await getDocs(q);

                if (!snapshot.empty) {
                    snapshot.forEach((docSnap) => {
                        // Actualizamos Cliente y Teléfono en la venta
                        batch.update(docSnap.ref, { 
                            client: newData.name,
                            phone: newData.phone 
                        });
                    });
                    await batch.commit();
                    console.log(`Sincronizados ${snapshot.size} registros de venta.`);
                }
            }

            setNotification({ show: true, message: 'Cliente y sus ventas actualizados', type: 'success' });
            return true;

        } catch (error) {
            console.error("Error actualizando cliente:", error);
            setNotification({ show: true, message: 'Error al actualizar datos', type: 'error' });
            return false;
        }
    };

    const triggerEditClient = (client) => {
        console.log("Solicitud de edición para:", client);
    };

    return {
        allClients,
        saveClientIfNew,
        triggerDeleteClient,
        triggerEditClient,
        updateClient 
    };
};