// src/components/LoginScreen.jsx (DISEÑO FINAL: LOGO FLOTANTE CON LUZ DE FONDO)

import React from 'react';
import { Mail, Lock, ArrowRight, Zap } from 'lucide-react';

const LoginScreen = ({ 
    loginEmail, 
    setLoginEmail, 
    loginPass, 
    setLoginPass, 
    handleLogin, 
    loginError 
}) => {
    
    const INPUT_WRAPPER = "relative group";
    const ICON_STYLE = "absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors pointer-events-none";
    const INPUT_STYLE = "w-full p-4 pl-12 bg-slate-50/50 border border-slate-200/60 rounded-2xl text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-indigo-200 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400";

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#F2F2F7] relative overflow-hidden">
            
            {/* Decoración de fondo ambiental */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[100px] animate-pulse"/>
            <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] animate-pulse" style={{animationDelay: '2s'}}/>

            <div className="w-full max-w-sm p-8 m-4 bg-white/60 backdrop-blur-2xl rounded-[3rem] shadow-2xl border border-white/60 relative z-10 animate-in fade-in zoom-in duration-500">
                
                <div className="text-center mb-6">
                    {/* ✅ LOGO ESTÉTICO CON LUZ DE FONDO */}
                    <div className="relative mx-auto mb-6 flex justify-center items-center h-32">
                        {/* 1. Luz/Glow trasero para integrar el logo (sin cuadro gris) */}
                        <div className="absolute w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />
                        
                        {/* 2. El Logo: Altura controlada, ancho auto, sombra suave */}
                        <img 
                            src="/Logo.png" 
                            alt="Logo" 
                            className="relative h-full w-auto object-contain filter drop-shadow-lg transform hover:scale-105 transition-transform duration-500" 
                        />
                    </div>
                    
                    <h1 className="text-3xl font-black text-slate-800 tracking-tight mb-2">Bienvenido</h1>
                    <p className="text-sm font-medium text-slate-400">Ingresa tus credenciales de acceso</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div className={INPUT_WRAPPER}>
                        <Mail size={20} className={ICON_STYLE}/>
                        <input 
                            type="email" 
                            required
                            placeholder="Correo Electrónico"
                            className={INPUT_STYLE}
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                        />
                    </div>

                    <div className={INPUT_WRAPPER}>
                        <Lock size={20} className={ICON_STYLE}/>
                        <input 
                            type="password" 
                            required
                            placeholder="Contraseña"
                            className={INPUT_STYLE}
                            value={loginPass}
                            onChange={(e) => setLoginPass(e.target.value)}
                        />
                    </div>

                    {loginError && (
                        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 animate-in slide-in-from-top-2">
                            <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0"/>
                            <p className="text-xs font-bold text-rose-600">{loginError}</p>
                        </div>
                    )}

                    <div className="h-2"></div>

                    <button 
                        type="submit" 
                        className="w-full py-4 bg-slate-900 text-white rounded-[1.5rem] font-black text-sm shadow-xl shadow-slate-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group"
                    >
                        Iniciar Sesión
                        <ArrowRight size={18} className="text-slate-400 group-hover:text-white group-hover:translate-x-1 transition-all"/>
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest flex items-center justify-center gap-1">
                        <Zap size={10} className="fill-slate-300"/> HM Digital Secure
                    </p>
                </div>

            </div>
        </div>
    );
};

export default LoginScreen;