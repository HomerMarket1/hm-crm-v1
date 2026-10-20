// src/utils/botOutbox.js
// 📤 Envío directo por el Bot de WhatsApp (Bot-Whatsapp / src/outbox.js).
// El CRM deja el mensaje en users/{uid}/whatsappOutbox y el bot lo envía al instante.
// Estados: pending -> sending -> sent | error. Si nadie lo toma a tiempo: cancelled.
import { collection, doc, setDoc, getDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const HEARTBEAT_STALE_MS = 3 * 60 * 1000; // el bot late cada minuto: sin señal en 3 min = apagado

/**
 * 🩺 Explica POR QUÉ el bot no tomó el mensaje, usando su señal de vida (users/{uid}/config/botHeartbeat).
 * Devuelve un texto listo para mostrar.
 */
export const diagnoseBot = async (uid) => {
    const shortUid = `${uid.slice(0, 6)}…${uid.slice(-4)}`;
    const project = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
    try {
        const snap = await withTimeout(getDoc(doc(db, `users/${uid}/config/botHeartbeat`)), 4000);
        if (!snap.exists()) {
            return `El bot no está escuchando esta cuenta. En el .env del bot, MY_USER_ID debe ser ${uid} y su serviceAccount.json del proyecto "${project}". (Requiere el bot actualizado.)`;
        }
        const hb = snap.data();
        const lastSeen = hb.lastSeen?.toMillis ? hb.lastSeen.toMillis() : 0;
        const minutes = Math.round((Date.now() - lastSeen) / 60000);
        if (!lastSeen || Date.now() - lastSeen > HEARTBEAT_STALE_MS) {
            return `El bot está apagado o sin conexión a Firebase (última señal hace ${minutes} min${hb.host ? ` desde ${hb.host}` : ''}).`;
        }
        if (!hb.whatsappConnected) return 'El bot está encendido, pero WhatsApp está desconectado (reconectando o hay que escanear el QR).';
        if (hb.outboxListening === false) return 'El bot está encendido, pero perdió la escucha de envíos. Se reconecta solo; si sigue, reinícialo.';
        return `El bot está encendido (cuenta ${shortUid}) pero no respondió a tiempo. Puede ser la conexión; prueba de nuevo.`;
    } catch {
        return 'El bot de WhatsApp no respondió y no se pudo verificar su estado (conexión lenta con Firebase).';
    }
};

const PICKUP_TIMEOUT_MS = 3000;    // si el bot no lo toma en 3 s -> se ofrece el envío manual
const DELIVERY_TIMEOUT_MS = 45000; // tiempo máximo esperando el resultado una vez tomado

const withTimeout = (promise, ms) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
]);

// Cancela el envío solo si sigue "pending" (el bot nunca lo tomó). Devuelve true si se canceló.
const cancelIfPending = (ref) => withTimeout(runTransaction(db, async (t) => {
    const snap = await t.get(ref);
    if (snap.data()?.status !== 'pending') return false;
    t.update(ref, { status: 'cancelled', cancelledAt: serverTimestamp() });
    return true;
}), 5000);

/**
 * @returns {Promise<{status: 'sent'|'error'|'timeout', error?: string}>}
 */
export const sendViaBot = ({ uid, phone, text, saleId = null, kind = 'data' }) => new Promise((resolve) => {
    const outboxRef = doc(collection(db, `users/${uid}/whatsappOutbox`));
    let done = false;
    let saved = false;
    let unsub = () => {};
    let pickupTimer, deliveryTimer;

    const finish = (result) => {
        if (done) return;
        done = true;
        clearTimeout(pickupTimer);
        clearTimeout(deliveryTimer);
        unsub();
        resolve(result);
    };

    // No se espera la confirmación del servidor para arrancar los tiempos:
    // si Firebase no responde, igual avisamos en vez de quedarnos girando.
    setDoc(outboxRef, {
        phone: String(phone || ''),
        text,
        saleId,
        kind,
        status: 'pending',
        createdAt: serverTimestamp(),
        clientCreatedAt: Date.now() // el bot descarta envíos viejos que lleguen tarde
    }).then(() => {
        saved = true;
        // Si ya ofrecimos el envío manual y el guardado llegó tarde, lo cancelamos (evita mensaje duplicado)
        if (done) cancelIfPending(outboxRef).catch(() => {});
    }).catch((e) => finish({ status: 'error', error: `Firebase rechazó el envío (${e.code || e.message}).` }));

    unsub = onSnapshot(outboxRef, (snap) => {
        const data = snap.data();
        if (data?.status === 'sent') finish({ status: 'sent' });
        else if (data?.status === 'error') finish({ status: 'error', error: data.error || 'Error desconocido' });
    }, () => {});

    pickupTimer = setTimeout(async () => {
        if (!saved) {
            finish({ status: 'error', error: 'Sin conexión con Firebase: no se pudo entregar el mensaje al bot.' });
            return;
        }
        // Guardado pero el bot no lo tomó: lo cancelamos para que no llegue tarde ni duplicado
        try {
            const cancelled = await cancelIfPending(outboxRef);
            // Cancelado: el bot nunca lo vio -> se explica la causa con su señal de vida
            if (cancelled) finish({ status: 'error', error: await diagnoseBot(uid) });
            // Si no se canceló, el bot ya lo tomó: seguimos esperando el resultado
        } catch {
            finish({ status: 'error', error: await diagnoseBot(uid) });
        }
    }, PICKUP_TIMEOUT_MS);

    deliveryTimer = setTimeout(() => finish({ status: 'timeout' }), DELIVERY_TIMEOUT_MS);
});
