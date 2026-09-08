

import { scadenza } from '../util.mjs';/**
 * API-Football, piano gratuito. Formazioni vere, eventi e punteggio dal vivo
 * della stagione in corso.
 *
 * COME SI AGGIRA IL LIMITE DEL PIANO GRATUITO (verificato il 5 settembre 2026)
 *
 * Il piano gratuito rifiuta il parametro `season` sulla stagione in corso:
 *   "Free plans do not have access to this season, try from 2022 to 2024".
 * Rifiuta anche `last` e `next`.
 *
 * Ma il filtro non e sui dati, e sui parametri. Le chiamate che NON passano
 * `season` rispondono con la stagione in corso, gratis:
 *
 *   fixtures?date=YYYY-MM-DD    tutte le partite del giorno, si filtra qui
 *   fixtures?id=N               una partita, con stato e punteggio dal vivo
 *   fixtures/lineups?fixture=N  formazioni: undici titolari, numeri, panchina
 *   fixtures/events?fixture=N   gol, assist, cartellini, cambi, col minuto
 *   players/squads?team=N       la rosa di oggi, 23 uomini
 *
 * COSA NON C'E, E NON C'E NEMMENO PAGANDO
 *
 * Il campo coverage della lega 943 dice statistics_fixtures: false. Possesso
 * palla, tiri, falli e pagelle non esistono per la Serie C su questa fonte, a
 * nessun prezzo. fixtures/statistics risponde con zero risultati. Anche
 * formation e coach tornano vuoti: il modulo non si inventa.
 *
 * LA QUOTA
 *
 * Cento chiamate al giorno, e il cron gira ogni mezz'ora. Quindi si chiama
 * solo dentro la finestra di una partita (due ore prima, sei ore dopo) e solo
 * finche manca qualcosa. A partita finita e archiviata, zero chiamate.
 */

/**
 * Le due porte di API-Football.
 *
 * Lo stesso servizio si raggiunge da due parti, con account e chiavi separate:
 * il portale diretto (api-sports.io) e RapidAPI. Chi ha sbattuto contro un
 * account bloccato da una parte puo aprirne uno gratuito dall'altra senza che
 * cambi una riga di codice: il piano gratuito e cento chiamate al giorno in
 * entrambi i casi, e la forma delle risposte e identica.
 *
 * Si sceglie in base a quale variabile e valorizzata. Se ci sono tutte e due
 * vince quella diretta, che non ha l'intermediario in mezzo.
 */
const DIRETTO = {
  base: 'https://v3.football.api-sports.io',
  intestazioni: (chiave) => ({ 'x-apisports-key': chiave }),
};
const RAPIDAPI = {
  base: 'https://api-football-v1.p.rapidapi.com/v3',
  intestazioni: (chiave) => ({
    'x-rapidapi-key': chiave,
    'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
  }),
};

/** Quale porta usare per questa chiave. `via` lo decide chi chiama. */
export function porta(via) {
  return via === 'rapidapi' ? RAPIDAPI : DIRETTO;
}

export const FOGGIA_TEAM_ID = 521;
/** Girone A, B, C e la Coppa Italia di Serie C. */
export const LEGHE_SERIE_C = new Set([138, 942, 943, 891]);

const ORE = 60 * 60 * 1000;
const PRIMA_DEL_FISCHIO = 2 * ORE;
const DOPO_IL_FISCHIO = 6 * ORE;

/**
 * Il budget dell'ingest, in chiamate ad API-Football per giro.
 *
 * Il piano gratuito ne da cento al giorno e il guardiano ne tiene
 * quarantacinque. Il cron dell'ingest gira ogni mezz'ora: con dodici per giro,
 * anche una giornata storta resta sotto i quaranta, perche la maggior parte
 * dei giri costa zero (fuori dalla finestra di una partita non chiama).
 *
 * Il primo account e stato sospeso il 6 settembre 2026 perche questo numero
 * non esisteva: c'erano solo le pause fra una lettura e l'altra, che sono una
 * stima di quante chiamate verranno, non un limite.
 */
const TETTO_PER_GIRO = 12;

/**
 * Quanto si aspetta fra una chiamata e l'altra.
 *
 * Il piano gratuito diretto consente dieci richieste al minuto, e superarlo e
 * proprio il "pattern eccessivo" che fa scattare la sospensione automatica.
 * Sette secondi tengono il ritmo a otto al minuto.
 */
const PAUSA_FRA_CHIAMATE = 7000;

const dormi = (ms) => new Promise((r) => setTimeout(r, ms));
let ultimaChiamata = 0;

async function chiedi(percorso, chiave, conteggio, via = process.env.API_FOOTBALL_VIA) {
  if (conteggio.n >= TETTO_PER_GIRO) {
    return { dati: [], problema: `tetto di ${TETTO_PER_GIRO} chiamate raggiunto in questo giro` };
  }

  // il ritmo si tiene fra chiamate vere: la prima non aspetta
  const attesa = PAUSA_FRA_CHIAMATE - (Date.now() - ultimaChiamata);
  if (ultimaChiamata && attesa > 0) await dormi(attesa);
  ultimaChiamata = Date.now();

  conteggio.n += 1;
  const p = porta(via);
  const r = await fetch(`${p.base}/${percorso}`, { headers: p.intestazioni(chiave), signal: scadenza() });
  if (!r.ok) return { dati: [], problema: `HTTP ${r.status}` };
  const j = await r.json();
  const errori = j.errors && !Array.isArray(j.errors) ? Object.values(j.errors) : [];
  if (errori.length) return { dati: [], problema: String(errori[0]) };
  return { dati: j.response ?? [], problema: null };
}

/** Vero se adesso siamo abbastanza vicini al calcio d'inizio da valere una chiamata. */
export function dentroLaFinestra(kickoff, adesso = Date.now()) {
  const t = Date.parse(kickoff);
  if (!Number.isFinite(t)) return false;
  return adesso >= t - PRIMA_DEL_FISCHIO && adesso <= t + DOPO_IL_FISCHIO;
}

/** Una partita e chiusa quando e finita e abbiamo gia formazioni ed eventi. */
function giaCompleta(salvata) {
  return Boolean(
    salvata
    && ['FT', 'AET', 'PEN'].includes(salvata.status)
    && salvata.lineups?.length
    && salvata.events?.length,
  );
}

function normalizzaGiocatore(p) {
  return {
    number: p.player?.number ?? null,
    name: p.player?.name ?? null,
    pos: p.player?.pos ?? null,
  };
}

/**
 * Trova la partita del Foggia in una certa data e ne scarica formazioni ed
 * eventi. Restituisce anche quante chiamate ha speso, cosi il chiamante puo
 * fermarsi prima di finire la quota.
 */
export async function fetchPartita({ chiave, date, salvata = null }) {
  const conteggio = { n: 0 };
  const avvisi = [];
  if (!chiave) return { partita: null, chiamate: 0, warnings: ['API-Football: nessuna chiave, salto.'] };

  const giorno = await chiedi(`fixtures?date=${date}`, chiave, conteggio);
  if (giorno.problema) {
    return { partita: null, chiamate: conteggio.n, warnings: [`API-Football: ${giorno.problema}`] };
  }

  const trovata = giorno.dati.find(
    (x) => LEGHE_SERIE_C.has(x.league?.id)
      && (x.teams?.home?.id === FOGGIA_TEAM_ID || x.teams?.away?.id === FOGGIA_TEAM_ID),
  );
  if (!trovata) {
    return { partita: null, chiamate: conteggio.n, warnings: [] };
  }

  const { partita, warnings } = await dettaglio(trovata, chiave, conteggio, salvata);
  avvisi.push(...warnings);
  return { partita, chiamate: conteggio.n, warnings: avvisi };
}

/**
 * La stessa cosa, ma partendo da un id di partita gia noto.
 *
 * Serve perche `fixtures?date=` sul piano gratuito copre solo tre giorni
 * (ieri, oggi, domani): fuori da li risponde "Free plans do not have access to
 * this date". `fixtures?id=` invece non ha quel limite, quindi con gli id
 * presi da TheSportsDB si recuperano anche le partite vecchie.
 */
export async function fetchPartitaPerId({ chiave, fixtureId, salvata = null }) {
  const conteggio = { n: 0 };
  const avvisi = [];
  if (!chiave) return { partita: null, chiamate: 0, warnings: [] };

  const r = await chiedi(`fixtures?id=${fixtureId}`, chiave, conteggio);
  if (r.problema || !r.dati.length) {
    return { partita: null, chiamate: conteggio.n, warnings: r.problema ? [`API-Football: ${r.problema}`] : [] };
  }
  const { partita, warnings } = await dettaglio(r.dati[0], chiave, conteggio, salvata);
  avvisi.push(...warnings);
  return { partita, chiamate: conteggio.n, warnings: avvisi };
}

/**
 * La rosa vera di oggi: ventitre nomi con numero, ruolo e foto. E l'unica
 * lista che si aggiorna da sola quando un giocatore se ne va, quindi vale
 * come filtro su quella di Wikipedia, che tiene dentro anche i partiti.
 */
export async function fetchRosa({ chiave }) {
  const conteggio = { n: 0 };
  if (!chiave) return { rosa: [], chiamate: 0, warnings: [] };

  const r = await chiedi(`players/squads?team=${FOGGIA_TEAM_ID}`, chiave, conteggio);
  if (r.problema) return { rosa: [], chiamate: conteggio.n, warnings: [`API-Football rosa: ${r.problema}`] };

  const players = r.dati[0]?.players ?? [];
  return {
    rosa: players.map((p) => ({
      apiId: p.id,
      name: p.name,
      number: p.number ?? null,
      position: p.position ?? null,
      age: p.age ?? null,
      photo: p.photo ?? null,
    })),
    chiamate: conteggio.n,
    warnings: [],
  };
}

/** Prende la scheda della partita e ci attacca formazioni ed eventi. */
async function dettaglio(grezza, chiave, conteggio, salvata) {
  const warnings = [];
  const id = grezza.fixture.id;
  const partita = {
    fixtureId: id,
    date: String(grezza.fixture.date).slice(0, 10),
    kickoff: grezza.fixture.date,
    status: grezza.fixture.status?.short ?? null,
    minute: grezza.fixture.status?.elapsed ?? null,
    competition: grezza.league?.name ?? null,
    round: grezza.league?.round ?? null,
    home: { id: grezza.teams?.home?.id, name: grezza.teams?.home?.name, goals: grezza.goals?.home ?? null },
    away: { id: grezza.teams?.away?.id, name: grezza.teams?.away?.name, goals: grezza.goals?.away ?? null },
    lineups: salvata?.lineups ?? [],
    events: salvata?.events ?? [],
    fetchedAt: new Date().toISOString(),
  };

  // le formazioni escono circa un'ora prima: si riprovano finche non ci sono
  if (!partita.lineups.length) {
    const f = await chiedi(`fixtures/lineups?fixture=${id}`, chiave, conteggio);
    if (f.problema) warnings.push(`API-Football formazioni: ${f.problema}`);
    partita.lineups = f.dati.map((sq) => ({
      teamId: sq.team?.id ?? null,
      teamName: sq.team?.name ?? null,
      isFoggia: sq.team?.id === FOGGIA_TEAM_ID,
      startXI: (sq.startXI ?? []).map(normalizzaGiocatore),
      bench: (sq.substitutes ?? []).map(normalizzaGiocatore),
    }));
  }

  // gli eventi crescono durante la partita: si riscaricano finche non e finita
  const finita = ['FT', 'AET', 'PEN'].includes(partita.status);
  if (!finita || !partita.events.length) {
    const e = await chiedi(`fixtures/events?fixture=${id}`, chiave, conteggio);
    if (e.problema) warnings.push(`API-Football eventi: ${e.problema}`);
    if (e.dati.length || !partita.events.length) {
      partita.events = e.dati.map((x) => ({
        minute: x.time?.elapsed ?? null,
        extra: x.time?.extra ?? null,
        type: x.type ?? null,
        detail: x.detail ?? null,
        player: x.player?.name ?? null,
        assist: x.assist?.name ?? null,
        teamId: x.team?.id ?? null,
        teamName: x.team?.name ?? null,
      }));
    }
  }
  return { partita, warnings };
}
