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
  /** il migliore scelto: id partita -> id giocatore */
  mvp?: Record<string, string>;
  /** il migliore del mese scelto: "2026-09" -> id giocatore */
  mvpMese?: Record<string, string>;
};

const EMPTY: Store = { presence: {}, ratings: {}, predictions: {}, mvp: {}, mvpMese: {} };

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

/*
 * Qui c'era `samplePresence`, che riempiva ogni settore con il 4-12 per cento
 * della capienza. Erano numeri stabili e plausibili -- e per questo peggio di
 * numeri assurdi: nessuno li metteva in dubbio. Chi apriva la sezione stadio
 * leggeva "312 in Curva Nord" e credeva che ci fosse gia una comunita.
 *
 * Adesso si contano solo le persone che hanno davvero detto che ci vanno.
 * Zero e un dato: dice che si comincia adesso.
 */

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

/** Quante persone hanno detto che vanno in quel settore. Solo quelle vere. */
export function presenceOf(matchId: string, sectorId: string, _capacity?: number) {
  const vere = reali.presenze[matchId];
  const mine = myPresence(matchId) === sectorId ? 1 : 0;
  if (vere) return { total: vere[sectorId] ?? 0, sample: 0, mine: mine === 1 };
  // senza database resta solo la propria dichiarazione, che e vera anche lei
  return { total: mine, sample: 0, mine: mine === 1 };
}

/** I numeri sono sempre veri adesso: la funzione resta per non toccare le schermate. */
export function presenzeVere(_matchId: string): boolean {
  return true;
}

/** Le medie sono sempre vere adesso; resta true quando c'e almeno un voto. */
export function medieVere(matchId: string): boolean {
  return Boolean(reali.medie[matchId]);
}

/* ---------------------------------------------------------------- pagelle */

/** Media di esempio per un giocatore, stabile fra 5.0 e 7.4. */
/*
 * Qui c'era `sampleRating`, che dava a ogni giocatore una media fra 5.0 e 7.5
 * su 40-200 voti inventati. In pagella si leggeva "6.8 · 127 voti" e sembrava
 * il giudizio della Curva: era un numero derivato dal nome del giocatore.
 *
 * Adesso un giocatore senza voti mostra zero voti, e la media compare quando
 * qualcuno ha votato davvero.
 */

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
  // senza database c'e solo il proprio voto, e vale uno
  if (mine == null) return { avg: 0, votes: 0, mine: null as number | null };
  return { avg: mine, votes: 1, mine };
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

/**
 * La classifica dei pronostici.
 *
 * Prima c'erano sette avversari inventati -- Michele P. con 14 punti, Rita C.
 * con 12 -- e tu in fondo. Chi apriva la sezione credeva di essere ultimo fra
 * gente vera, e di essere arrivato tardi a una cosa gia avviata.
 *
 * Adesso ci sei solo tu, finche non ci sono gli altri. Il primo posto in una
 * classifica di uno e onesto: dice che sei il primo ad arrivare.
 */
export function leaderboard(myPoints: number, myExact: number): LeaderRow[] {
  return [{ name: 'Tu', points: myPoints, exact: myExact, sample: false }];
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


/* ------------------------------------------------------------- i migliori */

/*
 * MVP e migliore del mese non sono le pagelle.
 *
 * Prima li ricavavo dalla media dei voti da 4 a 10, ma sono due cose diverse:
 * la pagella e un giudizio su ognuno, l'MVP e una scelta sola fra tutti. Uno
 * puo dare 7 a tutta la squadra e pensare comunque che il migliore sia stato
 * il portiere -- e con la media quel pensiero non si vede.
 *
 * Qui si conta chi ha preso piu preferenze, come un'elezione.
 */

export type Preferenza = { giocatore: string; voti: number };

let mvpPartite: Record<string, Preferenza[]> = {};
let mvpMesi: Record<string, Preferenza[]> = {};

export async function caricaMvpPartita(matchId: string) {
  if (!supabase || caricate.has(`mv:${matchId}`)) return;
  caricate.add(`mv:${matchId}`);
  const { data } = await supabase.rpc('mvp_partita', { p_partita: matchId });
  mvpPartite[matchId] = (data as Preferenza[] | null) ?? [];
  version += 1;
  listeners.forEach((l) => l());
}

export async function caricaMvpMese(mese: string) {
  if (!supabase || caricate.has(`mm:${mese}`)) return;
  caricate.add(`mm:${mese}`);
  const { data } = await supabase.rpc('mvp_mese', { p_mese: mese });
  mvpMesi[mese] = (data as Preferenza[] | null) ?? [];
  version += 1;
  listeners.forEach((l) => l());
}

export function classificaMvp(matchId: string): Preferenza[] {
  return mvpPartite[matchId] ?? [];
}

export function classificaMvpMese(mese: string): Preferenza[] {
  return mvpMesi[mese] ?? [];
}

/**
 * La mia preferenza, tenuta anche sul dispositivo.
 *
 * Il database e la verita, ma senza copia locale il nome scelto sparisce
 * finche il server non risponde, e sembra che il tocco non abbia funzionato.
 */
export function miaPreferenza(matchId: string): string | null {
  return store.mvp?.[matchId] ?? null;
}

export function miaPreferenzaMese(mese: string): string | null {
  return store.mvpMese?.[mese] ?? null;
}

export function scegliMvp(matchId: string, giocatore: string) {
  store = { ...store, mvp: { ...(store.mvp ?? {}), [matchId]: giocatore } };
  commit();
  const u = utenteCorrente();
  if (supabase && u) {
    void supabase.from('mvp_voti')
      .upsert({ utente: u.id, partita: matchId, giocatore })
      .then(() => { caricate.delete(`mv:${matchId}`); return caricaMvpPartita(matchId); });
  }
}

export function scegliMvpMese(mese: string, giocatore: string) {
  store = { ...store, mvpMese: { ...(store.mvpMese ?? {}), [mese]: giocatore } };
  commit();
  const u = utenteCorrente();
  if (supabase && u) {
    void supabase.from('mvp_mese_voti')
      .upsert({ utente: u.id, mese, giocatore })
      .then(() => { caricate.delete(`mm:${mese}`); return caricaMvpMese(mese); });
  }
}
