import React, { useState } from 'react';
import { Search, Key, ChevronLeft, Tv, AlertTriangle, Smartphone, User, CheckCircle2 } from 'lucide-react';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore'; // 👈 CAMBIO IMPORTANTE
import { db } from '../firebase/config';

const ClientPortal = ({ onBack }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');

    // 🎨 SISTEMA DE TEMAS INTELIGENTE (Conservado de tu código original)
    const getServiceTheme = (serviceName) => {
        const lower = serviceName ? serviceName.toLowerCase() : '';
        if (lower.includes('netflix')) return {
            color: 'text-rose-500',
            bg: 'from-rose-500/10 to-transparent',
            border: 'border-rose-500/20',
            btn: 'bg-gradient-to-r from-rose-600 to-rose-500 shadow-rose-600/30',
            codeBox: 'bg-rose-500/10 border-rose-500/30 text-rose-500',
            icon: 'text-rose-500'
        };
        if (lower.includes('disney')) return {
            color: 'text-blue-400',
            bg: 'from-blue-500/10 to-transparent',
            border: 'border-blue-500/20',
            btn: 'bg-gradient-to-r from-blue-600 to-cyan-500 shadow-blue-600/30',
            codeBox: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
            icon: 'text-blue-400'
        };
        if (lower.includes('max') || lower.includes('hbo')) return {
            color: 'text-purple-400',
            bg: 'from-purple-500/10 to-transparent',
            border: 'border-purple-500/20',
            btn: 'bg-gradient-to-r from-purple-600 to-indigo-600 shadow-purple-600/30',
            codeBox: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
            icon: 'text-purple-400'
        };
        if (lower.includes('prime') || lower.includes('amazon')) return {
            color: 'text-teal-400',
            bg: 'from-teal-500/10 to-transparent',
            border: 'border-teal-500/20',
            btn: 'bg-gradient-to-r from-teal-600 to-emerald-500 shadow-teal-600/30',
            codeBox: 'bg-teal-500/10 border-teal-500/30 text-teal-400',
            icon: 'text-teal-400'
        };
        // Default
        return {
            color: 'text-indigo-400',
            bg: 'from-indigo-500/10 to-transparent',
            border: 'border-indigo-500/20',
            btn: 'bg-gradient-to-r from-indigo-600 to-blue-600 shadow-indigo-600/30',
            codeBox: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400',
            icon: 'text-indigo-400'
        };
    };

    const handleSearch = async (e) => {
        e.preventDefault();
        
        let rawInput = searchTerm.trim().replace(/\D/g, ''); 
        if (rawInput.length < 6) return setError('Ingresa un número válido.');
        
        // Normalización de número (Ajustar según país si es necesario)
        let targetId = rawInput;
        if (rawInput.startsWith('09') && rawInput.length === 9) targetId = '598' + rawInput.substring(1);
        else if (rawInput.startsWith('9') && rawInput.length === 8) targetId = '598' + rawInput;

        setLoading(true);
        setError('');
        setResults(null);

        try {
            // 🔍 BÚSQUEDA GLOBAL (Collection Group)
            // Busca en todas las subcolecciones 'client_portal' de TODOS los usuarios
            const q = query(
                collectionGroup(db, 'client_portal'), 
                where('phone', '==', targetId)
            );

            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                setError('No encontramos servicios activos para este número.');
            } else {
                // Unificar resultados de múltiples vendedores si existieran
                let allServices = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.services && Array.isArray(data.services)) {
                        allServices = [...allServices, ...data.services];
                    }
                });

                // Filtrar activos (últimos 10 días vencidos máximo)
                const active = allServices.filter(s => {
                    const days = Math.ceil((new Date(s.endDate) - new Date()) / (86400000));
                    return days >= -10; 
                });

                // Ordenar por fecha de vencimiento
                active.sort((a, b) => new Date(a.endDate) - new Date(b.endDate));

                if (active.length > 0) setResults(active);
                else setError('Tu número está registrado, pero tus servicios han expirado hace mucho.');
            }

        } catch (err) {
            console.error("Error Portal:", err);
            // Mensaje amigable si falta el índice
            if (err.message.includes('requires an index')) {
                setError('Sistema actualizándose. Intenta en 5 minutos.');
            } else {
                setError('Error de conexión. Verifica tu internet.');
            }
        }
        setLoading(false);
    };

    const isUrl = (string) => string && (string.startsWith('http://') || string.startsWith('https://'));

    return (
        <div className="min-h-screen bg-[#0B0F19] text-white flex flex-col items-center p-4">
            
            {/* HEADER */}
            <div className="w-full max-w-md flex justify-between items-center py-6">
                <button onClick={onBack} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                    <ChevronLeft size={24}/>
                </button>
                <h1 className="text-xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400">
                    SOPORTE <span className="text-white/20 font-medium">CLIENTES</span>
                </h1>
                <div className="w-10"></div>
            </div>

            {/* BUSCADOR */}
            <div className="w-full max-w-md space-y-6">
                {!results && (
                    <div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4">
                        <div className="w-20 h-20 bg-indigo-500/10 rounded-full mx-auto flex items-center justify-center mb-6 shadow-[0_0_40px_-10px_rgba(99,102,241,0.3)]">
                            <Smartphone size={40} className="text-indigo-400"/>
                        </div>
                        <h2 className="text-3xl font-black tracking-tight">Mis Servicios</h2>
                        <p className="text-slate-400 text-sm max-w-xs mx-auto">
                            Ingresa tu <b className="text-white">Número de Celular</b> registrado para ver tus accesos.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSearch} className="relative group z-20">
                    <input 
                        type="tel"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        placeholder="Ej: 099 123 456"
                        className="w-full h-16 pl-14 pr-4 rounded-2xl bg-white/5 border border-white/10 focus:border-indigo-500/50 focus:bg-indigo-500/5 outline-none font-bold text-lg transition-all placeholder:font-medium placeholder:text-slate-600 shadow-xl tracking-wider"
                        autoFocus
                    />
                    <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={24}/>
                    <button type="submit" className="absolute right-3 top-3 bottom-3 aspect-square bg-indigo-600 rounded-xl flex items-center justify-center hover:bg-indigo-500 transition-colors shadow-lg shadow-indigo-600/20 active:scale-95">
                        {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Search size={20}/>}
                    </button>
                </form>

                {error && <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-200 text-center text-sm font-bold flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2"><AlertTriangle size={16}/> {error}</div>}

                {/* RESULTADOS */}
                <div className="space-y-4 pb-20">
                    {results && results.map((item, idx) => {
                         const days = Math.ceil((new Date(item.endDate) - new Date()) / (86400000));
                         const isExpired = days < 0;
                         const theme = getServiceTheme(item.service);

                         return (
                            <div key={idx} className={`p-1 rounded-[1.5rem] bg-gradient-to-b ${theme.bg} animate-in slide-in-from-bottom-4`} style={{animationDelay: `${idx * 100}ms`}}>
                                <div className="p-5 rounded-[1.4rem] bg-[#0F131F] relative overflow-hidden">
                                    <div className={`absolute top-0 right-0 p-8 opacity-5 ${theme.color}`}><Tv size={100}/></div>
                                    
                                    {/* HEADER TARJETA */}
                                    <div className="relative z-10 flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="font-black text-xl text-white leading-none tracking-tight">{item.service}</h3>
                                            <p className={`text-[10px] font-bold mt-1.5 uppercase tracking-widest inline-block px-2 py-0.5 rounded border border-white/10 ${theme.color} bg-white/5`}>{item.type || 'Suscripción'}</p>
                                        </div>
                                        <div className="text-right">
                                            <div className={`text-3xl font-black ${isExpired ? 'text-rose-500' : 'text-emerald-400'}`}>{isExpired ? '0' : days}</div>
                                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Días Restantes</div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4 relative z-10">
                                        {!isExpired ? (
                                            <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-3">
                                                
                                                {/* 1. CORREO ÚNICAMENTE */}
                                                <div>
                                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1">
                                                        <User size={10}/> Usuario / Correo
                                                    </div>
                                                    <div className="font-mono font-bold text-base text-slate-200 select-all">{item.email}</div>
                                                </div>

                                                {(item.profile || item.pin) && <div className="h-px bg-white/5 w-full"></div>}

                                                {/* 2. PERFIL Y PIN */}
                                                <div className="flex gap-4">
                                                    {item.profile && (
                                                        <div className="flex-1">
                                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">Perfil</div>
                                                            <div className="font-bold text-base text-white">{item.profile}</div>
                                                        </div>
                                                    )}
                                                    
                                                    {item.pin && (
                                                        <div className={item.profile ? "text-right" : "flex-1"}>
                                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">PIN Secreto</div>
                                                            <div className="font-mono font-bold text-amber-400 tracking-[0.3em]">{item.pin}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center"><p className="text-xs font-bold text-rose-300">Servicio Vencido</p></div>
                                        )}

                                        {/* ZONA INTELIGENTE: ENLACE O CÓDIGO */}
                                        {!isExpired && item.lastCode && (
                                            <div className="animate-in zoom-in-95 duration-300">
                                                {isUrl(item.lastCode) ? (
                                                    // 🔴 CASO 1: ES UN LINK
                                                    <>
                                                        <a 
                                                            href={item.lastCode} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer"
                                                            className={`block w-full py-4 px-4 rounded-xl text-white text-center font-black uppercase tracking-wide hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg ${theme.btn}`}
                                                        >
                                                            <CheckCircle2 size={20}/>
                                                            APROBAR / ACTUALIZAR
                                                        </a>
                                                        <p className="text-[10px] text-center text-slate-500 mt-2 opacity-60">
                                                            * Toca para autorizar el acceso.
                                                        </p>
                                                    </>
                                                ) : (
                                                    // 🔢 CASO 2: ES UN CÓDIGO (4 o 6 dígitos)
                                                    <div className={`p-4 rounded-xl border text-center relative overflow-hidden ${theme.codeBox}`}>
                                                        {/* Brillo de fondo */}
                                                        <div className={`absolute top-[-50%] left-[-50%] w-[200%] h-[200%] blur-3xl animate-pulse opacity-20 ${item.service.toLowerCase().includes('disney') ? 'bg-blue-500' : 'bg-amber-500'}`}></div>
                                                        
                                                        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 flex justify-center items-center gap-2 relative z-10 ${theme.icon}`}>
                                                            <Key size={12}/> Tu Código de Acceso
                                                        </p>
                                                        <p className="text-4xl font-black text-white font-mono tracking-[0.15em] drop-shadow-lg select-all relative z-10">
                                                            {item.lastCode}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default ClientPortal;