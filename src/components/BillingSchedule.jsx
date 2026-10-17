// src/components/BillingSchedule.jsx
// ⏰ Horario de cobranzas automáticas del Bot de WhatsApp.
// Guarda users/{uid}/config/billing; el bot lo escucha y reprograma su cron al instante.
// El bot informa cada ejecución en users/{uid}/config/billingStatus.
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Clock, Save } from 'lucide-react';
import { db } from '../firebase/config';

const DEFAULTS = { enabled: true, weekdayTime: '10:00', weekendTime: '12:00' };

const formatDateTime = (ts) => {
    const d = ts?.toDate ? ts.toDate() : (ts ? new Date(ts) : null);
    if (!d || Number.isNaN(d.getTime())) return null;
    return d.toLocaleString('es-UY', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const BillingSchedule = ({ user, darkMode, theme, setNotification }) => {
    const [form, setForm] = useState(DEFAULTS);
    const [saved, setSaved] = useState(DEFAULTS);
    const [status, setStatus] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user) return;
        const unsubConfig = onSnapshot(doc(db, `users/${user.uid}/config/billing`), (snap) => {
            const data = { ...DEFAULTS, ...(snap.exists() ? snap.data() : {}) };
            setSaved(data);
            setForm(data);
        });
        const unsubStatus = onSnapshot(doc(db, `users/${user.uid}/config/billingStatus`), (snap) => {
            setStatus(snap.exists() ? snap.data() : null);
        });
        return () => { unsubConfig(); unsubStatus(); };
    }, [user]);

    const isDirty = form.enabled !== saved.enabled || form.weekdayTime !== saved.weekdayTime || form.weekendTime !== saved.weekendTime;

    const handleSave = async () => {
        if (!form.weekdayTime || !form.weekendTime) {
            setNotification({ show: true, message: 'Completa las dos horas de cobro.', type: 'error' });
            return;
        }
        setSaving(true);
        try {
            await setDoc(doc(db, `users/${user.uid}/config/billing`), {
                enabled: form.enabled, weekdayTime: form.weekdayTime, weekendTime: form.weekendTime,
                timezone: 'America/Montevideo', updatedAt: serverTimestamp()
            }, { merge: true });
            setNotification({ show: true, message: 'Horario de cobranzas guardado. El bot lo aplica al instante.', type: 'success' });
        } catch (e) {
            console.error(e);
            setNotification({ show: true, message: 'No se pudo guardar el horario.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // ¿El bot ya tomó el horario guardado?
    const botApplied = status && status.weekdayTime === saved.weekdayTime && status.weekendTime === saved.weekendTime
        && status.scheduled === saved.enabled;
    const lastRun = formatDateTime(status?.lastRunAt);
    const box = darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200';

    return (
        <div className={`rounded-[2rem] overflow-hidden border ${theme.card}`}>
            <div className={`px-4 sm:px-6 py-4 border-b ${theme.cardHeader} flex flex-wrap items-center justify-between gap-2`}>
                <h3 className={`font-black text-xs uppercase tracking-wider ${theme.subtext} flex items-center gap-2`}><Clock size={14}/> Cobranzas automáticas (Bot WhatsApp)</h3>
                {status && (
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${botApplied ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                        {botApplied ? (saved.enabled ? 'BOT PROGRAMADO' : 'BOT EN PAUSA') : 'ESPERANDO AL BOT'}
                    </span>
                )}
            </div>
            <div className="p-4 sm:p-6 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input type="checkbox" className="accent-emerald-500 w-4 h-4 mt-0.5" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} />
                    <div>
                        <p className={`text-sm font-bold ${theme.text}`}>Enviar recordatorios de cobro automáticamente</p>
                        <p className={`text-xs ${theme.subtext}`}>El bot avisa a los clientes que vencen hoy y mañana, agrupando todos sus servicios en un mensaje.</p>
                    </div>
                </label>

                <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 transition-opacity ${form.enabled ? '' : 'opacity-40 pointer-events-none'}`}>
                    {[
                        { key: 'weekdayTime', label: 'Lunes a Viernes' },
                        { key: 'weekendTime', label: 'Sábados y Domingos' }
                    ].map(({ key, label }) => (
                        <div key={key} className={`p-3 rounded-xl border ${box}`}>
                            <label className={`text-[10px] font-bold uppercase ${theme.subtext}`}>{label}</label>
                            <input type="time" required className={theme.input + ' w-full mt-1 px-3 py-2 rounded-xl font-black text-lg outline-none border'} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
                        </div>
                    ))}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <p className="text-[10px] text-slate-500">
                        Hora de Uruguay (America/Montevideo).
                        {lastRun ? ` Última ejecución: ${lastRun} · ${status.lastRunSent ?? 0} enviados${status.lastRunFailed ? ` · ${status.lastRunFailed} fallidos` : ''}${status.lastRunError ? ` · ${status.lastRunError}` : ''}.` : ' Aún no hay ejecuciones registradas.'}
                    </p>
                    <button onClick={handleSave} disabled={!isDirty || saving} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                        <Save size={14}/> {saving ? 'Guardando...' : 'Guardar horario'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BillingSchedule;
