/**
 * Prova di live-score-api: copre la Serie C con marcatori e formazioni?
 *
 * Il secret resta sulla tua macchina: si legge dalle variabili d'ambiente e
 * non viene mai stampato. Quello che esce e solo il verdetto.
 *
 *   LSA_KEY=... LSA_SECRET=... node prova-livescore.mjs
 */
import { readFileSync } from 'node:fs';

/**
 * Le credenziali, lette da .env.livescore o dall'ambiente.
 *
 * Il file resta sul computer di chi lancia lo script: `.gitignore` ignora
 * tutto quello che comincia per `.env`, e qui dentro le credenziali non
 * vengono mai stampate -- nemmeno in un messaggio d'errore.
 */
function credenziali() {
  const dalFile = {};
  try {
    for (const riga of readFileSync(new URL('.env.livescore', import.meta.url), 'utf8').split('\n')) {
      const pulita = riga.trim();
      if (!pulita || pulita.startsWith('#')) continue;
      const i = pulita.indexOf('=');
      if (i > 0) dalFile[pulita.slice(0, i).trim()] = pulita.slice(i + 1).trim();
    }
  } catch {
    // nessun file: si prova con l'ambiente
  }
  return {
    KEY: process.env.LSA_KEY || dalFile.LSA_KEY,
    SECRET: process.env.LSA_SECRET || dalFile.LSA_SECRET,
  };
}

const { KEY, SECRET } = credenziali();

if (!KEY || !SECRET) {
  console.error('\nManca ' + (!KEY ? 'la key' : 'il secret') + '.');
  console.error('Aprilo e compilalo:  .env.livescore  (accanto a questo script)');
  console.error('Il secret sta qui:   https://live-score-api.com/users/profile\n');
  process.exit(1);
}

const BASE = 'https://livescore-api.com/api-client';

async function chiedi(percorso, params = {}) {
  const q = new URLSearchParams({ key: KEY, secret: SECRET, ...params });
  try {
    const r = await fetch(`${BASE}/${percorso}.json?${q}`);
    const j = await r.json().catch(() => null);
    return { ok: r.ok && j?.success !== false, stato: r.status, dati: j };
  } catch (e) {
    return { ok: false, stato: 0, dati: { error: e.message } };
  }
}

const riga = (etichetta, esito) => {
  const err = esito.dati?.error ? ` — ${String(esito.dati.error).slice(0, 70)}` : '';
  console.log(`${esito.ok ? '  OK ' : ' NO '} ${etichetta.padEnd(34)} http ${esito.stato}${err}`);
};

console.log('\n1. LE COMPETIZIONI: c e la Serie C italiana?');
const comp = await chiedi('competitions/list');
riga('competitions/list', comp);

let idSerieC = null;
if (comp.ok) {
  const lista = comp.dati?.data?.competition ?? comp.dati?.data ?? [];
  const italiane = (Array.isArray(lista) ? lista : []).filter((c) =>
    /ital/i.test(JSON.stringify(c.countries ?? c.country ?? '')) || /serie|lega pro/i.test(c.name ?? ''));
  for (const c of italiane.slice(0, 12)) {
    console.log(`       id ${String(c.id).padEnd(6)} ${c.name}`);
    if (/serie c/i.test(c.name ?? '')) idSerieC = c.id;
  }
  if (!italiane.length) console.log('       nessuna competizione italiana riconosciuta nella risposta');
}

console.log('\n2. LA PARTITA DI IERI: Foggia-Audace Cerignola, 6 settembre, finita 0-2');
const storia = await chiedi('matches/history', { from: '2026-09-06', to: '2026-09-06', ...(idSerieC ? { competition_id: idSerieC } : {}) });
riga('matches/history', storia);

let idPartita = null;
if (storia.ok) {
  const partite = storia.dati?.data?.match ?? [];
  const nostra = (Array.isArray(partite) ? partite : []).find((m) =>
    /foggia/i.test(`${m.home_name ?? m.home?.name ?? ''} ${m.away_name ?? m.away?.name ?? ''}`));
  if (nostra) {
    idPartita = nostra.id;
    console.log(`       trovata: ${nostra.home_name ?? nostra.home?.name} ${nostra.score ?? ''} ${nostra.away_name ?? nostra.away?.name}  (id ${idPartita})`);
  } else {
    console.log(`       ${Array.isArray(partite) ? partite.length : 0} partite quel giorno, nessuna del Foggia`);
  }
}

if (idPartita) {
  console.log('\n3. I MARCATORI col nome');
  for (const ep of ['matches/stats', 'scores/events', 'events/list']) {
    const e = await chiedi(ep, { match_id: idPartita });
    riga(ep, e);
    if (e.ok) {
      const testo = JSON.stringify(e.dati);
      const gol = testo.match(/"player"\s*:\s*"([^"]{2,40})"/g) ?? [];
      if (gol.length) console.log('       marcatori:', gol.slice(0, 6).join(', '));
    }
  }

  console.log('\n4. LE FORMAZIONI');
  for (const ep of ['matches/lineups', 'scores/lineups', 'fixtures/lineups']) {
    const l = await chiedi(ep, { match_id: idPartita });
    riga(ep, l);
    if (l.ok) {
      const n = (JSON.stringify(l.dati).match(/"name"/g) ?? []).length;
      console.log(`       ${n} nomi nella risposta`);
    }
  }
}

console.log('\n5. QUOTA RIMASTA');
const uso = comp.dati?.requests ?? storia.dati?.requests ?? null;
console.log(uso ? `       ${JSON.stringify(uso)}` : '       non dichiarata nella risposta');
console.log('');
