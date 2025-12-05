// src/components/Sidebar.jsx

import React from 'react';
import { Layers, Box, Settings, LogOut } from 'lucide-react'; 
// Importa todos los íconos usados en la Sidebar

const Sidebar = ({ view, setView, handleLogout }) => {
    return (
        // ✅ CORTAR Y PEGAR ESTE BLOQUE
        <div className="hidden md:flex w-72 bg-white/80 backdrop-blur-2xl border-r border-white/50 flex-col shadow-xl z-20 relative">
            <div className="p-8 flex flex-col items-center justify-center border-b border-slate-100/50">
                <div className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/20 mb-4 bg-white overflow-hidden p-2 group cursor-pointer hover:scale-105 transition-transform">
                    <img src="/logo1.png" alt="Logo" className="w-full h-full object-contain rounded-xl"/>
                </div>
                <h1 className="font-bold text-lg text-slate-800">HM Digital</h1>
                <span className="text-xs text-slate-400 font-medium tracking-widest uppercase">Manager Pro</span>
            </div>
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                {/* Nota: Usamos las props view y setView aquí */}
                <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-semibold text-sm ${view === 'dashboard' ? 'bg-[#007AFF] text-white shadow-lg shadow-blue-500/30' : 'text-slate-500 hover:bg-white/60'}`}><Layers size={20}/> Tablero</button>
                <button onClick={() => setView('add_stock')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-semibold text-sm ${view === 'add_stock' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:bg-white/60'}`}><Box size={20}/> Stock</button>
                <button onClick={() => setView('config')} className={`w-full flex items-center gap-3 px-5 py-4 rounded-2xl transition-all font-semibold text-sm ${view === 'config' ? 'bg-white text-slate-900 shadow-md border border-slate-100' : 'text-slate-500 hover:bg-white/60'}`}><Settings size={20}/> Ajustes</button>
            </nav>
            <div className="p-6 border-t border-slate-100/50">
                {/* Nota: Usamos la prop handleLogout aquí */}
                <button onClick={handleLogout} className="w-full py-3 flex items-center justify-center gap-2 text-red-400 hover:text-red-600 font-bold text-xs uppercase tracking-wider transition-colors"><LogOut size={16}/> Salir</button>
            </div>
        </div>
    );
};

export default Sidebar;