import { useSyncExternalStore } from 'react';

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
export function useFanplay(): number {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => version,
    () => version,
  );
}
listeners.add(() => { version += 1; });

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
}

export function clearPresence(matchId: string) {
  const next = { ...store.presence };
  delete next[matchId];
  store = { ...store, presence: next };
  commit();
}

/** Totale per settore: esempi piu la tua dichiarazione, se e in quel settore. */
export function presenceOf(matchId: string, sectorId: string, capacity: number) {
  const sample = samplePresence(matchId, sectorId, capacity);
  const mine = myPresence(matchId) === sectorId ? 1 : 0;
  return { total: sample + mine, sample, mine: mine === 1 };
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
}

/** Media mostrata: quella di esempio con dentro il tuo voto, se l'hai dato. */
export function ratingOf(matchId: string, playerId: string) {
  const { avg, votes } = sampleRating(matchId, playerId);
  const mine = myRating(matchId, playerId);
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
}

export function clearPrediction(matchId: string) {
  const next = { ...store.predictions };
  delete next[matchId];
  store = { ...store, predictions: next };
  commit();
}

/**
 * Punteggio di un pronostico: tre punti il risultato esatto, uno l'esito.
 * Nessun premio e nessuna quota: e una classifica fra tifosi, non una scommessa.
 */
export function scorePrediction(
  guess: [number, number],
  actual: { home: number; away: number },
): number {
  if (guess[0] === actual.home && guess[1] === actual.away) return 3;
  const sign = (a: number, b: number) => (a === b ? 0 : a > b ? 1 : -1);
  return sign(guess[0], guess[1]) === sign(actual.home, actual.away) ? 1 : 0;
}

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
