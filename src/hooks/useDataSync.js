import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { 
    collection, 
    onSnapshot, 
    query, 
    orderBy, 
    limit, 
    doc
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';

// --- CONSTANTES ---
// Sincronizadas con Dashboard para evitar discrepancias financieras
const IGNORED_STATUSES = [
    'LIBRE', 'Espacio Libre', 'Disponible', // Stock
    'Caída', 'Caida', 'Actualizar', 'Dominio', 'Falla', // Problemas
    'EXPIRED', 'Vencido', 'Cancelado', 
    'Garantía', 'Garantia', 'Admin', 'Reposicion', 'Stock'
];

// --- HELPER PURO ---
const sanitizeData = (doc) => {
    // Defensive coding: prevenimos crashes si faltan campos
    const data = doc.data();
    return {
        ...data,
        id: doc.id,
        // Convertimos Timestamps de Firestore a JS Date nativo de forma segura
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : null,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : null,
        // Garantizamos matemáticas seguras
        cost: Number(data.cost) || 0 
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
      
      // Si no hay usuario, limpiamos memoria inmediatamente (Security best practice)
      if (!currentUser) {
        setSales([]); 
        setCatalog([]); 
        setClientsDirectory([]);
        setTotalRevenue(0);
        setBranding({ name: 'HM Digital', logo: null });
        setLoadingState({ sales: false, catalog: false, clients: false });
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. DATA SYNC (Real-time Pipeline)
  useEffect(() => {
    if (!user) return; // Esperamos a tener autenticación
    
    const userPath = `users/${user.uid}`;
    
    // A. Branding en Tiempo Real (Fix: Cambiado de getDoc a onSnapshot)
    // Si cambias la config en otro dispositivo, se actualiza al instante.
    const brandingUnsub = onSnapshot(
        doc(db, `${userPath}/config/branding`), 
        (snap) => {
            if (snap.exists()) setBranding(snap.data());
        },
        (error) => console.error("⚠️ Error Syncing Branding:", error)
    );

    // B. Ventas (Core Data)
    // Limitamos a 3000 para proteger rendimiento, ordenamos por creación.
    const salesQuery = query(
        collection(db, userPath, 'sales'), 
        orderBy('createdAt', 'desc'), 
        limit(3000)
    );
    
    const salesUnsub = onSnapshot(salesQuery, (snapshot) => {
        const docs = snapshot.docs.map(sanitizeData);
        setSales(docs);
        
        // 🔥 CÁLCULO FINANCIERO OPTIMIZADO
        // Solo sumamos dinero real, ignorando stock, caídas y admin.
        const currentTotal = docs.reduce((acc, item) => {
            // Normalizamos a minúsculas para comparación robusta
            const clientName = (item.client || '').trim();
            
            // Si el cliente está en la lista negra O el nombre incluye "Libre", ignorar costo
            const isIgnored = IGNORED_STATUSES.some(status => 
                clientName.toLowerCase() === status.toLowerCase() || 
                clientName.toLowerCase().includes('libre')
            );

            if (isIgnored) return acc;
            return acc + item.cost;
        }, 0);
        
        setTotalRevenue(currentTotal);
        setLoadingState(prev => ({ ...prev, sales: false }));
    }, (error) => {
        console.error("⚠️ Error Syncing Sales:", error);
        setLoadingState(prev => ({ ...prev, sales: false })); // Evita loading infinito en error
    });

    // C. Catálogo
    const catalogUnsub = onSnapshot(collection(db, userPath, 'catalog'), (snap) => {
        setCatalog(snap.docs.map(sanitizeData));
        setLoadingState(prev => ({ ...prev, catalog: false }));
    }, (error) => console.error("⚠️ Error Syncing Catalog:", error));

    // D. Directorio de Clientes
    const clientsUnsub = onSnapshot(collection(db, userPath, 'clients'), (snap) => {
        setClientsDirectory(snap.docs.map(sanitizeData));
        setLoadingState(prev => ({ ...prev, clients: false }));
    }, (error) => console.error("⚠️ Error Syncing Clients:", error));

    // Cleanup: Matamos todos los listeners al desmontar
    return () => { 
        brandingUnsub();
        salesUnsub(); 
        catalogUnsub(); 
        clientsUnsub(); 
    };
  }, [user]);

  const loadingData = authLoading || loadingState.sales || loadingState.catalog || loadingState.clients;
  
  return { 
      user, 
      authLoading, 
      sales, 
      catalog, 
      clientsDirectory, 
      loadingData, 
      totalRevenue, 
      branding 
  };
};