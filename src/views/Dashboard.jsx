import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'; 
import { Search, Lock, Edit2, Ban, XCircle, RotateCcw, X, Calendar, ChevronRight, CalendarPlus, Filter, Bell, Send, CheckCircle2, Copy, Smartphone, AlertTriangle, Activity, ShieldAlert, Box } from 'lucide-react';
import AppleCalendar from '../components/AppleCalendar';

// --- CONSTANTES & HELPERS ---

// 1. Palabras que activan la ALERTA DE GARANTÍA
const PROBLEM_KEYWORDS = ['caída', 'caida', 'actualizar', 'dominio', 'reposicion', 'falla', 'garantía', 'garantia', 'revisar', 'problema', 'error', 'verificar'];

// 2. Nombres DE SISTEMA (Se irán al final de la lista de Activos)
const NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Vencido', 'Cancelado', 'Problemas', 'Garantía', 'Admin', 'Stock', 'Reposicion'];

const cleanServiceName = (name) => name ? name.replace(/\s(Paquete|Perfil|Perfiles|Cuenta|Renovación|Pantalla|Dispositivo).*$/gi, '').trim() : '';

const getWhatsAppUrl = (phone, message) => {
    if (!phone) return '#';
    const cleanPhone = phone.replace(/\D/g, '');
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    return `https://${isMobile ? 'api' : 'web'}.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
};

const safeGetDays = (dateString) => {
    if (!dateString || !dateString.includes('-')) return 0;
    const today = new Date(); today.setHours(0,0,0,0);
    const [y, m, d] = dateString.split('-').map(Number);
    return Math.ceil((new Date(y, m - 1, d) - today) / (1000 * 60 * 60 * 24));
};

// --- HELPER DE ESTILOS (Alto Contraste) ---
const getCardStyles = (sale, days, darkMode) => {
    const clientName = sale.client ? sale.client.toLowerCase() : '';
    const isFree = clientName === 'libre' || clientName === 'espacio libre' || clientName === 'disponible';
    
    // Detectamos problema buscando en todo el texto de la venta
    const textToCheck = (sale.client + " " + sale.service + " " + (sale.type || "")).toLowerCase();
    const isProblem = PROBLEM_KEYWORDS.some(k => textToCheck.includes(k)) || NON_BILLABLE_STATUSES.includes(sale.client);
    
    const isAdmin = sale.client === 'Admin';

    // 1. Estilos Base
    let bg = darkMode ? 'bg-[#161B28] border-white/5' : 'bg-white/60 border-white/40';
    let text = darkMode ? 'text-white' : 'text-slate-800';
    let subText = darkMode ? 'text-slate-400' : 'text-slate-500';

    // 2. Estados Especiales
    if (isFree) {
        bg = darkMode ? "bg-emerald-900/10 border-emerald-500/20" : "bg-emerald-50/50 border-emerald-100";
        text = darkMode ? "text-emerald-400" : "text-emerald-900";
        subText = darkMode ? "text-emerald-400/70" : "text-emerald-700/70";
    } else if (isProblem) {
        // Estilo Ámbar/Rojo para problemas
        bg = darkMode ? "bg-amber-900/10 border-amber-500/20" : "bg-amber-50/50 border-amber-100";
        text = darkMode ? "text-amber-300" : "text-amber-900"; 
        subText = darkMode ? "text-amber-200/60" : "text-amber-800/60";
    } else if (isAdmin) {
        bg = darkMode ? "bg-slate-800 border-white/10" : "bg-slate-900 text-white";
        text = "text-white";
        subText = "text-slate-300";
    }

    // 3. Color del Icono
    let statusColor = darkMode ? 'bg-indigo-500/10 text-indigo-400' : 'bg-indigo-50 text-indigo-600';
    if (isFree) statusColor = darkMode ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-600';
    else if (isProblem) statusColor = darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-500';
    else if (days < 0) statusColor = darkMode ? 'bg-rose-500/10 text-rose-400' : 'bg-rose-100 text-rose-600';
    else if (days <= 3) statusColor = darkMode ? 'bg-amber-500/10 text-amber-400' : 'bg-amber-100 text-amber-600';

    return { bg, text, subText, statusColor, isFree, isProblem, isAdmin };
};

// --- COMPONENTE TARJETA ---
const SaleCard = React.memo(({ sale, darkMode, handlers }) => {
    const days = safeGetDays(sale.endDate);
    const { bg, text, subText, statusColor, isFree, isProblem, isAdmin } = getCardStyles(sale, days, darkMode);
    const cost = Math.round(sale.cost || 0);

    const iconLetter = useMemo(() => {
        const lower = sale.service ? sale.service.toLowerCase() : '';
        return lower.includes('netflix') ? 'N' : lower.includes('disney') ? 'D' : 'S';
    }, [sale.service]);

    const formattedDate = sale.endDate ? sale.endDate.split('-').reverse().slice(0,2).join('/') : '--';

    return (
        <div className={`p-3 md:p-4 rounded-[20px] transition-all duration-300 w-full relative group border shadow-sm hover:shadow-md ${bg}`}>
            <div className="flex flex-col gap-2 md:grid md:grid-cols-12 md:gap-4 items-center">
                
                {/* COL 1: Info */}
                <div className="col-span-12 md:col-span-4 w-full flex items-start gap-3">
                    <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center text-lg font-black shrink-0 ${statusColor}`}>
                        {iconLetter}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <div className={`font-bold text-sm md:text-base leading-tight truncate ${text}`}>{isFree ? 'Espacio Libre' : sale.client}</div>
                                <div className={`text-[11px] md:text-xs font-medium truncate mt-0.5 ${subText}`}>{sale.service}</div>
                            </div>
                            
                            {/* Vista Móvil */}
                            {!isFree && !isProblem && (
                                <div className="text-right md:hidden leading-tight flex flex-col items-end">
                                    {cost > 0 && <span className={`text-xs font-black ${isAdmin ? 'text-white/80' : (darkMode ? 'text-white' : 'text-slate-800')}`}>${cost}</span>}
                                    <div className={`text-[9px] font-bold ${days < 0 ? 'text-rose-500' : days <= 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                                        {days}d
                                    </div>
                                    <div className={`text-[9px] font-bold opacity-60 uppercase ${subText}`}>
                                        {formattedDate}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Info extra para libres */}
                        {isFree && (sale.profile || sale.pin) && (
                            <div className="md:hidden mt-1 flex items-center gap-2">
                                {sale.profile && <span className="text-[9px] bg-emerald-500/20 text-emerald-500 px-1.5 py-0.5 rounded font-bold">{sale.profile}</span>}
                                {sale.pin && <span className="text-[9px] opacity-60 font-mono">PIN: {sale.pin}</span>}
                            </div>
                        )}
                        {/* Alerta Visual de Problema Móvil */}
                        {isProblem && (
                            <div className="md:hidden mt-1 flex items-center gap-1 text-amber-500 font-bold text-[10px] animate-pulse">
                                <AlertTriangle size={10} /> <span>Modo Garantía</span>
                            </div>
                        )}
                        
                        {!isFree && !isProblem && <div className={`md:hidden mt-1 flex items-center gap-1 ${subText}`}><Smartphone size={10}/> <span className="text-[10px]">{sale.phone}</span></div>}
                    </div>
                </div>

                {/* COL 2: Credenciales */}
                <div className="col-span-12 md:col-span-3 w-full pl-0 md:pl-2">
                    <div className={`rounded-xl px-3 py-2 border md:border-none ${darkMode ? 'bg-black/40 border-white/10' : 'bg-white/50 border-white/20 md:bg-transparent'}`}>
                        <div className={`flex items-center justify-between gap-2 mb-1 ${subText}`}>
                            <span className="text-[10px] truncate select-all opacity-90">{sale.email}</span>
                            <button onClick={(e) => handlers.copy(e, sale.email, sale.pass)} className={`hover:text-indigo-500 active:scale-90 transition-transform ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}><Copy size={10}/></button>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-[11px] font-mono font-bold select-all ${darkMode ? 'text-slate-200' : 'text-slate-700'}`}>{sale.pass}</span>
                            {(sale.profile || sale.pin || !isFree) && (
                                <div className="flex gap-1 ml-auto">
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border border-white/10 ${isAdmin ? 'bg-white/10' : (darkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white text-indigo-600')}`}>{sale.profile || 'Gral'}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border border-white/10 ${darkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-500'}`}>{sale.pin || '•••'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* COL 3: Estado Desktop */}
                <div className="hidden md:flex col-span-3 w-full flex-col items-center">
                    {!isFree && !isProblem ? (
                        <div className="text-center leading-none">
                            <div className={`text-2xl font-black tracking-tighter ${days < 0 ? 'text-rose-500' : days <= 3 ? 'text-amber-500' : (darkMode ? 'text-white' : 'text-slate-800')}`}>{days}<span className="text-[10px] opacity-40 align-top ml-0.5 font-bold">DÍAS</span></div>
                            <div className="text-[10px] font-bold opacity-40 uppercase mt-1 text-slate-400">{formattedDate}</div>
                        </div>
                    ) : (isFree ? <span className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-lg uppercase">DISPONIBLE</span> : 
                        <span className={`flex items-center gap-2 text-xs font-black px-3 py-1 rounded-full ${darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600'}`}>
                            <ShieldAlert size={14}/> GARANTÍA
                        </span>
                    )}
                </div>

                {/* COL 4: Acciones */}
                <div className="col-span-12 md:col-span-2 w-full flex justify-end gap-1 pt-2 md:pt-0 border-t md:border-none border-dashed border-white/10">
                    {isFree ? (
                        <div className="flex w-full md:w-auto gap-2 justify-end">
                            <button onClick={() => handlers.edit(sale)} className={`w-9 h-9 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 border ${darkMode ? 'bg-white/5 border-white/10 text-emerald-400 hover:bg-emerald-500/20' : 'bg-white border-slate-200 text-emerald-600 shadow-sm'}`}>
                                <Edit2 size={14}/>
                            </button>
                            <button onClick={() => handlers.assign(sale)} className="flex-1 md:flex-none md:w-auto px-4 py-1.5 rounded-full font-bold text-xs bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 active:scale-95 transition-all flex items-center justify-center gap-1">
                                Asignar <ChevronRight size={14}/>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 w-full justify-end">
                            {!isProblem && days <= 3 && <button onClick={() => handlers.whatsapp(sale, 'reminder')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${days <= 0 ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'}`}><XCircle size={14}/></button>}
                            
                            {!isProblem && <button onClick={() => handlers.whatsapp(sale, 'data')} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 ${darkMode ? 'bg-white/5 text-slate-300 hover:bg-indigo-500/20 hover:text-indigo-400' : 'bg-slate-100 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}><Lock size={14}/></button>}
                            
                            <button onClick={() => handlers.edit(sale)} className={`w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-110 ${darkMode ? 'bg-white/5 text-slate-300 hover:text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}><Edit2 size={14}/></button>
                            <div className="w-px h-4 bg-white/10 mx-1"></div>
                            {!isProblem && <button onClick={() => handlers.renew(sale.id, sale.endDate)} className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm hover:scale-110 transition-all ${darkMode ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}><CalendarPlus size={14}/></button>}
                            <button onClick={() => handlers.liberate(sale.id)} className={`w-8 h-8 rounded-full flex items-center justify-center hover:bg-rose-500/10 hover:text-rose-500 transition-all ${darkMode ? 'text-slate-400' : 'text-slate-400'}`}><RotateCcw size={14}/></button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

// --- DASHBOARD PRINCIPAL ---
const Dashboard = ({
    sales = [], filteredSales = [], catalog = [],
    totalItems = 0, totalFilteredMoney = 0, loadingData = false,
    filterClient, setFilter, filterService, filterStatus, dateFrom, dateTo,
    handleQuickRenew, triggerLiberate, setFormData, setView, setBulkProfiles,
    expiringToday = [], expiringTomorrow = [], overdueSales = [],
    darkMode
}) => {

    const [bulkModal, setBulkModal] = useState({ show: false, title: '', list: [] });
    const [sentIds, setSentIds] = useState([]); 
    const [displayLimit, setDisplayLimit] = useState(50);
    // TABS: 'healthy' (Activos), 'free' (Disponibles), 'warranty' (Garantía)
    const [activeTab, setActiveTab] = useState('healthy'); 
    const observer = useRef();

    useEffect(() => { setDisplayLimit(50); }, [filterClient, filterService, filterStatus, dateFrom, dateTo, activeTab]);

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        try {
            const saved = JSON.parse(localStorage.getItem('crm_sent_ids') || '{}');
            if (saved.date === today) setSentIds(saved.ids || []);
            else localStorage.removeItem('crm_sent_ids');
        } catch (e) {}
    }, []);

    const saveSentIds = (newIds) => {
        setSentIds(prev => {
            const updated = [...new Set([...prev, ...newIds])];
            localStorage.setItem('crm_sent_ids', JSON.stringify({ date: new Date().toISOString().split('T')[0], ids: updated }));
            return updated;
        });
    };

    // --- LOGICA WHATSAPP UNIFICADA ---
    const handleUnifiedWhatsApp = useCallback((sale, actionType) => {
        const { client, phone, endDate } = sale;
        const targetDays = safeGetDays(endDate);
        let message = '';

        if (actionType === 'reminder') {
            const related = sales.filter(s => {
                if (s.client !== client) return false;
                if (NON_BILLABLE_STATUSES.includes(s.client)) return false;
                if (s.client === 'LIBRE') return false;

                const currentDays = safeGetDays(s.endDate);
                if (targetDays < 0) return currentDays < 0; 
                return currentDays === targetDays;
            });

            const summary = Object.entries(related.reduce((acc, curr) => {
                const name = cleanServiceName(curr.service);
                const isFull = curr.type === 'Cuenta' || curr.service?.toLowerCase().includes('completa');
                const key = `${name}-${isFull ? 'C' : 'P'}`;
                if(!acc[key]) acc[key] = { name, isFull, count: 0 };
                acc[key].count++;
                return acc;
            }, {})).map(([_, g]) => `${g.count} ${g.isFull ? (g.count>1?'Ctas Completas':'Cuenta Completa') : (g.count>1?'Perfiles':'Perfil')} ${g.name}`).join(' + ');

            if (targetDays < 0) message = `🔴 Hola ${client}, recordatorio de pago pendiente por: ${summary}.`;
            else if (targetDays === 0) message = `❌ Hola ${client}, el vencimiento de ${summary} es HOY. Por favor realiza tu pago para mantener el servicio activo.`;
            else if (targetDays === 1) message = `⚠️ Buen día ${client}, mañana vence: ${summary}. ¿Deseas renovar?`;
            else message = `Hola ${client}, recordatorio: ${summary} vence en ${targetDays} días.`;

        } else if (actionType === 'data') {
            const cleanName = cleanServiceName(sale.service);
            const isFull = sale.type === 'Cuenta';
            
            const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            let dateText = "Indefinido";
            if (endDate) {
                const [y, m, d] = endDate.split('-').map(Number);
                dateText = `${d} de ${months[m-1]}`;
            }

            message = `${cleanName.toUpperCase()} ${isFull ? 'CUENTA COMPLETA' : '1 PERFIL'}\n\n` +
                      `CORREO:\n${sale.email}\n` +
                      `CONTRASEÑA:\n${sale.pass}\n` +
                      `${!isFull ? `PERFIL:\n${sale.profile}\nPIN:\n${sale.pin || 'Sin PIN'}\n` : ''}` +
                      `\n☑️Su Perfil Vence el día ${dateText}☑️`;
        }
        
        window.open(getWhatsAppUrl(phone, message), '_blank');
    }, [sales]);

    // --- HANDLERS ---
    const handlers = useMemo(() => ({
        whatsapp: handleUnifiedWhatsApp,
        copy: (e, email, pass) => {
            e.preventDefault(); navigator.clipboard.writeText(`${email}:${pass}`);
            const btn = e.currentTarget; 
            const original = btn.innerHTML;
            btn.innerHTML = `<span class="text-emerald-500 text-[10px] font-bold">OK</span>`;
            setTimeout(() => btn.innerHTML = original, 1500);
        },
        assign: (sale) => { setFormData(sale); setView('form'); },
        edit: (sale) => { setFormData({...sale, profilesToBuy: 1}); setBulkProfiles([{ profile: sale.profile, pin: sale.pin }]); setView('form'); },
        renew: handleQuickRenew,
        liberate: triggerLiberate
    }), [handleUnifiedWhatsApp, handleQuickRenew, triggerLiberate, setFormData, setView, setBulkProfiles]);

    // --- LÓGICA DE CLASIFICACIÓN (3 LISTAS) ---
    const { healthySales, freeSales, warrantySales } = useMemo(() => {
        const groups = {};
        const healthy = [];
        const free = [];
        const warranty = [];

        // 1. Agrupamos todo por CORREO (Email)
        (filteredSales || []).forEach(sale => {
            const key = sale.email ? sale.email.trim().toLowerCase() : `no-email-${sale.id}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(sale);
        });

        // 2. Analizamos cada grupo
        Object.values(groups).forEach(group => {
            // A. Detectamos si hay problemas en el grupo (Ignoramos Admin)
            const realItems = group.filter(s => s.client !== 'Admin');
            
            const hasProblem = realItems.some(sale => {
                const textToCheck = (sale.client + " " + sale.service + " " + (sale.type || "")).toLowerCase();
                return PROBLEM_KEYWORDS.some(k => textToCheck.includes(k)) || NON_BILLABLE_STATUSES.includes(sale.client);
            });

            // B. Reglas de Contagio (> 1 item y NO Full)
            const isLargeGroup = realItems.length > 1; 
            const isFullAccount = realItems.some(s => 
                (s.type || '').toLowerCase().includes('completa') || 
                (s.service || '').toLowerCase().includes('completa')
            );

            // C. DECISIÓN:
            if (hasProblem && isLargeGroup && !isFullAccount) {
                // -> A GARANTÍA (Todo el grupo se contagia)
                warranty.push(...group);
            } else {
                // -> A ACTIVOS O DISPONIBLES
                group.forEach(sale => {
                    const clientName = sale.client ? sale.client.toLowerCase() : '';
                    const isFree = clientName === 'libre' || clientName === 'espacio libre' || clientName === 'disponible';
                    
                    if (isFree) {
                        free.push(sale);
                    } else {
                        // AQUÍ ENTRAN TODOS LOS OCUPADOS (Sanos y Enfermos Solitarios)
                        healthy.push(sale);
                    }
                });
            }
        });

        return { healthySales: healthy, freeSales: free, warrantySales: warranty };
    }, [filteredSales]);

    // Elegimos qué lista mostrar
    let currentList = [];
    if (activeTab === 'healthy') currentList = healthySales;
    else if (activeTab === 'free') currentList = freeSales;
    else currentList = warrantySales;

    // --- SCROLL INFINITO & ORDENAMIENTO (CON ORDEN PERSONALIZADO) ---
    const visibleSales = useMemo(() => {
        const sorted = [...currentList];

        if (activeTab === 'warranty') {
            // GARANTÍA: Agrupado por Cuenta (Email)
            sorted.sort((a, b) => (a.email || '').localeCompare(b.email || ''));
        } else {
            // ACTIVOS Y DISPONIBLES:
            // Regla: Nombres "basura" (Admin, Actualizar, Caída...) AL FINAL.
            sorted.sort((a, b) => {
                const clientA = (a.client || '').toLowerCase();
                const clientB = (b.client || '').toLowerCase();

                // Verificamos si son nombres de sistema (usamos la lista de NON_BILLABLE)
                // Usamos .some() para búsqueda insensible a mayúsculas exacta
                const isBadA = NON_BILLABLE_STATUSES.some(s => s.toLowerCase() === clientA);
                const isBadB = NON_BILLABLE_STATUSES.some(s => s.toLowerCase() === clientB);

                if (isBadA && !isBadB) return 1; // A es malo, B es bueno -> A al fondo
                if (!isBadA && isBadB) return -1; // A es bueno, B es malo -> A arriba

                // Si ambos son iguales (ambos buenos o ambos malos), orden alfabético
                return clientA.localeCompare(clientB);
            });
        }

        return sorted.slice(0, displayLimit);
    }, [currentList, displayLimit, activeTab]);

    const lastElementRef = useCallback(node => {
        if (loadingData) return;
        if (observer.current) observer.current.disconnect();
        observer.current = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting && displayLimit < currentList.length) {
                setDisplayLimit(prev => prev + 50);
            }
        });
        if (node) observer.current.observe(node);
    }, [loadingData, displayLimit, currentList.length]);

    // --- THEME ---
    const theme = useMemo(() => ({
        inputBg: darkMode ? 'bg-black/20 text-white placeholder-slate-600 border-white/5' : 'bg-transparent text-slate-800 placeholder-slate-400',
        activeBtn: darkMode ? 'bg-[#161B28] text-white shadow-sm border border-white/5' : 'bg-white text-indigo-600 shadow-sm',
        inactiveBtn: darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'
    }), [darkMode]);

    if (loadingData) return <div className="flex flex-col items-center justify-center h-[60vh] text-slate-400"><div className="w-12 h-12 rounded-full border-4 border-current border-t-transparent animate-spin mb-4"/>Sincronizando...</div>;

    const getPlaceholder = () => {
        if (activeTab === 'healthy') return "Buscar Cliente Activo...";
        if (activeTab === 'free') return "Buscar Espacio Libre...";
        return "Buscar Cuenta en Garantía...";
    };

    return (
        <div className="w-full pb-32 space-y-4 animate-in fade-in">
            {/* ALERTAS SUPERIORES */}
            {(expiringToday.length > 0 || expiringTomorrow.length > 0 || overdueSales.length > 0) && ( 
                <div className="flex gap-2 px-1 animate-in slide-in-from-top-4">
                    {overdueSales.length > 0 && (<button onClick={() => setBulkModal({ show: true, title: 'Vencidas', list: overdueSales })} className="flex-1 p-2 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-600/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-between"><div className="flex gap-2 items-center"><Ban size={16} className="opacity-80"/><div className="text-left leading-none"><span className="text-[9px] font-bold uppercase opacity-80">Vencidas</span><p className="text-sm font-black">{overdueSales.length}</p></div></div><ChevronRight size={14}/></button>)}
                    {expiringToday.length > 0 && (<button onClick={() => setBulkModal({ show: true, title: 'Vencen Hoy', list: expiringToday })} className="flex-1 p-2 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-between"><div className="flex gap-2 items-center"><Bell size={16} className="opacity-80"/><div className="text-left leading-none"><span className="text-[9px] font-bold uppercase opacity-80">Hoy</span><p className="text-sm font-black">{expiringToday.length}</p></div></div><ChevronRight size={14}/></button>)}
                    {expiringTomorrow.length > 0 && (<button onClick={() => setBulkModal({ show: true, title: 'Vencen Mañana', list: expiringTomorrow })} className="flex-1 p-2 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-between"><div className="flex gap-2 items-center"><Calendar size={16} className="opacity-80"/><div className="text-left leading-none"><span className="text-[9px] font-bold uppercase opacity-80">Mañana</span><p className="text-sm font-black">{expiringTomorrow.length}</p></div></div><ChevronRight size={14}/></button>)}
                </div>
            )}

            {/* SECCIÓN DE TABS: ACTIVOS | DISPONIBLES | GARANTÍA */}
            <div className="px-1 grid grid-cols-3 gap-2">
                <button 
                    onClick={() => setActiveTab('healthy')} 
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all relative overflow-hidden ${activeTab === 'healthy' 
                        ? (darkMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30') 
                        : (darkMode ? 'bg-white/5 text-slate-400 hover:bg-white/10' : 'bg-white text-slate-500 hover:bg-slate-50')}`}
                >
                    <Activity size={18} className={`mb-1 ${activeTab === 'healthy' ? 'animate-pulse' : ''}`} />
                    <span className="text-[9px] font-bold uppercase opacity-80">Activos</span>
                    <span className="text-xs font-black">{healthySales.length}</span>
                </button>

                <button 
                    onClick={() => setActiveTab('free')} 
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all relative overflow-hidden ${activeTab === 'free' 
                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                        : (darkMode ? 'bg-white/5 text-slate-400 hover:bg-emerald-500/10 hover:text-emerald-400' : 'bg-white text-slate-500 hover:bg-emerald-50 hover:text-emerald-600')}`}
                >
                    <Box size={18} className={`mb-1 ${activeTab === 'free' ? 'animate-bounce' : ''}`} />
                    <span className="text-[9px] font-bold uppercase opacity-80">Disponibles</span>
                    <span className="text-xs font-black">{freeSales.length}</span>
                </button>

                <button 
                    onClick={() => setActiveTab('warranty')} 
                    className={`flex flex-col items-center justify-center p-2 rounded-2xl transition-all relative overflow-hidden ${activeTab === 'warranty' 
                        ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' 
                        : (darkMode ? 'bg-white/5 text-slate-400 hover:bg-amber-500/10 hover:text-amber-400' : 'bg-white text-slate-500 hover:bg-amber-50 hover:text-amber-600')}`}
                >
                    <ShieldAlert size={18} className={`mb-1 ${activeTab === 'warranty' ? 'animate-pulse' : ''}`} />
                    <span className="text-[9px] font-bold uppercase opacity-80">Garantía</span>
                    <span className="text-xs font-black">{warrantySales.length}</span>
                    {activeTab !== 'warranty' && warrantySales.length > 0 && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-ping"></span>
                    )}
                </button>
            </div>

            {/* FILTROS (STICKY) */}
            <div className={`sticky top-0 z-40 px-1 -mx-1 py-2 backdrop-blur-xl transition-colors ${darkMode ? 'bg-[#0B0F19]/80' : 'bg-[#F2F2F7]/80'}`}>
                <div className={`p-2 rounded-[24px] shadow-xl border flex flex-col gap-2 ${darkMode ? 'bg-[#161B28]/90 border-white/5 shadow-black/20' : 'bg-white/80 border-white/50 shadow-indigo-500/5'}`}>
                    <div className="relative group w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input type="text" placeholder={getPlaceholder()} className={`w-full pl-10 pr-4 py-2.5 rounded-xl font-bold text-sm outline-none transition-all ${theme.inputBg}`} value={filterClient} onChange={e => setFilter('filterClient', e.target.value)} />
                    </div>
                    
                    <div className="flex flex-col md:flex-row gap-2">
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center px-1">
                            <div className="relative flex-shrink-0">
                                <select className={`appearance-none font-bold text-xs py-2 pl-3 pr-8 rounded-xl border border-transparent outline-none cursor-pointer ${theme.activeBtn}`} value={filterService} onChange={e => setFilter('filterService', e.target.value)}>
                                    <option value="Todos">Servicios</option>{catalog.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                                <Filter size={10} className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50 pointer-events-none"/>
                            </div>
                            <div className={`flex p-1 rounded-xl flex-shrink-0 ${darkMode ? 'bg-black/20' : 'bg-slate-200/50'}`}>
                                {['Todos', 'Libres', 'Ocupados', 'Vencidos'].map((st) => (
                                    <button key={st} onClick={() => setFilter('filterStatus', st)} className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === st ? theme.activeBtn : theme.inactiveBtn}`}>{st}</button>
                                ))}
                            </div>
                        </div>
                        <div className={`flex items-center gap-1 px-1 py-1 rounded-xl border w-full md:w-auto ${darkMode ? 'bg-white/5 border-white/5' : 'bg-white/50 border-white/50'}`}>
                            <div className="w-24 md:w-28"><AppleCalendar value={dateFrom} onChange={(val) => setFilter('dateFrom', val)} label="Desde" darkMode={darkMode} ghost={true} /></div>
                            <span className="opacity-30">-</span>
                            <div className="w-24 md:w-28"><AppleCalendar value={dateTo} onChange={(val) => setFilter('dateTo', val)} label="Hasta" darkMode={darkMode} ghost={true} /></div>
                            {(dateFrom || dateTo) && <button onClick={() => { setFilter('dateFrom', ''); setFilter('dateTo', ''); }} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-md"><X size={14}/></button>}
                        </div>
                    </div>
                </div>
            </div>

            {/* HEADER DINERO (Solo visible en Activos para no confundir) */}
            {activeTab === 'healthy' && (
                <div className="flex items-end justify-between px-2 md:px-4 animate-in fade-in">
                    <div>
                        <h1 className={`text-4xl md:text-5xl font-black tracking-tighter ${darkMode ? 'text-white' : 'text-slate-900'}`}>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-500 to-slate-400">${totalFilteredMoney.toLocaleString()}</span>
                        </h1>
                        <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest pl-1">Facturación Mensual</p>
                    </div>
                    <div className="text-right">
                        <div className={`text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>{totalItems}</div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Activos</div>
                    </div>
                </div>
            )}

            {/* MENSAJES DE ESTADO VACÍO */}
            {activeTab === 'warranty' && warrantySales.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center opacity-50 animate-in zoom-in">
                    <CheckCircle2 size={48} className="text-emerald-500 mb-2"/>
                    <p className={`font-black text-xl ${darkMode ? 'text-white' : 'text-slate-800'}`}>¡Todo Excelente!</p>
                    <p className="text-sm font-medium text-slate-400">No hay cuentas en Garantía por ahora.</p>
                </div>
            )}
            {activeTab === 'free' && freeSales.length === 0 && (
                <div className="py-10 text-center flex flex-col items-center opacity-50 animate-in zoom-in">
                    <Box size={48} className="text-slate-500 mb-2"/>
                    <p className={`font-black text-xl ${darkMode ? 'text-white' : 'text-slate-800'}`}>Sin Stock</p>
                    <p className="text-sm font-medium text-slate-400">No hay espacios libres disponibles.</p>
                </div>
            )}

            {/* LISTA VIRTUALIZADA */}
            <div className="space-y-3">
                {visibleSales.length > 0 ? visibleSales.map((sale, i) => (
                    <div key={sale.id} ref={i === visibleSales.length - 1 ? lastElementRef : null}>
                        <SaleCard sale={sale} darkMode={darkMode} handlers={handlers} />
                    </div>
                )) : (
                    activeTab === 'healthy' && <div className="py-20 text-center opacity-40"><p className="font-bold">Sin resultados</p></div>
                )}
                {displayLimit < currentList.length && <div className="py-4 text-center text-xs opacity-50 animate-pulse">Cargando más...</div>}
            </div>

            {/* MODAL BULK */}
            {bulkModal.show && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4 animate-in fade-in">
                    <div className={`w-full md:max-w-md rounded-t-[2rem] md:rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] ${darkMode ? 'bg-[#161B28]' : 'bg-white'}`}>
                        <div className={`p-5 border-b flex justify-between items-center ${darkMode ? 'border-white/5' : 'border-slate-100'}`}>
                            <div><h3 className={`text-lg font-black ${darkMode ? 'text-white' : 'text-slate-900'}`}>{bulkModal.title}</h3><p className="text-xs font-bold text-slate-400 uppercase">Cola: {bulkModal.list.length}</p></div>
                            <button onClick={() => setBulkModal({ ...bulkModal, show: false })} className={`p-2 rounded-full ${darkMode ? 'bg-white/10 text-white' : 'bg-slate-100 text-slate-500'}`}><X size={18}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {bulkModal.list.map((sale) => {
                                const isSent = sentIds.includes(sale.id);
                                return (
                                    <div key={sale.id} className={`flex items-center justify-between p-3 rounded-2xl border ${isSent ? (darkMode ? 'bg-emerald-500/10 border-emerald-500/20 opacity-50' : 'bg-emerald-50 border-emerald-100 opacity-50') : (darkMode ? 'bg-black/20 border-white/5' : 'bg-white border-slate-100')}`}>
                                        <div className="min-w-0">
                                            <p className={`font-bold text-sm truncate ${darkMode ? 'text-slate-200' : 'text-slate-800'}`}>{sale.client}</p>
                                            <p className="text-[10px] font-bold text-slate-400">{sale.service} • {sale.phone}</p>
                                        </div>
                                        {isSent ? <span className="flex items-center gap-1 text-xs font-black text-emerald-500"><CheckCircle2 size={12}/> Listo</span> : 
                                            <button 
                                                onClick={() => { 
                                                    handleUnifiedWhatsApp(sale, 'reminder'); 
                                                    const relatedIds = bulkModal.list
                                                        .filter(item => item.client === sale.client && item.phone === sale.phone)
                                                        .map(item => item.id);
                                                    saveSentIds(relatedIds); 
                                                }} 
                                                className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 ${darkMode ? 'bg-white text-black' : 'bg-slate-900 text-white'}`}
                                            >
                                                Enviar <Send size={12}/>
                                            </button>
                                        }
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;