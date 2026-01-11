// src/hooks/useDataSync.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy, 
    limit, 
    doc,
    getDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// Helper limpio
const sanitizeData = (doc) => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
        cost: Number(data.cost) || 0 // Aseguramos que cost sea número siempre
    };
};

export const useDataSync = () => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [sales, setSales] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clientsDirectory, setClientsDirectory] = useState([]);
  const [totalRevenue, setTotalRevenue] = useState(0); 
  const [branding, setBranding] = useState({ name: 'HM Digital', logo: null });

  const [loadingState, setLoadingState] = useState({
    sales: true,
    catalog: true,
    clients: true
  });

  // 1. AUTH LISTENER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        setSales([]); setCatalog([]); setClientsDirectory([]);
        setTotalRevenue(0);
        setLoadingState({ sales: false, catalog: false, clients: false });
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. DATA SYNC
  useEffect(() => {
    if (!user) return;
    const userPath = `users/${user.uid}`;
    
    // Lista de estados que NO suman dinero
    const IGNORED_STATUSES = [
        'LIBRE', 'Caída', 'Actualizar', 'Dominio', 'EXPIRED', 
        'Vencido', 'Cancelado', 'Problemas', 'Garantía', 'Admin'
    ];

    // A. Branding
    getDoc(doc(db, `${userPath}/config/branding`)).then(snap => {
        if(snap.exists()) setBranding(snap.data());
    });

    // B. Ventas (Realtime + Cálculo Local)
    const salesQuery = query(collection(db, userPath, 'sales'), orderBy('createdAt', 'desc'), limit(3000));
    const salesUnsub = onSnapshot(salesQuery, (snapshot) => {
        const docs = snapshot.docs.map(sanitizeData);
        setSales(docs);
        
        // 🔥 CÁLCULO DE DINERO EN TIEMPO REAL (CORREGIDO)
        // Sumamos solo lo que NO esté en la lista negra
        const currentTotal = docs.reduce((acc, item) => {
            if (IGNORED_STATUSES.includes(item.client)) return acc;
            return acc + item.cost;
        }, 0);
        
        setTotalRevenue(currentTotal);
        setLoadingState(prev => ({ ...prev, sales: false }));
    });

    // C. Catálogo
    const catalogUnsub = onSnapshot(collection(db, userPath, 'catalog'), (snap) => {
        setCatalog(snap.docs.map(sanitizeData));
        setLoadingState(prev => ({ ...prev, catalog: false }));
    });

    // D. Clientes
    const clientsUnsub = onSnapshot(collection(db, userPath, 'clients'), (snap) => {
        setClientsDirectory(snap.docs.map(sanitizeData));
        setLoadingState(prev => ({ ...prev, clients: false }));
    });

    return () => { salesUnsub(); catalogUnsub(); clientsUnsub(); };
  }, [user]);

  const loadingData = authLoading || loadingState.sales || loadingState.catalog || loadingState.clients;
  return { user, authLoading, sales, catalog, clientsDirectory, loadingData, totalRevenue, branding };
};