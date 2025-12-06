// src/components/Sidebar.jsx (LOGO GRANDE Y FLOTANTE SIN RECUADRO)

import React from 'react';
import { LayoutDashboard, Box, Settings, LogOut } from 'lucide-react';

const Sidebar = ({ view, setView, handleLogout }) => {
    
    // Estilo base para los botones de navegación
    const NAV_BTN_CLASS = (isActive) => `
        flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 group font-bold text-sm
        ${isActive 
            ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20 scale-100' 
            : 'text-slate-500 hover:bg-white hover:shadow-sm hover:text-slate-800'
        }
    `;

    return (
        <div className="flex flex-col h-full px-2 py-2">
            
            {/* 1. PERFIL / LOGO (MODIFICADO) */}
            <div className="flex flex-col items-center justify-center py-6 mb-2">
                {/* SE ELIMINÓ EL DIV CONTENEDOR BLANCO (bg-white border shadow...) */}
                <img 
                    src="/Logo.png" 
                    alt="Logo" 
                    // SE APLICARON ESTILOS DIRECTAMENTE A LA IMAGEN:
                    // - w-24 h-24: Más grande que antes.
                    // - filter drop-shadow-lg: Sombra suave natural.
                    // - hover:scale-105: Pequeño efecto al pasar el mouse.
                    className="w-24 h-24 object-contain filter drop-shadow-lg mb-3 transform hover:scale-105 transition-transform duration-300" 
                />
                <h2 className="text-lg font-black text-slate-800 tracking-tight">HM Digital</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Manager Pro</p>
            </div>

            {/* 2. NAVEGACIÓN */}
            <nav className="flex-1 space-y-2">
                <button 
                    onClick={() => setView('dashboard')} 
                    className={NAV_BTN_CLASS(view === 'dashboard')}
                >
                    <LayoutDashboard size={20} className={view === 'dashboard' ? 'text-blue-300' : 'text-slate-400 group-hover:text-blue-500'}/>
                    Tablero
                </button>

                <button 
                    onClick={() => setView('add_stock')} 
                    className={NAV_BTN_CLASS(view === 'add_stock')}
                >
                    <Box size={20} className={view === 'add_stock' ? 'text-indigo-300' : 'text-slate-400 group-hover:text-indigo-500'}/>
                    Stock
                </button>

                <button 
                    onClick={() => setView('config')} 
                    className={NAV_BTN_CLASS(view === 'config')}
                >
                    <Settings size={20} className={view === 'config' ? 'text-slate-300' : 'text-slate-400 group-hover:text-slate-600'}/>
                    Ajustes
                </button>
            </nav>

            {/* 3. BOTÓN SALIR */}
            <div className="mt-auto pt-4 border-t border-slate-200/50">
                <button 
                    onClick={handleLogout} 
                    className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-rose-50 text-rose-500 font-bold text-xs uppercase tracking-widest hover:bg-rose-500 hover:text-white hover:shadow-lg hover:shadow-rose-500/30 transition-all duration-300 group active:scale-95"
                >
                    <LogOut size={16} className="group-hover:rotate-180 transition-transform duration-500"/>
                    Cerrar Sesión
                </button>
            </div>

        </div>
    );
};

export default Sidebar;