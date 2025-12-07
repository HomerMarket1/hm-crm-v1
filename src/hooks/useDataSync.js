// src/hooks/useDataSync.js (VERSIÓN PULIDA)

import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; 
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore'; // Añadir query, orderBy
import { auth, db } from '../firebase/config'; 

export const useDataSync = () => {
  
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [sales, setSales] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clientsDirectory, setClientsDirectory] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // 1. AUTENTICACIÓN: Detecta cambios de sesión
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []); 

  // 2. CARGA DE DATOS: Sincroniza las colecciones cuando el usuario está autenticado
  useEffect(() => {
    if (!user) {
      setSales([]); setCatalog([]); setClientsDirectory([]);
      return;
    }
    
    setLoadingData(true);
    const userPath = `users/${user.uid}`;

    // 💡 MEJORA: Ordenar las ventas en la consulta (backend) es más eficiente.
    const salesQuery = query(collection(db, userPath, 'sales'), orderBy('createdAt', 'asc'));

    const salesUnsub = onSnapshot(salesQuery, (s) => {
      // Ordenamiento del lado del cliente ELIMINADO ya que se hace en la consulta
      setSales(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingData(false); // Asumimos que la primera carga es suficiente
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

  // ✅ PULIDO FINAL: Eliminamos db y auth del retorno para desacoplar App.jsx
  return { user, authLoading, sales, catalog, clientsDirectory, loadingData };
};