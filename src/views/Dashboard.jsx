// src/views/Dashboard.jsx
import React from 'react';
import { 
    Search, Plus, Smartphone, MessageCircle, Lock, Key, Trash2, Edit2, Ban, XCircle, 
    CheckCircle, Filter, DollarSign, RotateCcw, X, MoreVertical, Menu, 
    RefreshCw, Globe, Shield, Skull, CalendarPlus, ChevronRight, AlertTriangle, Calendar 
} from 'lucide-react';

const Dashboard = ({
    sales, // Se necesita para el wrapper de sendWhatsApp
    filteredSales,
    catalog, // Se necesita para el wrapper de sendWhatsApp
    filterClient, setFilterClient,
    filterService, setFilterService,
    filterStatus, setFilterStatus,
    dateFrom, setDateFrom,
    dateTo, setDateTo,
    totalItems, totalFilteredMoney,
    getStatusIcon, getStatusColor,
    getDaysRemaining,
    sendWhatsApp, // Función wrapper de App.jsx
    handleQuickRenew,
    triggerLiberate, 
    setFormData, setView,
    openMenuId, setOpenMenuId,
    setBulkProfiles,
    NON_BILLABLE_STATUSES // Lista de estados no cobrables
}) => {

    return (
        <div className="space-y-4 md:space-y-6 w-full pb-20">
            <div className="bg-white/70 backdrop-blur-xl p-1.5 rounded-[1.5rem] shadow-sm border border-white sticky top-0 z-30">
                <div className="flex flex-col gap-2">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input type="text" placeholder="Buscar Cliente o Correo..." className="w-full pl-11 pr-4 h-10 md:h-12 bg-slate-100/50 border-none rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all text-sm font-medium" value={filterClient} onChange={e => setFilterClient(e.target.value)} />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <select className="h-8 md:h-10 px-4 bg-slate-100/50 rounded-xl text-xs font-bold text-slate-600 outline-none border-none focus:bg-white cursor-pointer min-w-[120px]" value={filterService} onChange={e => setFilterService(e.target.value)}><option value="Todos">Todos</option>{catalog.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}</select>
                        <div className="flex bg-slate-100/50 p-1 rounded-xl h-8 md:h-10 flex-shrink-0">
                            {['Todos', 'Libres', 'Ocupados', 'Problemas'].map(status => (
                                <button key={status} onClick={() => setFilterStatus(status)} className={`px-3 md:px-4 rounded-lg text-[10px] md:text-xs font-bold transition-all ${filterStatus === status ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>{status}</button>
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

            <div className="flex justify-between items-center px-2">
                <div className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">{totalItems} Resultados</div>
                <div className="flex items-center gap-2"><span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase">Total:</span><span className="text-base md:text-xl font-black text-slate-800 tracking-tight">${totalFilteredMoney.toLocaleString()}</span></div>
            </div>

            <div className="grid grid-cols-1 gap-2 md:gap-4">
                <div className="hidden md:grid grid-cols-12 gap-4 px-6 text-xs font-bold text-slate-400 uppercase tracking-wider pl-8">
                    <div className="col-span-3">Cliente</div>
                    <div className="col-span-4">Servicio & Detalles</div>
                    <div className="col-span-2 text-center">Vencimiento</div>
                    <div className="col-span-1 text-center">Costo</div>
                    <div className="col-span-2 text-right">Controles</div>
                </div>

                {filteredSales.map((sale) => {
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
                                
                                <div className="col-span-12 md:col-span-3 w-full flex items-center gap-3">
                                    <div className={`w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-2xl flex items-center justify-center text-lg md:text-xl font-bold shadow-sm flex-shrink-0 ${getStatusColor(sale.client)}`}>{getStatusIcon(sale.client)}</div>
                                    <div className="flex-1 overflow-hidden">
                                        <div className={`font-bold text-sm md:text-base truncate leading-tight ${isAdmin ? 'text-white' : 'text-slate-900'}`}>{isFree ? 'Cupo Disponible' : sale.client}</div>
                                        <div className={`text-[10px] md:text-xs font-medium mt-0.5 truncate ${isAdmin ? 'text-slate-400' : 'text-slate-500'}`}>{sale.service}</div>
                                        {!isFree && !isProblem && <div className="text-[10px] text-blue-500 font-bold mt-1 md:hidden flex items-center gap-1"><Smartphone size={10}/> {sale.phone}</div>}
                                    </div>
                                    <div className={`text-sm font-bold md:hidden ${isAdmin ? 'text-white' : 'text-slate-700'}`}>${(isFree || isProblem || isAdmin) ? 0 : sale.cost}</div>
                                </div>

                                <div className="col-span-12 md:col-span-4 w-full flex flex-col justify-center">
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

                                <div className="col-span-6 md:col-span-2 w-full text-left md:text-center flex items-center md:block gap-2">
                                    {!isFree && !isProblem ? (
                                        <>
                                            <div className={`text-xs md:text-sm font-bold ${days <= 3 ? 'text-amber-500' : (isAdmin ? 'text-white' : 'text-slate-800')}`}>{sale.endDate ? sale.endDate.split('-').reverse().slice(0,2).join('/') : '--'}</div>
                                            <div className="text-[10px] font-bold text-slate-400 uppercase md:mt-0.5">{days} Días Rest.</div>
                                        </>
                                    ) : <span className="text-slate-400 text-[10px] font-bold bg-slate-100 px-2 py-1 rounded-full">{isFree ? 'LIBRE' : 'N/A'}</span>}
                                </div>

                                <div className="hidden md:block col-span-1 text-center">
                                    <div className={`text-sm font-bold ${isAdmin ? 'text-white' : 'text-slate-700'}`}>${(isFree || isProblem || isAdmin) ? 0 : sale.cost}</div>
                                </div>

                                {/* CONTROLES */}
                                <div className="col-span-12 md:col-span-2 w-full flex justify-end pt-2 md:pt-0 border-t border-black/5 md:border-none mt-1 md:mt-0 relative">
                                    {isFree ? (
                                        <button onClick={() => { setFormData(sale); setView('form'); }} className="h-8 md:h-9 w-full md:w-auto px-4 bg-black text-white rounded-lg font-bold text-xs shadow-md flex items-center justify-center gap-2 active:scale-95">Asignar <ChevronRight size={12}/></button>
                                    ) : (
                                        <>
                                            {/* Botón de Menú (Solo Visible en Móvil/Tablet) */}
                                            <div className="flex md:hidden absolute right-0 top-1/2 transform -translate-y-1/2 mr-2 z-20">
                                                <button onClick={() => setOpenMenuId(openMenuId === sale.id ? null : sale.id)} className={`w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 active:scale-95 transition-all ${openMenuId === sale.id ? 'bg-slate-100' : 'bg-transparent'}`}><MoreVertical size={16}/></button>
                                            </div>
                                            
                                            {/* Controles en PC (Visibles) / Controles en Móvil (Retráctil) */}
                                            <div className={`absolute md:relative top-full md:top-0 right-0 md:right-0 bg-white md:bg-transparent rounded-xl md:p-0 transition-all duration-200 shadow-xl md:shadow-none p-2 space-x-1 z-50 ${openMenuId === sale.id || window.innerWidth >= 768 ? 'flex flex-col md:flex-row' : 'hidden md:flex'}`}>
                                                
                                                <div className="flex gap-1 md:space-x-1 md:w-auto">
                                                    {!isProblem && days <= 3 && (<button onClick={() => sendWhatsApp(sale, days <= 0 ? 'expired_today' : 'warning_tomorrow')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center border shadow-sm transition-colors ${days <= 0 ? 'bg-red-50 text-red-500 border-red-100 hover:bg-red-100' : 'bg-amber-50 text-amber-500 border-amber-100 hover:bg-amber-100'}`}>{days <= 0 ? <XCircle size={14}/> : <Ban size={14}/>}</button>)}
                                                    {!isProblem && <button onClick={() => sendWhatsApp(sale, 'account_details')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-blue-600 bg-white border border-slate-100 hover:border-blue-200 shadow-sm'}`}><Key size={14}/></button>}
                                                    {!isProblem && sale.type === 'Perfil' && <button onClick={() => sendWhatsApp(sale, 'profile_details')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-blue-600 bg-white border border-slate-100 hover:border-blue-200 shadow-sm'}`}><Lock size={14}/></button>}
                                                </div>
                                                <div className={`flex gap-1 pl-1 ${isAdmin ? 'border-l border-slate-600' : 'border-l border-slate-100'} md:space-x-1 md:border-none md:w-auto`}>
                                                    <button onClick={() => { setFormData({...sale, profilesToBuy: 1}); setBulkProfiles([{ profile: sale.profile, pin: sale.pin }]); setView('form'); setOpenMenuId(null); }} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800 bg-white border border-slate-100 hover:border-slate-300 shadow-sm'}`}><Edit2 size={14}/></button>
                                                    {!isProblem && <button onClick={() => { handleQuickRenew(sale.id); setOpenMenuId(null); }} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-emerald-500 hover:text-emerald-400' : 'text-emerald-500 hover:text-emerald-700 bg-white border border-slate-100 hover:border-emerald-200 shadow-sm'}`}><CalendarPlus size={14}/></button>}
                                                    <button onClick={() => { triggerLiberate(sale.id); setOpenMenuId(null); }} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center transition-all ${isAdmin ? 'text-red-400 hover:text-red-300' : 'text-red-400 hover:text-red-600 bg-white border border-slate-100 hover:border-red-200 shadow-sm'}`}><RotateCcw size={14}/></button>
                                                </div>
                                                
                                                {/* BOTÓN CERRAR MENÚ (Solo en Móvil) */}
                                                {openMenuId === sale.id && (<button onClick={() => setOpenMenuId(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 md:hidden"><X size={16}/></button>)}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                {filteredSales.length === 0 && <div className="text-center py-12 text-slate-400">Sin resultados</div>}
            </div>
        </div>
    );
};

export default Dashboard;