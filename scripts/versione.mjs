import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * Il segnaposto della versione pubblicata.
 *
 * PERCHE SERVE
 *
 * L'app aggiunta alla schermata Home dell'iPhone o al Dock del Mac tiene in
 * memoria la pagina con cui e partita, e non va a chiedere se ne e uscita una
 * nuova finche non la si chiude davvero dallo switcher. Chi la usa cosi resta
 * su una copia vecchia per giorni senza saperlo: si pubblica una cosa nuova e
 * la persona a cui serve non la vede.
 *
 * Questo file cambia a ogni pubblicazione. L'app lo rilegge quando torna in
 * primo piano e, se e cambiato, lo dice.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const FUORI = join(QUI, '..', 'apps/mobile/public/versione.json');

/*
 * Sul computer si chiede a git. Su Vercel no: la cartella .git non c'e, e il
 * comando falliva lasciando scritto "sconosciuto". L'identificativo del commit
 * lo passa Vercel in una variabile, ed e quello che serve per risalire da una
 * versione pubblicata al codice che c'era dentro.
 */
let commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7);
if (!commit) {
  try {
    commit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {
    commit = 'locale';
  }
}

const versione = `${commit}-${Date.now().toString(36)}`;
writeFileSync(FUORI, JSON.stringify({ versione, costruito: new Date().toISOString() }) + '\n');
console.log(`versione.json  ${versione}`);
