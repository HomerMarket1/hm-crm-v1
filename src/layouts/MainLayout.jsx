// src/layouts/MainLayout.jsx
import React, { useState } from 'react';
import { LayoutDashboard, Box, Settings, LogOut, Menu, X, Moon, Sun } from 'lucide-react';
import Toast from '../components/Toast';
import logoImg from '../assets/Logo.png';

const MainLayout = ({ view, setView, handleLogout, children, notification, setNotification, darkMode, setDarkMode }) => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Colores dinámicos
    const theme = {
        bg: darkMode ? 'bg-[#0B0F19]' : 'bg-[#F2F2F7]',
        text: darkMode ? 'text-slate-200' : 'text-slate-800',
        card: darkMode ? 'bg-[#161B28]/60 border-white/5' : 'bg-white/40 border-white/60',
        sidebar: darkMode ? 'bg-[#161B28]/60 border-white/5' : 'bg-white/40 border-white/60',
        hover: darkMode ? 'hover:bg-white/5' : 'hover:bg-white/40',
        activeBtn: darkMode ? 'bg-white/10 text-white shadow-none' : 'bg-white shadow-lg shadow-indigo-100/50',
    };

    const menuItems = [
        { id: 'dashboard', label: 'Tablero', icon: LayoutDashboard, color: 'text-indigo-400', bg: 'bg-indigo-500' },
        { id: 'add_stock', label: 'Stock / Bóveda', icon: Box, color: 'text-emerald-400', bg: 'bg-emerald-500' },
        { id: 'config', label: 'Ajustes', icon: Settings, color: 'text-slate-400', bg: 'bg-slate-500' },
    ];

    const NavButton = ({ item, isMobile = false }) => {
        const isActive = view === item.id;
        return (
            <button
                onClick={() => { setView(item.id); if(isMobile) setMobileMenuOpen(false); }}
                className={`group relative w-full flex items-center gap-3 p-2.5 transition-all duration-300 ${isActive ? theme.activeBtn : theme.hover} rounded-2xl mb-4 md:mb-6 overflow-hidden`}
            >
                {isActive && <div className={`absolute left-0 top-2 bottom-2 w-1 ${item.bg} rounded-r-full`} />}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 shrink-0 ${isActive ? item.bg + ' text-white shadow-md' : (darkMode ? 'bg-white/5 text-slate-500' : 'bg-slate-100/80 text-slate-400')}`}>
                    <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <div className="text-left truncate">
                    <span className={`block text-sm font-bold tracking-tight ${isActive ? (darkMode ? 'text-white' : 'text-slate-800') : 'text-slate-500 group-hover:text-slate-300'}`}>{item.label}</span>
                </div>
            </button>
        );
    };

    return (
        <div className={`flex h-screen ${theme.bg} overflow-hidden font-sans selection:bg-indigo-500/30 transition-colors duration-500`}>
            
            {/* 🔥 SCROLLBARS INVISIBLES GLOBAL (ESTILO MAC) 🔥 */}
            <style>{`
                ::-webkit-scrollbar { width: 6px; height: 6px; }
                ::-webkit-scrollbar-track { background: transparent; }
                ::-webkit-scrollbar-thumb {
                    background-color: transparent;
                    border-radius: 20px;
                }
                /* Solo mostrar al pasar el mouse sobre el elemento scrollable */
                *:hover::-webkit-scrollbar-thumb {
                    background-color: ${darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)'};
                }
            `}</style>

            <Toast notification={notification} setNotification={setNotification} />

            {/* SIDEBAR DESKTOP */}
            <aside className="hidden md:flex flex-col w-64 h-full p-4 z-20">
                <div className={`flex-1 backdrop-blur-2xl border shadow-xl shadow-black/5 rounded-[2.5rem] flex flex-col p-5 relative overflow-hidden transition-colors duration-500 ${theme.sidebar}`}>
                    <div className={`absolute -top-20 -right-20 w-60 h-60 rounded-full blur-3xl pointer-events-none ${darkMode ? 'bg-indigo-500/10' : 'bg-indigo-500/10'}`}/>
                    
                    <div className="flex flex-col items-center mb-8 mt-2">
                        <div className="relative group cursor-pointer">
                            <div className="absolute inset-0 bg-indigo-500 rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"/>
                            <div className={`relative w-24 h-24 rounded-full shadow-lg border-4 flex items-center justify-center transform group-hover:scale-105 transition-transform duration-500 overflow-hidden ${darkMode ? 'bg-[#0B0F19] border-white/10' : 'bg-white border-white'}`}>
                                <img src={logoImg} alt="Logo" className="w-full h-full object-cover" />
                            </div>
                        </div>
                        <h1 className={`mt-3 text-xl font-black tracking-tight transition-colors ${theme.text}`}>HM Digital</h1>
                    </div>

                    <nav className="flex-1 flex flex-col justify-center px-1">
                        {menuItems.map(item => <NavButton key={item.id} item={item} />)}
                    </nav>

                    <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-3">
                        <button onClick={() => setDarkMode(!darkMode)} className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-all border ${darkMode ? 'bg-white/5 border-white/10 text-indigo-300 hover:bg-white/10' : 'bg-white/50 border-white/50 text-indigo-600 hover:bg-white'}`}>
                            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                            <span>{darkMode ? 'Modo Día' : 'Modo Noche'}</span>
                        </button>
                        <button onClick={handleLogout} className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 text-rose-500 hover:scale-[1.02] active:scale-95 transition-all font-bold text-xs border ${darkMode ? 'bg-white/5 border-white/10 hover:bg-rose-500/10' : 'bg-white/50 border-white/50 hover:bg-rose-50'}`}>
                            <LogOut size={16} /> <span>Salir</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* MOBILE HEADER */}
            <div className={`md:hidden fixed top-0 left-0 right-0 h-20 z-40 px-4 flex items-center justify-between backdrop-blur-md border-b transition-colors ${darkMode ? 'bg-[#0B0F19]/90 border-white/10' : 'bg-[#F2F2F7]/90 border-white/20'}`}>
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full shadow-sm flex items-center justify-center overflow-hidden border ${darkMode ? 'bg-black border-white/20' : 'bg-white border-white'}`}>
                        <img src={logoImg} alt="Logo" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h1 className={`text-lg font-black leading-none ${theme.text}`}>HM Digital</h1>
                        <p className="text-[10px] font-bold text-slate-500 uppercase">Panel</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => setDarkMode(!darkMode)} className={`w-12 h-12 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform ${darkMode ? 'bg-[#161B28] text-indigo-400' : 'bg-white text-indigo-600'}`}>
                        {darkMode ? <Sun size={20}/> : <Moon size={20}/>}
                    </button>
                    <button onClick={() => setMobileMenuOpen(true)} className={`w-12 h-12 rounded-full shadow-sm flex items-center justify-center active:scale-90 transition-transform ${darkMode ? 'bg-[#161B28] text-white' : 'bg-white text-slate-700'}`}>
                        <Menu size={24} />
                    </button>
                </div>
            </div>

            {/* MOBILE MENU */}
            {mobileMenuOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setMobileMenuOpen(false)}>
                    <div className={`absolute right-0 top-0 bottom-0 w-3/4 max-w-sm p-6 shadow-2xl animate-in slide-in-from-right duration-300 ${darkMode ? 'bg-[#0B0F19]' : 'bg-[#F2F2F7]'}`} onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-8">
                            <h2 className={`text-2xl font-black ${theme.text}`}>Menú</h2>
                            <button onClick={() => setMobileMenuOpen(false)} className={`p-2 rounded-full shadow-sm ${darkMode ? 'bg-[#161B28] text-white' : 'bg-white text-black'}`}><X size={24} /></button>
                        </div>
                        <div className="px-1">
                            {menuItems.map(item => <NavButton key={item.id} item={item} isMobile={true} />)}
                            <div className={`h-px my-6 ${darkMode ? 'bg-white/10' : 'bg-slate-200'}`}/>
                            <button onClick={handleLogout} className="w-full py-3 bg-rose-500/10 text-rose-500 rounded-xl font-bold flex items-center justify-center gap-2 text-sm">
                                <LogOut size={18} /> Cerrar Sesión
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN CONTENT */}
            <main className="flex-1 h-full overflow-y-auto overflow-x-hidden relative pt-20 md:pt-0">
                <div className="max-w-[1600px] mx-auto p-4 md:p-6 h-full">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default MainLayout;