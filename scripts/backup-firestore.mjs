// Descarga una copia de los datos de tu usuario en Firestore (producción) a backups/*.json
// Uso: npm run backup
// Credenciales: variables BACKUP_EMAIL / BACKUP_PASSWORD o se piden por consola
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline/promises';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, collection, getDocs, terminate, Timestamp, GeoPoint, DocumentReference } from 'firebase/firestore';

const USER_COLLECTIONS = ['clients', 'sales', 'catalog', 'client_portal', 'config'];

// Convierte los tipos de Firestore a JSON legible (las fechas quedan en ISO)
function toJSON(value) {
    if (value instanceof Timestamp) return { __type: 'timestamp', value: value.toDate().toISOString() };
    if (value instanceof GeoPoint) return { __type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
    if (value instanceof DocumentReference) return { __type: 'ref', path: value.path };
    if (value instanceof Date) return { __type: 'timestamp', value: value.toISOString() };
    if (Array.isArray(value)) return value.map(toJSON);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, toJSON(v)]));
    return value;
}

async function ask(question) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(question);
    rl.close();
    return answer.trim();
}

const env = process.env;
const config = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
};
if (!config.apiKey || !config.projectId) {
    console.error('❌ Faltan las variables VITE_FIREBASE_* en el archivo .env');
    process.exit(1);
}

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);

const email = env.BACKUP_EMAIL || await ask('Correo de tu usuario de Firebase: ');
const password = env.BACKUP_PASSWORD || await ask('Contraseña: ');

const { user } = await signInWithEmailAndPassword(auth, email, password);
console.log(`🔐 Sesión iniciada como ${user.email} (uid ${user.uid})`);

const backup = {
    exportedAt: new Date().toISOString(),
    projectId: config.projectId,
    uid: user.uid,
    email: user.email,
    collections: {},
};

for (const name of USER_COLLECTIONS) {
    const snap = await getDocs(collection(db, 'users', user.uid, name));
    backup.collections[name] = Object.fromEntries(snap.docs.map((d) => [d.id, toJSON(d.data())]));
    console.log(`  • ${name}: ${snap.size} documentos`);
}

await mkdir('backups', { recursive: true });
const file = `backups/backup-${backup.exportedAt.replace(/[:.]/g, '-')}.json`;
await writeFile(file, JSON.stringify(backup, null, 2), 'utf8');
console.log(`✅ Backup guardado en ${file}`);

await signOut(auth);
await terminate(db);
process.exit(0);
