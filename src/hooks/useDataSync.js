// src/hooks/useDataSync.js

import { useState, useEffect } from 'react';
// Asegúrate de importar todas las funciones de Firebase necesarias
import { onAuthStateChanged } from 'firebase/auth'; 
import { collection, onSnapshot } from 'firebase/firestore'; 
import { auth, db } from '../firebase/config'; // Importa la conexión

export const useDataSync = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sales, setSales] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clientsDirectory, setClientsDirectory] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // 1. AUTENTICACIÓN (MOVIDA DESDE App.jsx)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []); // Dependencia de auth ya no es necesaria si la importamos

  // 2. CARGA DE DATOS (MOVIDA DESDE App.jsx)
  useEffect(() => {
    if (!user) {
      setSales([]); setCatalog([]); setClientsDirectory([]);
      return;
    }
    setLoadingData(true);
    const userPath = `users/${user.uid}`;

    const salesUnsub = onSnapshot(collection(db, userPath, 'sales'), (s) => {
      setSales(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)));
      // ✅ IMPORTANTE: `setLoadingData(false)` debe ir al final de la carga de *todos* los datos.
      // Aquí lo dejamos al final de la primera suscripción, como estaba en tu código original.
      setLoadingData(false); 
    });
    const catalogUnsub = onSnapshot(collection(db, userPath, 'catalog'), (s) => {
      setCatalog(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const clientsUnsub = onSnapshot(collection(db, userPath, 'clients'), (s) => {
      setClientsDirectory(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    
    return () => { salesUnsub(); catalogUnsub(); clientsUnsub(); };
  }, [user]); // Dependencia de db ya no es necesaria

  // El hook retorna todos los datos y estados de carga.
  return { user, authLoading, sales, catalog, clientsDirectory, loadingData, db, auth };
};