// src/components/AppleCalendar.jsx
import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

const AppleCalendar = ({ value, onChange, label = "Fecha", darkMode, ghost = false }) => {
    const [show, setShow] = useState(false);
    const [currentDate, setCurrentDate] = useState(new Date());
    const wrapperRef = useRef(null);

    const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    useEffect(() => {
        if (value) {
            const [y, m, d] = value.split('-').map(Number);
            setCurrentDate(new Date(y, m - 1, d));
        }
    }, [show, value]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) { setShow(false); }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getDaysInMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    const getFirstDayOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    
    const handlePrevMonth = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleDayClick = (day) => {
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        onChange(`${year}-${month}-${dayStr}`);
        setShow(false);
    };

    const getTargetDay = () => {
        if (value) { const [,, d] = value.split('-').map(Number); return d; }
        return new Date().getDate(); 
    };
    const targetDay = getTargetDay();

    const renderDays = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];
        for (let i = 0; i < firstDay; i++) { days.push(<div key={`empty-${i}`} className="h-7 w-7 md:h-8 md:w-8" />); }
        for (let i = 1; i <= daysInMonth; i++) {
            const isSelected = value === `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const isToday = i === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
            const isTargetGhost = i === targetDay && !isSelected;

            let dayClass = `h-7 w-7 md:h-8 md:w-8 flex items-center justify-center rounded-full text-[10px] md:text-xs font-bold transition-all cursor-pointer select-none `;
            
            if (isSelected) { dayClass += darkMode ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/50 scale-110' : 'bg-black text-white shadow-lg scale-110'; } 
            else if (isTargetGhost) { dayClass += darkMode ? 'border border-indigo-400 text-indigo-400 bg-indigo-400/10' : 'border border-indigo-600 text-indigo-600 bg-indigo-50'; } 
            else if (isToday) { dayClass += darkMode ? 'bg-white/10 text-indigo-400' : 'bg-slate-100 text-indigo-600'; } 
            else { dayClass += darkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-black'; }

            days.push(<div key={i} onClick={() => handleDayClick(i)} className="flex items-center justify-center"><div className={dayClass}>{i}</div></div>);
        }
        return days;
    };

    const containerClass = darkMode ? 'bg-[#1C1C1E] border border-white/10 shadow-2xl shadow-black/50 text-white' : 'bg-white border border-slate-200 shadow-2xl shadow-indigo-500/10 text-slate-800';
    const triggerClass = darkMode ? 'bg-white/5 border-white/5 hover:bg-white/10 text-slate-300' : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-600';
    const valueTextClass = value ? (darkMode ? 'text-white' : 'text-slate-800') : '';

    return (
        <div className="relative w-full" ref={wrapperRef}>
            {ghost ? (
                <div onClick={() => setShow(!show)} className={`cursor-pointer group relative rounded-xl pl-3 pr-2 py-2 border transition-all flex items-center justify-between gap-2 ${triggerClass}`}>
                    <span className={`text-[10px] md:text-xs font-bold truncate ${valueTextClass}`}>
                        {value ? value.split('-').reverse().join('/') : label}
                    </span>
                    <CalendarIcon size={14} className={`text-slate-400 group-hover:text-indigo-500 transition-colors ${value ? 'text-indigo-500' : ''}`}/>
                </div>
            ) : (
                <div className="flex flex-col gap-1">
                    <label className={`text-xs font-bold ml-1 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{label}</label>
                    <button type="button" onClick={() => setShow(!show)} className={`w-full h-[52px] px-4 rounded-2xl font-bold text-sm flex items-center justify-between transition-all outline-none border focus:ring-2 focus:ring-indigo-500/50 ${darkMode ? 'bg-black/20 border-white/10 text-white hover:bg-white/5' : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'}`}>
                        <span>{value ? value.split('-').reverse().join('/') : 'Seleccionar Fecha'}</span>
                        <CalendarIcon size={16} className="text-slate-400"/>
                    </button>
                </div>
            )}

            {show && (
                <>
                    {/* Fondo oscuro para mobile - Evita distracciones y ayuda a cerrar */}
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[998] md:hidden" onClick={() => setShow(false)} />
                    
                    <div className={`
                        /* Posicionamiento Inteligente */
                        fixed md:absolute 
                        z-[999] 
                        mt-2
                        
                        /* Mobile: Centrado exacto / Desktop: Bajo el input */
                        inset-x-4 top-1/2 -translate-y-1/2
                        md:inset-x-auto md:top-full md:left-0 md:translate-y-0
                        
                        /* Dimensiones y Estilo */
                        w-auto max-w-[280px] mx-auto md:mx-0
                        p-4 rounded-[32px] 
                        animate-in fade-in zoom-in-95 duration-200 
                        ${containerClass}
                    `}>
                        <div className="flex items-center justify-between mb-3 px-1">
                            <button type="button" onClick={handlePrevMonth} className={`p-2 rounded-full hover:scale-110 transition-transform ${darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
                                <ChevronLeft size={18}/>
                            </button>
                            
                            <span className="text-sm font-black capitalize tracking-tight">
                                {months[currentDate.getMonth()]} <span className="text-indigo-500">{currentDate.getFullYear()}</span>
                            </span>
                            
                            <button type="button" onClick={handleNextMonth} className={`p-2 rounded-full hover:scale-110 transition-transform ${darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100'}`}>
                                <ChevronRight size={18}/>
                            </button>
                        </div>
                        
                        <div className="grid grid-cols-7 mb-1">
                            {weekDays.map(day => (<div key={day} className="h-6 flex items-center justify-center text-[10px] font-black text-slate-500">{day}</div>))}
                        </div>
                        
                        <div className="grid grid-cols-7 gap-y-1">
                            {renderDays()}
                        </div>
                        
                        <div className="mt-4 pt-2 border-t border-dashed border-slate-500/20 flex flex-col gap-2">
                            {value && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); onChange(''); setShow(false); }} className="text-[10px] font-bold text-rose-500 hover:text-rose-400 flex items-center justify-center gap-1 py-2 rounded-xl hover:bg-rose-500/10 transition-colors">
                                    <X size={12}/> Limpiar Fecha
                                </button>
                            )}
                            {/* Botón de cerrar explícito para mobile */}
                            <button type="button" onClick={() => setShow(false)} className="md:hidden w-full py-3 rounded-2xl bg-slate-100 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest text-slate-500">
                                Cerrar
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AppleCalendar;