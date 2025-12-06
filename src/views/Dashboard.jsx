// src/views/Dashboard.jsx (FINAL: Botón "Renovar" y sin Iconos de Plataforma)

import React, { useState } from 'react';
import { 
    Search, Smartphone, Key, Lock, Edit2, Ban, XCircle, RotateCcw, 
    X, Calendar, ChevronRight, CalendarPlus, Filter, Bell, Send, CheckCircle2, Copy, Eye,
    // (Se remueven las importaciones de íconos de plataforma como Tv, Film, etc.)
    Package, Box 
} from 'lucide-react';

const Dashboard = ({
    sales, 
    filteredSales,
    catalog, 
    filterClient, 
    filterService, 
    filterStatus, 
    dateFrom, 
    dateTo, 
    setFilter, 
    totalItems, 
    totalFilteredMoney, 
    getStatusIcon, 
    getStatusColor,
    getDaysRemaining, 
    sendWhatsApp, 
    handleQuickRenew, 
    triggerLiberate, 
    setFormData, 
    setView, 
    setBulkProfiles,
    NON_BILLABLE_STATUSES, 
    loadingData 
}) => {

    const [bulkModal, setBulkModal] = useState({ show: false, title: '', list: [], msgType: '' });
    const [sentIds, setSentIds] = useState([]); 
    
    // 🔥 NOTA: getServiceVisuals fue eliminado para volver al diseño anterior.
    // Si desea agregar un ícono, hágalo directamente en el JSX usando <IconName size={12}/>

    // FUNCIÓN: Copiar email y contraseña al portapapeles
    const handleCopyCredentials = (e, email, pass) => {
        e.preventDefault();
        navigator.clipboard.writeText(`${email}:${pass}`);
        const btn = e.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = `<span class="text-emerald-600 flex items-center gap-1"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copiado</span>`;
        setTimeout(() => { btn.innerHTML = originalContent; }, 2000);
    };

    const validSales = sales.filter(s => 
        s.client !== 'LIBRE' && 
        s.client !== 'Admin' && 
        (!NON_BILLABLE_STATUSES || !NON_BILLABLE_STATUSES.includes(s.client))
    );

    const expiringToday = validSales.filter(s => getDaysRemaining(s.endDate) === 0);
    const expiringTomorrow = validSales.filter(s => getDaysRemaining(s.endDate) === 1);
    const overdueSales = validSales.filter(s => getDaysRemaining(s.endDate) < 0);

    const sortedSales = filteredSales.slice().sort((a, b) => {
        const clientA = a.client ? a.client.toUpperCase() : '';
        const clientB = b.client ? b.client.toUpperCase() : '';
        return clientA < clientB ? -1 : clientA > clientB ? 1 : 0; 
    });

    const openBulkModal = (type) => {
        if (type === 'today') {
            if (expiringToday.length === 0) return;
            setBulkModal({ show: true, title: 'Vencen Hoy', list: expiringToday, msgType: 'expired_today' });
        } else if (type === 'tomorrow') {
            if (expiringTomorrow.length === 0) return;
            setBulkModal({ show: true, title: 'Vencen Mañana', list: expiringTomorrow, msgType: 'warning_tomorrow' });
        } else if (type === 'overdue') { 
            if (overdueSales.length === 0) return;
            setBulkModal({ show: true, title: 'Vencidas (Pago)', list: overdueSales, msgType: 'overdue_payment' });
        }
    };

    const handleBulkSend = (sale) => {
        sendWhatsApp(sale, bulkModal.msgType);
        const clientName = sale.client;
        const clientPhone = sale.phone;
        const allClientIdsInQueue = bulkModal.list
            .filter(item => item.client === clientName && item.phone === clientPhone)
            .map(item => item.id);
        setSentIds(prev => [...new Set([...prev, ...allClientIdsInQueue])]); 
    };

    // 🔥 FUNCIÓN: Renovar y Marcar como Procesado (para el botón "Renovar")
    const handleModalRenew = (sale) => {
        handleQuickRenew(sale.id); // 1. Ejecutar la renovación de 30 días
        
        // 2. Marcar como PROCESADO/ENVIADO (sin enviar WhatsApp, solo actualizando sentIds)
        const clientName = sale.client;
        const clientPhone = sale.phone;
        const allClientIdsInQueue = bulkModal.list
            .filter(item => item.client === clientName && item.phone === clientPhone)
            .map(item => item.id);
        setSentIds(prev => [...new Set([...prev, ...allClientIdsInQueue])]); 
    };


    // --- COMPONENTE TARJETA UNIFICADO ---
    const SaleCard = ({ sale }) => {
        const isFree = sale.client === 'LIBRE';
        const isProblem = NON_BILLABLE_STATUSES && NON_BILLABLE_STATUSES.includes(sale.client);
        const isAdmin = sale.client === 'Admin';
        const days = getDaysRemaining(sale.endDate);
        const cost = (isFree || isProblem || isAdmin) ? 0 : Math.round(sale.cost);

        let containerStyle = "bg-white/40 backdrop-blur-md border border-white/40 shadow-sm hover:bg-white/60";
        let textPrimary = "text-slate-800";
        let textSecondary = "text-slate-500";
        let accentColor = "bg-indigo-500 text-white shadow-indigo-500/30";
        let priceColor = isAdmin ? "text-white/80" : "text-slate-700"; 

        if (isFree) {
            containerStyle = "bg-emerald-50/30 backdrop-blur-sm border border-emerald-100/50";
            textPrimary = "text-emerald-900";
            textSecondary = "text-emerald-600/70";
            accentColor = "bg-emerald-500 text-white shadow-emerald-500/30";
        }
        if (isProblem) {
            containerStyle = "bg-rose-50/30 backdrop-blur-sm border border-rose-100/50";
            textPrimary = "text-rose-900";
            accentColor = "bg-rose-500 text-white";
        }
        if (isAdmin) {
            containerStyle = "bg-slate-900/90 backdrop-blur-xl border border-white/10 text-white";
            textPrimary = "text-white";
            textSecondary = "text-slate-400";
            accentColor = "bg-white text-black";
        }
        
        // La iconografía personalizada fue removida aquí.

        return (
            <div className={`p-2.5 md:p-5 rounded-[18px] md:rounded-[24px] transition-all duration-300 w-full relative group ${containerStyle}`}>
                <div className="flex flex-col gap-1 md:grid md:grid-cols-12 md:gap-4 items-center">
                    
                    {/* 1. CABECERA (CLIENTE) */}
                    <div className="col-span-12 md:col-span-3 w-full flex items-start gap-2.5">
                        <div className={`w-9 h-9 md:w-14 md:h-14 rounded-[12px] md:rounded-[18px] flex items-center justify-center text-base md:text-2xl shadow-inner flex-shrink-0 ${getStatusColor(sale.client)}`}>
                            {getStatusIcon(sale.client)}
                        </div>
                        <div className="flex-1 min-w-0 relative pt-0.5">
                            <div className="flex justify-between items-start">
                                <div className='pr-1'>
                                    <div className={`font-bold text-sm md:text-lg tracking-tight truncate ${textPrimary} leading-none mb-0.5`}>{isFree ? 'Espacio Libre' : sale.client}</div>
                                    
                                    {/* Mostrar Servicio sin Icono de Plataforma */}
                                    <div className={`text-[10px] md:text-xs font-semibold truncate flex items-center gap-1 ${textSecondary}`}>
                                        {sale.service}
                                    </div>
                                    
                                </div>
                                {!isFree && !isProblem && (
                                    <div className="text-right md:hidden flex flex-col items-end leading-none">
                                        {cost > 0 && <span className={`text-sm font-black tracking-tight ${priceColor}`}>${cost}</span>}
                                        <div className={`text-[9px] font-bold mt-0.5 ${days < 0 ? 'text-rose-500' : days <= 3 ? 'text-amber-500' : 'text-slate-400'}`}>{days}d</div>
                                    </div>
                                )}
                            </div>
                            {!isFree && !isProblem && (
                                <div className="md:hidden mt-0.5 flex items-center gap-1 opacity-70">
                                    <Smartphone size={9} className="text-slate-400"/> <span className="text-[9px] font-medium text-slate-500">{sale.phone}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 2. INFO DE CUENTA (VISIBLE PARA TODOS) */}
                    <div className="col-span-12 md:col-span-4 w-full pl-0 md:pl-4 mt-0.5 md:mt-0">
                        <div className="flex flex-col justify-center bg-white/40 md:bg-transparent rounded-lg px-2 py-1.5 md:p-0 border border-white/20 md:border-none">
                            
                            {/* Email */}
                            <div className={`text-[10px] md:text-xs font-medium truncate select-all mb-0.5 ${textSecondary}`} title="Email">
                                {sale.email}
                            </div>
                            
                            {/* Contraseña + Botón Copiar */}
                            <div className="flex items-center justify-between gap-2 border-t border-black/5 pt-1 md:border-none md:pt-0">
                                
                                {/* Contraseña visible */}
                                <div className="flex items-center gap-1">
                                    <div className="text-[10px] md:text-xs font-mono font-bold text-slate-600 truncate select-all" title="Contraseña">
                                        {sale.pass}
                                    </div>
                                    {/* Botón de Copiar */}
                                    <button 
                                        onClick={(e) => handleCopyCredentials(e, sale.email, sale.pass)}
                                        className="text-slate-400 hover:text-indigo-600 p-1 rounded-full transition-colors active:scale-90"
                                        title="Copiar Correo y Contraseña"
                                    >
                                        <Copy size={12}/>
                                    </button>
                                </div>
                                
                                {/* Badge de Estado o PIN */}
                                <div className="flex items-center gap-1 flex-shrink-0">
                                    {isFree ? (
                                        <span className="text-[9px] font-black text-emerald-600 bg-emerald-100/50 px-1.5 py-0.5 rounded border border-emerald-100">DISPONIBLE</span>
                                    ) : (
                                        <>
                                            <span className={`px-1 py-0.5 rounded text-[9px] font-bold uppercase border border-white/20 ${isAdmin ? 'bg-white/10 text-white' : 'bg-white/60 text-indigo-600'}`}>{sale.profile || 'Gral'}</span>
                                            <span className={`font-mono text-[9px] tracking-widest px-1 py-0.5 rounded border border-white/20 ${isAdmin ? 'bg-white/5 text-slate-300' : 'bg-slate-100/50 text-slate-500'}`}>{sale.pin || '••••'}</span>
                                        </>
                                    )}
                                </div>
                            </div>

                        </div>
                    </div>

                    {/* 3. ESTADO PC (COLUMNA 3: DÍAS/PRECIO) - Aumentado a col-span-3 */}
                    <div className="hidden md:flex col-span-3 w-full flex-col items-center">
                        {!isFree && !isProblem ? (
                            <div className="text-center">
                                <div className={`text-xl font-black tracking-tighter ${days < 0 ? 'text-rose-500' : days <= 3 ? 'text-amber-500' : textPrimary}`}>{days} <span className="text-[10px] font-bold uppercase text-slate-400 align-top">días</span></div>
                                <div className={`text-[10px] font-bold uppercase tracking-wider ${textSecondary}`}>{sale.endDate ? sale.endDate.split('-').reverse().slice(0,2).join('/') : '--'}</div>
                            </div>
                        ) : (
                            isFree ? 
                            <span className="text-xs font-black text-emerald-400 uppercase tracking-widest bg-emerald-50 px-2 py-1 rounded-lg">LIBRE</span> :
                            <span className="text-xs font-black text-slate-300 uppercase tracking-widest">---</span>
                        )}
                        {/* El precio en PC ahora se muestra aquí para usar el espacio adicional */}
                        {!isProblem && cost > 0 && <div className={`hidden md:block text-sm font-black tracking-tight ${priceColor} mt-1`}>${cost}</div>}
                    </div>

                    {/* 4. ACCIONES (COLUMNA 4: BOTONES) - Reducido a col-span-2 y botones compactos */}
                    <div className="col-span-12 md:col-span-2 w-full flex flex-col md:flex-row items-center justify-end gap-1 mt-1 md:mt-0 pt-1 md:pt-0 border-t border-black/5 md:border-none">
                        
                        <div className="flex justify-end gap-1 w-full md:w-auto">
                            {isFree ? (
                                <button onClick={() => { setFormData(sale); setView('form'); }} className={`w-full md:w-auto px-4 h-8 md:h-9 rounded-full font-bold text-xs shadow-lg flex items-center justify-center gap-1 ${accentColor}`}>Asignar <ChevronRight size={14}/></button>
                            ) : (
                                <div className="flex items-center gap-1 w-full justify-end">
                                    <div className="flex gap-1">
                                        {/* 1. Advertencia/Expiración */}
                                        {!isProblem && days <= 3 && <button onClick={() => sendWhatsApp(sale, days <= 0 ? 'expired_today' : 'warning_tomorrow')} className={`w-7 h-7 md:w-8 md:h-8 rounded-full flex items-center justify-center transition-transform active:scale-90 ${days <= 0 ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}><XCircle size={12}/></button>}
                                        
                                        {/* 2. ENVIAR PERFIL (Candado/Lock) */}
                                        {!isProblem && <button onClick={() => sendWhatsApp(sale, 'profile_details')} className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-indigo-100 hover:text-indigo-600"><Lock size={12}/></button>}
                                        
                                        {/* 3. ENVIAR CUENTA (Llave/Key) */}
                                        {!isProblem && <button onClick={() => sendWhatsApp(sale, 'account_details')} className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-blue-100 hover:text-blue-600"><Key size={12}/></button>}
                                        
                                        {/* 4. Editar */}
                                        <button onClick={() => { setFormData({...sale, profilesToBuy: 1}); setBulkProfiles([{ profile: sale.profile, pin: sale.pin }]); setView('form'); }} className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center hover:bg-slate-200"><Edit2 size={12}/></button>
                                    </div>
                                    
                                    <div className="flex gap-1 pl-1 border-l border-slate-200 ml-1">
                                        {/* 5. Renovación Rápida */}
                                        {!isProblem && <button onClick={() => handleQuickRenew(sale.id)} className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center hover:bg-emerald-500 hover:text-white shadow-sm"><CalendarPlus size={12}/></button>}
                                        
                                        {/* 6. Liberar */}
                                        <button onClick={() => triggerLiberate(sale.id)} className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-white border border-slate-100 text-slate-400 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 shadow-sm"><RotateCcw size={12}/></button>
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

    return (
        <div className="w-full pb-32 space-y-3 md:space-y-8">
            
            {/* --- MODAL DE ENVÍO MASIVO --- */}
            {bulkModal.show && (
                <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/30 backdrop-blur-sm animate-in fade-in duration-300 p-0 md:p-4">
                    <div className="w-full md:max-w-md bg-white rounded-t-[2rem] md:rounded-[2rem] shadow-2xl flex flex-col max-h-[85vh]">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <div><h3 className="text-xl font-black text-slate-800">{bulkModal.title}</h3><p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Cola de envío: {bulkModal.list.length}</p></div>
                            <button onClick={() => setBulkModal({ ...bulkModal, show: false })} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X size={20} className="text-slate-500"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 pb-24">
                            {bulkModal.list.map((sale) => {
                                // Aquí se usa la lógica del cliente/teléfono
                                const isClientSent = bulkModal.list
                                    .filter(item => item.client === sale.client && item.phone === sale.phone)
                                    .every(item => sentIds.includes(item.id));
                                
                                return (
                                    <div key={sale.id} className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${isClientSent ? 'bg-emerald-50 border-emerald-100 opacity-50' : 'bg-white border-slate-100 shadow-sm'}`}>
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${getStatusColor(sale.client)}`}>{getStatusIcon(sale.client)}</div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-slate-800 truncate">{sale.client}</p>
                                                <p className="text-[10px] font-bold text-slate-400 truncate">{sale.phone}</p>
                                            </div>
                                        </div>
                                        {isClientSent ? (
                                            <span className="flex items-center gap-1 text-xs font-black text-emerald-600 px-3 py-2 bg-emerald-100/50 rounded-xl"><CheckCircle2 size={14}/> Procesado</span>
                                        ) : (
                                            <div className="flex gap-2">
                                                {/* NUEVO BOTÓN: Renovar */}
                                                <button 
                                                    onClick={() => handleModalRenew(sale)} 
                                                    className="px-3 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center"
                                                >
                                                    Renovar
                                                </button>
                                                
                                                {/* Botón existente: Enviar WhatsApp */}
                                                <button onClick={() => handleBulkSend(sale)} className="px-4 py-2 bg-black text-white rounded-xl font-bold text-xs shadow-lg active:scale-95 transition-all flex items-center">
                                                    Enviar <Send size={12}/>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* ALERTAS - FILTROS VENCIDAS, HOY, MAÑANA */}
            {(expiringToday.length > 0 || expiringTomorrow.length > 0 || overdueSales.length > 0) && ( 
                <div className="flex gap-2 px-1 animate-in slide-in-from-top-4">
                    
                    {/* Botón: Vencidas (Días < 0) */}
                    {overdueSales.length > 0 && (
                        <button onClick={() => openBulkModal('overdue')} className="flex-1 flex items-center justify-between p-2 bg-rose-600 text-white rounded-2xl shadow-lg shadow-rose-600/30 hover:scale-[1.02] active:scale-95 transition-all group">
                            <div className="flex items-center gap-2">
                                <div className="p-1 bg-white/20 rounded-lg"><Ban size={14} className="fill-white"/></div>
                                <div className="text-left leading-none">
                                    <p className="text-[9px] font-bold opacity-80 uppercase">Vencidas</p>
                                    <p className="text-xs font-black">{overdueSales.length} Clientes</p>
                                </div>
                            </div>
                            <ChevronRight size={14} className="opacity-60 group-hover:translate-x-1 transition-transform"/>
                        </button>
                    )}

                    {/* Botón: Vencen Hoy (Días = 0) */}
                    {expiringToday.length > 0 && (<button onClick={() => openBulkModal('today')} className="flex-1 flex items-center justify-between p-2 bg-rose-500 text-white rounded-2xl shadow-lg shadow-rose-500/30 hover:scale-[1.02] active:scale-95 transition-all group">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-white/20 rounded-lg"><Bell size={14} className="fill-white"/></div>
                            <div className="text-left leading-none">
                                <p className="text-[9px] font-bold opacity-80 uppercase">Hoy</p>
                                <p className="text-xs font-black">{expiringToday.length} Clientes</p>
                            </div>
                        </div>
                        <ChevronRight size={14} className="opacity-60 group-hover:translate-x-1 transition-transform"/>
                    </button>)}
                    
                    {/* Botón: Vencen Mañana (Días = 1) */}
                    {expiringTomorrow.length > 0 && (<button onClick={() => openBulkModal('tomorrow')} className="flex-1 flex items-center justify-between p-2 bg-amber-500 text-white rounded-2xl shadow-lg shadow-amber-500/30 hover:scale-[1.02] active:scale-95 transition-all group">
                        <div className="flex items-center gap-2">
                            <div className="p-1 bg-white/20 rounded-lg"><Calendar size={14} className="fill-white"/></div>
                            <div className="text-left leading-none">
                                <p className="text-[9px] font-bold opacity-80 uppercase">Mañana</p>
                                <p className="text-xs font-black">{expiringTomorrow.length} Clientes</p>
                            </div>
                        </div>
                        <ChevronRight size={14} className="opacity-60 group-hover:translate-x-1 transition-transform"/>
                    </button>)}
                </div>
            )}

            {/* SECCIÓN DE FILTROS (RESTAURADA) */}
            <div className="sticky top-0 z-40 px-1 py-2 md:py-3 -mx-1 bg-[#F2F2F7]/80 backdrop-blur-xl transition-all">
                <div className="bg-white/60 backdrop-blur-md rounded-[1.5rem] md:rounded-[2rem] p-2 shadow-lg shadow-indigo-500/5 border border-white/50 flex flex-col gap-2">
                    <div className="relative group w-full"><div className="absolute inset-y-0 left-0 pl-3 md:pl-4 flex items-center pointer-events-none"><Search className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18} /></div><input type="text" placeholder="Buscar cliente, correo..." className="block w-full pl-10 md:pl-12 pr-4 py-2 md:py-3 bg-transparent border-none text-slate-800 placeholder-slate-400 focus:ring-0 text-sm md:text-base font-medium rounded-2xl transition-all" value={filterClient} onChange={e => setFilter('filterClient', e.target.value)} /></div>
                    <div className="flex flex-col md:flex-row gap-2 w-full">
                        <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar items-center px-1 w-full md:w-auto"><div className="relative flex-shrink-0"><select className="appearance-none bg-slate-100/80 hover:bg-white text-slate-600 font-bold text-[10px] md:text-xs py-2 pl-3 pr-6 rounded-xl border border-transparent hover:border-indigo-100 transition-all cursor-pointer outline-none" value={filterService} onChange={e => setFilter('filterService', e.target.value)}><option value="Todos">Todos</option>{catalog.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select><Filter size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/></div><div className="flex bg-slate-200/50 p-1 rounded-xl flex-shrink-0">{['Todos', 'Libres', 'Ocupados', 'Problemas'].map((status) => (<button key={status} onClick={() => setFilter('filterStatus', status)} className={`px-3 py-1.5 rounded-lg text-[10px] md:text-xs font-bold transition-all whitespace-nowrap ${filterStatus === status ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>{status}</button>))}</div></div>
                        <div className="flex items-center justify-between md:justify-start gap-1 bg-white/50 px-2 py-1.5 rounded-xl border border-white/50 w-full md:w-auto"><div className="flex items-center gap-1"><Calendar size={14} className="text-slate-400"/><span className="text-[10px] font-bold text-slate-400 uppercase md:hidden">Desde:</span><input type="date" className="bg-transparent text-[10px] md:text-xs font-bold text-slate-600 w-24 md:w-24 outline-none" value={dateFrom} onChange={e => setFilter('dateFrom', e.target.value)}/></div><div className="flex items-center gap-1"><span className="text-slate-400 text-xs">-</span><input type="date" className="bg-transparent text-[10px] md:text-xs font-bold text-slate-600 w-24 md:w-24 outline-none text-right md:text-left" value={dateTo} onChange={e => setFilter('dateTo', e.target.value)}/></div>{(dateFrom || dateTo) && <button onClick={() => { setFilter('dateFrom', ''); setFilter('dateTo', ''); }} className="ml-1 p-1 bg-rose-50 text-rose-500 rounded-full hover:bg-rose-100"><X size={10}/></button>}</div>
                    </div>
                </div>
            </div>

            <div className="flex items-end justify-between px-2 md:px-4"><div><h1 className="text-3xl md:text-6xl font-black text-slate-900 tracking-tighter mb-1"><span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-800 to-slate-500">${totalFilteredMoney.toLocaleString()}</span></h1><p className="text-slate-400 font-bold text-[10px] md:text-xs uppercase tracking-widest pl-1">Ingresos Mensuales</p></div><div className="text-right pb-1 md:pb-2"><div className="text-xl md:text-2xl font-black text-slate-800">{totalItems}</div><div className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase tracking-wider">Activos</div></div></div>

            <div className="grid grid-cols-1 gap-2 md:gap-4">
                {sortedSales.length > 0 ? (
                    sortedSales.map(sale => <SaleCard key={sale.id} sale={sale} />)
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 opacity-50"><div className="w-24 h-24 bg-slate-200 rounded-full mb-4 animate-pulse"/><p className="text-slate-400 font-bold">Sin resultados</p></div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;