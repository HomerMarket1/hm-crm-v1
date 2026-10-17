// src/components/BusinessHours.jsx
// 🕰️ Horario de atención y Modo viaje del Bot de WhatsApp.
// Guarda users/{uid}/config/businessHours; el bot (src/businessHours.js) lo valida y aplica al instante.
// El bot confirma lo aplicado en users/{uid}/config/businessHoursStatus.
import React, { useState, useEffect, useMemo } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { Store, Plane, Save, RotateCcw } from 'lucide-react';
import { db } from '../firebase/config';

const TIMEZONE = 'America/Montevideo';
const DAYS = [ // orden de la semana empezando el lunes; key = día de JS (0 = domingo)
    { key: '1', label: 'Lunes' }, { key: '2', label: 'Martes' }, { key: '3', label: 'Miércoles' },
    { key: '4', label: 'Jueves' }, { key: '5', label: 'Viernes' }, { key: '6', label: 'Sábado' }, { key: '0', label: 'Domingo' }
];
// Mismo horario por defecto que el bot (el histórico)
const DEFAULTS = {
    schedule: {
        0: { open: false, from: '10:00', to: '22:00' },
        1: { open: true, from: '10:00', to: '22:00' }, 2: { open: true, from: '10:00', to: '22:00' },
        3: { open: true, from: '10:00', to: '22:00' }, 4: { open: true, from: '10:00', to: '22:00' },
        5: { open: true, from: '10:00', to: '22:00' },
        6: { open: true, from: '12:00', to: '20:00' }
    },
    travelMode: { enabled: false, until: '', returnText: 'el jueves a primera hora' }
};

const HOUR = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMinutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

const merge = (data = {}) => {
    const schedule = {};
    for (let d = 0; d <= 6; d++) schedule[d] = { ...DEFAULTS.schedule[d], ...((data.schedule || {})[d] || {}) };
    return { schedule, travelMode: { ...DEFAULTS.travelMode, ...(data.travelMode || {}) } };
};

// Hora actual en Uruguay (para mostrar "Ahora: Abierto / Cerrado")
const nowInUruguay = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
    }).formatToParts(new Date()).map(x => [x.type, x.value]));
    const days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { day: days[p.weekday], minutes: Number(p.hour) * 60 + Number(p.minute), dateISO: `${p.year}-${p.month}-${p.day}` };
};

const BusinessHours = ({ user, darkMode, theme, setNotification }) => {
    const [form, setForm] = useState(merge());
    const [saved, setSaved] = useState(merge());
    const [savedAt, setSavedAt] = useState(null);
    const [status, setStatus] = useState(null);
    const [saving, setSaving] = useState(false);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        if (!user) return;
        const unsubCfg = onSnapshot(doc(db, `users/${user.uid}/config/businessHours`), (snap) => {
            const data = snap.exists() ? snap.data() : {};
            const merged = merge(data);
            setSaved(merged);
            setForm(merged);
            setSavedAt(data.updatedAt || null);
        });
        const unsubStatus = onSnapshot(doc(db, `users/${user.uid}/config/businessHoursStatus`), (snap) => setStatus(snap.exists() ? snap.data() : null));
        const timer = setInterval(() => setTick(t => t + 1), 60000); // refresca "Ahora: abierto/cerrado"
        return () => { unsubCfg(); unsubStatus(); clearInterval(timer); };
    }, [user]);

    // 🛡️ Validación (el bot vuelve a validar por su cuenta)
    const errors = useMemo(() => {
        const e = {};
        DAYS.forEach(({ key }) => {
            const d = form.schedule[key];
            if (!d.open) return;
            if (!HOUR.test(d.from) || !HOUR.test(d.to)) e[key] = 'Hora incompleta';
            else if (toMinutes(d.from) >= toMinutes(d.to)) e[key] = 'La apertura debe ser antes del cierre';
        });
        if (form.travelMode.enabled && !form.travelMode.returnText.trim()) e.travel = 'Indica cuándo vuelve la atención';
        return e;
    }, [form]);

    const isDirty = JSON.stringify(form) !== JSON.stringify(saved);
    const hasErrors = Object.keys(errors).length > 0;

    const setDay = (key, field, value) => setForm(f => ({ ...f, schedule: { ...f.schedule, [key]: { ...f.schedule[key], [field]: value } } }));
    const setTravel = (field, value) => setForm(f => ({ ...f, travelMode: { ...f.travelMode, [field]: value } }));

    const handleSave = async () => {
        if (hasErrors) {
            setNotification({ show: true, message: 'Revisa los horarios marcados en rojo.', type: 'error' });
            return;
        }
        setSaving(true);
        try {
            const schedule = {};
            DAYS.forEach(({ key }) => {
                const d = form.schedule[key];
                schedule[key] = { open: !!d.open, from: d.from, to: d.to };
            });
            await setDoc(doc(db, `users/${user.uid}/config/businessHours`), {
                schedule,
                travelMode: {
                    enabled: !!form.travelMode.enabled,
                    until: form.travelMode.until || '',
                    returnText: form.travelMode.returnText.trim().slice(0, 80)
                },
                timezone: TIMEZONE,
                updatedAt: serverTimestamp()
            });
            setNotification({ show: true, message: 'Horario de atención guardado. El bot lo aplica al instante.', type: 'success' });
        } catch (e) {
            console.error(e);
            setNotification({ show: true, message: 'No se pudo guardar el horario de atención.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Estado actual según lo GUARDADO (lo que usa el bot)
    const now = useMemo(() => nowInUruguay(), [tick, saved]); // eslint-disable-line react-hooks/exhaustive-deps
    const today = saved.schedule[now.day];
    const openNow = today.open && now.minutes >= toMinutes(today.from) && now.minutes < toMinutes(today.to);
    const travelNow = saved.travelMode.enabled && (!saved.travelMode.until || now.dateISO <= saved.travelMode.until);

    const savedMs = savedAt?.toMillis ? savedAt.toMillis() : null;
    const appliedMs = status?.appliedConfigAt?.toMillis ? status.appliedConfigAt.toMillis() : null;
    const botApplied = status && savedMs === appliedMs;
    const box = darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200';
    const timeInput = theme.input + ' px-2 py-1.5 rounded-lg font-bold text-sm outline-none border flex-1 min-w-0 sm:flex-none sm:w-[110px]';

    return (
        <div className={`rounded-[2rem] overflow-hidden border ${theme.card}`}>
            <div className={`px-4 sm:px-6 py-4 border-b ${theme.cardHeader} flex flex-wrap items-center justify-between gap-2`}>
                <h3 className={`font-black text-xs uppercase tracking-wider ${theme.subtext} flex items-center gap-2`}><Store size={14}/> Horario de atención (Bot WhatsApp)</h3>
                <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${travelNow ? 'bg-sky-500/15 text-sky-500' : openNow ? 'bg-emerald-500/15 text-emerald-500' : 'bg-rose-500/15 text-rose-500'}`}>
                        {travelNow ? '✈️ MODO VIAJE' : openNow ? 'AHORA: ABIERTO' : 'AHORA: CERRADO'}
                    </span>
                    {status && (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${botApplied ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                            {botApplied ? 'BOT ACTUALIZADO' : 'ESPERANDO AL BOT'}
                        </span>
                    )}
                </div>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
                {/* HORARIO POR DÍA */}
                <div className="space-y-2">
                    {DAYS.map(({ key, label }) => {
                        const d = form.schedule[key];
                        return (
                            <div key={key} className={`p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 ${box} ${errors[key] ? 'border-rose-500/50' : ''}`}>
                                <label className="flex items-center gap-2 sm:w-32 shrink-0 cursor-pointer select-none">
                                    <input type="checkbox" className="accent-emerald-500 w-4 h-4" checked={d.open} onChange={e => setDay(key, 'open', e.target.checked)} />
                                    <span className={`text-sm font-bold ${theme.text}`}>{label}</span>
                                </label>
                                {d.open ? (
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <input type="time" className={timeInput} value={d.from} onChange={e => setDay(key, 'from', e.target.value)} aria-label={`${label} apertura`} />
                                        <span className={`text-xs ${theme.subtext}`}>a</span>
                                        <input type="time" className={timeInput} value={d.to} onChange={e => setDay(key, 'to', e.target.value)} aria-label={`${label} cierre`} />
                                    </div>
                                ) : (
                                    <span className={`text-xs font-bold ${theme.subtext}`}>Cerrado todo el día</span>
                                )}
                                {errors[key] && <span className="text-[10px] font-bold text-rose-500">{errors[key]}</span>}
                            </div>
                        );
                    })}
                    <p className="text-[10px] text-slate-500">Hora de Uruguay. Fuera de este horario el bot avisa que están cerrados (una vez cada 12 h por cliente) y la IA responde en modo nocturno. Los códigos de Netflix/Disney/Max siguen funcionando 24 h.</p>
                </div>

                {/* MODO VIAJE */}
                <div className={`p-4 rounded-2xl border space-y-3 ${form.travelMode.enabled ? 'border-sky-500/40 bg-sky-500/5' : box}`}>
                    <label className="flex items-start gap-3 cursor-pointer select-none">
                        <input type="checkbox" className="accent-sky-500 w-4 h-4 mt-0.5" checked={form.travelMode.enabled} onChange={e => setTravel('enabled', e.target.checked)} />
                        <div>
                            <p className={`text-sm font-bold flex items-center gap-1.5 ${theme.text}`}><Plane size={14}/> Modo viaje / fuera de oficina</p>
                            <p className={`text-xs ${theme.subtext}`}>El bot sigue entregando cuentas y códigos, pero avisa que el soporte manual está pausado y cuándo vuelve.</p>
                        </div>
                    </label>
                    {form.travelMode.enabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:pl-7">
                            <div>
                                <label className={`text-[10px] font-bold uppercase ${theme.subtext}`}>Activo hasta (incluido)</label>
                                <input type="date" className={theme.input + ' w-full mt-1 px-3 py-2 rounded-xl font-bold text-sm outline-none border'} value={form.travelMode.until} onChange={e => setTravel('until', e.target.value)} />
                                <p className="text-[10px] text-slate-500 mt-1">{form.travelMode.until ? 'Se apaga solo al terminar ese día.' : 'Sin fecha: queda activo hasta que lo apagues.'}</p>
                            </div>
                            <div>
                                <label className={`text-[10px] font-bold uppercase ${theme.subtext}`}>El soporte vuelve...</label>
                                <input type="text" maxLength={80} placeholder="el jueves a primera hora" className={theme.input + ` w-full mt-1 px-3 py-2 rounded-xl font-bold text-sm outline-none border ${errors.travel ? 'border-rose-500' : ''}`} value={form.travelMode.returnText} onChange={e => setTravel('returnText', e.target.value)} />
                                <p className="text-[10px] text-slate-500 mt-1">Ej: "...se responderán <b>{form.travelMode.returnText || '…'}</b>."</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                    {isDirty && (
                        <button onClick={() => setForm(saved)} className={`px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 ${darkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}><RotateCcw size={14}/> Descartar</button>
                    )}
                    <button onClick={handleSave} disabled={!isDirty || saving || hasErrors} className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95">
                        <Save size={14}/> {saving ? 'Guardando...' : 'Guardar horario de atención'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BusinessHours;
