// src/layouts/MainLayout.jsx (CORRECCIÓN VISUAL: SIDEBAR SIN BORDES INTERNOS)

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
        // CONTENEDOR MÁSTER
        <div className="h-screen w-full bg-[#F2F2F7] relative overflow-hidden flex md:p-6 md:gap-6 selection:bg-indigo-100 selection:text-indigo-900">
            
            {/* FONDO ANIMADO */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none"/>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{animationDelay: '2s'}}/>

            {/* NOTIFICACIONES */}
            <div className="z-50"><Toast notification={notification} setNotification={setNotification} /></div>

            {/* 1. ISLA IZQUIERDA (SIDEBAR) - CORREGIDO */}
            {/* Quitamos el padding interno para que el Sidebar llene todo el contenedor y tome sus curvas */}
            <aside className="hidden md:flex w-72 h-full flex-col bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden z-20 relative">
                <div className="h-full w-full overflow-y-auto no-scrollbar">
                    <Sidebar view={view} setView={setView} handleLogout={handleLogout}/>
                </div>
            </aside>

            {/* 2. ISLA DERECHA (CONTENIDO) */}
            <div className="flex-1 h-full flex flex-col bg-white/60 backdrop-blur-2xl md:rounded-[2.5rem] md:shadow-2xl md:border border-white/40 overflow-hidden z-10 relative transition-all">
                
                {/* HEADER */}
                <header className="h-20 flex items-center justify-between px-6 md:px-10 flex-shrink-0 z-20">
                    <div>
                        <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tighter drop-shadow-sm">
                            {getPageTitle()}
                        </h2>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/40 backdrop-blur-md text-slate-500 rounded-full text-xs font-bold border border-white/30 shadow-sm">
                        <Calendar size={14}/> 
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    
                    <button onClick={handleLogout} className="md:hidden p-2 text-slate-400">
                        <LogOut size={20}/>
                    </button>
                </header>

                {/* CONTENIDO PRINCIPAL */}
                <main className="flex-1 overflow-y-auto p-4 md:p-10 pb-24 md:pb-8 scroll-smooth no-scrollbar relative mask-linear-gradient">
                    {children}
                </main>

                {/* BOTTOM NAV (SOLO MÓVIL) */}
                <nav className="md:hidden fixed bottom-4 left-4 right-4 bg-white/80 backdrop-blur-xl rounded-[2rem] border border-white/50 p-2 flex justify-around z-40 shadow-2xl">
                    <button onClick={() => setView('dashboard')} className={`p-3 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-slate-900 text-white shadow-lg scale-105' : 'text-slate-400'}`}><Layers size={24}/></button>
                    <button onClick={() => setView('add_stock')} className={`p-3 rounded-2xl transition-all ${view === 'add_stock' ? 'bg-indigo-600 text-white shadow-lg scale-105' : 'text-slate-400'}`}><Box size={24}/></button>
                    <button onClick={() => setView('config')} className={`p-3 rounded-2xl transition-all ${view === 'config' ? 'bg-slate-200 text-slate-800 scale-105' : 'text-slate-400'}`}><Settings size={24}/></button>
                </nav>

            </div>

            {/* Sidebar Móvil */}
            <div className="md:hidden absolute -left-full">
                <Sidebar view={view} setView={setView} handleLogout={handleLogout}/>
            </div>

        </div>
    );
};

export default MainLayout;