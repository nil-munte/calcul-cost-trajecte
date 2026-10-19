// Genera les icones PNG i la imatge per a xarxes socials a partir de public/icons/logo.svg.
// Ús: npm run assets
import { readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const logo = readFileSync('public/icons/logo.svg', 'utf8');
const logoUri = 'data:image/svg+xml;base64,' + Buffer.from(logo).toString('base64');

const icons = [
  { file: 'public/icons/icon-192.png', size: 192 },
  { file: 'public/icons/icon-512.png', size: 512 },
  { file: 'public/icons/apple-touch-icon.png', size: 180, square: true },
  // Maskable: el logo dins de la zona segura (80 %) sobre el color de fons.
  { file: 'public/icons/icon-maskable-512.png', size: 512, square: true, pad: 0.1 }
];

const og = `<!DOCTYPE html><html><head>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700&family=Hanken+Grotesk:wght@500;600&display=block">
<style>
  body { margin: 0; width: 1200px; height: 630px; background: #0c1413; color: #e5f0ee; font-family: 'Hanken Grotesk', sans-serif;
    display: grid; grid-template-columns: 1fr 400px; align-items: center; gap: 56px; padding: 0 80px; box-sizing: border-box; }
  img { width: 112px; height: 112px; }
  h1 { font-family: 'Bricolage Grotesque', sans-serif; font-size: 76px; line-height: 1; letter-spacing: -0.02em; margin: 36px 0 22px; }
  p { font-size: 30px; color: #93a8a5; margin: 0; line-height: 1.3; }
  .card { background: #131f1e; border: 2px solid #263836; border-radius: 22px; padding: 36px; }
  .lbl { font-size: 18px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #93a8a5; }
  .total { font-family: 'Bricolage Grotesque', sans-serif; font-size: 88px; margin: 6px 0 24px; }
  .bar { display: flex; height: 18px; border-radius: 99px; overflow: hidden; }
  .row { display: flex; justify-content: space-between; font-size: 24px; margin-top: 18px; font-weight: 600; }
  .sw { display: inline-block; width: 16px; height: 16px; border-radius: 4px; margin-right: 10px; }
</style></head><body>
  <div>
    <img src="${logoUri}" alt="">
    <h1>Cost de viatge en elèctric</h1>
    <p>Quant t'ha costat el viatge, sumant la càrrega de casa i la de fora.</p>
  </div>
  <div class="card">
    <div class="lbl">Cost total del viatge</div>
    <div class="total">18,56 €</div>
    <div class="bar"><span style="width:60%;background:#3cc1ad"></span><span style="width:40%;background:#f0914a"></span></div>
    <div class="row"><span><i class="sw" style="background:#3cc1ad"></i>Casa</span><span>5,96 €</span></div>
    <div class="row"><span><i class="sw" style="background:#f0914a"></i>Fora</span><span>12,60 €</span></div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage();

for (const { file, size, square, pad = 0 } of icons) {
  await page.setViewportSize({ width: size, height: size });
  const inset = Math.round(size * pad);
  // Les icones «square» no poden tenir transparència: el sistema les retalla amb la seva pròpia forma.
  const bg = square ? '#0b7a6b' : 'transparent';
  const svg = square ? logo.replace(/rx="116"/, 'rx="0"') : logo;
  const uri = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  await page.setContent(`<body style="margin:0;background:${bg}"><img src="${uri}" style="display:block;width:${size - 2 * inset}px;height:${size - 2 * inset}px;margin:${inset}px"></body>`);
  await page.screenshot({ path: file, omitBackground: !square });
  console.log(file);
}

await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og, { waitUntil: 'networkidle' });
await page.evaluate(() => globalThis.document.fonts.ready);
await page.screenshot({ path: 'public/og-image.png' });
console.log('public/og-image.png');

await browser.close();
