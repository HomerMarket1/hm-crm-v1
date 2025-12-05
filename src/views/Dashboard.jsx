// src/views/Dashboard.jsx

import React from 'react';
import { 
    Search, Plus, Smartphone, MessageCircle, Lock, Key, Trash2, Edit2, Ban, XCircle, 
    CheckCircle, Filter, DollarSign, RotateCcw, X, MoreVertical, Menu, 
    RefreshCw, Globe, Shield, Skull, CalendarPlus, ChevronRight, AlertTriangle, Calendar,
    Loader 
} from 'lucide-react';

const Dashboard = ({
    sales, 
    filteredSales,
    catalog, 
    filterClient, setFilterClient,
    filterService, setFilterService,
    filterStatus, setFilterStatus,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    totalItems, totalFilteredMoney,
    getStatusIcon, getStatusColor,
    getDaysRemaining,
    sendWhatsApp, 
    handleQuickRenew,
    triggerLiberate, 
    setFormData, setView,
    openMenuId, setOpenMenuId, // Mantener, pero solo lo usará el botón de detalles
    setBulkProfiles,
    NON_BILLABLE_STATUSES,
    loadingData 
}) => {

    // 1. FUNCIÓN INTERNA DE RENDERIZADO DE LA TARJETA (SaleCard)
    const SaleCard = ({ sale }) => {
        
        const isFree = sale.client === 'LIBRE';
        const isProblem = NON_BILLABLE_STATUSES && NON_BILLABLE_STATUSES.includes(sale.client);
        const isAdmin = sale.client === 'Admin';
        const days = getDaysRemaining(sale.endDate);
        let cardClass = "bg-white/80 backdrop-blur-sm border border-white hover:border-blue-200 hover:shadow-lg hover:-translate-y-0.5";
        if (isFree) cardClass = "bg-emerald-50/40 border border-emerald-100 border-dashed";
        if (isProblem) cardClass = "bg-red-50/20 border border-red-100 hover:border-red-200";
        if (isAdmin) cardClass = "bg-slate-900 border border-slate-700 text-white";

        return (
            <div key={sale.id} className={`p-3 rounded-2xl transition-all relative group ${cardClass}`}>
                <div className="flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 items-center">
                    
                    {/* CLIENTE (col-span-2) */}
                    <div className="col-span-12 md:col-span-2 w-full flex items-center gap-3">
                        <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center text-lg md:text-xl font-bold shadow-sm flex-shrink-0 ${getStatusColor(sale.client)}`}>{getStatusIcon(sale.client)}</div>
                        <div className="flex-1 overflow-hidden">
                            <div className={`font-bold text-sm md:text-base truncate leading-tight ${isAdmin ? 'text-white' : 'text-slate-900'}`}>{isFree ? 'Cupo Disponible' : sale.client}</div>
                            <div className={`text-[10px] md:text-xs font-medium mt-0.5 truncate ${isAdmin ? 'text-slate-400' : 'text-slate-500'}`}>{sale.service}</div>
                            {!isFree && !isProblem && <div className="text-[10px] text-blue-500 font-bold mt-1 md:hidden flex items-center gap-1"><Smartphone size={10}/> {sale.phone}</div>}
                        </div>
                        <div className={`text-sm font-bold md:hidden ${isAdmin ? 'text-white' : 'text-slate-700'}`}>${(isFree || isProblem || isAdmin) ? 0 : sale.cost}</div>
                    </div>

                    {/* DETALLES/EMAIL/PERFIL (col-span-5) */}
                    <div className="col-span-12 md:col-span-5 w-full flex flex-col justify-center">
                        {!isFree && !isProblem ? (
                            <>
                                <div className={`text-[10px] md:text-xs font-medium truncate ${isAdmin ? 'text-slate-300' : 'text-slate-600'}`} title={sale.email}>{sale.email}</div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="bg-blue-50 text-blue-600 text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-100 truncate max-w-[100px]">{sale.profile || 'Gral'}</span>
                                    <span className="bg-slate-50 text-slate-500 text-[9px] md:text-[10px] font-mono px-1.5 py-0.5 rounded border border-slate-200">{sale.pin || '****'}</span>
                                </div>
                            </>
                        ) : isFree && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full w-fit hidden md:block">Disponible para venta</span>}
                    </div>

                    {/* VENCIMIENTO (col-span-1) */}
                    <div className="col-span-6 md:col-span-1 w-full text-left md:text-center flex items-center md:block gap-2">
                        {!isFree && !isProblem ? (
                            <>
                                <div className={`text-xs md:text-sm font-bold ${days <= 3 ? 'text-amber-500' : (isAdmin ? 'text-white' : 'text-slate-800')}`}>{sale.endDate ? sale.endDate.split('-').reverse().slice(0,2).join('/') : '--'}</div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase md:mt-0.5">{days} Días Rest.</div>
                            </>
                        ) : <span className="text-slate-400 text-[10px] font-bold bg-slate-100 px-2 py-1 rounded-full">{isFree ? 'LIBRE' : 'N/A'}</span>}
                    </div>

                    {/* COSTO (col-span-2) */}
                    <div className="hidden md:block col-span-2 text-center">
                        <div className={`text-sm font-bold ${isAdmin ? 'text-white' : 'text-slate-700'}`}>${(isFree || isProblem || isAdmin) ? 0 : sale.cost}</div>
                    </div>

                    {/* CONTROLES (col-span-2) - SIMPLIFICADO PARA MOVIL */}
                    <div className="col-span-12 md:col-span-2 w-full flex justify-end pt-2 md:pt-0 border-t border-black/5 md:border-none mt-1 md:mt-0 relative">
                        {isFree ? (
                            <button onClick={() => { setFormData(sale); setView('form'); }} className="h-8 md:h-9 w-full md:w-auto px-4 bg-black text-white rounded-lg font-bold text-xs shadow-md flex items-center justify-center gap-2 active:scale-95">Asignar <ChevronRight size={12}/></button>
                        ) : (
                            // ✅ Botones visibles en una fila única para móvil/PC
                            <div className="flex gap-1 md:space-x-1 md:w-auto w-full justify-end">
                                
                                {/* Botones de Acción Inmediata (Siempre visibles) */}
                                {!isProblem && days <= 3 && (<button onClick={() => sendWhatsApp(sale, days <= 0 ? 'expired_today' : 'warning_tomorrow')} className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-sm transition-colors ${days <= 0 ? 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100' : 'bg-amber-50 text-amber-500 border-amber-100 hover:bg-amber-100'}`}>{days <= 0 ? <XCircle size={14}/> : <Ban size={14}/>}</button>)}
                                
                                {!isProblem && <button onClick={() => sendWhatsApp(sale, 'account_details')} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-blue-600 bg-white border border-slate-100 hover:border-blue-200 shadow-sm'}`}><Key size={14}/></button>}
                                
                                {/* Botón Editar */}
                                <button onClick={() => { setFormData({...sale, profilesToBuy: 1}); setBulkProfiles([{ profile: sale.profile, pin: sale.pin }]); setView('form'); }} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800 bg-white border border-slate-100 hover:border-slate-300 shadow-sm'}`}><Edit2 size={14}/></button>
                                
                                {/* Botón Renovar */}
                                {!isProblem && <button onClick={() => { handleQuickRenew(sale.id); }} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-emerald-500 hover:text-emerald-400' : 'text-emerald-500 hover:text-emerald-700 bg-white border border-slate-100 hover:border-emerald-200 shadow-sm'}`}><CalendarPlus size={14}/></button>}
                                
                                {/* Botón Liberar */}
                                <button onClick={() => { triggerLiberate(sale.id); }} className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-red-400 hover:text-red-300' : 'text-red-400 hover:text-red-600 bg-white border border-slate-100 hover:border-red-200 shadow-sm'}`}><RotateCcw size={14}/></button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };


    // -------------------------------------------------------------
    // BLOQUE PRINCIPAL DEL DASHBOARD
    // -------------------------------------------------------------
    
    // ✅ LOADER FROSTED GLASS
    if (loadingData) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] bg-white/90 backdrop-blur-xl rounded-[2rem] shadow-2xl border border-white/50 p-10 mx-auto max-w-lg">
                <Loader size={48} className="animate-spin text-indigo-400/80"/>
                <p className="mt-4 text-slate-700 font-extrabold tracking-tight">Cargando Datos Centrales...</p>
                <div className="mt-1 text-sm text-slate-500">Sincronizando Firebase, espere un momento.</div>
            </div>
        );
    }

    return (
        <div className="space-y-4 md:space-y-6 w-full pb-20">
            
            {/* BLOQUE DE FILTROS MINIMALISTA */}
            <div className="bg-white/70 backdrop-blur-xl p-1.5 rounded-[1.5rem] shadow-sm border border-white sticky top-0 z-30">
                <div className="flex flex-col gap-2">
                    
                    {/* BUSCADOR DE PILL (iOS Search Bar Style) */}
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Buscar Cliente o Correo..." className="w-full pl-11 pr-4 h-10 md:h-12 bg-slate-100/70 border border-slate-200/50 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium" value={filterClient} onChange={e => setFilterClient(e.target.value)} />
                    </div>
                    
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {/* SELECTOR DE SERVICIO */}
                        <select className="h-8 md:h-10 px-4 bg-slate-100/70 rounded-xl text-xs font-bold text-slate-600 outline-none border border-slate-200/50 focus:bg-white cursor-pointer min-w-[120px]" value={filterService} onChange={e => setFilterService(e.target.value)}><option value="Todos">Todos</option>{catalog.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                        
                        {/* CONTROL SEGMENTADO (iOS Style Status Filter) */}
                        <div className="flex bg-slate-100/50 p-1 rounded-xl border border-slate-200/50 backdrop-blur-sm shadow-inner text-sm font-semibold">
                            {['Todos', 'Libres', 'Ocupados', 'Problemas'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={`px-4 py-2 rounded-lg transition-all active:scale-[0.98] ${
                                        filterStatus === status
                                            ? 'bg-white text-slate-800 shadow-sm border border-white/50'
                                            : 'text-slate-500 hover:bg-slate-200/70'
                                    }`}
                                >
                                    {status}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* FILTRO AVANZADO DE FECHAS */}
            <div className="flex items-center gap-2 bg-white/70 backdrop-blur-xl p-2 rounded-xl border border-white/50">
                <Calendar size={16} className="text-slate-400 flex-shrink-0"/>
                <span className="text-xs font-bold text-slate-500 uppercase flex-shrink-0">Vence:</span>
                <input type="date" className="bg-slate-100/50 p-1 rounded-lg text-xs font-medium text-slate-700 outline-none w-1/2 cursor-pointer" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <span className="text-slate-400 text-xs">-</span>
                <input type="date" className="bg-slate-100/50 p-1 rounded-lg text-xs font-medium text-slate-700 outline-none w-1/2 cursor-pointer" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                {(dateFrom || dateTo) && (<button onClick={() => {setDateFrom(''); setDateTo('');}} className="p-1 text-red-400 hover:text-red-600 rounded-lg"><X size={14}/></button>)}
            </div>

            {/* CONTADORES */}
            <div className="flex justify-between items-center px-2">
                <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{totalItems} Resultados</div>
                <div className="flex items-center gap-2"><span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Total:</span><span className="text-base md:text-xl font-black text-slate-800 tracking-tight">${totalFilteredMoney.toLocaleString()}</span></div>
            </div>

            {/* ENCABEZADO DE COLUMNAS (PC) */}
            <div className="grid grid-cols-1 gap-2 md:gap-4">
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider pl-8">
                    <div className="col-span-2">Cliente</div>          
                    <div className="col-span-5">Servicio & Detalles</div> 
                    <div className="col-span-1 text-center">Vencimiento</div> 
                    <div className="col-span-2 text-center">Costo</div>        
                    <div className="col-span-2 text-right">Controles</div>    
                </div>

                {/* LISTA DE VENTAS */}
                <div className="space-y-2">
                    {filteredSales.length > 0 ? (
                        filteredSales.map(sale => (
                            <SaleCard key={sale.id} sale={sale} />
                        ))
                    ) : (
                        <div className="text-center py-12 text-slate-400">Sin resultados</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Dashboard;