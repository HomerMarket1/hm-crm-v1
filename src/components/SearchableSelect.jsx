// src/components/SearchableSelect.jsx
// Selector con buscador en vivo. value === allValue significa "sin filtro" / "sin elegir".
// - Como filtro (Tablero): muestra la opción "Todos los Servicios" y se pinta de morado al filtrar.
// - Como campo de formulario (Bóveda): showAllOption={false}, highlightActive={false}, size="lg".
import React, { useState, useMemo, useRef } from 'react';
import { Search, X } from 'lucide-react';

const SearchableSelect = ({
    value, options, onChange, darkMode, disabled = false,
    allValue = 'Todos', allLabel = 'Todos los Servicios', placeholder = 'Buscar servicio...',
    showAllOption = true, highlightActive = true, size = 'sm', clearable = true
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const inputRef = useRef(null);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? options.filter(o => o.toLowerCase().includes(q)) : options;
    }, [options, query]);

    const isActive = value !== allValue && value !== '' && value != null;
    const painted = highlightActive && isActive && !open;

    const select = (v) => {
        onChange(v);
        inputRef.current?.blur();
    };

    const sizeCls = size === 'lg'
        ? 'pl-11 pr-10 py-4 rounded-2xl text-sm font-semibold'
        : 'pl-9 pr-8 py-2.5 rounded-xl text-xs font-bold';
    const inputTheme = painted
        ? 'bg-indigo-600 text-white border-indigo-500 placeholder-white'
        : (darkMode
            ? `bg-[#0B0F19] border-[#1E293B] text-white focus:border-cyan-400 ${isActive ? 'placeholder-white' : 'placeholder-slate-500'}`
            : `bg-white text-slate-700 border-slate-200 focus:border-indigo-500 ${isActive ? 'placeholder-slate-700' : 'placeholder-slate-400'}`);
    const menuTheme = darkMode ? 'bg-[#0B0F19] border-white/10' : 'bg-white border-slate-200';
    const itemText = darkMode ? 'text-slate-200' : 'text-slate-700';
    const itemPad = size === 'lg' ? 'px-4 py-2.5 text-sm' : 'px-4 py-2 text-xs';

    return (
        <div className={`relative w-full ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <Search size={size === 'lg' ? 16 : 14} className={`absolute ${size === 'lg' ? 'left-4' : 'left-3'} top-1/2 -translate-y-1/2 pointer-events-none ${painted ? 'text-white' : 'text-slate-400'}`}/>
            <input
                ref={inputRef}
                type="text"
                disabled={disabled}
                className={`w-full border transition-all outline-none shadow-sm ${sizeCls} ${inputTheme}`}
                placeholder={open ? placeholder : (isActive ? value : allLabel)}
                value={open ? query : (isActive ? value : '')}
                onFocus={() => { setOpen(true); setQuery(''); }}
                onBlur={() => setOpen(false)}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => {
                    if (e.key === 'Escape') e.currentTarget.blur();
                    if (e.key === 'Enter') {
                        e.preventDefault(); // no enviar el formulario al elegir
                        if (matches.length > 0) select(matches[0]);
                    }
                }}
            />
            {clearable && isActive && !open && (
                <button type="button" onClick={() => onChange(allValue)} title="Quitar" className={`absolute right-3 top-1/2 -translate-y-1/2 ${painted ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-rose-500'}`}><X size={14}/></button>
            )}
            {open && (
                <div className={`absolute z-50 mt-1 w-full min-w-[220px] max-h-64 overflow-y-auto rounded-2xl border shadow-2xl py-1 custom-scrollbar ${menuTheme}`}>
                    {showAllOption && !query && (
                        <button type="button" onMouseDown={e => { e.preventDefault(); select(allValue); }} className={`w-full text-left font-bold hover:bg-indigo-500/10 ${itemPad} ${!isActive ? 'text-indigo-400' : itemText}`}>{allLabel}</button>
                    )}
                    {matches.map(name => (
                        <button type="button" key={name} onMouseDown={e => { e.preventDefault(); select(name); }} className={`w-full text-left font-bold hover:bg-indigo-500/10 ${itemPad} ${value === name ? 'text-indigo-400' : itemText}`}>{name}</button>
                    ))}
                    {matches.length === 0 && <p className="px-4 py-3 text-xs text-slate-500">Sin resultados</p>}
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
