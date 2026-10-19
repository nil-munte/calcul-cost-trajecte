# Arquitectura

## Visió general

Aplicació estàtica servida per GitHub Pages. No hi ha backend propi: el navegador parla directament amb Firebase Authentication i Cloud Firestore, i les regles de Firestore són la frontera de seguretat.

```
Navegador ──► GitHub Pages (public/)
    │
    ├──► Firebase Auth (Google)
    └──► Cloud Firestore (users/{uid}/…)
```

El SDK de Firebase es carrega sota demanda des de `www.gstatic.com`, amb la versió fixada a `FB_VERSION` (`public/assets/app.js`). Si no hi ha configuració, l'aplicació funciona com a calculadora sense historial.

## Model de dades

| Ruta | Contingut |
| --- | --- |
| `users/{uid}/prefs/main` | Preu de casa, consum, pèrdues, mètode i capacitat |
| `users/{uid}/trips/{tripId}` | Dades d'entrada i resultats d'un viatge |
| `users/{uid}/trips/{tripId}/images/{imageId}` | Justificant en JPEG base64 (≤ 190 KB, màxim 8 per viatge) |

Les imatges es desen a Firestore en lloc de Cloud Storage perquè el projecte pugui funcionar amb el pla Spark, sense facturació.

## Seguretat

- Cada usuari només pot llegir i escriure sota `users/{uid}` (`firestore.rules`, cobert per `tests/rules/`).
- La configuració web de Firebase no és secreta; l'abús es limita amb els dominis autoritzats, les restriccions de la clau d'API i App Check.
- El text que introdueix l'usuari s'escapa abans d'inserir-lo al DOM, i l'exportació CSV neutralitza les fórmules.

## Càlcul

- **Per consum:** energia = km × consum. Casa = energia − kWh de fora (mínim 0).
- **Per bateria:** net = (% inicial − % final) × capacitat. Energia = net + kWh de fora. Casa = net (mínim 0).
- kWh al comptador de casa = kWh de casa / (1 − pèrdues).
