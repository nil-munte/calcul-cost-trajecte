# Cost de viatge Tesla

Calculadora del cost d'un viatge amb el Tesla (casa + càrregues de fora), amb historial
desat al teu compte de Google per veure'l des de qualsevol dispositiu.

Fitxers:

- `index.html`: la pàgina.
- `firebase-config.js`: la configuració de Firebase (la fas tu al pas 4).
- `firestore.rules`: les regles que fan que cadascú només vegi les seves dades (pas 3).

## 1. Publicar a GitHub Pages

1. Crea un repositori a GitHub, per exemple `cost-viatge-tesla`. Ha de ser **públic**:
   amb el pla gratuït, GitHub Pages només funciona amb repositoris públics.
   El que és públic és el codi. Els viatges no hi són, són a Firebase.
2. Puja `index.html`, `firebase-config.js`, `firestore.rules` i aquest `README.md`
   (Add file > Upload files).
3. A Settings > Pages, a Source tria **Deploy from a branch**, branca `main`, carpeta `/ (root)`.
4. En uns minuts (fins a 10) la pàgina serà a `https://EL_TEU_USUARI.github.io/cost-viatge-tesla/`.

## 2. Crear el projecte a Firebase

1. Ves a <https://console.firebase.google.com> i entra amb el teu Gmail.
2. Add project. Posa-li un nom i desactiva Google Analytics (no cal).
3. Build > **Authentication** > Get started > Sign-in method > **Google** > Enable.
   Tria el teu correu com a correu d'assistència i desa.
4. Build > **Firestore Database** > Create database. Tria una ubicació d'Europa
   i el mode de producció.

No enllacis cap compte de facturació: el pla gratuït (Spark) és suficient.

## 3. Regles de seguretat

A Firestore Database > Rules, esborra el que hi ha, enganxa el contingut de `firestore.rules`
i prem **Publish**.

Opcional: si vols que només entris tu, canvia la condició per
`request.auth.token.email == 'el.teu@gmail.com'`.

## 4. Configuració de la pàgina

1. A Project settings (la roda dentada) > Your apps, prem la icona web `</>` i registra una app
   (no cal Firebase Hosting).
2. Copia l'objecte `firebaseConfig` que et mostra.
3. A GitHub, edita `firebase-config.js` i enganxa-hi els quatre valors
   (`apiKey`, `authDomain`, `projectId`, `appId`). Desa (commit).

## 5. Autoritzar el domini

A Authentication > Settings > **Authorized domains** > Add domain, afegeix
`EL_TEU_USUARI.github.io` (només el domini, sense la ruta).

Sense aquest pas, l'inici de sessió falla amb l'error «domini no autoritzat».

## 6. Provar-ho

Obre la pàgina, prem **Entrar amb Google**, calcula un viatge i prem **Desar viatge**.
Entra des del mòbil amb el mateix compte i hi hauràs de veure el mateix historial.

## Notes

- Les dades es guarden a Firestore, a `users/<el teu id>/trips`. El preu de casa, el consum
  i les pèrdues també es sincronitzen (`users/<el teu id>/prefs/main`).
- Els justificants (captures de les càrregues o del consum del cotxe, tiquets) es guarden també a Firestore, dins de cada viatge
  (`users/<el teu id>/trips/<viatge>/images`). Es redimensionen i es comprimeixen al navegador
  abans de pujar-los (uns 100-190 KB cadascun, màxim 8 per viatge), de manera que no cal Firebase
  Storage ni cap compte de facturació.
- El pla gratuït de Firebase té una quota diària d'ús. Per a un ús personal n'hi ha de sobres.
- Per canviar la pàgina, edita `index.html` al repositori. Cal esperar uns minuts perquè es publiqui.
