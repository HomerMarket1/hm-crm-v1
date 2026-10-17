// src/utils/backupExport.js
// 💾 Copia de seguridad COMPLETA y ordenada.
// - Excel (.xlsx) con una hoja por sección: Resumen, Catálogo, Ventas y Stock, Clientes, Mudanzas, Configuración.
// - JSON con todos los datos crudos (para restaurar o migrar).
// Incluye servicios/paquetes SIN stock ni ventas (salen con 0).
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { cleanServiceName } from './accessMessage';

const FREE = ['libre', 'espacio libre', 'disponible', ''];
const PROBLEM = ['caída', 'caida', 'actualizar', 'dominio', 'expired', 'garantía', 'garantia', 'problemas', 'seguimiento', 'reposicion'];
const TYPE_ORDER = { Cuenta: 0, Perfil: 1, Paquete: 2 };

// Respuestas automáticas: mismas categorías y orden que el panel (components/BotRules.jsx)
const RULE_CATEGORIES = [
    { id: 'saludos', label: 'Saludos y horario' }, { id: 'soporte', label: 'Soporte y reglas' },
    { id: 'pagos', label: 'Pagos' }, { id: 'promos', label: 'Promociones' },
    { id: 'plataformas', label: 'Plataformas y precios' }, { id: 'otras', label: 'Otras' }
];
const RULE_CATEGORY_INDEX = Object.fromEntries(RULE_CATEGORIES.map((c, i) => [c.id, i]));
const RULE_CATEGORY_BY_NAME = { // respuestas cargadas antes de que existieran las categorías
    'Saludo': 'saludos', 'Horario de atención': 'saludos',
    'Reporte técnico': 'soporte', 'No vendemos IPTV': 'soporte', 'Sin demos ni pruebas gratis': 'soporte',
    'Regla 1 perfil = 1 dispositivo': 'soporte', 'Guía Netflix TV': 'soporte', 'Guía Prime Video': 'soporte',
    'Dice que ya pagó': 'pagos', 'Medios de pago': 'pagos', 'Abitab / RedPagos': 'pagos', 'Transferencia bancaria': 'pagos',
    'MiDinero': 'pagos', 'OCA Blue': 'pagos'
};
const ruleCategory = (r) => RULE_CATEGORY_INDEX[r.category] !== undefined ? r.category
    : RULE_CATEGORY_BY_NAME[r.name] || (r.origin === 'rules.js' ? 'plataformas' : 'otras');

// ---------- utilidades ----------
const toDate = (value) => {
    if (!value) return null;
    if (typeof value.toDate === 'function') return value.toDate();             // Timestamp de Firestore
    if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {      // "YYYY-MM-DD" sin zona horaria
        const [y, m, d] = value.split('-').map(Number);
        return new Date(y, m - 1, d);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

const byText = (a, b) => (a || '').localeCompare(b || '', 'es', { numeric: true, sensitivity: 'base' });
const baseName = (name) => cleanServiceName(name || '').replace(/\s+completa\b.*$/i, '').trim().toLowerCase();

const saleStatus = (s) => {
    const c = (s.client || '').trim().toLowerCase();
    if (FREE.includes(c)) return 'Libre';
    if (PROBLEM.includes(c)) return s.client;          // Caída, Actualizar, Garantía...
    if (c === 'admin') return 'Admin';
    return 'Vendido';
};

const daysLeft = (endDate) => {
    const d = toDate(endDate);
    if (!d || typeof endDate !== 'string') return null;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return Math.round((d - today) / 86400000);
};

// ¿Esta venta pertenece a este servicio del catálogo? (incluye nombres derivados como en la Bóveda)
const belongsTo = (sale, item) => {
    if ((sale.service || '') === item.name) return true;
    if (baseName(sale.service) !== baseName(item.name)) return false;
    if (item.type === 'Cuenta') return /completa/i.test(sale.service || '');
    if (item.type === 'Perfil') return (sale.service || '').trim().toLowerCase() === baseName(item.name);
    return false;
};

// ---------- celdas con estilo ----------
const HEADER = { fontWeight: 'bold', color: '#FFFFFF', backgroundColor: '#4F46E5', align: 'center' };
const header = (titles) => titles.map(t => ({ value: t, ...HEADER }));
const text = (v) => ({ value: v == null ? '' : String(v), type: String });
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v))) ? null : { value: Number(v), type: Number };
const money = (v) => (v == null || v === '' || Number.isNaN(Number(v))) ? null : { value: Number(v), type: Number, format: '#,##0' };
const date = (v, format = 'dd/mm/yyyy') => { const d = toDate(v); return d ? { value: d, type: Date, format } : null; };
const bold = (v) => ({ value: String(v), type: String, fontWeight: 'bold' });

// ---------- lectura de lo que no está en memoria ----------
const readExtra = async (uid) => {
    const safeGetDocs = async (path) => {
        try { return (await getDocs(collection(db, path))).docs.map(d => ({ id: d.id, ...d.data() })); }
        catch (e) { console.warn(`Backup: no se pudo leer ${path}:`, e.message); return []; }
    };
    const safeGetDoc = async (path) => {
        try { const s = await getDoc(doc(db, path)); return s.exists() ? s.data() : null; }
        catch (e) { console.warn(`Backup: no se pudo leer ${path}:`, e.message); return null; }
    };
    const [moveHistory, clients, branding, billing, businessHours, botRules] = await Promise.all([
        safeGetDocs(`users/${uid}/moveHistory`),
        safeGetDocs(`users/${uid}/clients`),
        safeGetDoc(`users/${uid}/config/branding`),
        safeGetDoc(`users/${uid}/config/billing`),
        safeGetDoc(`users/${uid}/config/businessHours`),
        safeGetDocs(`users/${uid}/botRules`)
    ]);
    return { moveHistory, clients, branding, billing, businessHours, botRules };
};

// Imágenes de las respuestas automáticas (solo para el JSON: pesan, van en base64)
const readBotMedia = async (uid) => {
    try { return (await getDocs(collection(db, `users/${uid}/botMedia`))).docs.map(d => ({ id: d.id, ...d.data() })); }
    catch (e) { console.warn('Backup: no se pudo leer botMedia:', e.message); return []; }
};

const stamp = () => new Date().toISOString().slice(0, 10);

// =====================================================================
// 📗 EXCEL ORDENADO
// =====================================================================
export const exportBackupExcel = async ({ uid, sales = [], catalog = [], clients: clientsFromApp = [] }) => {
    const { default: writeXlsxFile } = await import('write-excel-file/browser');
    const extra = await readExtra(uid);
    const clients = extra.clients.length ? extra.clients : clientsFromApp;

    // --- Catálogo (TODOS los servicios, también los que no tienen nada) ---
    const catalogSorted = [...catalog].sort((a, b) => (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9) || byText(a.name, b.name));
    const catalogRows = catalogSorted.map(item => {
        const related = sales.filter(s => belongsTo(s, item));
        const free = related.filter(s => saleStatus(s) === 'Libre').length;
        const sold = related.filter(s => saleStatus(s) === 'Vendido').length;
        const other = related.length - free - sold;
        return [
            text(item.name), text(item.type || ''), money(item.cost),
            num(item.defaultSlots), num(item.type === 'Cuenta' ? (item.profileCapacity || (Number(item.defaultSlots) > 1 ? item.defaultSlots : '')) : ''),
            num(free), num(sold), num(other), num(related.length),
            text(related.length === 0 ? 'Sin stock ni ventas' : ''), text(item.id)
        ];
    });

    // --- Ventas y stock: por servicio, cuenta (correo) y perfil ---
    const salesSorted = [...sales].sort((a, b) =>
        byText(a.service, b.service) || byText(a.email, b.email) || byText(a.profile, b.profile));
    const salesRows = salesSorted.map(s => [
        text(s.service), text(s.type || ''), text(saleStatus(s)),
        text(FREE.includes((s.client || '').trim().toLowerCase()) ? '' : s.client),
        text(s.phone), text(s.email), text(s.pass), text(s.profile), text(s.pin),
        date(s.endDate), num(daysLeft(s.endDate)), money(s.cost),
        date(s.clientSince), date(s.createdAt), text(s.markedForDeletion ? 'Sí' : ''), text(s.id)
    ]);

    // --- Clientes con cantidad de servicios activos ---
    const activeByPhone = {};
    sales.forEach(s => {
        if (saleStatus(s) !== 'Vendido') return;
        const key = (s.phone || '').replace(/\D/g, '') || (s.client || '').toLowerCase();
        activeByPhone[key] = (activeByPhone[key] || 0) + 1;
    });
    const clientRows = [...clients].sort((a, b) => byText(a.name, b.name)).map(c => {
        const key = (c.phone || '').replace(/\D/g, '') || (c.name || '').toLowerCase();
        return [text(c.name), text(c.phone), num(activeByPhone[key] || 0), text(c.id)];
    });

    // --- Historial de mudanzas (más recientes primero) ---
    const moveRows = [...extra.moveHistory]
        .sort((a, b) => (toDate(b.createdAt) || 0) - (toDate(a.createdAt) || 0))
        .map(m => [
            date(m.createdAt, 'dd/mm/yyyy hh:mm'), text(m.client), text(m.phone),
            text(m.from?.service), text(m.from?.email), text(m.from?.profile),
            text(m.to?.service), text(m.to?.email), text(m.to?.profile),
            text(m.oldAccountStatus), text(m.by)
        ]);

    // --- Respuestas automáticas del bot (por categoría y en el orden del panel) ---
    const rulesSorted = [...extra.botRules].sort((a, b) =>
        RULE_CATEGORY_INDEX[ruleCategory(a)] - RULE_CATEGORY_INDEX[ruleCategory(b)] || (a.order || 0) - (b.order || 0) || byText(a.name, b.name));
    const ruleRows = rulesSorted.map(r => [
        text(RULE_CATEGORIES[RULE_CATEGORY_INDEX[ruleCategory(r)]].label),
        text(r.name), text(r.enabled === false ? 'No' : 'Sí'),
        text((r.keywords || []).join(', ')),
        text(r.pattern ? 'Avanzado (patrón)' : (r.matchMode === 'exact' ? 'Palabra exacta' : 'Contiene')),
        text(r.pattern || ''), text(r.response || ''),
        text(r.imagePath || ''), text(r.requiresStock || ''), text(r.origin || 'panel'),
        date(r.updatedAt, 'dd/mm/yyyy hh:mm'), text(r.id)
    ]);

    // --- Configuración ---
    const DAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const configRows = [
        [bold('Marca'), text(extra.branding?.name || '')],
        [bold('Cobranzas automáticas'), text(extra.billing ? (extra.billing.enabled === false ? 'Pausadas' : 'Activas') : 'Por defecto (activas)')],
        [bold('Cobranzas Lun-Vie'), text(extra.billing?.weekdayTime || '10:00')],
        [bold('Cobranzas Sáb-Dom'), text(extra.billing?.weekendTime || '12:00')],
        ...[1, 2, 3, 4, 5, 6, 0].map(d => {
            const day = extra.businessHours?.schedule?.[d];
            return [bold(`Atención ${DAY[d]}`), text(day ? (day.open ? `${day.from} a ${day.to}` : 'Cerrado') : 'Por defecto')];
        }),
        [bold('Modo viaje'), text(extra.businessHours?.travelMode?.enabled ? `Activo${extra.businessHours.travelMode.until ? ` hasta ${extra.businessHours.travelMode.until}` : ''}` : 'Apagado')]
    ];

    // --- Resumen ---
    const count = (st) => sales.filter(s => saleStatus(s) === st).length;
    const summaryRows = [
        [{ value: 'Copia de seguridad HM CRM', type: String, fontWeight: 'bold', fontSize: 14 }],
        [bold('Generada'), date(new Date(), 'dd/mm/yyyy hh:mm')],
        [],
        [bold('Servicios en catálogo'), num(catalog.filter(c => c.type !== 'Paquete').length)],
        [bold('Paquetes en catálogo'), num(catalog.filter(c => c.type === 'Paquete').length)],
        [bold('Servicios/paquetes sin stock ni ventas'), num(catalogRows.filter(r => r[8]?.value === 0).length)],
        [],
        [bold('Registros totales (ventas + stock)'), num(sales.length)],
        [bold('Vendidos'), num(count('Vendido'))],
        [bold('Stock libre'), num(count('Libre'))],
        [bold('Admin'), num(count('Admin'))],
        [bold('Con problema (Caída, Garantía...)'), num(sales.length - count('Vendido') - count('Libre') - count('Admin'))],
        [],
        [bold('Clientes'), num(clients.length)],
        [bold('Mudanzas registradas'), num(extra.moveHistory.length)],
        [bold('Respuestas automáticas (activas / total)'), text(`${extra.botRules.filter(r => r.enabled !== false).length} / ${extra.botRules.length}`)]
    ];

    const sheets = [
        { sheet: 'Resumen', data: summaryRows, columns: [{ width: 38 }, { width: 22 }] },
        {
            sheet: 'Catálogo', stickyRowsCount: 1,
            data: [header(['Servicio', 'Tipo', 'Precio', 'Cupos', 'Perfiles de la cuenta', 'Stock libre', 'Vendidos', 'Otros estados', 'Total registros', 'Nota', 'ID']), ...catalogRows],
            columns: [{ width: 34 }, { width: 10 }, { width: 10 }, { width: 8 }, { width: 18 }, { width: 11 }, { width: 10 }, { width: 13 }, { width: 14 }, { width: 20 }, { width: 24 }]
        },
        {
            sheet: 'Ventas y Stock', stickyRowsCount: 1,
            data: [header(['Servicio', 'Tipo', 'Estado', 'Cliente', 'Celular', 'Correo', 'Contraseña', 'Perfil', 'PIN', 'Vencimiento', 'Días restantes', 'Precio', 'Cliente desde', 'Creado', 'No renueva', 'ID']), ...salesRows],
            columns: [{ width: 28 }, { width: 9 }, { width: 11 }, { width: 24 }, { width: 14 }, { width: 30 }, { width: 16 }, { width: 14 }, { width: 8 }, { width: 12 }, { width: 13 }, { width: 9 }, { width: 13 }, { width: 12 }, { width: 11 }, { width: 24 }]
        },
        {
            sheet: 'Clientes', stickyRowsCount: 1,
            data: [header(['Cliente', 'Celular', 'Servicios activos', 'ID']), ...clientRows],
            columns: [{ width: 30 }, { width: 16 }, { width: 16 }, { width: 24 }]
        },
        {
            sheet: 'Mudanzas', stickyRowsCount: 1,
            data: [header(['Fecha', 'Cliente', 'Celular', 'Desde: servicio', 'Desde: correo', 'Desde: perfil', 'Hacia: servicio', 'Hacia: correo', 'Hacia: perfil', 'Cuenta anterior quedó', 'Por']), ...moveRows],
            columns: [{ width: 17 }, { width: 24 }, { width: 14 }, { width: 22 }, { width: 28 }, { width: 13 }, { width: 22 }, { width: 28 }, { width: 13 }, { width: 18 }, { width: 24 }]
        },
        {
            sheet: 'Respuestas automáticas', stickyRowsCount: 1,
            data: [header(['Categoría', 'Nombre', 'Activa', 'Palabras clave', 'Coincidencia', 'Patrón', 'Respuesta', 'Imagen', 'Requiere stock', 'Origen', 'Actualizada', 'ID']), ...ruleRows],
            columns: [{ width: 20 }, { width: 28 }, { width: 8 }, { width: 36 }, { width: 16 }, { width: 24 }, { width: 70 }, { width: 30 }, { width: 14 }, { width: 10 }, { width: 17 }, { width: 24 }]
        },
        { sheet: 'Configuración', data: configRows, columns: [{ width: 28 }, { width: 30 }] }
    ];

    await writeXlsxFile(sheets).toFile(`HM_Backup_${stamp()}.xlsx`);
    return { services: catalog.length, sales: sales.length, clients: clients.length, moves: extra.moveHistory.length, rules: extra.botRules.length };
};

// =====================================================================
// 🧩 JSON COMPLETO (datos crudos para restaurar / migrar)
// =====================================================================
const serialize = (value) => {
    if (value == null) return value;
    if (typeof value.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (Array.isArray(value)) return value.map(serialize);
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
    return value;
};

export const exportBackupJson = async ({ uid, sales = [], catalog = [] }) => {
    const [extra, botMedia] = await Promise.all([readExtra(uid), readBotMedia(uid)]);
    const payload = {
        app: 'HM CRM', version: 2, exportedAt: new Date().toISOString(),
        counts: { catalog: catalog.length, sales: sales.length, clients: extra.clients.length, moveHistory: extra.moveHistory.length, botRules: extra.botRules.length, botMedia: botMedia.length },
        catalog: serialize(catalog), sales: serialize(sales), clients: serialize(extra.clients),
        moveHistory: serialize(extra.moveHistory),
        botRules: serialize(extra.botRules),
        botMedia: serialize(botMedia), // imágenes de las respuestas (base64)
        config: serialize({ branding: extra.branding, billing: extra.billing, businessHours: extra.businessHours })
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `HM_Backup_${stamp()}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    return payload.counts;
};
