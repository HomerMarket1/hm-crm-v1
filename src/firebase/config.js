// src/firebase/config.js

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ============================================================================
// ✅ CREDENCIALES MOVIDAS
// ============================================================================
const firebaseConfig = {
  apiKey: "AIzaSyBw3xZAm7MIBg5_0wofo9ZLOKdaFqfrtKo",
  authDomain: "hm-digital-b573e.firebaseapp.com",
  projectId: "hm-digital-b573e",
  storageBucket: "hm-digital-b573e.firebasestorage.app",
  messagingSenderId: "913709788584",
  appId: "1:913709788584:web:6814c401e1d495019d",
  measurementId: "G-MYN2RPJXF0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); // Exportar para Login/Logout
export const db = getFirestore(app); // Exportar para CRUD