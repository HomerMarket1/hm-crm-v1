// src/firebase/config.js
import { initializeApp } from "firebase/app";
// Herramientas para caché offline (Persistencia)
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Tus credenciales
const firebaseConfig = {
  apiKey: "AIzaSyBw3xZAm7MIBg5_0wofo9ZLOKdaFqfrtKo",
  authDomain: "hm-digital-b573e.firebaseapp.com",
  projectId: "hm-digital-b573e",
  storageBucket: "hm-digital-b573e.firebasestorage.app",
  messagingSenderId: "913709788584",
  appId: "1:913709788584:web:6814c401e1d495019d",
  measurementId: "G-MYN2RPJXF0"
};

// Inicializar la App
const app = initializeApp(firebaseConfig);

// ✅ ACTIVAR PERSISTENCIA (OFFLINE - MODO MODERNO)
// Esto guarda tus 1800 clientes en la base de datos interna del navegador (IndexedDB).
// Al recargar la página, los datos cargan al instante sin esperar a Internet.
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        // Esto permite tener varias pestañas abiertas sin que la base de datos falle
        tabManager: persistentMultipleTabManager()
    })
});

const auth = getAuth(app);

export { db, auth };