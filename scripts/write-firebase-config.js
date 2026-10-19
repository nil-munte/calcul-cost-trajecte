// Genera public/firebase-config.js a partir de les variables d'entorn del desplegament.
import { writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'public/firebase-config.js';
const keys = {
  apiKey: 'FIREBASE_API_KEY',
  authDomain: 'FIREBASE_AUTH_DOMAIN',
  projectId: 'FIREBASE_PROJECT_ID',
  appId: 'FIREBASE_APP_ID'
};

const config = Object.fromEntries(Object.entries(keys).map(([k, env]) => [k, process.env[env] ?? '']));
const missing = Object.entries(keys).filter(([k]) => !config[k]).map(([, env]) => env);

// Opcional: clau de lloc de Fraud Defense (reCAPTCHA Enterprise) per a App Check.
if (process.env.FIREBASE_APPCHECK_SITE_KEY) config.appCheckSiteKey = process.env.FIREBASE_APPCHECK_SITE_KEY;

if (missing.length) {
  console.warn(`::warning::Falten variables de Firebase (${missing.join(', ')}). L'historial quedarà desactivat.`);
}

writeFileSync(out, `export const firebaseConfig = ${JSON.stringify(config, null, 2)};\n`);
console.log(`Escrit ${out}`);
