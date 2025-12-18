// src/views/Dashboard.jsx
import React, { useState, useEffect } from 'react'; 
import { Search, Smartphone, Lock, Edit2, Ban, XCircle, RotateCcw, X, Calendar, ChevronRight, CalendarPlus, Filter, Bell, Send, CheckCircle2, Copy } from 'lucide-react';
// ✅ Importamos el Calendario
import AppleCalendar from '../components/AppleCalendar';

// --- HELPERS ---
const cleanServiceName = (name) => {
    if (!name) return '';
    return name.replace(/\s(Paquete|Perfil|Perfiles|Cuenta|Renovación|Pantalla|Dispositivo).*$/gi, '').trim();
};

const getWhatsAppUrl = (phone, message) => {
    if (!phone) return '#';
    const cleanPhone = phone.replace(/\D/g, '');
    const encodedMessage = encodeURIComponent(message);
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`
        : `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
};

const safeGetDays = (dateString) => {
    if (!dateString || typeof dateString !== 'string' || !dateString.includes('-')) return 0;
    try {
        const today = new Date(); today.setHours(0,0,0,0);
        const [y, m, d] = dateString.split('-').map(Number);
        const end = new Date(y, m - 1, d); 
        const diffTime = end - today;
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch(e) { return 0; }
};

const safeGetStatusColor = (endDate, client, NON_BILLABLE, darkMode) => {
    if (client === 'LIBRE') return darkMode ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-100 text-emerald-600 border-emerald-200';
    if (NON_BILLABLE?.includes(client)) return darkMode ? 'bg-white/5 text-slate-500 border-white/5' : 'bg-gray-100 text-gray-500 border-gray-200';
    if (!endDate) return 'text-slate-500';
    
    const days = safeGetDays(endDate);
    if (days < 0) return darkMode ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-rose-100 text-rose-600 border-rose-200';
    if (days <= 3) return darkMode ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-100 text-amber-600 border-amber-200';
    return darkMode ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-blue-50 text-blue-600 border-blue-200';
};

const safeGetStatusIcon = (serviceName) => {
    const lower = serviceName ? serviceName.toLowerCase() : '';
    return lower.includes('netflix') ? 'N' : lower.includes('disney') ? 'D' : 'S';
};

const Dashboard = ({
    sales = [], filteredSales = [], catalog = [],
    totalItems = 0, totalFilteredMoney = 0, loadingData = false,
    filterClient, setFilter, filterService, filterStatus, dateFrom, dateTo,
    handleQuickRenew, triggerLiberate, setFormData, setView, setBulkProfiles,
    expiringToday = [], expiringTomorrow = [], overdueSales = [],
    getDaysRemaining, darkMode, 
    NON_BILLABLE_STATUSES = ['Caída', 'Actualizar', 'Dominio', 'EXPIRED', 'Vencido', 'Cancelado', 'Problemas', 'Garantía']
}) => {

    const [bulkModal, setBulkModal] = useState({ show: false, title: '', list: [], msgType: '' });
    const [sentIds, setSentIds] = useState([]); 

    const _getDays = (date) => getDaysRemaining ? getDaysRemaining(date) : safeGetDays(date);
    const _getColor = (end, client) => safeGetStatusColor(end, client, NON_BILLABLE_STATUSES, darkMode);
    const _getIcon = (svc) => safeGetStatusIcon(svc);

    const theme = {
        card: darkMode ? 'bg-[#161B28]/60 backdrop-blur-md border border-white/5 shadow-sm hover:bg-[#161B28]' : 'bg-white/40 backdrop-blur-md border border-white/40 shadow-sm hover:bg-white/60',
        textPrimary: darkMode ? "text-slate-200" : "text-slate-800",
        textSecondary: darkMode ? "text-slate-400" : "text-slate-500",
        inputBg: darkMode ? 'bg-black/20 text-white placeholder-slate-600 border-white/5' : 'bg-transparent text-slate-800 placeholder-slate-400',
        filterBtnActive: darkMode ? 'bg-[#161B28] text-white shadow-sm border border-white/5' : 'bg-white text-indigo-600 shadow-sm',
        filterBtnInactive: darkMode ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700',
        filterContainer: darkMode ? 'bg-[#161B28]/60 border-white/5 shadow-black/20' : 'bg-white/60 shadow-indigo-500/5 border-white/50',
    };

    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];
        const savedData = localStorage.getItem('crm_sent_ids');
        if (savedData) {
            const parsed = JSON.parse(savedData);
            if (parsed.date === today) { setSentIds(parsed.ids); } 
            else { localStorage.removeItem('crm_sent_ids'); }
        }
    }, []);

    const saveSentIds = (newIds) => {
        setSentIds(prev => {
            const updated = [...new Set([...prev, ...newIds])];
            const today = new Date().toISOString().split('T')[0];
            localStorage.setItem('crm_sent_ids', JSON.stringify({ date: today, ids: updated }));
            return updated;
        });
    };

    // 🔥 LOGICA WHATSAPP UNIFICADA (VENCIDOS, HOY, MAÑANA) 🔥
    const handleUnifiedWhatsApp = (sale, actionType) => {
        const { client, phone, endDate } = sale;
        const targetDays = _getDays(endDate);
        
        let message = '';

        if (actionType === 'reminder') {
            // 1. Filtrar ventas relacionadas según el ESTADO de urgencia
            let relatedSales = [];

            if (targetDays < 0) {
                // Si es VENCIDO, buscar TODOS los vencidos de este cliente
                relatedSales = sales.filter(s => s.client === client && _getDays(s.endDate) < 0 && !NON_BILLABLE_STATUSES.includes(s.client) && s.client !== 'LIBRE');
            } else if (targetDays === 0) {
                // Si es HOY, buscar TODOS los que vencen HOY
                relatedSales = sales.filter(s => s.client === client && _getDays(s.endDate) === 0 && !NON_BILLABLE_STATUSES.includes(s.client) && s.client !== 'LIBRE');
            } else if (targetDays === 1) {
                // Si es MAÑANA, buscar TODOS los que vencen MAÑANA
                relatedSales = sales.filter(s => s.client === client && _getDays(s.endDate) === 1 && !NON_BILLABLE_STATUSES.includes(s.client) && s.client !== 'LIBRE');
            } else {
                // Si es FUTURO, buscar por fecha exacta
                relatedSales = sales.filter(s => s.client === client && s.endDate === endDate && !NON_BILLABLE_STATUSES.includes(s.client) && s.client !== 'LIBRE');
            }

            // 2. Agrupar y Sumar (Crear el texto "1 perfil de X y 2 cuentas de Y")
            const groups = {};
            relatedSales.forEach(s => {
                const cleanName = cleanServiceName(s.service);
                const isFull = s.type === 'Cuenta' || (s.service && s.service.toLowerCase().includes('cuenta completa'));
                const key = `${cleanName}-${isFull ? 'C' : 'P'}`;

                if (!groups[key]) { groups[key] = { name: cleanName, isFull: isFull, count: 0 }; }
                groups[key].count += 1;
            });

            const descriptionParts = Object.values(groups).map(g => {
                if (g.isFull) { return `${g.count} ${g.count > 1 ? 'cuentas completas' : 'cuenta completa'} de ${g.name}`; } 
                else { return `${g.count} ${g.count > 1 ? 'perfiles' : 'perfil'} de ${g.name}`; }
            });

            const servicesString = descriptionParts.join(' y ');

            // 3. Seleccionar Plantilla de Mensaje
            if (targetDays < 0) {
                message = `🔴 Hola, recordatorio de pago pendiente por: ${servicesString}`;
            } else if (targetDays === 0) {
                message = `❌ Hola, el vencimiento de ${servicesString} es HOY. Por favor, realiza tu pago para no perder tu cupo ❌`;
            } else if (targetDays === 1) {
                message = `⚠️ Buen Día ${client}⚠️\nMañana vence: ${servicesString}.\n¿Renuevas un mes más?`;
            } else {
                message = `Hola ${client}, recordatorio: ${servicesString} vence en ${targetDays} días.`;
            }
        } 
        else if (actionType === 'data') {
            // ENVIO DE DATOS (Individual por ahora, o podrías agruparlo si quisieras)
            let readableDate = endDate ? endDate.split('-').reverse().join('/') : '---';
            const pinValue = (sale.pin && sale.pin.trim() !== "") ? sale.pin : "No Tiene";
            const cleanName = cleanServiceName(sale.service);
            const isFullAccount = sale.type === 'Cuenta' || (sale.service && sale.service.toLowerCase().includes('cuenta completa'));

            if (isFullAccount) {
                message = `${cleanName.toUpperCase()} CUENTA COMPLETA\n\nCORREO:\n${sale.email}\nCONTRASEÑA:\n${sale.pass}\n\n☑️Su Cuenta Vence el día ${readableDate}☑️`;
            } else {
                message = `${cleanName.toUpperCase()} 1 PERFIL\n\nCORREO:\n${sale.email}\nCONTRASEÑA:\n${sale.pass}\nPERFIL:\n${sale.profile}\nPIN:\n${pinValue}\n\n☑️Su Perfil Vence el día ${readableDate}☑️`;
            }
        }
        
        window.open(getWhatsAppUrl(phone, message), '_blank');
    };

    const handleCopyCredentials = (e, email, pass) => {
        e.preventDefault(); navigator.clipboard.writeText(`${email}:${pass}`);
        const btn = e.currentTarget; const originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="text-emerald-500 flex items-center gap-1">Copiado</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
    };

    const openBulkModal = (type) => {
        let list = []; let title = '';
        if (type === 'today') { list = expiringToday; title = 'Vencen Hoy'; }
        else if (type === 'tomorrow') { list = expiringTomorrow; title = 'Vencen Mañana'; }
        else if (type === 'overdue') { list = overdueSales; title = 'Vencidas (Pago)'; }
        if (list.length === 0) return;
        setBulkModal({ show: true, title, list });
    };

    const SaleCard = ({ sale }) => {
        const isFree = sale.client === 'LIBRE';
        const isProblem = NON_BILLABLE_STATUSES.includes(sale.client);
        const isAdmin = sale.client === 'Admin';
        const days = _getDays(sale.endDate);
        const cost = (isFree || isProblem || isAdmin) ? 0 : Math.round(sale.cost);

        let cardStyle = theme.card;
        let primaryColor = theme.textPrimary;
        let priceColor = darkMode ? "text-slate-300" : "text-slate-700";

        if (isFree) {
            cardStyle = darkMode ? "bg-emerald-500/5 border border-emerald-500/10" : "bg-emerald-50/30 border border-emerald-100/50";
            primaryColor = darkMode ? "text-emerald-400" : "text-emerald-900"; 
        } else if (isProblem) {
            cardStyle = darkMode ? "bg-rose-500/5 border border-rose-500/10" : "bg-rose-50/30 border border-rose-100/50"; 
            primaryColor = darkMode ? "text-rose-400" : "text-rose-900"; 
        } else if (isAdmin) {
            cardStyle = darkMode ? "bg-black border border-white/10" : "bg-slate-900/90 text-white";
            primaryColor = "text-white"; 
            priceColor = "text-white/80";
        }
        
        return (
            <div className={`p-2.5 md:p-4 rounded-[18px] md:rounded-[24px] transition-all duration-300 w-full relative group ${cardStyle}`}>
                <div className="flex flex-col gap-1 md:grid md:grid-cols-12 md:gap-4 items-center">
                    <div className="col-span-12 md:col-span-4 w-full flex items-start gap-2.5">
                        <div className={`w-9 h-9 md:w-14 md:h-14 rounded-[12px] md:rounded-[18px] flex items-center justify-center text-base md:text-2xl shadow-inner flex-shrink-0 border ${darkMode ? 'border-white/5' : 'border-transparent'} ${_getColor(sale.endDate, sale.client)}`}>
                            {_getIcon(sale.service)}
                        </div>
                        <div className="flex-1 min-w-0 relative pt-0.5">
                            <div className="flex justify-between items-start">
                                <div className='pr-1'>
                                    <div className={`font-bold text-sm md:text-lg tracking-tight truncate ${primaryColor} leading-none mb-0.5`}>{isFree ? 'Espacio Libre' : sale.client}</div>
                                    <div className={`text-[10px] md:text-xs font-semibold truncate flex items-center gap-1 ${theme.textSecondary}`}>{sale.service}</div>
                                </div>
                                {!isFree && !isProblem && (
                                    <div className="text-right md:hidden flex flex-col items-end leading-none">
                                        {cost > 0 && <span className={`text-sm font-black tracking-tight ${priceColor}`}>${cost}</span>}
                                        <div className={`text-[9px] font-bold mt-0.5 ${days < 0 ? 'text-rose-500' : days <= 3 ? 'text-amber-500' : 'text-slate-400'}`}>{days}d</div>
                                    </div>
                                )}
                            </div>
                            {!isFree && !isProblem && <div className="md:hidden mt-0.5 flex items-center gap-1 opacity-70"><Smartphone size={9} className="text-slate-400"/> <span className="text-[9px] font-medium text-slate-500">{sale.phone}</span></div>}
                        </div>
                    </div>

                    <div className="col-span-12 md:col-span-3 w-full pl-0 md:pl-4 mt-0.5 md:mt-0">
                        <div className={`flex flex-col justify-center rounded-lg px-2 py-1.5 md:p-0 border md:border-none ${darkMode ? 'bg-black/20 border-white/5' : 'bg-white/40 border-white/20 md:bg-transparent'}`}>
                            <div className={`flex items-start justify-between gap-1 mb-1 ${theme.textSecondary}`}>
                                <div className="flex items-start gap-1 min-w-0"><div className="text-[10px] md:text-[11px] font-medium truncate select-all">{sale.email}</div></div>
                                <button onClick={(e) => handleCopyCredentials(e, sale.email, sale.pass)} className={`p-0.5 rounded-full transition-colors active:scale-90 flex-shrink-0 -mt-0.5 ${darkMode ? 'text-slate-500 hover:text-indigo-400' : 'text-slate-400 hover:text-indigo-600'}`}><Copy size={12}/></button>
                            </div>
                            <div className={`flex items-center justify-between gap-2 pt-1 md:pt-0 md:border-none ${darkMode ? 'border-white/5' : 'border-black/5'}`}>
                                <div className="flex items-center gap-1"><div className={`text-[10px] md:text-xs font-mono font-bold truncate select-all ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>{sale.pass}</div></div>
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {!isFree && (<><span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase border border-white/10 ${isAdmin ? 'bg-white/10 text-white' : (darkMode ? 'bg-indigo-500/20 text-indigo-300' : 'bg-white/60 text-indigo-600')}`}>{sale.profile || 'Gral'}</span><span className={`font-mono text-[9px] tracking-widest px-1 py-0.5 rounded border border-white/10 ${isAdmin ? 'bg-white/5 text-slate-300' : (darkMode ? 'bg-white/5 text-slate-500' : 'bg-slate-100/50 text-slate-500')}`}>{sale.pin || '••••'}</span></>)}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="hidden md:flex col-span-3 w-full flex-col items-center">
                        {!isFree && !isProblem ? (
                            <div className="text-center">
                                <div className={`text-xl font-black tracking-tighter ${days < 0 ? 'text-rose-500' : days <= 3 ? 'text-amber-500' : primaryColor}`}>{days} <span className="text-[10px] font-bold uppercase text-slate-400 align-top">días</span></div>
                                <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.textSecondary}`}>{sale.endDate ? sale.endDate.split('-').reverse().slice(0,2).join('/') : '--'}</div>
                            </div>
                        ) : (isFree ? <span className="text-xs font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-1 rounded-lg">LIBRE</span> : <span className="text-xs font-black text-slate-500 uppercase tracking-widest">---</span>)}
                        {!isProblem && cost > 0 && <div className={`hidden md:block text-sm font-black tracking-tight ${priceColor} mt-1`}>${cost}</div>}
                    </div>

                    <div className="col-span-12 md:col-span-2 w-full flex flex-col md:flex-row items-center justify-end gap-1 mt-1 md:mt-0 pt-1 md:pt-0 border-t md:border-none border-white/5">
                        <div className="flex justify-end gap-1 w-full md:w-auto">
                            {isFree ? (
                                <button onClick={() => { setFormData(sale); setView('form'); }} className={`w-full md:w-auto px-4 h-8 md:h-9 rounded-full font-bold text-xs shadow-lg flex items-center justify-center gap-1 ${darkMode ? 'bg-emerald-500 text-white shadow-emerald-500/30' : 'bg-emerald-500 text-white shadow-emerald-500/30'}`}>Asignar <ChevronRight size={14}/></button>
                            ) : (
                                <div className="flex items-center gap-1 w-full justify-end">
                                    <div className="flex gap-1">
                                        {!isProblem && days <= 3 && <button onClick={() => handleUnifiedWhatsApp(sale, 'reminder')} className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 ${days <= 0 ? (darkMode ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-100 text-rose-600') : (darkMode ? 'bg-amber-500/20 text-amber-400' : 'bg-amber-100 text-amber-600')}`}><XCircle size={12}/></button>}
                                        {!isProblem && <button onClick={() => handleUnifiedWhatsApp(sale, 'data')} className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center ${darkMode ? 'bg-white/5 text-slate-400 hover:bg-indigo-500/20 hover:text-indigo-300' : 'bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600'}`}><Lock size={12}/></button>}
                                        <button onClick={() => { setFormData({...sale, profilesToBuy: 1}); setBulkProfiles([{ profile: sale.profile, pin: sale.pin }]); setView('form'); }} className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center hover:bg-slate-200 ${darkMode ? 'bg-white/5 text-slate-400' : 'bg-slate-100 text-slate-600'}`}><Edit2 size={12}/></button>
                                    </div>
                                    <div className={`flex gap-1 pl-1 border-l ml-1 ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
                                        {!isProblem && <button onClick={() => handleQuickRenew(sale.id)} className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center shadow-sm ${darkMode ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-500 hover:text-white'}`}><CalendarPlus size={12}/></button>}
                                        <button onClick={() => triggerLiberate(sale.id)} className={`w-7 h-7 md:w-8 md:h-8 rounded-full border flex items-center justify-center shadow-sm ${darkMode ? 'bg-transparent border-white/10 text-slate-500 hover:bg-rose-500/20 hover:text-rose-400' : 'bg-white border-slate-100 text-slate-400 hover:bg-rose-50 hover:text-rose-500'}`}><RotateCcw size={12}/></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loadingData) return <div className="flex flex-col items-center justify-center h-[60vh]"><div className="w-16 h-16 rounded-full border-4 border-indigo-100 border-t-indigo-500 animate-spin mb-4"/><p className="text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">Sincronizando...</p></div>;

    const safeSalesList = filteredSales || [];
    const sortedSales = safeSalesList.slice().sort((a, b) => {
        const clientA = a.client ? a.client.toUpperCase() : '';
        const clientB = b.client ? b.client.toUpperCase() : '';
        return clientA < clientB ? -1 : clientA > clientB ? 1 : 0; 
    });

    return (
        <div className="w-full pb-32 space-y-3 md:space-y-8 animate-in fade-in">
            {/* ALERTAS */}
            {(expiringToday.length > 0 || expiringTomorrow.length > 0 || overdueSales.length > 0) && ( 
                <div className="flex gap-2 px-1 animate-in slide-in-from-top-4">
                    {overdueSales.length > 0 && (<button onClick={() => openBulkModal('overdue')} className="flex-1 flex items-center justify-between p-2 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-600/30 hover:scale-[1.02] active:scale-95 transition-all group"><div className="flex items-center gap-2"><div className="p-1 bg-white/20 rounded-lg"><Ban size={14} className="fill-white"/></div><div className="text-left leading-none"><p className="text-[9px] font-bold opacity-80 uppercase">Vencidas</p><p className="text-xs font-black">{overdueSales.length} Clientes</p></div></div><ChevronRight size={14} className="opacity-60 group-hover:translate-x-1 transition-transform"/></button>)}
                    {expiringToday.length > 0 && (<button onClick={() => openBulkModal('today')} className="flex-1 flex items-center justify-between p-2 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/30 hover:scale-[1.02] active:scale-95 transition-all group"><div className="flex items-center gap-2"><div className="p-1 bg-white/20 rounded-lg"><Bell size={14} className="fill-white"/></div><div className="text-left leading-none"><p className="text-[9px] font-bold opacity-80 uppercase">Hoy</p><p className="text-xs font-black">{expiringToday.length} Clientes</p></div></div><ChevronRight size={14} className="opacity-60 group-hover:translate-x-1 transition-transform"/></button>)}
                    {expiringTomorrow.length > 0 && (<button onClick={() => openBulkModal('tomorrow')} className="flex-1 flex items-center justify-between p-2 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/30 hover:scale-[1.02] active:scale-95 transition-all group"><div className="flex items-center gap-2"><div className="p-1 bg-white/20 rounded-lg"><Calendar size={14} className="fill-white"/></div><div className="text-left leading-none"><p className="text-[9px] font-bold opacity-80 uppercase">Mañana</p><p className="text-xs font-black">{expiringTomorrow.length} Clientes</p></div></div><ChevronRight size={14} className="opacity-60 group-hover:translate-x-1 transition-transform"/></button>)}
                </div>
            )}

            {/* BARRA FILTROS (CON CALENDARIO GHOST) */}
            <div className={`sticky top-0 z-40 px-1 py-2 md:py-3 -mx-1 backdrop-blur-xl transition-all ${darkMode ? 'bg-[#0B0F19]/80' : 'bg-[#F2F2F7]/80'}`}>
                <div className={`backdrop-blur-md rounded-[1.5rem] md:rounded-[2rem] p-2 shadow-lg border flex flex-col gap-2 ${theme.filterContainer}`}>
                    <div className="relative group w-full"><div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none"><Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} /></div><input type="text" placeholder="Buscar..." className={`block w-full pl-10 md:pl-12 pr-4 py-2 md:py-3 border-none font-medium rounded-2xl transition-all outline-none focus:ring-0 ${theme.inputBg}`} value={filterClient} onChange={e => setFilter('filterClient', e.target.value)} /></div>
                    <div className="flex flex-col md:flex-row gap-2 w-full">
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center px-1 w-full md:w-auto"><div className="relative flex-shrink-0"><select className={`appearance-none font-bold text-[10px] md:text-xs py-2 pl-3 pr-6 rounded-xl border border-transparent transition-all cursor-pointer outline-none ${darkMode ? 'bg-white/5 text-slate-300 hover:bg-white/10' : 'bg-slate-100/80 text-slate-600 hover:bg-white'}`} value={filterService} onChange={e => setFilter('filterService', e.target.value)}><option value="Todos">Todos</option>{catalog.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select><Filter size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/></div><div className={`flex p-1 rounded-xl flex-shrink-0 ${darkMode ? 'bg-black/20' : 'bg-slate-200/50'}`}>{['Todos', 'Libres', 'Ocupados', 'Problemas', 'Vencidos'].map((status) => (<button key={status} onClick={() => setFilter('filterStatus', status)} className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${filterStatus === status ? theme.filterBtnActive : theme.filterBtnInactive}`}>{status}</button>))}</div></div>
                        
                        {/* CALENDARIO GHOST */}
                        <div className={`flex items-center gap-1 px-2 py-1.5 rounded-xl border w-full md:w-auto ${darkMode ? 'bg-white/5 border-white/5' : 'bg-white/50 border-white/50'}`}>
                            <div className="w-28"> 
                                <AppleCalendar value={dateFrom} onChange={(val) => setFilter('dateFrom', val)} label="Desde" darkMode={darkMode} ghost={true} />
                            </div>
                            <span className="text-slate-400 text-xs">-</span>
                            <div className="w-28">
                                <AppleCalendar value={dateTo} onChange={(val) => setFilter('dateTo', val)} label="Hasta" darkMode={darkMode} ghost={true} />
                            </div>
                            {(dateFrom || dateTo) && <button onClick={() => { setFilter('dateFrom', ''); setFilter('dateTo', ''); }} className="ml-1 p-1 bg-rose-50 text-rose-500 rounded-full hover:bg-rose-100"><X size={10}/></button>}
                        </div>

                    </div>
                </div>
            </div>

            {/* HEADER METRICAS */}
            <div className="flex items-end justify-between px-2 md:px-4"><div><h1 className={`text-3xl md:text-6xl font-black tracking-tighter mb-1 ${darkMode ? 'text-white' : 'text-slate-900'}`}><span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-500 to-slate-400">${totalFilteredMoney.toLocaleString()}</span></h1><p className="text-slate-400 font-bold text-[10px] md:text-xs uppercase tracking-widest pl-1">Ingresos Mensuales</p></div><div className="text-right pb-1 md:pb-2"><div className={`text-xl md:text-2xl font-black ${darkMode ? 'text-white' : 'text-slate-800'}`}>{totalItems}</div><div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activos</div></div></div>

            {/* LISTA */}
            <div className="grid grid-cols-1 gap-2 md:gap-4">
                {sortedSales.length > 0 ? (
                    sortedSales.map(sale => <SaleCard key={sale.id} sale={sale} />)
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50"><div className="w-24 h-24 bg-slate-200 rounded-full mb-4 animate-pulse"/><p className="text-slate-400 font-bold">Sin resultados</p></div>
                )}
            </div>

            {/* Modal Masivo */}
            {bulkModal.show && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 p-0 md:p-4">
                    <div className={`w-full md:max-w-md rounded-t-[2rem] md:rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh] ${darkMode ? 'bg-[#161B28]' : 'bg-white'}`}>
                        <div className={`p-6 border-b flex justify-between items-center ${darkMode ? 'border-white/5' : 'border-slate-100'}`}>
                            <div><h3 className={`text-xl font-black ${theme.textPrimary}`}>{bulkModal.title}</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Cola: {bulkModal.list.length}</p></div>
                            <button onClick={() => setBulkModal({ ...bulkModal, show: false })} className={`p-2 rounded-full ${darkMode ? 'bg-white/5 hover:bg-white/10 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-500'}`}><X size={20}/></button>
                        </div>
                        <div className={`flex-1 overflow-y-auto p-4 space-y-3 pb-24 ${darkMode ? 'bg-[#0B0F19]/50' : 'bg-slate-50/50'}`}>
                            {bulkModal.list.map((sale) => {
                                const isClientSent = bulkModal.list.filter(item => item.client === sale.client && item.phone === sale.phone).every(item => sentIds.includes(item.id));
                                return (
                                    <div key={sale.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${isClientSent ? (darkMode ? 'bg-emerald-500/10 border-emerald-500/20 opacity-50' : 'bg-emerald-50 border-emerald-100 opacity-50') : (darkMode ? 'bg-[#161B28] border-white/5 shadow-sm' : 'bg-white border-slate-100 shadow-sm')}`}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${_getColor(sale.endDate, sale.client)}`}>{_getIcon(sale.service)}</div>
                                            <div className="min-w-0"><p className={`font-bold text-sm truncate ${theme.textPrimary}`}>{sale.client}</p><p className="text-[10px] font-bold text-slate-400 truncate">{sale.phone}</p></div>
                                        </div>
                                        {isClientSent ? <span className="flex items-center gap-1 text-xs font-black text-emerald-600 px-3 py-2 bg-emerald-100/50 rounded-xl"><CheckCircle2 size={14}/> Listo</span> : <button onClick={() => { handleUnifiedWhatsApp(sale, 'reminder'); const allClientIdsInQueue = bulkModal.list.filter(item => item.client === sale.client && item.phone === sale.phone).map(item => item.id); saveSentIds(allClientIdsInQueue); }} className="px-4 py-2 bg-black text-white rounded-xl font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center">Enviar <Send size={12}/></button>}
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