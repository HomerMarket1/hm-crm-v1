// src/components/MoveHistory.jsx
// 📜 Historial de mudanzas: qué cliente se movió de qué cuenta a cuál (users/{uid}/moveHistory)
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { ArrowRight, Search, X, History, Copy } from 'lucide-react';
import { db } from '../firebase/config';
import Pagination from './Pagination';

const PAGE_SIZE = 20;
const MAX_RECORDS = 500;

const formatDateTime = (ts) => {
    const d = ts?.toDate ? ts.toDate() : null;
    if (!d) return 'Guardando...';
    return d.toLocaleString('es-UY', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const MoveHistory = ({ user, darkMode, theme, sales = [], setNotification }) => {
    // Contraseña ACTUAL de cada cuenta (el historial no guarda contraseñas)
    const passByEmail = useMemo(() => {
        const map = {};
        sales.forEach(s => {
            const email = (s.email || '').trim().toLowerCase();
            if (email && s.pass && !map[email]) map[email] = s.pass;
        });
        return map;
    }, [sales]);

    const copyCredentials = async (acc) => {
        const email = acc?.email || '';
        const pass = passByEmail[email.trim().toLowerCase()] || '';
        try {
            await navigator.clipboard.writeText(pass ? `${email}:${pass}` : email);
            setNotification?.({ show: true, message: pass ? 'Correo y contraseña copiados.' : 'Correo copiado (la cuenta ya no existe, sin contraseña).', type: pass ? 'success' : 'error' });
        } catch {
            setNotification?.({ show: true, message: 'No se pudo copiar al portapapeles.', type: 'error' });
        }
    };

    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (!user) return;
        const q = query(collection(db, `users/${user.uid}/moveHistory`), orderBy('createdAt', 'desc'), limit(MAX_RECORDS));
        return onSnapshot(q, (snap) => {
            setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        }, (err) => { console.error('Error leyendo historial:', err); setLoading(false); });
    }, [user]);

    useEffect(() => { setPage(1); }, [search]);

    const filtered = useMemo(() => {
        const t = search.trim().toLowerCase();
        if (!t) return records;
        return records.filter(r => [r.client, r.phone, r.from?.email, r.to?.email, r.from?.service, r.to?.service]
            .some(v => (v || '').toLowerCase().includes(t)));
    }, [records, search]);

    const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const box = darkMode ? 'bg-black/20 border-white/5' : 'bg-white border-slate-200';

    const Account = ({ acc, label }) => (
        <div className={`flex-1 min-w-0 p-2.5 rounded-xl border flex items-start gap-2 ${box}`}>
            <div className="min-w-0 flex-1">
                <p className={`text-[9px] font-black uppercase tracking-wider ${theme.subtext}`}>{label}</p>
                <p className={`text-xs font-bold truncate ${theme.text}`} title={acc?.email}>{acc?.email || '—'}</p>
                <p className={`text-[10px] font-mono truncate ${theme.subtext}`}>{acc?.service || ''}{acc?.profile ? ` · ${acc.profile}` : ''}</p>
            </div>
            {acc?.email && (
                <button type="button" onClick={() => copyCredentials(acc)} title="Copiar correo y contraseña" aria-label={`Copiar correo y contraseña (${label})`}
                    className={`p-1.5 rounded-lg shrink-0 transition-all active:scale-90 ${darkMode ? 'text-slate-400 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-indigo-600'}`}>
                    <Copy size={14}/>
                </button>
            )}
        </div>
    );

    return (
        <div className={`rounded-[2rem] p-6 border ${theme.card}`}>
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <div>
                    <h2 className={`text-xl font-black ${theme.sectionTitle}`}>Historial de Mudanzas</h2>
                    <p className={`text-xs font-bold uppercase tracking-wider ${theme.subtext}`}>Cambios de cuenta por cliente</p>
                </div>
                <div className="relative group w-full md:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500" size={16}/>
                    <input type="text" placeholder="Cliente, celular o correo..." className={theme.input + ' w-full pl-10 pr-9 py-2 rounded-xl font-bold text-sm outline-none border'} value={search} onChange={e => setSearch(e.target.value)}/>
                    {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"><X size={14}/></button>}
                </div>
            </div>

            {loading ? (
                <p className={`text-center text-xs font-bold py-10 ${theme.subtext}`}>Cargando historial...</p>
            ) : visible.length === 0 ? (
                <div className="text-center py-12">
                    <History size={36} className={`mx-auto mb-2 opacity-30 ${theme.text}`}/>
                    <p className={`text-xs font-bold ${theme.subtext}`}>{search ? `Sin resultados para "${search}"` : 'Aún no hay mudanzas registradas.'}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {visible.map(r => (
                        <div key={r.id} className={`p-3 rounded-2xl border ${theme.itemBg}`}>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <p className={`text-sm font-black truncate ${theme.text}`}>{r.client || 'Sin nombre'}</p>
                                    {r.phone && <span className={`text-[10px] font-mono ${theme.subtext}`}>{r.phone}</span>}
                                </div>
                                <span className={`text-[10px] font-bold ${theme.subtext}`}>{formatDateTime(r.createdAt)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Account acc={r.from} label="Desde" />
                                <ArrowRight size={16} className="text-indigo-500 shrink-0"/>
                                <Account acc={r.to} label="Hacia" />
                            </div>
                            <p className={`text-[10px] mt-2 ${theme.subtext}`}>
                                Cuenta anterior quedó como <span className="font-black text-amber-500">{r.oldAccountStatus || 'LIBRE'}</span>
                                {r.by ? ` · por ${r.by}` : ''}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            <Pagination page={page} pageSize={PAGE_SIZE} totalItems={filtered.length} onPageChange={setPage} darkMode={darkMode} />
            {records.length >= MAX_RECORDS && <p className={`text-[10px] text-center mt-2 ${theme.subtext}`}>Mostrando las últimas {MAX_RECORDS} mudanzas.</p>}
        </div>
    );
};

export default MoveHistory;
