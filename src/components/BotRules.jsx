// src/components/BotRules.jsx
// 💬 Respuestas automáticas del Bot de WhatsApp (por palabra clave), con imagen opcional.
// Guarda users/{uid}/botRules/{id} y las imágenes en users/{uid}/botMedia/{id} (comprimidas en el navegador).
// El bot (src/panelRules.js) las valida, escribe las imágenes en assets/ y confirma en users/{uid}/config/botRulesStatus.
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { MessageSquareText, Plus, Save, X, Trash2, ArrowUp, ArrowDown, ImagePlus, FlaskConical, AlertTriangle, Edit2, Search,
    MessageCircle, LifeBuoy, CreditCard, Tag, Tv, Shapes, Layers } from 'lucide-react';
import { db } from '../firebase/config';
import SegmentedTabs from './SegmentedTabs';

// 🗂️ Categorías (pestañas). El bot las revisa en ESTE orden y, dentro de cada una, de arriba hacia abajo.
const CATEGORIAS = [
    { id: 'saludos', label: 'Saludos y horario', shortLabel: 'Saludos', icon: MessageCircle },
    { id: 'soporte', label: 'Soporte y reglas', shortLabel: 'Soporte', icon: LifeBuoy },
    { id: 'pagos', label: 'Pagos', icon: CreditCard },
    { id: 'promos', label: 'Promociones', shortLabel: 'Promos', icon: Tag },
    { id: 'plataformas', label: 'Plataformas y precios', shortLabel: 'Plataformas', icon: Tv },
    { id: 'otras', label: 'Otras', icon: Shapes }
];
const INDICE_CATEGORIA = Object.fromEntries(CATEGORIAS.map((c, i) => [c.id, i]));
// Respuestas cargadas antes de que existieran las categorías
const CATEGORIA_POR_NOMBRE = {
    'Saludo': 'saludos', 'Horario de atención': 'saludos',
    'Reporte técnico': 'soporte', 'No vendemos IPTV': 'soporte', 'Sin demos ni pruebas gratis': 'soporte',
    'Regla 1 perfil = 1 dispositivo': 'soporte', 'Guía Netflix TV': 'soporte', 'Guía Prime Video': 'soporte',
    'Dice que ya pagó': 'pagos', 'Medios de pago': 'pagos', 'Abitab / RedPagos': 'pagos', 'Transferencia bancaria': 'pagos',
    'MiDinero': 'pagos', 'OCA Blue': 'pagos'
};
const categoriaDe = (r) => INDICE_CATEGORIA[r.category] !== undefined ? r.category
    : CATEGORIA_POR_NOMBRE[r.name] || (r.origin === 'rules.js' ? 'plataformas' : 'otras');
const ordenar = (lista) => [...lista].sort((a, b) =>
    INDICE_CATEGORIA[categoriaDe(a)] - INDICE_CATEGORIA[categoriaDe(b)] || (a.order || 0) - (b.order || 0));

// Guarda el orden de la lista tal como viene (y la categoría si faltaba). Solo escribe lo que cambió.
async function renumerar(uid, lista) {
    const batch = writeBatch(db);
    let cambios = 0;
    lista.forEach((r, i) => {
        const order = (i + 1) * 10;
        const category = categoriaDe(r);
        if (r.order !== order || r.category !== category) {
            batch.update(doc(db, `users/${uid}/botRules/${r.id}`), { order, category, updatedAt: serverTimestamp() });
            cambios++;
        }
    });
    if (cambios) await batch.commit();
}

// Mismos límites que el bot (el bot vuelve a validar por su cuenta)
const MAX_REGLAS = 200;
const MAX_RESPUESTA = 3000;
const MAX_PALABRAS = 40;
const MAX_LARGO_PALABRA = 80;
const MAX_PATRON = 500;
const MAX_BASE64 = 900000;           // ~670 KB de imagen: entra en un documento de Firestore y en el límite del bot
const MAX_ARCHIVO = 25 * 1024 * 1024;
const STOCK_OPCIONES = [
    { id: '', label: 'No revisar stock' },
    { id: 'netflix', label: 'Netflix' }, { id: 'disney', label: 'Disney+' },
    { id: 'prime', label: 'Prime Video' }, { id: 'max', label: 'Max' }
];

const VACIA = { name: '', category: 'otras', keywords: [], matchMode: 'contains', pattern: '', response: '', imagePath: '', requiresStock: '', enabled: true };

// Mismo tratamiento que el bot aplica al mensaje del cliente
const normalizar = (t) => String(t || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[.,;:!¡¿?…"“”'()*_~]+/g, ' ')
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, ' ')
    .replace(/\s+/g, ' ').trim();
const escaparRegex = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const idImagen = (ruta) => ruta.replace(/[^a-z0-9_-]/gi, '_');
const separarPalabras = (texto) => texto.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);

// Devuelve la expresión con la que el bot va a comparar, o lanza un error con el motivo
function compilar(r) {
    const avanzado = (r.pattern || '').trim();
    if (avanzado) {
        if (avanzado.length > MAX_PATRON) throw new Error(`Máximo ${MAX_PATRON} caracteres`);
        try { return new RegExp(avanzado, 'i'); } catch (e) { throw new Error('Expresión inválida: ' + e.message); }
    }
    const palabras = (r.keywords || []).map(p => normalizar(p).slice(0, MAX_LARGO_PALABRA)).filter(Boolean).slice(0, MAX_PALABRAS);
    if (!palabras.length) throw new Error('Agregá al menos una palabra clave');
    const alt = palabras.map(p => escaparRegex(p).replace(/ /g, '\\s+')).join('|');
    return r.matchMode === 'exact'
        ? new RegExp(`^(?:${alt})$`, 'i')
        : new RegExp(`(?:^|[^a-z0-9])(?:${alt})(?:$|[^a-z0-9])`, 'i');
}

// Achica la foto a JPEG (máx. 1600 px) hasta que entre en el límite. También le quita los metadatos (GPS, etc.).
async function comprimirImagen(file) {
    if (!file.type.startsWith('image/')) throw new Error('El archivo no es una imagen.');
    if (file.size > MAX_ARCHIVO) throw new Error('La imagen pesa más de 25 MB.');
    let bitmap;
    try { bitmap = await createImageBitmap(file); }
    catch { throw new Error('No se pudo leer la imagen. Probá con JPG o PNG.'); }
    let lado = 1600, calidad = 0.85;
    for (let i = 0; i < 10; i++) {
        const escala = Math.min(1, lado / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bitmap.width * escala);
        canvas.height = Math.round(bitmap.height * escala);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', calidad);
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
        if (base64.length <= MAX_BASE64) return { base64, dataUrl, kb: Math.round(base64.length * 0.75 / 1024), ancho: canvas.width, alto: canvas.height };
        if (calidad > 0.6) calidad -= 0.1; else lado = Math.round(lado * 0.8);
    }
    throw new Error('No se pudo achicar la imagen lo suficiente.');
}

// Vista previa con el formato de WhatsApp: *negrita*, _cursiva_, ~tachado~
function TextoWhatsApp({ texto }) {
    const partes = String(texto || '').split(/(\*{1,2}[^*\n]+\*{1,2}|_[^_\n]+_|~[^~\n]+~)/g);
    return partes.map((p, i) => {
        if (/^\*{1,2}[^*\n]+\*{1,2}$/.test(p)) return <b key={i}>{p.replace(/^\*+|\*+$/g, '')}</b>;
        if (/^_[^_\n]+_$/.test(p)) return <i key={i}>{p.slice(1, -1)}</i>;
        if (/^~[^~\n]+~$/.test(p)) return <s key={i}>{p.slice(1, -1)}</s>;
        return <React.Fragment key={i}>{p}</React.Fragment>;
    });
}

// Miniatura: la genera el bot (users/{uid}/botPreviews, ~50 KB) a partir del archivo real de assets/.
// Si todavía no existe, se usa la imagen subida desde el panel (botMedia). Se actualiza sola.
const cacheMiniaturas = new Map();
function Miniatura({ uid, ruta, className }) {
    const [, setCargadas] = useState(0);
    useEffect(() => {
        if (!ruta) return;
        let vivo = true;
        const guardar = (url) => { if (url) { cacheMiniaturas.set(ruta, url); if (vivo) setCargadas(n => n + 1); } };
        const unsub = onSnapshot(doc(db, `users/${uid}/botPreviews/${idImagen(ruta)}`), (s) => {
            if (s.exists() && s.data().data) guardar(`data:image/jpeg;base64,${s.data().data}`);
            else if (!cacheMiniaturas.has(ruta)) {
                getDoc(doc(db, `users/${uid}/botMedia/${idImagen(ruta)}`))
                    .then(m => m.exists() && m.data().data && guardar(`data:image/jpeg;base64,${m.data().data}`))
                    .catch(() => {});
            }
        }, () => {});
        return () => { vivo = false; unsub(); };
    }, [uid, ruta]);
    const src = cacheMiniaturas.get(ruta);
    if (src) return <img src={src} alt="" className={`object-cover ${className}`} />;
    return (
        <div className={`flex flex-col items-center justify-center text-center bg-slate-500/10 text-slate-500 ${className}`} title={`Imagen del servidor: ${ruta}`}>
            <ImagePlus size={16} />
            <span className="text-[8px] font-bold leading-tight px-1 break-all">{ruta.split('/').pop()}</span>
        </div>
    );
}

// ==============================================================
// ✏️ EDITOR DE UNA RESPUESTA
// ==============================================================
function EditorRespuesta({ uid, inicial, todas, darkMode, theme, onClose, onSaved, setNotification }) {
    const [form, setForm] = useState({ ...VACIA, ...inicial, category: categoriaDe({ ...VACIA, ...inicial }) });
    const [textoPalabras, setTextoPalabras] = useState((inicial.keywords || []).join('\n'));
    const [avanzado, setAvanzado] = useState(!!(inicial.pattern || '').trim());
    const [imagenNueva, setImagenNueva] = useState(null);
    const [reemplazarOriginal, setReemplazarOriginal] = useState(true);
    const [procesando, setProcesando] = useState(false);
    const [guardando, setGuardando] = useState(false);
    const [confirmarBorrar, setConfirmarBorrar] = useState(false);
    const inputArchivo = useRef(null);

    const set = (campo, valor) => setForm(f => ({ ...f, [campo]: valor }));
    const palabras = useMemo(() => separarPalabras(textoPalabras), [textoPalabras]);

    const errores = useMemo(() => {
        const e = {};
        if (!form.name.trim()) e.name = 'Poné un nombre para reconocerla';
        if (!form.response.trim()) e.response = 'Escribí la respuesta';
        else if (form.response.length > MAX_RESPUESTA) e.response = `Máximo ${MAX_RESPUESTA} caracteres`;
        if (!avanzado && palabras.length > MAX_PALABRAS) e.keywords = `Máximo ${MAX_PALABRAS} palabras clave`;
        else if (!avanzado && palabras.some(p => p.length > MAX_LARGO_PALABRA)) e.keywords = `Cada palabra clave puede tener hasta ${MAX_LARGO_PALABRA} caracteres`;
        else {
            try { compilar({ ...form, keywords: palabras, pattern: avanzado ? form.pattern : '' }); }
            catch (err) { e[avanzado ? 'pattern' : 'keywords'] = err.message; }
        }
        return e;
    }, [form, palabras, avanzado]);
    const hayErrores = Object.keys(errores).length > 0;

    const rutaActual = form.imagePath;
    const usadaPorOtras = rutaActual ? todas.filter(r => r.id !== inicial.id && r.imagePath === rutaActual).length : 0;
    const esOriginal = rutaActual && !rutaActual.startsWith('panel/');

    const elegirImagen = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        setProcesando(true);
        try { setImagenNueva(await comprimirImagen(file)); }
        catch (err) { setNotification({ show: true, message: err.message, type: 'error' }); }
        finally { setProcesando(false); }
    };

    const guardar = async () => {
        if (hayErrores) return;
        setGuardando(true);
        try {
            const base = `users/${uid}`;
            const id = inicial.id || doc(collection(db, `${base}/botRules`)).id;
            let imagePath = form.imagePath;
            const rutaAnterior = inicial.imagePath || '';

            if (imagenNueva) {
                // Reemplaza el archivo actual (se actualiza en todas partes) o crea uno nuevo solo para esta respuesta
                if (!imagePath || ((esOriginal || usadaPorOtras) && !reemplazarOriginal)) {
                    imagePath = `panel/${id}-${Date.now().toString(36)}.jpg`;
                }
                await setDoc(doc(db, `${base}/botMedia/${idImagen(imagePath)}`), {
                    path: imagePath, data: imagenNueva.base64, mime: 'image/jpeg', size: imagenNueva.kb, updatedAt: serverTimestamp()
                });
                cacheMiniaturas.set(imagePath, imagenNueva.dataUrl);
            }

            // Nueva o cambiada de categoría: queda primera dentro de su categoría
            const category = INDICE_CATEGORIA[form.category] !== undefined ? form.category : 'otras';
            const otras = todas.filter(r => r.id !== id);
            const mismaCategoria = otras.filter(r => categoriaDe(r) === category);
            const order = inicial.id && categoriaDe(inicial) === category && typeof inicial.order === 'number'
                ? inicial.order
                : Math.min(0, ...mismaCategoria.map(r => r.order || 0)) - 5;

            await setDoc(doc(db, `${base}/botRules/${id}`), {
                name: form.name.trim().slice(0, 80),
                category,
                keywords: avanzado ? [] : palabras.map(p => p.slice(0, MAX_LARGO_PALABRA)).slice(0, MAX_PALABRAS),
                matchMode: form.matchMode === 'exact' ? 'exact' : 'contains',
                pattern: avanzado ? form.pattern.trim() : '',
                response: form.response.trim(),
                imagePath: imagePath || '',
                requiresStock: form.requiresStock || '',
                enabled: form.enabled !== false,
                order,
                ...(inicial.origin ? { origin: inicial.origin } : {}),
                updatedAt: serverTimestamp()
            });
            await renumerar(uid, ordenar([...otras, { id, category, order, name: form.name }]));

            // Si la imagen anterior era una subida del panel y ya nadie la usa, se borra
            if (rutaAnterior && rutaAnterior !== imagePath && rutaAnterior.startsWith('panel/') && !todas.some(r => r.id !== id && r.imagePath === rutaAnterior)) {
                await deleteDoc(doc(db, `${base}/botMedia/${idImagen(rutaAnterior)}`)).catch(() => {});
            }
            setNotification({ show: true, message: 'Respuesta guardada. El bot la aplica al instante.', type: 'success' });
            onSaved();
        } catch (e) {
            console.error(e);
            setNotification({ show: true, message: 'No se pudo guardar la respuesta.', type: 'error' });
        } finally {
            setGuardando(false);
        }
    };

    const borrar = async () => {
        setGuardando(true);
        try {
            const base = `users/${uid}`;
            await deleteDoc(doc(db, `${base}/botRules/${inicial.id}`));
            const ruta = inicial.imagePath || '';
            if (ruta.startsWith('panel/') && !todas.some(r => r.id !== inicial.id && r.imagePath === ruta)) {
                await deleteDoc(doc(db, `${base}/botMedia/${idImagen(ruta)}`)).catch(() => {});
            }
            setNotification({ show: true, message: 'Respuesta eliminada.', type: 'success' });
            onSaved();
        } catch (e) {
            console.error(e);
            setNotification({ show: true, message: 'No se pudo eliminar la respuesta.', type: 'error' });
        } finally {
            setGuardando(false);
        }
    };

    const input = theme.input + ' w-full mt-1 px-3 py-2 rounded-xl font-bold text-sm outline-none border';
    const etiqueta = `text-[10px] font-bold uppercase ${theme.subtext}`;
    const box = darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200';
    const vistaImagen = imagenNueva?.dataUrl || null;

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4" onClick={onClose}>
            <div className={`w-full sm:max-w-3xl max-h-[95vh] overflow-y-auto rounded-t-[2rem] sm:rounded-[2rem] border ${theme.card}`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Editar respuesta automática">
                <div className={`sticky top-0 z-10 px-4 sm:px-6 py-4 border-b ${theme.cardHeader} flex items-center justify-between gap-2`}>
                    <h3 className={`font-black text-sm ${theme.text}`}>{inicial.id ? 'Editar respuesta' : 'Nueva respuesta'}</h3>
                    <button onClick={onClose} className={`p-2 rounded-xl ${darkMode ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`} aria-label="Cerrar"><X size={18} /></button>
                </div>

                <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_260px] gap-5">
                    <div className="space-y-4 min-w-0">
                        <div>
                            <label className={etiqueta}>Nombre (solo para vos)</label>
                            <input className={input + (errores.name ? ' border-rose-500' : '')} maxLength={80} placeholder="Ej: Promo Black Friday" value={form.name} onChange={e => set('name', e.target.value)} />
                            {errores.name && <p className="text-[10px] font-bold text-rose-500 mt-1">{errores.name}</p>}
                        </div>

                        <div>
                            <label className={etiqueta}>Categoría</label>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                                {CATEGORIAS.map(({ id, label, icon }) => {
                                    const Icono = icon;
                                    const activa = form.category === id;
                                    return (
                                        <button key={id} type="button" onClick={() => set('category', id)} aria-pressed={activa}
                                            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 border transition-colors ${activa ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500' : (darkMode ? 'border-white/5 text-slate-400 hover:text-slate-200' : 'border-slate-200 text-slate-500 hover:text-slate-800')}`}>
                                            <Icono size={12} /> {label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* CUÁNDO RESPONDE */}
                        <div className={`p-3 rounded-2xl border space-y-3 ${box}`}>
                            <p className={`text-xs font-black ${theme.text}`}>¿Cuándo responde?</p>
                            {!avanzado ? (
                                <>
                                    <div>
                                        <label className={etiqueta}>Palabras clave (una por línea o separadas por coma)</label>
                                        <textarea rows={3} className={input + ' font-medium resize-y' + (errores.keywords ? ' border-rose-500' : '')} placeholder={'black friday\npromo\noferta'} value={textoPalabras} onChange={e => setTextoPalabras(e.target.value)} />
                                        {errores.keywords && <p className="text-[10px] font-bold text-rose-500 mt-1">{errores.keywords}</p>}
                                        {palabras.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-2">
                                                {palabras.slice(0, MAX_PALABRAS).map((p, i) => <span key={i} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600">{p}</span>)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {[
                                            { id: 'contains', t: 'El mensaje contiene', d: '"hola, ¿tienen promo?" activa "promo"' },
                                            { id: 'exact', t: 'El mensaje es exactamente', d: 'Solo si escribe "promo" y nada más' }
                                        ].map(o => (
                                            <label key={o.id} className={`p-2.5 rounded-xl border cursor-pointer ${form.matchMode === o.id ? 'border-emerald-500 bg-emerald-500/5' : (darkMode ? 'border-white/5' : 'border-slate-200')}`}>
                                                <input type="radio" className="sr-only" checked={form.matchMode === o.id} onChange={() => set('matchMode', o.id)} />
                                                <span className={`block text-xs font-bold ${theme.text}`}>{o.t}</span>
                                                <span className={`block text-[10px] ${theme.subtext}`}>{o.d}</span>
                                            </label>
                                        ))}
                                    </div>
                                    <p className="text-[10px] text-slate-500">No importan mayúsculas, tildes ni signos. Solo coincide con palabras completas ("oca" no se activa con "local").</p>
                                </>
                            ) : (
                                <div>
                                    <label className={etiqueta}>Expresión regular (avanzado)</label>
                                    <input className={input + ' font-mono text-xs' + (errores.pattern ? ' border-rose-500' : '')} maxLength={MAX_PATRON} value={form.pattern} onChange={e => set('pattern', e.target.value)} />
                                    {errores.pattern && <p className="text-[10px] font-bold text-rose-500 mt-1">{errores.pattern}</p>}
                                    <p className="text-[10px] text-slate-500 mt-1">Se compara contra el mensaje en minúsculas, sin tildes ni signos.</p>
                                </div>
                            )}
                            <button type="button" onClick={() => { setAvanzado(a => !a); if (avanzado) set('pattern', ''); }} className="text-[11px] font-bold text-indigo-500 hover:underline">
                                {avanzado ? '← Usar palabras clave (recomendado)' : 'Modo avanzado (expresión regular)'}
                            </button>
                        </div>

                        <div>
                            <label className={etiqueta}>Respuesta</label>
                            <textarea rows={8} className={input + ' font-medium resize-y' + (errores.response ? ' border-rose-500' : '')} value={form.response} onChange={e => set('response', e.target.value)} placeholder="¡Hola! 🔥 Esta semana tenemos..." />
                            <div className="flex justify-between mt-1">
                                {errores.response ? <p className="text-[10px] font-bold text-rose-500">{errores.response}</p> : <p className="text-[10px] text-slate-500">*negrita*  _cursiva_  ~tachado~</p>}
                                <p className={`text-[10px] font-bold ${form.response.length > MAX_RESPUESTA ? 'text-rose-500' : 'text-slate-500'}`}>{form.response.length}/{MAX_RESPUESTA}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className={etiqueta}>Si no hay stock de...</label>
                                <select className={input} value={form.requiresStock} onChange={e => set('requiresStock', e.target.value)}>
                                    {STOCK_OPCIONES.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                                </select>
                                <p className="text-[10px] text-slate-500 mt-1">...el bot avisa "agotado" en vez de esta respuesta.</p>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer select-none sm:mt-5">
                                <input type="checkbox" className="accent-emerald-500 w-4 h-4" checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />
                                <span className={`text-sm font-bold ${theme.text}`}>Respuesta activa</span>
                            </label>
                        </div>
                    </div>

                    {/* IMAGEN + VISTA PREVIA */}
                    <div className="space-y-3">
                        <label className={etiqueta}>Imagen (opcional)</label>
                        <div className={`rounded-2xl border overflow-hidden ${box}`}>
                            {vistaImagen
                                ? <img src={vistaImagen} alt="Imagen nueva" className="w-full max-h-56 object-contain bg-black/5" />
                                : rutaActual
                                    ? <Miniatura uid={uid} ruta={rutaActual} className="w-full h-40" />
                                    : <div className={`h-28 flex items-center justify-center text-xs ${theme.subtext}`}>Sin imagen</div>}
                        </div>
                        <input ref={inputArchivo} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden" onChange={elegirImagen} />
                        <div className="flex gap-2">
                            <button type="button" disabled={procesando} onClick={() => inputArchivo.current?.click()} className="flex-1 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 flex items-center justify-center gap-1.5">
                                <ImagePlus size={14} /> {procesando ? 'Procesando...' : (vistaImagen || rutaActual) ? 'Cambiar foto' : 'Subir foto'}
                            </button>
                            {(vistaImagen || rutaActual) && (
                                <button type="button" onClick={() => { setImagenNueva(null); set('imagePath', ''); }} className={`px-3 py-2 rounded-xl text-xs font-bold ${darkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Quitar</button>
                            )}
                        </div>
                        {imagenNueva && <p className="text-[10px] text-slate-500">Optimizada: {imagenNueva.ancho}×{imagenNueva.alto} px · {imagenNueva.kb} KB</p>}
                        {imagenNueva && rutaActual && (esOriginal || usadaPorOtras > 0) && (
                            <div className={`p-2.5 rounded-xl border text-[11px] space-y-1.5 ${box}`}>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="radio" className="mt-0.5 accent-emerald-500" checked={reemplazarOriginal} onChange={() => setReemplazarOriginal(true)} />
                                    <span className={theme.text}>Reemplazar <b>{rutaActual}</b> en todas partes{usadaPorOtras ? ` (otras ${usadaPorOtras} respuesta${usadaPorOtras > 1 ? 's' : ''} la usan)` : ''}{esOriginal ? ', también cuando la envía la IA' : ''}.</span>
                                </label>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="radio" className="mt-0.5 accent-emerald-500" checked={!reemplazarOriginal} onChange={() => setReemplazarOriginal(false)} />
                                    <span className={theme.text}>Usarla solo en esta respuesta.</span>
                                </label>
                            </div>
                        )}

                        <label className={etiqueta}>Así lo ve el cliente</label>
                        <div className="rounded-2xl p-3 bg-[#0b141a]">
                            <div className="ml-auto max-w-full rounded-xl rounded-tr-sm bg-[#005c4b] text-[#e9edef] text-[12px] leading-snug overflow-hidden">
                                {(vistaImagen || rutaActual) && (vistaImagen ? <img src={vistaImagen} alt="" className="w-full max-h-40 object-cover" /> : <Miniatura uid={uid} ruta={rutaActual} className="w-full h-28" />)}
                                <p className="px-2.5 py-2 whitespace-pre-wrap break-words"><TextoWhatsApp texto={form.response || '...'} /></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className={`sticky bottom-0 px-4 sm:px-6 py-3 border-t ${theme.cardHeader} flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2`}>
                    <div>
                        {inicial.id && (confirmarBorrar ? (
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-rose-500">¿Eliminar esta respuesta?</span>
                                <button onClick={borrar} disabled={guardando} className="px-3 py-2 rounded-xl text-xs font-bold bg-rose-600 text-white">Sí, eliminar</button>
                                <button onClick={() => setConfirmarBorrar(false)} className={`px-3 py-2 rounded-xl text-xs font-bold ${darkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>No</button>
                            </div>
                        ) : (
                            <button onClick={() => setConfirmarBorrar(true)} className="px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 flex items-center gap-1.5"><Trash2 size={14} /> Eliminar</button>
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button onClick={onClose} className={`flex-1 sm:flex-none px-4 py-2.5 rounded-xl font-bold text-sm ${darkMode ? 'bg-white/5 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>Cancelar</button>
                        <button onClick={guardar} disabled={guardando || procesando || hayErrores} className="flex-1 sm:flex-none px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2">
                            <Save size={14} /> {guardando ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ==============================================================
// 📋 LISTA DE RESPUESTAS
// ==============================================================
const BotRules = ({ user, darkMode, theme, setNotification }) => {
    const [reglas, setReglas] = useState(null);
    const [estado, setEstado] = useState(null);
    const [editando, setEditando] = useState(null);
    const [prueba, setPrueba] = useState('');
    const [busqueda, setBusqueda] = useState('');
    const [pestana, setPestana] = useState(() => {
        try { return localStorage.getItem('hm-botrules-tab') || 'todas'; } catch { return 'todas'; }
    });
    const ordenGuardado = useRef(false);

    useEffect(() => {
        if (!user) return;
        const unsubReglas = onSnapshot(collection(db, `users/${user.uid}/botRules`), (snap) => {
            setReglas(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order || 0) - (b.order || 0)));
        });
        const unsubEstado = onSnapshot(doc(db, `users/${user.uid}/config/botRulesStatus`), (snap) => setEstado(snap.exists() ? snap.data() : null));
        return () => { unsubReglas(); unsubEstado(); };
    }, [user]);

    // Una vez: guarda la categoría de las respuestas viejas y deja el orden del bot igual al de las pestañas
    useEffect(() => {
        if (!reglas?.length || ordenGuardado.current) return;
        ordenGuardado.current = true;
        const ordenadas = ordenar(reglas);
        const faltaCategoria = reglas.some(r => INDICE_CATEGORIA[r.category] === undefined);
        const desordenadas = ordenadas.some((r, i) => r.id !== reglas[i].id);
        if (faltaCategoria || desordenadas) renumerar(user.uid, ordenadas).catch(e => console.error('No se pudo ordenar por categoría', e));
    }, [reglas, user]);

    const cambiarPestana = (id) => {
        setPestana(id);
        try { localStorage.setItem('hm-botrules-tab', id); } catch { /* sin almacenamiento: no pasa nada */ }
    };

    const ordenadas = useMemo(() => ordenar(reglas || []), [reglas]);
    const erroresPorId = useMemo(() => Object.fromEntries((estado?.ruleErrors || []).map(e => [e.id, e.error])), [estado]);

    // ¿El bot ya aplicó el último cambio?
    const ultimoCambio = Math.max(0, ...(reglas || []).map(r => r.updatedAt?.toMillis ? r.updatedAt.toMillis() : 0));
    const aplicado = estado?.appliedAt?.toMillis ? estado.appliedAt.toMillis() : 0;
    const botAlDia = estado && aplicado >= ultimoCambio;

    // 🧪 Probador: qué respondería el bot a un mensaje (mismo orden que el bot)
    const resultadoPrueba = useMemo(() => {
        const texto = normalizar(prueba);
        if (!texto || !reglas) return null;
        for (const r of ordenadas) {
            if (r.enabled === false) continue;
            try { if (compilar(r).test(texto)) return r; } catch { /* regla con error: el bot también la saltea */ }
        }
        return false;
    }, [prueba, reglas, ordenadas]);

    // Sube o baja una respuesta dentro de su categoría
    const mover = async (r, delta) => {
        const lista = [...ordenadas];
        const grupo = lista.filter(x => categoriaDe(x) === categoriaDe(r));
        const vecino = grupo[grupo.indexOf(r) + delta];
        if (!vecino) return;
        const i = lista.indexOf(r), j = lista.indexOf(vecino);
        [lista[i], lista[j]] = [lista[j], lista[i]];
        try { await renumerar(user.uid, lista); }
        catch (e) {
            console.error(e);
            setNotification({ show: true, message: 'No se pudo cambiar el orden.', type: 'error' });
        }
    };

    const alternar = async (r) => {
        try {
            await setDoc(doc(db, `users/${user.uid}/botRules/${r.id}`), { enabled: r.enabled === false, updatedAt: serverTimestamp() }, { merge: true });
        } catch (e) {
            console.error(e);
            setNotification({ show: true, message: 'No se pudo cambiar el estado.', type: 'error' });
        }
    };

    const conteo = useMemo(() => {
        const c = {};
        ordenadas.forEach(r => { const k = categoriaDe(r); c[k] = (c[k] || 0) + 1; });
        return c;
    }, [ordenadas]);

    const q = normalizar(busqueda);
    const visibles = useMemo(() => {
        let lista = ordenadas;
        if (q) lista = lista.filter(r => normalizar(`${r.name} ${(r.keywords || []).join(' ')} ${r.response}`).includes(q));
        else if (pestana !== 'todas') lista = lista.filter(r => categoriaDe(r) === pestana);
        return lista;
    }, [ordenadas, q, pestana]);

    // En "Todas" (o buscando) se agrupa por categoría; en una pestaña se muestra solo esa
    const grupos = useMemo(() => CATEGORIAS
        .map(c => ({ ...c, items: visibles.filter(r => categoriaDe(r) === c.id) }))
        .filter(g => g.items.length), [visibles]);

    const box = darkMode ? 'bg-black/20 border-white/5' : 'bg-slate-50 border-slate-200';
    const limite = (reglas?.length || 0) >= MAX_REGLAS;
    const categoriaNueva = INDICE_CATEGORIA[pestana] !== undefined ? pestana : 'otras';
    const verAgrupado = q || pestana === 'todas';

    const fila = (r) => {
        const grupo = ordenadas.filter(x => categoriaDe(x) === categoriaDe(r));
        const pos = grupo.indexOf(r);
        const error = erroresPorId[r.id];
        const apagada = r.enabled === false;
        return (
            <div key={r.id} className={`p-3 rounded-xl border flex items-center gap-3 ${box} ${error ? 'border-rose-500/50' : ''} ${apagada ? 'opacity-50' : ''}`}>
                {!q && (
                    <div className="flex flex-col shrink-0">
                        <button onClick={() => mover(r, -1)} disabled={pos === 0} className="p-0.5 text-slate-400 hover:text-indigo-500 disabled:opacity-20" aria-label="Subir prioridad"><ArrowUp size={14} /></button>
                        <button onClick={() => mover(r, 1)} disabled={pos === grupo.length - 1} className="p-0.5 text-slate-400 hover:text-indigo-500 disabled:opacity-20" aria-label="Bajar prioridad"><ArrowDown size={14} /></button>
                    </div>
                )}
                {r.imagePath
                    ? <Miniatura uid={user.uid} ruta={r.imagePath} className="w-12 h-12 rounded-lg shrink-0" />
                    : <div className={`w-12 h-12 rounded-lg shrink-0 flex items-center justify-center ${darkMode ? 'bg-white/5' : 'bg-white'}`}><MessageSquareText size={16} className="text-slate-400" /></div>}
                <button onClick={() => setEditando(r)} className="min-w-0 flex-1 text-left">
                    <p className={`text-sm font-bold truncate ${theme.text}`}>{r.name || 'Sin nombre'}</p>
                    <p className={`text-[11px] truncate ${theme.subtext}`}>
                        {r.pattern ? <span className="font-mono">avanzado</span> : (r.keywords || []).join(', ')}
                        {r.matchMode === 'exact' && !r.pattern ? ' · exacto' : ''}
                    </p>
                    {error && <p className="text-[10px] font-bold text-rose-500 truncate">⚠️ El bot la ignora: {error}</p>}
                </button>
                <label className="relative shrink-0 cursor-pointer" title={apagada ? 'Activar' : 'Desactivar'}>
                    <input type="checkbox" className="peer sr-only" checked={!apagada} onChange={() => alternar(r)} />
                    <span className={`block w-9 h-5 rounded-full transition-colors peer-checked:bg-emerald-500 ${darkMode ? 'bg-white/10' : 'bg-slate-300'}`} />
                    <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
                </label>
                <button onClick={() => setEditando(r)} className="p-2 rounded-lg text-slate-400 hover:text-indigo-500 shrink-0" aria-label="Editar"><Edit2 size={14} /></button>
            </div>
        );
    };

    return (
        <div className={`rounded-[2rem] overflow-hidden border ${theme.card}`}>
            <div className={`px-4 sm:px-6 py-4 border-b ${theme.cardHeader} flex flex-wrap items-center justify-between gap-2`}>
                <h3 className={`font-black text-xs uppercase tracking-wider ${theme.subtext} flex items-center gap-2`}><MessageSquareText size={14} /> Respuestas automáticas</h3>
                <div className="flex items-center gap-2">
                    {estado ? (
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded ${botAlDia ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber-500/15 text-amber-500'}`}>
                            {botAlDia ? `BOT ACTUALIZADO · ${estado.activeCount ?? 0} ACTIVAS` : 'ESPERANDO AL BOT'}
                        </span>
                    ) : (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-500/15 text-slate-500">BOT SIN CONECTAR</span>
                    )}
                    <button onClick={() => setEditando({ ...VACIA, category: categoriaNueva })} disabled={limite || !reglas} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-xl font-bold text-xs flex items-center gap-1.5">
                        <Plus size={14} /> Nueva
                    </button>
                </div>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
                {!estado?.seeded && (
                    <div className={`p-3 rounded-xl border border-sky-500/30 bg-sky-500/5 text-xs ${darkMode ? 'text-sky-400' : 'text-sky-600'}`}>
                        Al encender el bot actualizado se van a cargar acá las respuestas que ya tenía (catálogo, precios, medios de pago...) para que las puedas editar.
                    </div>
                )}
                {(estado?.mediaErrors || []).length > 0 && (
                    <div className="p-3 rounded-xl border border-rose-500/30 bg-rose-500/5 text-xs text-rose-500 flex gap-2">
                        <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                        <span>El bot no pudo guardar {estado.mediaErrors.length} imagen(es): {estado.mediaErrors.map(e => e.error).join(' · ')}</span>
                    </div>
                )}

                {/* PROBADOR */}
                <div className={`p-3 rounded-2xl border ${box}`}>
                    <label className={`text-[10px] font-bold uppercase ${theme.subtext} flex items-center gap-1.5`}><FlaskConical size={12} /> Probar un mensaje</label>
                    <input className={theme.input + ' w-full mt-1 px-3 py-2 rounded-xl text-sm outline-none border'} placeholder='Ej: "cuánto sale netflix?"' value={prueba} onChange={e => setPrueba(e.target.value)} />
                    {resultadoPrueba !== null && (
                        <p className={`text-xs mt-2 ${theme.text}`}>
                            {resultadoPrueba
                                ? <>Responde: <button className="font-bold text-emerald-500 hover:underline" onClick={() => setEditando(resultadoPrueba)}>{resultadoPrueba.name}</button>
                                    <span className={theme.subtext}> · {CATEGORIAS[INDICE_CATEGORIA[categoriaDe(resultadoPrueba)]].label}</span></>
                                : <>Ninguna respuesta coincide → <b>contesta la IA</b>.</>}
                        </p>
                    )}
                    <p className="text-[10px] text-slate-500 mt-1">Si el cliente manda una foto, o habla de errores, códigos o "no me funciona", contesta la IA aunque haya coincidencia.</p>
                </div>

                {/* PESTAÑAS POR CATEGORÍA */}
                {reglas && reglas.length > 0 && (
                    <SegmentedTabs
                        size="sm"
                        darkMode={darkMode}
                        value={q ? '' : pestana}
                        onChange={(id) => { setBusqueda(''); cambiarPestana(id); }}
                        tabs={[
                            { id: 'todas', label: 'Todas', icon: Layers, count: ordenadas.length, activeText: 'text-emerald-400' },
                            ...CATEGORIAS.map(c => ({ id: c.id, label: c.label, shortLabel: c.shortLabel, icon: c.icon, count: conteo[c.id] || 0, activeText: 'text-emerald-400' }))
                        ]}
                    />
                )}

                {reglas && reglas.length > 6 && (
                    <div className="relative">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input className={theme.input + ' w-full pl-9 pr-3 py-2 rounded-xl text-sm outline-none border'} placeholder="Buscar en todas las respuestas..." value={busqueda} onChange={e => setBusqueda(e.target.value)} />
                    </div>
                )}

                {/* LISTA */}
                {!reglas ? (
                    <p className={`text-xs ${theme.subtext}`}>Cargando...</p>
                ) : reglas.length === 0 ? (
                    <p className={`text-xs ${theme.subtext}`}>Todavía no hay respuestas.</p>
                ) : visibles.length === 0 ? (
                    <div className={`p-6 rounded-xl border border-dashed text-center ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
                        <p className={`text-xs ${theme.subtext}`}>{q ? 'Ninguna respuesta coincide con la búsqueda.' : 'Todavía no hay respuestas en esta categoría.'}</p>
                        {!q && <button onClick={() => setEditando({ ...VACIA, category: categoriaNueva })} className="mt-2 text-xs font-bold text-indigo-500 hover:underline">+ Crear la primera</button>}
                    </div>
                ) : verAgrupado ? (
                    <div className="space-y-5">
                        {grupos.map(({ id, label, icon, items }) => {
                            const Icono = icon;
                            return (
                                <section key={id} className="space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className={`text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 ${theme.subtext}`}>
                                            <Icono size={12} /> {label} <span className="font-bold opacity-60">({items.length})</span>
                                        </h4>
                                        {!q && <button onClick={() => cambiarPestana(id)} className="text-[10px] font-bold text-indigo-500 hover:underline">Ver solo esta</button>}
                                    </div>
                                    {items.map(fila)}
                                </section>
                            );
                        })}
                    </div>
                ) : (
                    <div className="space-y-2">{visibles.map(fila)}</div>
                )}
                <p className="text-[10px] text-slate-500">El bot revisa las categorías en el orden de las pestañas y, dentro de cada una, de arriba hacia abajo: responde la primera que coincide. Las nuevas quedan primeras en su categoría. Las imágenes se optimizan para WhatsApp y el bot las guarda en su carpeta <b>assets/</b>.</p>
            </div>

            {editando && (
                <EditorRespuesta
                    uid={user.uid}
                    inicial={editando}
                    todas={reglas || []}
                    darkMode={darkMode}
                    theme={theme}
                    setNotification={setNotification}
                    onClose={() => setEditando(null)}
                    onSaved={() => setEditando(null)}
                />
            )}
        </div>
    );
};

export default BotRules;
