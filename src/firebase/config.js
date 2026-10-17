// src/firebase/config.js
import { initializeApp } from "firebase/app";
// Herramientas para caché offline (Persistencia)
import {
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
    memoryLocalCache,
    connectFirestoreEmulator
} from "firebase/firestore";
import { getAuth, connectAuthEmulator } from "firebase/auth";

// 🧪 Modo pruebas locales ("npm run dev:local"): usa los emuladores en vez de producción
const useEmulator = import.meta.env.VITE_USE_EMULATOR === "true";

// Tus credenciales (definidas en el archivo .env)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY, 
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Inicializar la App
const app = initializeApp(firebaseConfig);

// ✅ ACTIVAR PERSISTENCIA (OFFLINE - MODO MODERNO)
// Esto guarda tus 1800 clientes en la base de datos interna del navegador (IndexedDB).
// Al recargar la página, los datos cargan al instante sin esperar a Internet.
const db = initializeFirestore(app, {
    // En el emulador se usa caché en memoria para no mezclar datos de prueba con la caché de producción
    localCache: useEmulator ? memoryLocalCache() : persistentLocalCache({
        // Esto permite tener varias pestañas abiertas sin que la base de datos falle
        tabManager: persistentMultipleTabManager()
    })
});

const auth = getAuth(app);

if (useEmulator) {
    // Usa el host de la página para que también funcione desde el iPhone en la misma red
    const host = window.location.hostname;
    connectFirestoreEmulator(db, host, 8080);
    connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
    console.info("🧪 Conectado a los emuladores de Firebase");
}

export { db, auth };