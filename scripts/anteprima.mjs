import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * L'immagine che esce quando qualcuno incolla il link dell'app.
 *
 * PERCHE SERVE
 *
 * Incollato in un gruppo WhatsApp o sotto un post, l'indirizzo usciva nudo:
 * testo blu, niente altro. Nessuno ci clicca. Con questa immagine e i tag nella
 * testa della pagina esce una scheda con lo stemma e il nome, e il link
 * comincia a portare gente.
 *
 * LE MISURE
 *
 * 1200x630 e' il formato che WhatsApp, Facebook, X, Telegram e iMessage
 * ritagliano meglio. Sotto i 300 KB perche' alcuni servizi si rifiutano di
 * scaricare anteprime piu' pesanti e tornano a mostrare il link nudo.
 *
 * Il testo sta dentro il 90% centrale: le anteprime piccole di WhatsApp tagliano
 * i bordi.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const RADICE = join(QUI, '..');
const LOGO = join(RADICE, 'apps/mobile/assets/brand/logo.png');
const FUORI = join(RADICE, 'apps/mobile/public/anteprima.png');

const L = 1200;
const A = 630;
const FONDO = '#08080A';
const ROSSO = '#EE1111';

const testo = `
<svg width="${L}" height="${A}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="velo" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${ROSSO}" stop-opacity="0.22"/>
      <stop offset="55%" stop-color="${ROSSO}" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="${ROSSO}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="${L}" height="${A}" fill="${FONDO}"/>
  <rect width="${L}" height="${A}" fill="url(#velo)"/>
  <g font-family="Helvetica Neue, Helvetica, Arial, sans-serif">
    <text x="470" y="286" font-size="72" font-weight="800" font-style="italic" fill="#FFFFFF">Il Tifo della</text>
    <text x="470" y="372" font-size="72" font-weight="800" font-style="italic" fill="${ROSSO}">Daunia</text>
    <text x="474" y="428" font-size="27" font-weight="500" fill="rgba(235,235,245,0.62)">Pagelle, pronostici e la Curva. Per chi tifa Foggia.</text>
  </g>
  <rect x="0" y="${A - 6}" width="${L}" height="6" fill="${ROSSO}"/>
</svg>`;

const stemma = await sharp(LOGO).resize(300, 300, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

await sharp(Buffer.from(testo))
  .composite([{ input: stemma, left: 110, top: 165 }])
  // niente trasparenza: alcuni servizi la rendono su fondo bianco e il testo sparisce
  .flatten({ background: FONDO })
  .removeAlpha()
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(FUORI);

const { size } = await sharp(FUORI).metadata().then(async (m) => ({ ...m, size: (await import('node:fs')).statSync(FUORI).size }));
console.log(`anteprima.png  ${L}x${A}  ${Math.round(size / 1024)} KB`);
if (size > 300 * 1024) {
  console.error('troppo pesante: alcuni servizi non la scaricano e tornano al link nudo');
  process.exit(1);
}
