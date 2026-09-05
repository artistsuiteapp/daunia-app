import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from './supabase';
import { utenteCorrente } from './auth';

import { scorePrediction } from './prediction-score';

/**
 * Le tre cose che i tifosi fanno nell'app: dire che ci sono, dare i voti,
 * indovinare il risultato.
 *
 * Stanno insieme perche condividono lo stesso meccanismo: un pugno di scelte
 * personali salvate nel browser, mostrate accanto a numeri di esempio. Quando
 * arrivano gli account, i numeri di esempio spariscono e restano solo quelli
 * veri: cambia questo file, non le schermate.
 *
 * I numeri seminati sono dichiarati come esempio in ogni punto in cui compaiono.
 * Le percentuali di riempimento inventate le abbiamo tolte proprio perche
 * sembravano dati reali sulla disponibilita dei biglietti: qui non deve
 * succedere di nuovo.
 *
 * Con un account attivo i numeri veri arrivano dal database e prendono il posto
 * degli esempi. Le funzioni che le schermate chiamano restano le stesse: cambia
 * solo da dove viene la risposta.
 */

const KEY = 'daunia.fanplay.v1';

type Store = {
  /** presenze dichiarate: id partita -> id settore */
  presence: Record<string, string>;
  /** voti: id partita -> id giocatore -> voto da 1 a 10 */
  ratings: Record<string, Record<string, number>>;
  /** pronostici: id partita -> [gol casa, gol trasferta] */
  predictions: Record<string, [number, number]>;
};

const EMPTY: Store = { presence: {}, ratings: {}, predictions: {} };

function read(): Store {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as Store) } : { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

let store = read();
const listeners = new Set<() => void>();

function commit() {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(store));
  } catch {
    /* niente memoria: resta solo per questa sessione */
  }
  listeners.forEach((l) => l());
}

let version = 0;
/** Da chiamare in una schermata che mostra i numeri di una partita. */
export function useDatiPartita(matchId: string | null, conVoti = false) {
  useEffect(() => {
    if (!matchId) return;
    void caricaPresenze(matchId);
    if (conVoti) void caricaMedie(matchId);
  }, [matchId, conVoti]);
}

export function useFanplay(): number {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => version,
    () => version,
  );
}
listeners.add(() => { version += 1; });

/* ------------------------------------------------------- numeri dal database */

type Reali = {
  presenze: Record<string, Record<string, number>>;
  medie: Record<string, Record<string, { media: number; quanti: number }>>;
};

let reali: Reali = { presenze: {}, medie: {} };
let caricate = new Set<string>();

/** Presenze vere per una partita, dalla vista che conta senza esporre chi va. */
export async function caricaPresenze(matchId: string) {
  if (!supabase || caricate.has(`p:${matchId}`)) return;
  caricate.add(`p:${matchId}`);
  const { data } = await supabase
    .from('presenze_per_settore')
    .select('settore, quanti')
    .eq('partita', matchId);
  if (!data) return;
  reali.presenze[matchId] = Object.fromEntries(
    (data as Array<{ settore: string; quanti: number }>).map((r) => [r.settore, r.quanti]),
  );
  version += 1;
  listeners.forEach((l) => l());
}

/** Medie vere dei voti. Passa da una funzione: i voti singoli restano privati. */
export async function caricaMedie(matchId: string) {
  if (!supabase || caricate.has(`m:${matchId}`)) return;
  caricate.add(`m:${matchId}`);
  const { data } = await supabase.rpc('medie_voti', { p_partita: matchId });
  if (!data) return;
  reali.medie[matchId] = Object.fromEntries(
    (data as Array<{ giocatore: string; media: number; quanti: number }>)
      .map((r) => [r.giocatore, { media: Number(r.media), quanti: r.quanti }]),
  );
  version += 1;
  listeners.forEach((l) => l());
}

/** Numero stabile da una stringa: gli esempi non devono ballare a ogni ricarica. */
function seed(s: string): number {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/* --------------------------------------------------------------- presenze */

/** Presenze di esempio per settore, stabili e dichiarate come tali. */
export function samplePresence(matchId: string, sectorId: string, capacity: number): number {
  // fra il 4% e il 12% della capienza: un numero plausibile per una comunita
  // agli inizi, non una previsione di quanti biglietti si venderanno
  const h = seed(`${matchId}:${sectorId}`);
  return Math.round(capacity * (0.04 + (h % 80) / 1000));
}

export function myPresence(matchId: string): string | null {
  return store.presence[matchId] ?? null;
}

export function declarePresence(matchId: string, sectorId: string) {
  store = { ...store, presence: { ...store.presence, [matchId]: sectorId } };
  commit();
  const u = utenteCorrente();
  if (supabase && u) {
    void supabase.from('presenze')
      .upsert({ utente: u.id, partita: matchId, settore: sectorId })
      .then(() => { caricate.delete(`p:${matchId}`); return caricaPresenze(matchId); });
  }
}

export function clearPresence(matchId: string) {
  const next = { ...store.presence };
  delete next[matchId];
  store = { ...store, presence: next };
  commit();
  const u = utenteCorrente();
  if (supabase && u) {
    void supabase.from('presenze').delete().eq('utente', u.id).eq('partita', matchId)
      .then(() => { caricate.delete(`p:${matchId}`); return caricaPresenze(matchId); });
  }
}

/** Totale per settore: esempi piu la tua dichiarazione, se e in quel settore. */
export function presenceOf(matchId: string, sectorId: string, capacity: number) {
  const vere = reali.presenze[matchId];
  const mine = myPresence(matchId) === sectorId ? 1 : 0;
  // con il database attivo il numero e quello vero, senza aggiunte di esempio
  if (vere) return { total: vere[sectorId] ?? 0, sample: 0, mine: mine === 1 };
  const sample = samplePresence(matchId, sectorId, capacity);
  return { total: sample + mine, sample, mine: mine === 1 };
}

/** true quando i numeri mostrati vengono dal database e non dagli esempi. */
export function presenzeVere(matchId: string): boolean {
  return Boolean(reali.presenze[matchId]);
}

export function medieVere(matchId: string): boolean {
  return Boolean(reali.medie[matchId]);
}

/* ---------------------------------------------------------------- pagelle */

/** Media di esempio per un giocatore, stabile fra 5.0 e 7.4. */
export function sampleRating(matchId: string, playerId: string) {
  const h = seed(`${matchId}#${playerId}`);
  return { avg: 5 + ((h % 25) / 10), votes: 40 + (h % 160) };
}

export function myRating(matchId: string, playerId: string): number | null {
  return store.ratings[matchId]?.[playerId] ?? null;
}

export function rate(matchId: string, playerId: string, vote: number) {
  const forMatch = { ...(store.ratings[matchId] ?? {}), [playerId]: vote };
  store = { ...store, ratings: { ...store.ratings, [matchId]: forMatch } };
  commit();
  const u = utenteCorrente();
  if (supabase && u) {
    void supabase.from('voti')
      .upsert({ utente: u.id, partita: matchId, giocatore: playerId, voto: vote })
      .then(() => { caricate.delete(`m:${matchId}`); return caricaMedie(matchId); });
  }
}

/** Media mostrata: quella di esempio con dentro il tuo voto, se l'hai dato. */
export function ratingOf(matchId: string, playerId: string) {
  const mine = myRating(matchId, playerId);
  const vere = reali.medie[matchId]?.[playerId];
  if (reali.medie[matchId]) {
    // il proprio voto e gia dentro la media del server: non va sommato di nuovo
    return { avg: vere?.media ?? 0, votes: vere?.quanti ?? 0, mine };
  }
  const { avg, votes } = sampleRating(matchId, playerId);
  if (mine == null) return { avg, votes, mine: null as number | null };
  return { avg: (avg * votes + mine) / (votes + 1), votes: votes + 1, mine };
}

export function myRatingCount(matchId: string): number {
  return Object.keys(store.ratings[matchId] ?? {}).length;
}

/* -------------------------------------------------------------- pronostici */

export function myPrediction(matchId: string): [number, number] | null {
  return store.predictions[matchId] ?? null;
}

export function predict(matchId: string, home: number, away: number) {
  store = { ...store, predictions: { ...store.predictions, [matchId]: [home, away] } };
  commit();
  const u = utenteCorrente();
  if (supabase && u) {
    void supabase.from('pronostici')
      .upsert({ utente: u.id, partita: matchId, casa: home, ospiti: away });
  }
}

export function clearPrediction(matchId: string) {
  const next = { ...store.predictions };
  delete next[matchId];
  store = { ...store, predictions: next };
  commit();
}

export { scorePrediction } from './prediction-score';

export type LeaderRow = { name: string; points: number; exact: number; sample: boolean };

/** Classifica di esempio, con te dentro se hai giocato almeno una volta. */
export function leaderboard(myPoints: number, myExact: number): LeaderRow[] {
  const rows: LeaderRow[] = [
    { name: 'Michele P.', points: 14, exact: 3, sample: true },
    { name: 'Rita C.', points: 12, exact: 2, sample: true },
    { name: 'Nicola R.', points: 11, exact: 2, sample: true },
    { name: 'Francesca D.', points: 9, exact: 1, sample: true },
    { name: 'Giuseppe L.', points: 8, exact: 1, sample: true },
    { name: 'Antonio V.', points: 6, exact: 0, sample: true },
    { name: 'Pasquale M.', points: 4, exact: 0, sample: true },
  ];
  rows.push({ name: 'Tu', points: myPoints, exact: myExact, sample: false });
  return rows.sort((a, b) => b.points - a.points || b.exact - a.exact);
}

export function myPredictionTotals(
  played: Array<{ id: string; score: { home: number; away: number } | null }>,
) {
  let points = 0;
  let exact = 0;
  for (const m of played) {
    const g = myPrediction(m.id);
    if (!g || !m.score) continue;
    const p = scorePrediction(g, m.score);
    points += p;
    if (p === 3) exact += 1;
  }
  return { points, exact };
}
