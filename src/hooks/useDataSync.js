// src/hooks/useDataSync.js

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; 
import { collection, onSnapshot } from 'firebase/firestore'; 
// Asegúrate de que las rutas a config.js sean correctas:
import { auth, db } from '../firebase/config'; 

export const useDataSync = () => {
  // Estados que controlan la aplicación a nivel global
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Estados que almacenan los datos de Firestore
  const [sales, setSales] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clientsDirectory, setClientsDirectory] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // 1. AUTENTICACIÓN: Detecta cambios de sesión (login/logout)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    // Limpieza de la suscripción al desmontar el componente
    return () => unsubscribe();
  }, []); 

  // 2. CARGA DE DATOS: Sincroniza las colecciones cuando el usuario está autenticado
  useEffect(() => {
    // Si no hay usuario, limpiamos los datos y salimos
    if (!user) {
      setSales([]); setCatalog([]); setClientsDirectory([]);
      return;
    }
    
    setLoadingData(true);
    const userPath = `users/${user.uid}`;

    // Suscripción a 'sales'
    const salesUnsub = onSnapshot(collection(db, userPath, 'sales'), (s) => {
      setSales(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
      setLoadingData(false); 
    });
    
    // Suscripción a 'catalog'
    const catalogUnsub = onSnapshot(collection(db, userPath, 'catalog'), (s) => {
      setCatalog(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    // Suscripción a 'clients'
    const clientsUnsub = onSnapshot(collection(db, userPath, 'clients'), (s) => {
      setClientsDirectory(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    // Función de limpieza para desuscribirse de todos los listeners de Firestore
    return () => { salesUnsub(); catalogUnsub(); clientsUnsub(); };
  }, [user]); 

  // El hook retorna todos los datos y estados de carga.
  return { user, authLoading, sales, catalog, clientsDirectory, loadingData, db, auth };
};