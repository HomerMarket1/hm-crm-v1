// src/hooks/useDataSync.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; 
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase/config'; 

// 🚨 IMPORTANTE: Debe decir 'export const', NO 'export default'
export const useDataSync = () => {
  
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Estados de datos
  const [sales, setSales] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clientsDirectory, setClientsDirectory] = useState([]);
  
  // Estado de carga granular para evitar parpadeos
  const [loadingState, setLoadingState] = useState({
    sales: true,
    catalog: true,
    clients: true
  });

  // --- HELPER PARA SANITIZAR DATOS ---
  // Convierte los Timestamps de Firebase a objetos Date de JS para evitar crashes
  const sanitizeData = (doc) => {
    const data = doc.data();
    // Si hay fechas creadas con serverTimestamp, a veces vienen null latentes, 
    // o como objeto Timestamp. Aquí lo normalizamos.
    if (data.createdAt && data.createdAt.toDate) {
      data.createdAt = data.createdAt.toDate();
    }
    if (data.updatedAt && data.updatedAt.toDate) {
      data.updatedAt = data.updatedAt.toDate();
    }
    return { id: doc.id, ...data };
  };

  // 1. DETECTOR DE AUTENTICACIÓN
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      // Si el usuario hace logout, limpiamos todo inmediatamente
      if (!currentUser) {
        setSales([]);
        setCatalog([]);
        setClientsDirectory([]);
        setLoadingState({ sales: false, catalog: false, clients: false });
      }
    });
    return () => unsubscribe();
  }, []); 

  // 2. SINCRONIZACIÓN DE DATOS (Real-time)
  useEffect(() => {
    if (!user) return;

    const userPath = `users/${user.uid}`;
    
    // Consultas
    // Nota: Si la consola pide crear índice, sigue el link que te dé Firebase.
    const salesQuery = query(collection(db, userPath, 'sales'), orderBy('createdAt', 'desc'));
    const catalogRef = collection(db, userPath, 'catalog');
    const clientsRef = collection(db, userPath, 'clients');

    // A. Suscripción a VENTAS
    const salesUnsub = onSnapshot(salesQuery, (snapshot) => {
      setSales(snapshot.docs.map(sanitizeData));
      setLoadingState(prev => ({ ...prev, sales: false }));
    }, (error) => {
      console.error("Error sincronizando ventas:", error);
      setLoadingState(prev => ({ ...prev, sales: false }));
    });
    
    // B. Suscripción a CATÁLOGO
    const catalogUnsub = onSnapshot(catalogRef, (snapshot) => {
      setCatalog(snapshot.docs.map(sanitizeData));
      setLoadingState(prev => ({ ...prev, catalog: false }));
    }, (error) => {
        console.error("Error sincronizando catálogo:", error);
        setLoadingState(prev => ({ ...prev, catalog: false }));
    });
    
    // C. Suscripción a CLIENTES
    const clientsUnsub = onSnapshot(clientsRef, (snapshot) => {
      setClientsDirectory(snapshot.docs.map(sanitizeData));
      setLoadingState(prev => ({ ...prev, clients: false }));
    }, (error) => {
        console.error("Error sincronizando clientes:", error);
        setLoadingState(prev => ({ ...prev, clients: false }));
    });
    
    // Limpieza al desmontar
    return () => { salesUnsub(); catalogUnsub(); clientsUnsub(); };
  }, [user]); 

  // Calculamos si la app sigue cargando datos iniciales
  const loadingData = loadingState.sales || loadingState.catalog || loadingState.clients;

  return { user, authLoading, sales, catalog, clientsDirectory, loadingData };
};