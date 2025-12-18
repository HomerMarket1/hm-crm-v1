// src/firebase/config.js
import { initializeApp } from "firebase/app";
// Importamos las herramientas para activar la memoria caché offline
import { 
    getFirestore, 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Tus credenciales reales
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

// ✅ ACTIVAR PERSISTENCIA (OFFLINE)
// En lugar de usar getFirestore(), usamos initializeFirestore con configuración de caché.
// Esto permite que los datos se guarden en el navegador (IndexedDB) para no gastar lecturas.
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

const auth = getAuth(app);

export { db, auth };