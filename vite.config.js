import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // 🚀 Optimización para Vercel & Producción
    target: 'esnext', // Usa Javascript moderno (archivos más ligeros)
    outDir: 'dist',
    sourcemap: false, // Oculta el código fuente en producción (más seguro y ligero)
    
    // 📦 Estrategia de División (Chunking)
    rollupOptions: {
      output: {
        manualChunks: {
          // Separa las librerías pesadas para que el navegador las guarde en caché
          'vendor-react': ['react', 'react-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-icons': ['lucide-react'], 
        },
      },
    },
    // Evita advertencias molestas por el tamaño de Firebase (es normal que sea grande)
    chunkSizeWarningLimit: 1000,
  },
  
  // 📱 Para probar en tu iPhone (misma red Wi-Fi)
  server: {
    host: true, 
  }
})