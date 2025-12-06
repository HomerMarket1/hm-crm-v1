// src/layouts/MainLayout.jsx (BARRA INFERIOR AJUSTADA AL BORDE)

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
        <div className="h-[100dvh] w-full bg-[#F2F2F7] relative overflow-hidden flex flex-col md:flex-row pt-[env(safe-area-inset-top)] md:pt-6 md:p-6 md:gap-6 selection:bg-indigo-100 selection:text-indigo-900">
            
            {/* FONDO ANIMADO */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-indigo-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none"/>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none" style={{animationDelay: '2s'}}/>

            {/* NOTIFICACIONES */}
            <div className="z-50"><Toast notification={notification} setNotification={setNotification} /></div>

            {/* 1. ISLA IZQUIERDA (SIDEBAR) - PC */}
            <aside className="hidden md:flex w-72 h-full flex-col bg-white/70 backdrop-blur-2xl rounded-[2.5rem] shadow-2xl border border-white/40 overflow-hidden z-20 relative">
                <Sidebar view={view} setView={setView} handleLogout={handleLogout}/>
            </aside>

            {/* 2. ISLA DERECHA (CONTENIDO) */}
            <div className="flex-1 h-full flex flex-col bg-white/60 backdrop-blur-2xl md:rounded-[2.5rem] md:shadow-2xl md:border border-white/40 overflow-hidden z-10 relative transition-all rounded-t-[2rem] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-white/50">
                
                {/* HEADER */}
                <header className="h-auto min-h-[4rem] flex items-center justify-between px-6 md:px-10 flex-shrink-0 z-20 pt-4 pb-2 md:pt-0 md:pb-0">
                    <div>
                        <h2 className="text-2xl md:text-4xl font-black text-slate-800 tracking-tighter drop-shadow-sm">
                            {getPageTitle()}
                        </h2>
                    </div>
                    
                    <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/40 backdrop-blur-md text-slate-500 rounded-full text-xs font-bold border border-white/30 shadow-sm">
                        <Calendar size={14}/> 
                        {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </div>
                    
                    <button onClick={handleLogout} className="md:hidden p-2 text-slate-400 hover:text-slate-600 transition-colors">
                        <LogOut size={24}/>
                    </button>
                </header>

                {/* CONTENIDO PRINCIPAL */}
                {/* pb-28: Espacio suficiente para que el último ítem no quede tapado por la barra */}
                <main className="flex-1 overflow-y-auto p-4 md:p-10 pb-28 md:pb-8 scroll-smooth no-scrollbar relative">
                    {children}
                </main>

                {/* BOTTOM NAV (SOLO MÓVIL) - BAJADO AL MÁXIMO SEGURO */}
                {/* bottom-0 + mb-[env(safe-area...)] la coloca justo encima de la barra de inicio */}
                <nav className="md:hidden fixed bottom-0 left-4 right-4 bg-white/90 backdrop-blur-xl rounded-t-[2rem] rounded-b-[2.5rem] border-t border-x border-white/50 p-2 flex justify-around z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] mb-[env(safe-area-inset-bottom)]">
                    <button onClick={() => setView('dashboard')} className={`p-4 rounded-2xl transition-all ${view === 'dashboard' ? 'bg-slate-900 text-white shadow-lg scale-110' : 'text-slate-400'}`}><Layers size={24}/></button>
                    <button onClick={() => setView('add_stock')} className={`p-4 rounded-2xl transition-all ${view === 'add_stock' ? 'bg-indigo-600 text-white shadow-lg scale-110' : 'text-slate-400'}`}><Box size={24}/></button>
                    <button onClick={() => setView('config')} className={`p-4 rounded-2xl transition-all ${view === 'config' ? 'bg-slate-200 text-slate-800 scale-110' : 'text-slate-400'}`}><Settings size={24}/></button>
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