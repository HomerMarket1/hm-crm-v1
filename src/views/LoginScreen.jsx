import React from 'react';
import { Mail, Lock, ArrowRight, Zap, Search, ShieldCheck } from 'lucide-react';

const LoginScreen = ({ 
    loginEmail, 
    setLoginEmail, 
    loginPass, 
    setLoginPass, 
    handleLogin, 
    loginError,
    onGoToPortal 
}) => {
    
    // Estilos basados en la estética neón del resto del proyecto
    const INPUT_WRAPPER = "relative group";
    const ICON_STYLE = "absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-400 transition-colors pointer-events-none";
    
    const INPUT_STYLE = `
        w-full p-4 pl-12 
        bg-[#0B0F19] border-[#1E293B] 
        rounded-2xl text-sm font-bold text-white outline-none 
        focus:border-cyan-400 focus:shadow-[0_0_20px_rgba(34,211,238,0.2)] 
        transition-all placeholder:text-slate-600
    `;

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-[#070A11] relative overflow-hidden">
            
            {/* 🌌 Fondos Ambientales Neón */}
            <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"/>
            <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-cyan-600/10 rounded-full blur-[120px] animate-pulse" style={{animationDelay: '2s'}}/>

            {/* 📦 Contenedor Glassmorphism Oscuro */}
            <div className="w-full max-w-sm p-10 m-4 bg-[#111827]/40 backdrop-blur-3xl rounded-[3.5rem] border border-white/5 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] relative z-10 animate-in fade-in zoom-in duration-700">
                
                <div className="text-center mb-10">
                    {/* LOGO CON GLOW INTENSO */}
                    <div className="relative mx-auto mb-8 flex justify-center items-center h-28">
                        <div className="absolute w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl animate-pulse" />
                        <img 
                            src="/Logo.webp" 
                            alt="HM Digital" 
                            className="relative h-full w-auto object-contain filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] transform hover:scale-110 transition-transform duration-500" 
                        />
                    </div>
                    
                    <h1 className="text-3xl font-black text-white tracking-tight mb-2">HM Digital</h1>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.2em]">Panel de Control</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div className={INPUT_WRAPPER}>
                        <Mail size={18} className={ICON_STYLE}/>
                        <input 
                            type="email" 
                            required
                            placeholder="Correo Administrativo"
                            className={INPUT_STYLE}
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                        />
                    </div>

                    <div className={INPUT_WRAPPER}>
                        <Lock size={18} className={ICON_STYLE}/>
                        <input 
                            type="password" 
                            required
                            placeholder="Clave de Acceso"
                            className={INPUT_STYLE}
                            value={loginPass}
                            onChange={(e) => setLoginPass(e.target.value)}
                        />
                    </div>

                    {loginError && (
                        <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 animate-in slide-in-from-top-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.8)] shrink-0"/>
                            <p className="text-xs font-bold text-rose-400">{loginError}</p>
                        </div>
                    )}

                    <div className="pt-2">
                        <button 
                            type="submit" 
                            className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-[1.8rem] font-black text-sm shadow-[0_10px_20px_rgba(79,70,229,0.3)] hover:shadow-[0_15px_25px_rgba(79,70,229,0.4)] active:scale-95 transition-all flex items-center justify-center gap-3 group"
                        >
                            ENTRAR AL SISTEMA
                            <ArrowRight size={18} className="text-indigo-300 group-hover:text-white group-hover:translate-x-1 transition-all"/>
                        </button>
                    </div>
                </form>

                {/* ACCESO PORTAL CLIENTES (Diseño en coherencia con la Bóveda) */}
                <div className="mt-10 pt-8 border-t border-white/5 text-center">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">¿Solo vienes a consultar?</p>
                    <button 
                        type="button"
                        onClick={onGoToPortal} 
                        className="w-full py-3.5 rounded-2xl bg-white/5 border border-white/10 text-slate-300 font-bold text-xs hover:bg-white/10 hover:text-white transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                        <Search size={16} className="text-cyan-400"/>
                        Portal de Clientes
                    </button>
                </div>

                <div className="mt-8 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/5">
                        <ShieldCheck size={12} className="text-emerald-500"/>
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            HM Digital Secure V2
                        </span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LoginScreen;