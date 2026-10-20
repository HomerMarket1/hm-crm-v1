// src/components/BotStatus.jsx
// 🩺 Estado del Bot de WhatsApp en vivo (users/{uid}/config/botHeartbeat, escrito por el bot cada minuto).
// Muestra el UID y el proyecto de este CRM para compararlos con el .env del bot.
import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { Copy } from 'lucide-react';
import { db } from '../firebase/config';

const STALE_MS = 3 * 60 * 1000;

const BotStatus = ({ user, darkMode, theme, setNotification }) => {
    const [hb, setHb] = useState(undefined); // undefined = cargando, null = sin señal nunca
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, `users/${user.uid}/config/botHeartbeat`), (snap) => setHb(snap.exists() ? snap.data() : null), () => setHb(null));
        const timer = setInterval(() => setNow(Date.now()), 15000);
        return () => { unsub(); clearInterval(timer); };
    }, [user]);

    if (!user) return null;
    const project = import.meta.env.VITE_FIREBASE_PROJECT_ID || '—';
    const lastSeen = hb?.lastSeen?.toMillis ? hb.lastSeen.toMillis() : 0;
    const ago = lastSeen ? Math.max(0, Math.round((now - lastSeen) / 1000)) : null;
    const agoText = ago == null ? '' : ago < 60 ? `hace ${ago} s` : `hace ${Math.round(ago / 60)} min`;

    let state;
    if (hb === undefined) state = { dot: 'bg-slate-400', text: 'Verificando...', tone: theme.subtext };
    else if (hb === null) state = { dot: 'bg-rose-500', text: 'Sin señal: el bot no escucha esta cuenta (o no está actualizado)', tone: 'text-rose-500' };
    else if (now - lastSeen > STALE_MS) state = { dot: 'bg-rose-500', text: `Apagado · última señal ${agoText}`, tone: 'text-rose-500' };
    else if (!hb.whatsappConnected) state = { dot: 'bg-amber-500', text: `Encendido, WhatsApp desconectado · ${agoText}`, tone: 'text-amber-500' };
    else state = { dot: 'bg-emerald-500 animate-pulse', text: `Conectado · ${agoText}${hb.host ? ` · ${hb.host}` : ''}`, tone: 'text-emerald-500' };

    const copyUid = async () => {
        try { await navigator.clipboard.writeText(user.uid); setNotification?.({ show: true, message: 'UID copiado.', type: 'success' }); }
        catch { /* sin portapapeles */ }
    };
    const box = darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200';

    return (
        <div className={`mx-4 sm:mx-6 mt-4 p-3 rounded-xl border text-xs space-y-1.5 ${box}`}>
            <p className={`font-bold flex items-center gap-2 ${state.tone}`}><span className={`w-2 h-2 rounded-full ${state.dot}`} /> Bot: {state.text}</p>
            <p className={`flex flex-wrap items-center gap-x-2 gap-y-1 ${theme.subtext}`}>
                <span>Proyecto: <b className="font-mono">{project}</b></span>
                <span className="hidden sm:inline">·</span>
                <span>Tu UID (MY_USER_ID del bot): <b className="font-mono break-all">{user.uid}</b></span>
                <button type="button" onClick={copyUid} title="Copiar UID" className="p-1 rounded hover:bg-white/10"><Copy size={12}/></button>
            </p>
            {hb && hb.projectId && hb.projectId !== project && (
                <p className="font-bold text-rose-500">⚠️ El bot usa la llave del proyecto "{hb.projectId}", distinto a este CRM ("{project}").</p>
            )}
        </div>
    );
};

export default BotStatus;
