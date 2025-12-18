// src/layouts/MainLayout.jsx
import React, { useState } from 'react';
import { LayoutDashboard, Box, Settings, LogOut, Menu, X } from 'lucide-react';
import Toast from '../components/Toast';
// Asegúrate de que el logo siga importado correctamente
import logoImg from '../assets/Logo.png';

const MainLayout = ({ view, setView, handleLogout, children, notification, setNotification }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    const menuItems = [
        { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard, color: 'text-indigo-500', bg: 'bg-indigo-500' },
        { id: 'add_stock', label: 'Stock / Bóveda', icon: Box, color: 'text-emerald-500', bg: 'bg-emerald-500' },
        { id: 'config', label: 'Ajustes', icon: Settings, color: 'text-slate-500', bg: 'bg-slate-500' },
    ];

    // --- BOTÓN DE NAVEGACIÓN REFINADO (Más pequeño y espaciado) ---
    const NavButton = ({ item, isMobile = false }) => {
        const isActive = view === item.id;
        
        return (
            <button
                onClick={() => { setView(item.id); if(isMobile) setMobileMenuOpen(false); }}
                className={`
                    group relative w-full flex items-center gap-3 p-2.5 transition-all duration-300
                    ${isActive 
                        ? 'bg-white shadow-lg shadow-indigo-100/50 scale-100' 
                        : 'hover:bg-white/40 hover:scale-[1.02] active:scale-95'
                    }
                    // MÁS ESPACIO VERTICAL ENTRE BOTONES (mb-4 en móvil, mb-6 en escritorio)
                    rounded-2xl mb-4 md:mb-6 overflow-hidden
                `}
            >
                {/* Indicador lateral más sutil */}
                {isActive && <div className={`absolute left-0 top-2 bottom-2 w-1 ${item.bg} rounded-r-full`} />}
                
                {/* Icono más pequeño (w-10 h-10 en vez de w-12 h-12) */}
                <div className={`
                    w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0
                    ${isActive ? item.bg + ' text-white shadow-md' : 'bg-slate-100/80 text-slate-400 group-hover:bg-white group-hover:text-slate-600'}
                `}>
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>

                {/* Texto más pequeño (text-sm en vez de text-lg) */}
                <div className="text-left truncate">
                    <span className={`block text-sm font-bold tracking-tight ${isActive ? 'text-slate-800' : 'text-slate-400 group-hover:text-slate-600'}`}>
                        {item.label}
                    </span>
                </div>
            </button>
        );
    };

    return (
        <div className="flex h-screen bg-[#F2F2F7] overflow-hidden font-sans selection:bg-indigo-500/30">
            <Toast notification={notification} setNotification={setNotification} />

            {/* SIDEBAR DESKTOP (Más estrecho: w-64 en vez de w-80) */}
            <aside className="hidden md:flex flex-col w-64 h-full p-4 z-20">
                <div className="flex-1 bg-white/40 backdrop-blur-2xl border border-white/60 shadow-xl shadow-indigo-500/5 rounded-[2.5rem] flex flex-col p-5 relative overflow-hidden">
                    
                    <div className="absolute -top-20 -right-20 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"/>
                    
                    {/* Header Logo (Un poco más compacto) */}
                    <div className="flex flex-col items-center mb-8 mt-2">
                        <div className="relative group cursor-pointer">
                            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"/>
                            {/* Logo ligeramente más pequeño (w-24 h-24) */}
                            <div className="relative w-24 h-24 bg-white rounded-full shadow-lg border-4 border-white flex items-center justify-center transform group-hover:scale-105 transition-transform duration-500 overflow-hidden">
                                <img src={logoImg} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        </div>
                        <h1 className="mt-3 text-xl font-black text-slate-800 tracking-tight">HM Digital</h1>
                    </div>

                    {/* Navegación Centrada */}
                    <nav className="flex-1 flex flex-col justify-center px-1">
                        {menuItems.map(item => <NavButton key={item.id} item={item} />)}
                    </nav>

                    {/* Footer Logout Compacto */}
                    <div className="mt-auto pt-4 border-t border-slate-200/50">
                        <button 
                            onClick={handleLogout}
                            className="w-full py-3 rounded-xl flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-50 hover:scale-[1.02] active:scale-95 transition-all font-bold text-xs bg-white/50 border border-white/50 shadow-sm"
                        >
                            <LogOut size={16} />
                            <span>Salir</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* MOBILE HEADER (Sin cambios mayores, solo usa el logo) */}
            <div className="md:hidden fixed top-0 left-0 right-0 h-20 z-40 px-4 flex items-center justify-between bg-[#F2F2F7]/90 backdrop-blur-md border-b border-white/20">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white rounded-full shadow-sm flex items-center justify-center overflow-hidden border border-white">
                        <img src={logoImg} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black text-slate-800 leading-none">HM Digital</h1>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Panel</p>
                    </div>
                </div>
                <button onClick={() => setMobileMenuOpen(true)} className="w-12 h-12 bg-white rounded-full shadow-sm flex items-center justify-center text-slate-700 active:scale-90 transition-transform">
                    <Menu size={24} />
                </button>
            </div>

            {/* MOBILE MENU OVERLAY (Usa los nuevos botones compactos) */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMobileMenuOpen(false)}>
                    <div className="absolute right-0 top-0 bottom-0 w-3/4 max-w-sm bg-[#F2F2F7] p-6 shadow-2xl animate-in slide-in-from-right duration-300" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8">
                            <h2 className="text-2xl font-black text-slate-800">Menú</h2>
                            <button onClick={() => setMobileMenuOpen(false)} className="p-2 bg-white rounded-full shadow-sm"><X size={24} /></button>
                        </div>
                        <div className="px-1">
                            {menuItems.map(item => <NavButton key={item.id} item={item} isMobile={true} />)}
                            <div className="h-px bg-slate-200 my-6"/>
                            <button onClick={handleLogout} className="w-full py-3 bg-rose-100 text-rose-600 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                                <LogOut size={18} /> Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONTENIDO PRINCIPAL */}
            <main className="flex-1 h-full overflow-y-auto overflow-x-hidden relative pt-20 md:pt-0">
                <div className="max-w-[1600px] mx-auto p-4 md:p-6 h-full">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;