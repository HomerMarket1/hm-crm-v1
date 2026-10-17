// src/utils/botOutbox.js
// 📤 Envío directo por el Bot de WhatsApp (Bot-Whatsapp / src/outbox.js).
// El CRM deja el mensaje en users/{uid}/whatsappOutbox y el bot lo envía al instante.
// Estados: pending -> sending -> sent | error. Si nadie lo toma a tiempo: cancelled.
import { collection, doc, setDoc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

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
            if (cancelled) finish({ status: 'error', error: 'El bot de WhatsApp no está conectado.' });
            // Si no se canceló, el bot ya lo tomó: seguimos esperando el resultado
        } catch {
            finish({ status: 'error', error: 'El bot de WhatsApp no respondió.' });
        }
    }, PICKUP_TIMEOUT_MS);

    deliveryTimer = setTimeout(() => finish({ status: 'timeout' }), DELIVERY_TIMEOUT_MS);
});
