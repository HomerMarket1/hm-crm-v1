// src/components/Pagination.jsx
// Controles de paginación: "1–20 de 543" + ‹ 1 … 4 5 6 … 28 ›
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const getPageNumbers = (current, total) => {
    const sorted = [...new Set([1, total, current - 1, current, current + 1])]
        .filter(n => n >= 1 && n <= total)
        .sort((a, b) => a - b);
    const out = [];
    sorted.forEach((n, i) => {
        if (i > 0 && n - sorted[i - 1] > 1) out.push(`gap-${n}`);
        out.push(n);
    });
    return out;
};

const Pagination = ({ page, pageSize, totalItems, onPageChange, darkMode }) => {
    if (totalItems === 0) return null;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const start = (page - 1) * pageSize;

    const btnBase = darkMode ? 'bg-[#161B28] border-white/5 text-white' : 'bg-white border-slate-200 text-slate-700';
    const subText = darkMode ? 'text-slate-400' : 'text-slate-500';

    return (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 px-1">
            <span className={`text-xs font-bold ${subText}`}>
                {start + 1}–{Math.min(start + pageSize, totalItems)} de {totalItems}
            </span>
            {totalPages > 1 && (
                <div className="flex items-center gap-1">
                    <button disabled={page === 1} onClick={() => onPageChange(page - 1)} className={`p-2 rounded-lg border disabled:opacity-30 ${btnBase}`}><ChevronLeft size={14}/></button>
                    {getPageNumbers(page, totalPages).map(n => typeof n === 'string' ? (
                        <span key={n} className={`px-1 text-xs ${subText}`}>…</span>
                    ) : (
                        <button key={n} onClick={() => onPageChange(n)} className={`min-w-[32px] py-1.5 rounded-lg text-xs font-black border transition-all ${n === page ? 'bg-indigo-600 border-indigo-600 text-white' : `${btnBase} hover:border-indigo-500/50`}`}>{n}</button>
                    ))}
                    <button disabled={page === totalPages} onClick={() => onPageChange(page + 1)} className={`p-2 rounded-lg border disabled:opacity-30 ${btnBase}`}><ChevronRight size={14}/></button>
                </div>
            )}
        </div>
    );
};

export default Pagination;
