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

/*
 * La seconda meta dello stesso difetto: le memorie.
 *
 * Una schermata che si ridisegna non basta se i dati li tiene un useMemo che
 * non sa quando cambiano. Il 14 settembre ce n'erano sette: le Trasferte con
 * dipendenze vuote (l'elenco del primo disegno per sempre), le formazioni della
 * scheda partita e del Match Center, i giocatori da votare nelle pagelle, il
 * migliore del mese e il calendario di usePartite, da cui passano Partite, Home
 * e Statistiche. Qui si cercano con la stessa regola con cui sono stati trovati:
 * un useMemo o useCallback che usa un valore dei moduli dei dati deve avere la
 * versione dei dati fra le dipendenze.
 */
const RADICE = fileURLToPath(new URL('..', import.meta.url));
const MODULI_DATI = /\/(data|stampa|lineup|carriere|archivio)$/;

function sorgenti(cartella: string): string[] {
  const fuori: string[] = [];
  for (const nome of readdirSync(cartella)) {
    if (['node_modules', 'ios', 'android', 'dist'].includes(nome)) continue;
    const percorso = join(cartella, nome);
    if (statSync(percorso).isDirectory()) fuori.push(...sorgenti(percorso));
    else if (/\.tsx?$/.test(nome) && !/-core\.ts$/.test(nome) && nome !== 'data.ts') fuori.push(percorso);
  }
  return fuori;
}

test('ogni memoria che legge i dati del bundle ha la versione dei dati fra le dipendenze', () => {
  const ferme: string[] = [];
  for (const f of ['app', 'components', 'lib'].flatMap((c) => sorgenti(join(RADICE, c)))) {
    const s = readFileSync(f, 'utf8');
    const importati = new Set<string>();
    for (const m of s.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
      if (!MODULI_DATI.test(m[2])) continue;
      for (const n of m[1].split(',')) {
        const nome = n.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop();
        if (nome) importati.add(nome);
      }
    }
    if (!importati.size) continue;
    for (const m of s.matchAll(/use(Memo|Callback)\(/g)) {
      let i = m.index! + m[0].length;
      let profondita = 1;
      for (; i < s.length && profondita > 0; i += 1) {
        if (s[i] === '(') profondita += 1;
        else if (s[i] === ')') profondita -= 1;
      }
      const chiamata = s.slice(m.index!, i);
      const dipendenze = /\[([^[\]]*)\]\s*,?\s*\)$/.exec(chiamata)?.[1] ?? '';
      const corpo = chiamata.replace(/\[([^[\]]*)\]\s*,?\s*\)$/, '');
      const usati = [...importati].filter((n) => new RegExp(`\\b${n}\\b`).test(corpo));
      if (usati.length && !/\bversione\b/.test(dipendenze)) {
        ferme.push(`${relative(RADICE, f)}: use${m[1]} legge ${usati.join(', ')} con dipendenze [${dipendenze.trim()}]`);
      }
    }
  }
  assert.deepEqual(ferme, [], 'queste memorie restano ai dati del primo disegno: aggiungere `const versione = useDati()` alle dipendenze');
});
