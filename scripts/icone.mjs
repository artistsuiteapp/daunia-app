#!/usr/bin/env node
/**
 * Le icone dell'app, tutte da un file solo.
 *
 *   node scripts/icone.mjs
 *
 * PERCHE UNO SCRIPT E NON QUATTRO FILE FATTI A MANO
 *
 * Le icone sono cinque misure diverse della stessa cosa, con tre regole che si
 * dimenticano: iOS rifiuta la trasparenza, Android ritaglia un cerchio e mangia
 * i bordi, il web ne vuole una piccolissima. Rifarle a mano la seconda volta
 * significa sbagliarne una e scoprirlo al momento della pubblicazione.
 *
 * La sorgente e' apps/mobile/assets/brand/logo.png. Cambia quello e si rilancia
 * questo.
 *
 * LE TRE REGOLE
 *
 * iOS: l'icona non puo' avere canale alfa -- App Store Connect la respinge in
 * fase di caricamento, non a revisione. Quindi si appiattisce su un colore.
 *
 * Android: l'icona adattiva viene ritagliata a cerchio, a goccia o a
 * quadrato arrotondato a seconda del telefono. Solo il 66% centrale e'
 * garantito: quello che sta fuori puo' sparire. Il logo va quindi rimpicciolito
 * dentro la tela, non allargato fino ai bordi.
 *
 * Splash: qui la trasparenza serve, perche' il colore lo mette Expo dietro.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

import sharp from 'sharp';

const RADICE = path.join(import.meta.dirname, '..');
const LOGO = path.join(RADICE, 'apps/mobile/assets/brand/logo.png');
const FUORI = path.join(RADICE, 'apps/mobile/assets/brand');
const WEB = path.join(RADICE, 'apps/mobile/public');

/** Lo sfondo dell'app, lo stesso di app.json e del manifesto. */
const SFONDO = { r: 8, g: 8, b: 10, alpha: 1 };

/** Quanto del lato occupa il logo nell'icona adattiva di Android. */
const ZONA_SICURA = 0.66;

async function quadrato(lato, { opaco = false, dentro = 1 } = {}) {
  const misura = Math.round(lato * dentro);
  const logo = await sharp(LOGO).resize(misura, misura, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();

  const tela = sharp({
    create: {
      width: lato, height: lato, channels: 4,
      background: opaco ? SFONDO : { r: 0, g: 0, b: 0, alpha: 0 },
    },
  }).composite([{ input: logo, gravity: 'center' }]);

  /*
   * Per iOS non basta appiattire: `flatten` mette il colore dietro ma il
   * canale alfa resta, e App Store Connect guarda quello. Serve toglierlo
   * davvero con removeAlpha, se no il caricamento viene rifiutato -- e succede
   * al momento di pubblicare, non prima.
   */
  const compressa = { compressionLevel: 9, effort: 10 };
  return opaco
    ? tela.flatten({ background: SFONDO }).removeAlpha().png(compressa)
    : tela.png(compressa);
}

const pezzi = [
  { nome: 'icon.png', dove: FUORI, lato: 1024, opzioni: { opaco: true }, cosa: 'iOS e Android, senza trasparenza' },
  { nome: 'adaptive-icon.png', dove: FUORI, lato: 1024, opzioni: { dentro: ZONA_SICURA }, cosa: 'Android, dentro la zona sicura' },
  { nome: 'splash.png', dove: FUORI, lato: 1024, opzioni: {}, cosa: 'schermata di avvio, trasparente' },
  { nome: 'favicon.png', dove: FUORI, lato: 48, opzioni: {}, cosa: 'scheda del browser' },
  { nome: 'icon-192.png', dove: WEB, lato: 192, opzioni: {}, cosa: 'PWA' },
  { nome: 'icon-512.png', dove: WEB, lato: 512, opzioni: {}, cosa: 'PWA' },
  { nome: 'apple-touch-icon.png', dove: WEB, lato: 180, opzioni: { opaco: true }, cosa: 'schermata Home di iPhone' },
  // le due che disegna BrandMark dentro l'app
  { nome: 'logo-192.png', dove: FUORI, lato: 192, opzioni: {}, cosa: 'marchio nelle schermate' },
  { nome: 'logo-96.png', dove: FUORI, lato: 96, opzioni: {}, cosa: 'marchio piccolo' },
];

await mkdir(FUORI, { recursive: true });
await mkdir(WEB, { recursive: true });

for (const p of pezzi) {
  const immagine = await quadrato(p.lato, p.opzioni);
  const destinazione = path.join(p.dove, p.nome);
  const { size } = await immagine.toFile(destinazione);
  const kb = Math.round(size / 1024);
  console.log(`  ${p.nome.padEnd(22)} ${String(p.lato).padStart(4)}px  ${String(kb).padStart(4)} KB   ${p.cosa}`);
}

const icona = await sharp(path.join(FUORI, 'icon.png')).metadata();
if (icona.hasAlpha) {
  console.error('\nL\'icona iOS ha ancora il canale alfa: App Store Connect la rifiuterebbe.');
  process.exit(1);
}
console.log('\nFatte. L\'icona iOS non ha canale alfa.');
