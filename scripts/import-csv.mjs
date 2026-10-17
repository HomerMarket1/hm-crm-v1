// Importa un CSV exportado con "Descargar Base de Datos" (HM_Backup_*.csv) a Firestore
// Uso: npm run import:csv -- HM_Backup_2026-10-16.csv              (proyecto real de Firebase)
//      npm run import:csv -- HM_Backup_2026-10-16.csv --emulator   (emuladores locales)
//      npm run import:csv -- HM_Backup_2026-10-16.csv --dry        (solo muestra el resumen, no escribe nada)
//      npm run import:csv -- HM_Backup_2026-10-16.csv --catalogo   (solo crea el catálogo, no toca ventas ni clientes)
// Usa el ID_Venta como ID del documento: si lo ejecutas dos veces no se duplican ventas.
// El CSV no trae el catálogo: se reconstruye con los servicios vendidos y el precio más repetido de cada uno.
// Credenciales: variables IMPORT_EMAIL / IMPORT_PASSWORD o se piden por consola
import { readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, collection, doc, getDocs, writeBatch, terminate, Timestamp } from 'firebase/firestore';

// Nombres que no son clientes reales (no se agregan al directorio de clientes)
const SYSTEM_CLIENTS = ['libre', 'espacio libre', 'disponible', 'admin', 'caída', 'caida', 'actualizar', 'dominio', 'falla',
    'garantía', 'garantia', 'problemas', 'vencido', 'cancelado', 'expired', 'reposicion', 'stock'];

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const useEmulator = args.includes('--emulator');
const dryRun = args.includes('--dry');
const onlyCatalog = args.includes('--catalogo');
if (!file) {
    console.error('❌ Indica el archivo: npm run import:csv -- HM_Backup_2026-10-16.csv');
    process.exit(1);
}

async function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
}

// Separa una línea CSV respetando campos entre comillas
function parseLine(line) {
    const out = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (quoted) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (c === '"') quoted = false;
            else cur += c;
        } else if (c === '"') quoted = true;
        else if (c === ',') { out.push(cur); cur = ''; }
        else cur += c;
    }
    out.push(cur);
    return out.map((v) => v.trim());
}

// "14/10/2026" (día/mes/año) -> Date a mediodía
function parseDate(text) {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text);
    return m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12) : null;
}

const raw = (await readFile(file, 'utf8')).replace(/^﻿/, '');
const [headerLine, ...lines] = raw.split(/\r?\n/).filter((l) => l.trim());
const headers = parseLine(headerLine);
const expected = ['ID_Venta', 'Cliente', 'Celular', 'Servicio', 'Tipo', 'Correo', 'Contraseña', 'Perfil', 'PIN', 'Vencimiento', 'Costo', 'Creado'];
if (expected.some((h, i) => headers[i] !== h)) {
    console.error(`❌ Columnas inesperadas. Se esperaba:\n   ${expected.join(',')}\n   y llegó:\n   ${headers.join(',')}`);
    process.exit(1);
}

const rows = lines.map((l) => Object.fromEntries(parseLine(l).map((v, i) => [headers[i], v])));

// El CSV viene ordenado del más nuevo al más viejo. Las filas sin fecha son las más antiguas:
// se les asigna la fecha más vieja conocida menos unos segundos, para que conserven el orden.
let lastDate = null;
let undated = 0;
const sales = rows.map((r) => {
    let createdAt = parseDate(r.Creado);
    if (createdAt) lastDate = createdAt;
    else {
        undated++;
        createdAt = new Date((lastDate ?? new Date()).getTime() - undated * 1000);
    }
    return {
        id: r.ID_Venta,
        data: {
            client: r.Cliente,
            phone: r.Celular,
            service: r.Servicio,
            type: r.Tipo || 'Perfil',
            email: r.Correo,
            pass: r['Contraseña'],
            profile: r.Perfil,
            pin: r.PIN,
            endDate: /^\d{4}-\d{2}-\d{2}$/.test(r.Vencimiento) ? r.Vencimiento : '',
            cost: Number(r.Costo) || 0,
            createdAt: Timestamp.fromDate(createdAt),
            isProblem: false,
        },
    };
});

// Directorio de clientes: uno por nombre, con el primer celular que aparezca
const clientsByName = new Map();
for (const { data } of sales) {
    const name = data.client.trim();
    if (!name || SYSTEM_CLIENTS.includes(name.toLowerCase())) continue;
    const key = name.toLowerCase();
    const prev = clientsByName.get(key);
    if (!prev) clientsByName.set(key, { name, phone: data.phone });
    else if (!prev.phone && data.phone) prev.phone = data.phone;
}

// Catálogo: un ítem por servicio vendido, con el mismo nombre que usan las ventas
// - Perfil: 1 cupo (perfil suelto)
// - Cuenta ("X Cuenta Completa"): 1 cupo, perfiles por cuenta 5 en Netflix y 4 en el resto (igual que la app)
// - Paquete ("X Paquete 2 Perfiles"): cada venta guarda el precio por perfil, así que el precio es ese valor × perfiles
const pricesByService = new Map();
for (const { data } of sales) {
    const name = data.service.trim();
    if (!name) continue;
    if (!pricesByService.has(name)) pricesByService.set(name, { type: data.type, counts: new Map() });
    const entry = pricesByService.get(name);
    if (data.cost > 0) entry.counts.set(data.cost, (entry.counts.get(data.cost) || 0) + 1);
}
const catalog = [...pricesByService.entries()].map(([name, { type, counts }]) => {
    const unitCost = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0]?.[0] ?? 0;
    const pkg = /paquete\s*(\d+)/i.exec(name);
    if (pkg) return { name, type: 'Paquete', cost: unitCost * Number(pkg[1]), defaultSlots: Number(pkg[1]) };
    if (type === 'Cuenta' || /cuenta completa/i.test(name)) {
        return { name, type: 'Cuenta', cost: unitCost, defaultSlots: 1, profileCapacity: /netflix/i.test(name) ? 5 : 4 };
    }
    return { name, type: 'Perfil', cost: unitCost, defaultSlots: 1 };
}).sort((a, b) => a.name.localeCompare(b.name));

console.log(`📄 ${file}`);
console.log(`  • Ventas: ${sales.length} (${sales.length - undated} con fecha, ${undated} sin fecha)${onlyCatalog ? ' — se omiten (--catalogo)' : ''}`);
console.log(`  • Clientes reales encontrados: ${clientsByName.size}${onlyCatalog ? ' — se omiten (--catalogo)' : ''}`);
console.log(`  • Catálogo: ${catalog.length} servicios`);
for (const c of catalog) console.log(`      ${c.type.padEnd(8)} ${c.name.padEnd(38)} ${String(c.cost).padStart(5)}`);
console.log(`  • Destino: ${useEmulator ? 'EMULADOR local' : 'Firebase REAL'}`);
if (dryRun) {
    console.log('🔎 Modo --dry: no se escribió nada.');
    process.exit(0);
}

const env = process.env;
const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);
if (useEmulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
}

const email = env.IMPORT_EMAIL || await ask('Correo de tu usuario de Firebase: ');
const password = env.IMPORT_PASSWORD || await ask('Contraseña: ');

let user;
try {
    ({ user } = await signInWithEmailAndPassword(auth, email, password));
} catch (err) {
    // En el emulador el usuario puede no existir todavía: se crea
    if (!useEmulator) throw err;
    ({ user } = await createUserWithEmailAndPassword(auth, email, password));
}
console.log(`🔐 Sesión iniciada como ${user.email} (uid ${user.uid})`);

const existing = await getDocs(collection(db, 'users', user.uid, 'clients'));
const existingNames = new Set(existing.docs.map((d) => String(d.data().name || '').trim().toLowerCase()));
const newClients = onlyCatalog ? [] : [...clientsByName.entries()].filter(([key]) => !existingNames.has(key)).map(([, c]) => c);

// No se repiten servicios que ya estén en el catálogo (mismo nombre)
const existingCatalog = await getDocs(collection(db, 'users', user.uid, 'catalog'));
const catalogNames = new Set(existingCatalog.docs.map((d) => String(d.data().name || '').trim().toLowerCase()));
const newCatalog = catalog.filter((c) => !catalogNames.has(c.name.toLowerCase()));

// Firestore permite hasta 500 escrituras por lote
const writes = [
    ...(onlyCatalog ? [] : sales.map((s) => ({ ref: doc(db, 'users', user.uid, 'sales', s.id), data: s.data }))),
    ...newClients.map((c) => ({
        ref: doc(collection(db, 'users', user.uid, 'clients')),
        data: { name: c.name, phone: c.phone || '', createdAt: new Date().toISOString() },
    })),
    ...newCatalog.map((c) => ({
        ref: doc(collection(db, 'users', user.uid, 'catalog')),
        data: { ...c, createdAt: Timestamp.now() },
    })),
];
for (let i = 0; i < writes.length; i += 450) {
    const batch = writeBatch(db);
    for (const w of writes.slice(i, i + 450)) batch.set(w.ref, w.data);
    await batch.commit();
    console.log(`  … ${Math.min(i + 450, writes.length)}/${writes.length}`);
}

if (!onlyCatalog) {
    console.log(`✅ Importadas ${sales.length} ventas y ${newClients.length} clientes nuevos (${clientsByName.size - newClients.length} ya existían).`);
}
console.log(`✅ Catálogo: ${newCatalog.length} servicios creados (${catalog.length - newCatalog.length} ya existían).`);

await signOut(auth);
await terminate(db);
process.exit(0);
