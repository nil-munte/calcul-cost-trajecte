# Operació

## Entorns

| Entorn | Hosting | Projecte Firebase |
| --- | --- | --- |
| Local | `npm start` | El de `public/firebase-config.js`, o cap |
| CI | — | Emulador (`demo-cost-trajecte`) |
| Producció | GitHub Pages | Variables del repositori |

## Configuració del repositori

**Variables** (Settings › Secrets and variables › Actions › Variables):

| Variable | Origen |
| --- | --- |
| `FIREBASE_API_KEY` | Firebase › Project settings › Your apps › `apiKey` |
| `FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `FIREBASE_PROJECT_ID` | `projectId` |
| `FIREBASE_APP_ID` | `appId` |
| `FIREBASE_APPCHECK_SITE_KEY` | Clau de lloc de reCAPTCHA v3 registrada a App Check (opcional) |

**Secret** (environment `production`):

| Secret | Ús |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | JSON d'un compte de servei amb el rol *Firebase Rules Admin*, per al workflow *Deploy Firestore rules* |

Després de canviar les variables, cal tornar a executar el workflow *CI/CD* a `main`.

## Projecte Firebase

1. Authentication › Sign-in method: activar **Google**.
2. Authentication › Settings › Authorized domains: afegir `nil-munte.github.io`.
3. Firestore: crear la base de dades en una regió d'Europa, en mode producció.
4. Regles: executar el workflow *Deploy Firestore rules*, o `npx firebase deploy --only firestore:rules --project <id>`.
5. Recomanat: restringir la clau d'API per referent HTTP a `https://nil-munte.github.io/*` (Google Cloud › APIs & Services › Credentials) i activar App Check.

## Publicació

- Els canvis entren per pull request; la CI ha de passar abans de fusionar.
- El push a `main` desplega automàticament. Per tornar enrere, reverteix el commit.
- Versiona amb etiquetes `vX.Y.Z` i anota els canvis a `CHANGELOG.md`.
