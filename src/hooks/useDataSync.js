// src/hooks/useDataSync.js
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth'; 
import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy, 
    limit, 
    where, // ✅ Importante para filtrar basura
    getAggregateFromServer, 
    sum 
} from 'firebase/firestore';
import { auth, db } from '../firebase/config'; 

// ⚡️ Función pura para limpiar datos
const sanitizeData = (doc) => {
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
    };
};

export const useDataSync = () => {
  
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [sales, setSales] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [clientsDirectory, setClientsDirectory] = useState([]);
  
  // Estado para el Dinero Real (Sin contar Admin/Problemas/etc)
  const [totalRevenue, setTotalRevenue] = useState(0); 
  
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
      
      if (!currentUser) {
        setSales([]);
        setCatalog([]);
        setClientsDirectory([]);
        setTotalRevenue(0);
        setLoadingState({ sales: false, catalog: false, clients: false });
      }
    });
    return () => unsubscribe();
  }, []); 

  // 2. SINCRONIZACIÓN DE DATOS
  useEffect(() => {
    if (!user) return;

    const userPath = `users/${user.uid}`;
    
    // --- LISTA NEGRA DE ESTADOS (No suman dinero) ---
    // Firestore permite máximo 10 valores en 'not-in'. 
    const IGNORED_STATUSES = [
        'LIBRE', 
        'Caída', 'Actualizar', 'Dominio', 'EXPIRED', 
        'Vencido', 'Cancelado', 'Problemas', 'Garantía', 'Admin'
    ];

    // --- QUERY PRINCIPAL (Visual) ---
    // Traemos hasta 3000 para que el buscador funcione bien en tu volumen actual (1800 clientes).
    const salesQuery = query(
        collection(db, userPath, 'sales'), 
        orderBy('createdAt', 'desc'), 
        limit(3000) 
    );

    const catalogRef = collection(db, userPath, 'catalog');
    const clientsRef = collection(db, userPath, 'clients');

    // --- CÁLCULO DE DINERO SERVIDOR (CORREGIDO) ---
    // Sumamos solo lo que tiene costo y NO es un estado problemático o administrativo.
    const calculateTotal = async () => {
        try {
            const coll = collection(db, userPath, 'sales');
            const q = query(
                coll, 
                where('cost', '>', 0),
                where('client', 'not-in', IGNORED_STATUSES) // ✅ Aquí está la magia
            ); 
            
            const snapshot = await getAggregateFromServer(q, {
                totalCost: sum('cost')
            });
            setTotalRevenue(snapshot.data().totalCost || 0);
        } catch (e) {
            console.error("Error calculando total:", e);
        }
    };
    
    // Ejecutamos el cálculo inicial
    calculateTotal();

    // A. Suscripción a VENTAS
    const salesUnsub = onSnapshot(salesQuery, (snapshot) => {
      const docs = snapshot.docs.map(sanitizeData);
      setSales(docs);
      
      // Si tenemos pocos datos (menos del límite), calculamos la suma en local para que sea tiempo real
      // PERO aplicando el mismo filtro de ignorar estados basura.
      if(snapshot.size < 3000) {
          const localTotal = docs
            .filter(d => !IGNORED_STATUSES.includes(d.client)) // ✅ Filtro local idéntico al servidor
            .reduce((acc, doc) => acc + (Number(doc.cost) || 0), 0);
          setTotalRevenue(localTotal);
      }
      
      setLoadingState(prev => ({ ...prev, sales: false }));
    }, (error) => {
      console.error("Error sync ventas:", error);
      setLoadingState(prev => ({ ...prev, sales: false }));
    });
    
    // B. Suscripción a CATÁLOGO
    const catalogUnsub = onSnapshot(catalogRef, (snapshot) => {
      setCatalog(snapshot.docs.map(sanitizeData));
      setLoadingState(prev => ({ ...prev, catalog: false }));
    });
    
    // C. Suscripción a CLIENTES
    const clientsUnsub = onSnapshot(clientsRef, (snapshot) => {
      setClientsDirectory(snapshot.docs.map(sanitizeData));
      setLoadingState(prev => ({ ...prev, clients: false }));
    });
    
    return () => { salesUnsub(); catalogUnsub(); clientsUnsub(); };
  }, [user]); 

  const loadingData = authLoading || loadingState.sales || loadingState.catalog || loadingState.clients;

  return { user, authLoading, sales, catalog, clientsDirectory, loadingData, totalRevenue };
};