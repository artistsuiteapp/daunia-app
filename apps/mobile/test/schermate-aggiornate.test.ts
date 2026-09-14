/**
 * Ogni schermata si ridisegna quando arrivano i dati nuovi.
 *
 * PERCHE ESISTE
 *
 * "Le notizie non si aggiornano" e stato corretto sei volte. Ogni correzione
 * era giusta e riguardava un anello solo della catena: l'ingest, il cron, il
 * bundle scaricato da GitHub. L'anello in fondo, lo schermo, non l'ha mai
 * guardato nessuno. `useDati()` stava dentro `Screen`, e da li non poteva far
 * ridisegnare la schermata che calcola gli articoli: i dati nuovi arrivavano in
 * memoria e la schermata restava quella di prima, su tutte le 38.
 *
 * Non si vedeva nelle prove perche per controllare si usciva e si rientrava,
 * e rientrando la schermata si ricostruisce. Le schede in basso invece restano
 * montate per tutta la vita dell'app: Home, Partite e Notizie mostravano i dati
 * del momento in cui erano state aperte la prima volta.
 *
 * La regola e semplice e questo test la fa rispettare anche alle schermate che
 * non esistono ancora.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const APP = fileURLToPath(new URL('../app', import.meta.url));

function schermate(cartella = APP): string[] {
  const fuori: string[] = [];
  for (const nome of readdirSync(cartella)) {
    const percorso = join(cartella, nome);
    if (statSync(percorso).isDirectory()) fuori.push(...schermate(percorso));
    else if (nome.endsWith('.tsx') && nome !== '_layout.tsx' && nome !== '+html.tsx') fuori.push(percorso);
  }
  return fuori;
}

test('ogni schermata chiama useDati(), cosi i dati nuovi si vedono senza uscire e rientrare', () => {
  const tutte = schermate();
  assert.ok(tutte.length > 30, `trovate solo ${tutte.length} schermate: il percorso di app/ e cambiato?`);
  const dimenticate = tutte
    .filter((f) => !/\buseDati\(\)/.test(readFileSync(f, 'utf8')))
    .map((f) => relative(APP, f));
  assert.deepEqual(dimenticate, [],
    `queste schermate restano ai dati di quando si sono aperte: chiamino useDati() in cima al componente`);
});

test('useDati() sta in cima alla schermata, prima di ogni uscita anticipata', () => {
  const fuoriPosto = schermate().filter((f) => {
    const s = readFileSync(f, 'utf8');
    const corpo = s.slice(s.indexOf('export default function'));
    const primaUscita = corpo.search(/\n\s*if \([^)]*\)\s*(\{\s*)?return\b/);
    const chiamata = corpo.indexOf('useDati()');
    return chiamata < 0 || (primaUscita >= 0 && primaUscita < chiamata);
  }).map((f) => relative(APP, f));
  // un hook dopo un return condizionale rompe le regole di React e fa crashare la schermata
  assert.deepEqual(fuoriPosto, []);
});
