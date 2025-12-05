import React from 'react';
import { Calendar, LogOut, Layers, Box, Settings } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import Toast from '../components/Toast';

const MainLayout = ({ 
    children, 
    view, 
    setView, 
    handleLogout, 
    notification, 
    setNotification 
}) => {

    // Lógica visual del título según la vista
    const getPageTitle = () => {
        switch (view) {
            case 'dashboard': return 'Ventas';
            case 'add_stock': return 'Inventario';
            case 'form': return 'Cliente';
            case 'config': return 'Ajustes';
            default: return 'HM CRM';
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-full bg-[#F2F2F7] font-sans text-slate-900 overflow-hidden relative selection:bg-blue-100 selection:text-blue-900">
            
            {/* 1. Notificaciones Globales dentro del Layout */}
            <Toast notification={notification} setNotification={setNotification} />

            {/* 2. Sidebar de Escritorio */}
            <Sidebar view={view} setView={setView} handleLogout={handleLogout}/>

            {/* 3. Contenedor Principal (Lado derecho) */}
            <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                
                {/* Header */}
                <header className="h-14 md:h-20 flex items-center justify-between px-4 md:px-8 flex-shrink-0 z-10 bg-white/50 backdrop-blur-md md:bg-transparent">
                    <div>
                        <h2 className="text-xl md:text-3xl font-bold text-slate-900 tracking-tight">
                            {getPageTitle()}
                        </h2>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/60 backdrop-blur text-slate-500 rounded-full text-xs font-bold border border-white/50 shadow-sm">
                        <Calendar size={14}/> 
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    
                    <button onClick={handleLogout} className="md:hidden p-2 text-slate-400">
                        <LogOut size={20}/>
                    </button>
                </header>

                {/* Área de Contenido Dinámico (Aquí se inyectan tus vistas) */}
                <main className="flex-1 overflow-y-auto p-3 md:p-8 pb-24 md:pb-8 scroll-smooth no-scrollbar">
                    {children}
                </main>

                {/* Navegación Móvil (Bottom Nav) */}
                <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 p-2 flex justify-around z-40 pb-safe">
                    <button onClick={() => setView('dashboard')} className={`p-3 rounded-2xl ${view === 'dashboard' ? 'bg-[#007AFF] text-white shadow-lg' : 'text-slate-400'}`}><Layers size={24}/></button>
                    <button onClick={() => setView('add_stock')} className={`p-3 rounded-2xl ${view === 'add_stock' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-400'}`}><Box size={24}/></button>
                    <button onClick={() => setView('config')} className={`p-3 rounded-2xl ${view === 'config' ? 'bg-slate-100 text-slate-800' : 'text-slate-400'}`}><Settings size={24}/></button>
                </nav>

            </div>
        </div>
    );
};

export default MainLayout;