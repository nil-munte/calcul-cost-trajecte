# Cost de trajecte

[![CI/CD](https://github.com/nil-munte/calcul-cost-trajecte/actions/workflows/ci.yml/badge.svg)](https://github.com/nil-munte/calcul-cost-trajecte/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Calculadora del cost real d'un viatge en cotxe elèctric, que combina l'energia carregada a casa i fora. Té historial sincronitzat amb el compte de Google.

**Producció:** <https://nil-munte.github.io/calcul-cost-trajecte/>

## Funcionalitats

- Càlcul per consum (km × Wh/km) o per estat de la bateria (% inicial i final).
- Càrregues externes amb preu propi; la resta s'imputa a la tarifa de casa, amb pèrdues de càrrega.
- Historial per usuari amb justificants (imatges comprimides al client), edició i exportació a CSV.
- Preferències sincronitzades entre dispositius.

## Stack

| Capa | Tecnologia |
| --- | --- |
| Frontend | HTML, CSS i JavaScript sense build |
| Autenticació | Firebase Authentication (Google) |
| Dades | Cloud Firestore |
| Hosting | GitHub Pages, desplegat amb GitHub Actions |
| Qualitat | ESLint, html-validate, Playwright, emulador de Firestore |

## Desenvolupament

Requereix Node 24 (`.nvmrc`). Les proves de regles necessiten Java 21.

```bash
npm ci
npm start            # http://localhost:8080
npm run lint
npm run test:e2e
npm run test:rules
```

Per treballar amb dades reals, copia `public/firebase-config.example.js` a `public/firebase-config.js` i omple-hi la configuració d'un projecte de Firebase. Aquest fitxer està ignorat per git.

## Estructura

```
public/               aplicació estàtica (arrel publicada)
  assets/             CSS i JavaScript
firestore.rules       regles de seguretat de Firestore
scripts/              eines de desplegament
tests/e2e/            proves de navegador (Playwright)
tests/rules/          proves de les regles (emulador)
docs/                 arquitectura i operació
```

## Desplegament

Cada push a `main` passa el lint i les proves i, si tot és correcte, publica `public/` a GitHub Pages. La configuració de Firebase s'injecta en desplegar, a partir de les variables del repositori. Les regles de Firestore es despleguen amb el workflow manual *Deploy Firestore rules*. Vegeu [docs/operations.md](docs/operations.md).

## Documentació

- [Arquitectura i model de dades](docs/architecture.md)
- [Operació i configuració d'entorns](docs/operations.md)
- [Política de seguretat](SECURITY.md)
- [Registre de canvis](CHANGELOG.md)

## Llicència

[MIT](LICENSE)
