// src/components/SegmentedTabs.jsx
// Barra de pestañas reutilizable y responsive:
// - Escritorio: botones del mismo ancho, en una sola fila.
// - Celular: se desplaza horizontalmente (sin cortar textos en dos líneas).
import React from 'react';

/**
 * tabs: [{ id, label, shortLabel?, icon?, count?, activeText? }]
 * size: 'md' (sub-pestañas) | 'sm' (pestañas internas)
 */
const SegmentedTabs = ({ tabs, value, onChange, darkMode, size = 'md', className = '' }) => {
    const pad = size === 'sm' ? 'px-3 py-2 text-[11px]' : 'px-4 py-2.5 text-xs';
    const track = darkMode ? 'bg-[#0B0F19] border-white/5' : 'bg-white border-slate-200 shadow-sm';

    return (
        <div className={`w-full overflow-x-auto no-scrollbar ${className}`} role="tablist">
            <div className={`inline-flex min-w-full gap-1 p-1 rounded-2xl border ${track}`}>
                {tabs.map(({ id, label, shortLabel, icon: Icon, count, activeText = 'text-indigo-400' }) => {
                    const active = value === id;
                    const activeStyle = darkMode
                        ? `bg-[#161B28] border border-white/10 shadow-sm ${activeText}`
                        : 'bg-slate-900 text-white shadow';
                    const idleStyle = darkMode
                        ? 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50';
                    return (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => onChange(id)}
                            className={`flex-1 shrink-0 whitespace-nowrap rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${pad} ${active ? activeStyle : idleStyle}`}
                        >
                            {Icon && <Icon size={size === 'sm' ? 13 : 14} className="shrink-0" />}
                            {shortLabel ? (
                                <>
                                    <span className="sm:hidden">{shortLabel}</span>
                                    <span className="hidden sm:inline">{label}</span>
                                </>
                            ) : label}
                            {count !== undefined && (
                                <span className={`min-w-[20px] px-1.5 py-0.5 rounded-md text-[10px] leading-none ${active ? (darkMode ? 'bg-white/10' : 'bg-white/20') : (darkMode ? 'bg-white/5' : 'bg-slate-100')}`}>{count}</span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default SegmentedTabs;
