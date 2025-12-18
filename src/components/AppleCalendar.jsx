// src/components/AppleCalendar.jsx
import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalIcon, X } from 'lucide-react';

const AppleCalendar = ({ value, onChange, label, darkMode, ghost = false }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [viewDate, setViewDate] = useState(new Date());

    useEffect(() => {
        if (value) {
            const [y, m, d] = value.split('-').map(Number);
            setViewDate(new Date(y, m - 1, d));
        }
    }, [showPicker]);

    // Helpers
    const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();
    const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
    const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
    
    const handleSelectDay = (day) => {
        const month = viewDate.getMonth() + 1;
        const year = viewDate.getFullYear();
        const formattedDate = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        onChange(formattedDate);
        setShowPicker(false);
    };

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const weekDays = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

    // 🎨 TEMA DINÁMICO
    const theme = {
        // Si es GHOST (Fantasma), quitamos fondos y bordes
        inputContainer: ghost 
            ? 'bg-transparent border-none px-0 py-1' 
            : (darkMode ? 'bg-black/20 border-white/5 px-4 py-3.5 border' : 'bg-slate-50 border-slate-200 px-4 py-3.5 border'),
        
        inputText: darkMode ? 'text-white' : 'text-slate-700',
        placeholder: darkMode ? 'text-slate-500' : 'text-slate-400',
        iconColor: darkMode ? 'text-slate-400' : 'text-slate-400',
        
        // Popup siempre mantiene su estilo flotante
        popupBg: darkMode ? 'bg-[#161B28] border-white/10 shadow-black/50' : 'bg-white border-white/60 shadow-xl',
        
        dayHover: darkMode ? 'hover:bg-white/10' : 'hover:bg-slate-100',
        daySelected: 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30',
        textPrimary: darkMode ? 'text-white' : 'text-slate-800',
    };

    const renderDays = () => {
        const totalDays = daysInMonth(viewDate.getMonth(), viewDate.getFullYear());
        const startDay = firstDayOfMonth(viewDate.getMonth(), viewDate.getFullYear());
        const blanks = Array(startDay).fill(null);
        const days = Array.from({ length: totalDays }, (_, i) => i + 1);
        const today = new Date();
        const isCurrentMonth = today.getMonth() === viewDate.getMonth() && today.getFullYear() === viewDate.getFullYear();

        return [...blanks, ...days].map((day, i) => {
            if (!day) return <div key={`blank-${i}`} className="w-8 h-8" />;
            let isSelected = false;
            if (value) {
                const [y, m, d] = value.split('-').map(Number);
                if (d === day && m - 1 === viewDate.getMonth() && y === viewDate.getFullYear()) isSelected = true;
            }
            return (
                <button key={day} onClick={(e) => { e.preventDefault(); handleSelectDay(day); }} className={`w-8 h-8 rounded-full text-xs font-bold flex items-center justify-center transition-all ${isSelected ? theme.daySelected : theme.dayHover} ${!isSelected ? theme.textPrimary : ''} ${!isSelected && isCurrentMonth && day === today.getDate() ? 'border border-indigo-500 text-indigo-500' : ''}`}>{day}</button>
            );
        });
    };

    return (
        <div className="relative w-full">
            {/* INPUT VISUAL */}
            <div onClick={() => setShowPicker(!showPicker)} className={`w-full rounded-xl font-bold text-xs outline-none transition-all cursor-pointer flex items-center gap-2 ${theme.inputContainer}`}>
                {/* Icono: Si es ghost, lo hacemos más pequeño */}
                <CalIcon size={ghost ? 14 : 18} className={theme.iconColor} />
                
                <span className={`truncate ${value ? theme.inputText : theme.placeholder}`}>
                    {value ? value.split('-').reverse().join('/') : label || 'Fecha'}
                </span>
            </div>

            {/* POPUP */}
            {showPicker && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPicker(false)} />
                    <div className={`absolute top-full mt-2 left-0 z-50 p-4 rounded-[24px] border backdrop-blur-xl w-[280px] animate-in zoom-in-95 duration-200 ${theme.popupBg}`}>
                        <div className="flex justify-between items-center mb-4 px-1">
                            <button onClick={(e) => { e.preventDefault(); handlePrevMonth(); }} className={`p-1 rounded-full hover:bg-white/10 ${theme.textPrimary}`}><ChevronLeft size={18}/></button>
                            <span className={`font-black text-xs capitalize ${theme.textPrimary}`}>{months[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
                            <button onClick={(e) => { e.preventDefault(); handleNextMonth(); }} className={`p-1 rounded-full hover:bg-white/10 ${theme.textPrimary}`}><ChevronRight size={18}/></button>
                        </div>
                        <div className="grid grid-cols-7 mb-2 text-center text-[10px] font-bold text-slate-500">{weekDays.map((d,i) => <span key={i}>{d}</span>)}</div>
                        <div className="grid grid-cols-7 gap-1 place-items-center">{renderDays()}</div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AppleCalendar;