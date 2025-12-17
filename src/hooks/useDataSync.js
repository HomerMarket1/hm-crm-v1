// src/hooks/useDataSync.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; 
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { auth, db } from '../firebase/config'; 

// ⚡️ OPTIMIZACIÓN: Función pura fuera del Hook para no recrearla en cada render
const sanitizeData = (doc) => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        // Conversión segura de Timestamps a Date
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
        // Si tienes fechas de vencimiento como string, se mantienen igual
    };
};

export const useDataSync = () => {
  
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Estados de datos
  const [sales, setSales] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clientsDirectory, setClientsDirectory] = useState([]);
  
  // Estado de carga granular
  const [loadingState, setLoadingState] = useState({
    sales: true,
    catalog: true,
    clients: true
  });

  // 1. DETECTOR DE AUTENTICACIÓN
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      
      // Limpieza inmediata al salir
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
    // NOTA: Si tienes miles de ventas, en el futuro podrías necesitar 'limit(100)' aquí.
    const salesQuery = query(collection(db, userPath, 'sales'), orderBy('createdAt', 'desc'));
    const catalogRef = collection(db, userPath, 'catalog');
    const clientsRef = collection(db, userPath, 'clients');

    // A. Suscripción a VENTAS
    const salesUnsub = onSnapshot(salesQuery, (snapshot) => {
      setSales(snapshot.docs.map(sanitizeData));
      setLoadingState(prev => ({ ...prev, sales: false }));
    }, (error) => {
      console.error("Error sync ventas:", error);
      setLoadingState(prev => ({ ...prev, sales: false }));
    });
    
    // B. Suscripción a CATÁLOGO
    const catalogUnsub = onSnapshot(catalogRef, (snapshot) => {
      setCatalog(snapshot.docs.map(sanitizeData));
      setLoadingState(prev => ({ ...prev, catalog: false }));
    }, (error) => {
        console.error("Error sync catálogo:", error);
        setLoadingState(prev => ({ ...prev, catalog: false }));
    });
    
    // C. Suscripción a CLIENTES
    const clientsUnsub = onSnapshot(clientsRef, (snapshot) => {
      setClientsDirectory(snapshot.docs.map(sanitizeData));
      setLoadingState(prev => ({ ...prev, clients: false }));
    }, (error) => {
        console.error("Error sync clientes:", error);
        setLoadingState(prev => ({ ...prev, clients: false }));
    });
    
    // Limpieza al desmontar o cambiar usuario
    return () => { salesUnsub(); catalogUnsub(); clientsUnsub(); };
  }, [user]); 

  // Calculamos bandera global de carga
  const loadingData = authLoading || loadingState.sales || loadingState.catalog || loadingState.clients;

  return { user, authLoading, sales, catalog, clientsDirectory, loadingData };
};