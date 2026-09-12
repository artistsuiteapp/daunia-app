/**
 * Punteggio dal vivo.
 *
 * Durante la partita il telefono interroga TheSportsDB ogni quarantacinque
 * secondi: `lookupevent.php?id=<idEvent>` pesa un chilo e mezzo e porta
 * punteggio e stato aggiornati. Gratis, senza quota giornaliera, con CORS
 * aperto, quindi funziona anche dal web.
 *
 * Perche non API-Football: la sua quota e cento chiamate al giorno e serve
 * intera per formazioni ed eventi. E soprattutto la sua chiave e segreta,
 * mentre quella di TheSportsDB e pubblica per definizione, quindi puo stare
 * dentro l'app senza esporre niente.
 *
 * L'id della partita arriva dall'ingest in data/prossima.json: cosi il telefono
 * non deve cercarselo a ogni apertura.
 *
 * Il polling parte da dieci minuti prima del calcio d'inizio, si ferma appena
 * la partita e finita o dopo tre ore, e si sospende quando l'app va in secondo
 * piano. Se una chiamata fallisce si tiene l'ultimo punteggio buono: meglio un
 * dato di un minuto fa che una schermata vuota.
 *
 * I conti stanno in live-core.ts, che e senza React e sotto test.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { Match } from '@satanelli/core';

import { prossima } from './data';
import { supabase } from './supabase';
import { cronacaDi, finestraAperta, leggiEvento, orienta, type Live } from './live-core';

export type { Live } from './live-core';

const BASE = 'https://www.thesportsdb.com/api/v1/json/123';
const OGNI = 45_000;
/** ogni quanto si ridisegna il minuto fra un aggiornamento e l'altro */
const BATTITO = 15_000;

let stato: Live | null = null;
/** i gol della partita in corso, col minuto: la cronologia che il guardiano registra */
let gol: GolVivo[] = [];
/** cartellini e cambi della partita in corso: prima si vedevano solo il giorno dopo */
let cartellini: CartellinoVivo[] = [];
let cambi: CambioVivo[] = [];
/** l'istante del triplice fischio, che decide quando chiude la chat */
let finitaIl: string | null = null;
/**
 * La formazione ufficiale, appena la Lega la pubblica.
 *
 * Arriva dal guardiano invece che dal bundle: fra cron e deploy l'ingest ci
 * mette fino a venti minuti, e le formazioni escono anche a venti minuti dal
 * fischio.
 */
let formazioneVivo: FormazioneVivo | null = null;
let ascoltatori: Array<() => void> = [];
let timer: ReturnType<typeof setInterval> | null = null;
let battito: ReturnType<typeof setInterval> | null = null;

function annuncia() {
  for (const f of ascoltatori) f();
}

/**
 * Un gol visto dal vivo.
 *
 * Il nome di chi ha segnato non c'e: quello lo da solo API-Football, e per la
 * Serie C non sempre. Minuto e punteggio invece si sanno, e durante la partita
 * sono la meta che conta -- "48' 0-2" dice quasi tutto.
 */
/**
 * Un cartellino visto dal vivo.
 *
 * Prima non esisteva: durante la partita si salvavano solo i gol, e i
 * cartellini comparivano il giorno dopo con l'aggiornamento dati. Per chi
 * segue dal telefono era mezza cronaca -- sapeva che si stava perdendo, non
 * che eravate in dieci.
 */
export type CartellinoVivo = {
  minuto: number | null;
  chi: string | null;
  /** true se e un giocatore del Foggia */
  nostro: boolean;
  rosso: boolean;
};

export type CambioVivo = {
  minuto: number | null;
  esce: string | null;
  entra: string | null;
  nostro: boolean;
};

export type GolVivo = {
  minuto: string | null;
  /** null finche la fonte degli eventi non pubblica il marcatore */
  chi?: string | null;
  casa: number | null;
  ospiti: number | null;
  nostro: boolean;
  fonte?: 'vero' | 'stimato' | 'eventi';
};

/** Le colonne che il guardiano tiene aggiornate, tradotte in `Live`. */
type Riga = {
  stato: string | null;
  casa: number | null;
  ospiti: number | null;
  minuto: string | null;
  aggiornato_il?: string | null;
  finita_il?: string | null;
  gol?: GolVivo[] | null;
  cartellini?: CartellinoVivo[] | null;
  cambi?: CambioVivo[] | null;
  formazione?: FormazioneVivo | null;
};

/** L'undici ufficiale scritto dal guardiano, com'e nel database. */
export type ColonnaVivo = {
  squadra: string; modulo: string | null; allenatore: string | null;
  giocatori: Array<{ numero: number | null; nome: string; ruolo: string | null }>;
};
export type FormazioneVivo = { casa: ColonnaVivo; ospiti: ColonnaVivo };

function daRiga(r: Riga | null): Live | null {
  if (!r?.stato) return null;
  // l'ora del server, non quella della lettura: il cronometro deve partire da
  // quando il minuto e stato scritto, non da quando l'abbiamo visto
  const scritto = r.aggiornato_il ? Date.parse(r.aggiornato_il) : NaN;
  return leggiEvento({
    strStatus: r.stato,
    intHomeScore: r.casa,
    intAwayScore: r.ospiti,
    strProgress: r.minuto,
  }, Number.isFinite(scritto) ? scritto : Date.now());
}

function applica(letto: Live | null, cronologia?: GolVivo[] | null, r?: Riga) {
  if (Array.isArray(cronologia)) gol = cronologia;
  if (Array.isArray(r?.cartellini)) cartellini = r.cartellini;
  if (Array.isArray(r?.cambi)) cambi = r.cambi;
  if (!letto) { if (Array.isArray(cronologia)) annuncia(); return; }
  stato = letto;
  annuncia();
  if (letto.finita) ferma();
}

/**
 * Il punteggio dal database.
 *
 * E la strada buona: il guardiano scarica la lista del dal vivo una volta al
 * minuto sul server -- sessanta chilobyte, con dentro il minuto vero -- e qui
 * si legge una riga sola. Con Realtime il punteggio arriva da solo, senza
 * chiedere niente a nessuno.
 */
async function chiediAlDatabase(): Promise<boolean> {
  const id = prossima?.eventId;
  if (!supabase || !id) return false;
  const { data, error } = await supabase
    .from('stato_partita')
    .select('stato, casa, ospiti, minuto, gol, cartellini, cambi, aggiornato_il, finita_il, formazione')
    .eq('partita', String(id))
    .maybeSingle();
  if (error || !data) return false;
  const r = data as Riga;
  finitaIl = r.finita_il ?? null;
  formazioneVivo = r.formazione ?? null;
  applica(daRiga(r), r.gol ?? [], r);
  return true;
}

/**
 * Il ripiego: la scheda dell'evento, chiesta direttamente alla fonte.
 *
 * Arriva tardi e non porta il minuto -- durante Foggia-Cerignola diceva "HT"
 * mentre si giocava il 48esimo -- ma pesa un chilo e mezzo e funziona anche
 * senza backend. Resta per quello: quando il database non risponde, meglio un
 * punteggio in ritardo che una schermata vuota.
 */
async function chiediAllaFonte() {
  const id = prossima?.eventId;
  if (!id) return;
  try {
    const r = await fetch(`${BASE}/lookupevent.php?id=${id}`);
    if (!r.ok) return;
    const j = await r.json();
    applica(leggiEvento(j?.events?.[0]));
  } catch {
    // rete assente o fonte giu: si tiene l'ultimo punteggio
  }
}

async function chiedi() {
  if (await chiediAlDatabase()) return;
  await chiediAllaFonte();
}

/** l'abbonamento alle modifiche della riga: uno solo per tutta l'app */
let canale: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

function ascoltaIlDatabase() {
  const id = prossima?.eventId;
  if (!supabase || !id || canale) return;
  canale = supabase
    .channel(`partita-${id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'stato_partita', filter: `partita=eq.${id}` },
      (m) => {
        const r = m.new as Riga;
        finitaIl = r.finita_il ?? null;
        formazioneVivo = r.formazione ?? null;
        applica(daRiga(r), r.gol ?? [], r);
      },
    )
    .subscribe();
}

function avvia() {
  if (!finestraAperta(prossima?.kickoff)) return;
  ascoltaIlDatabase();

  /*
   * Il battito del cronometro.
   *
   * Il dato dal server arriva una volta al minuto; senza questo il minuto sullo
   * schermo resterebbe fermo e poi salterebbe di uno. Qui non si chiede niente
   * a nessuno: si rifa il disegno, e `minutoCorrente` calcola dove siamo. Il
   * conto sta in live-core, quindi non c'e nessun contatore da tenere allineato.
   */
  if (!battito) {
    battito = setInterval(() => {
      if (!stato || stato.finita) return;
      stato = { ...stato };
      annuncia();
    }, BATTITO);
  }

  // un colpo si fa comunque: se lo stato dell'app arrivasse sbagliato, meglio
  // un punteggio fermo che nessun punteggio
  void chiedi();

  // il ciclo invece parte solo in primo piano, per non consumare batteria
  if (timer) return;
  if (AppState.currentState === 'background') return;
  timer = setInterval(() => {
    if (!finestraAperta(prossima?.kickoff)) { ferma(); return; }
    void chiedi();
  }, OGNI);
}

function ferma() {
  if (timer) clearInterval(timer);
  timer = null;
  if (battito) clearInterval(battito);
  battito = null;
  if (canale) { void canale.unsubscribe(); canale = null; }
}

/**
 * Il punteggio dal vivo, se c'e. Il poller e uno solo per tutta l'app, anche se
 * la scheda partita compare in piu schermate insieme.
 */
export function useLive(): Live | null {
  useEffect(() => {
    avvia();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') avvia(); else ferma();
    });
    return () => { sub.remove(); };
  }, []);

  return useSyncExternalStore(
    (f) => {
      ascoltatori = [...ascoltatori, f];
      return () => { ascoltatori = ascoltatori.filter((x) => x !== f); };
    },
    () => stato,
    () => stato,
  );
}

/**
 * I gol della partita in corso, col minuto.
 *
 * Vuoto quando non si gioca o quando nessuno ha ancora segnato: la scheda in
 * quel caso mostra quello che ha nei dati, come prima.
 */
export function fineVera(): string | null {
  return finitaIl;
}

/** L'undici ufficiale della partita in corso, se il guardiano l'ha gia preso. */
export function formazioneDalVivo(): FormazioneVivo | null {
  return formazioneVivo;
}

/** Cartellini e cambi della partita in corso, come li scrive il guardiano. */
export function useCronacaVivo(): { cartellini: CartellinoVivo[]; cambi: CambioVivo[] } {
  return useSyncExternalStore(
    (f) => {
      ascoltatori = [...ascoltatori, f];
      return () => { ascoltatori = ascoltatori.filter((x) => x !== f); };
    },
    () => cronacaFerma(),
    () => cronacaFerma(),
  );
}

/*
 * `useSyncExternalStore` confronta il risultato per identita: costruire
 * l'oggetto a ogni chiamata farebbe girare React all'infinito. Si tiene fermo
 * e si rifa solo quando una delle due liste cambia davvero.
 */
let cronacaCache: { cartellini: CartellinoVivo[]; cambi: CambioVivo[] } = { cartellini, cambi };
function cronacaFerma() {
  if (cronacaCache.cartellini !== cartellini || cronacaCache.cambi !== cambi) {
    cronacaCache = { cartellini, cambi };
  }
  return cronacaCache;
}

export function useGolVivo(): GolVivo[] {
  return useSyncExternalStore(
    (f) => {
      ascoltatori = [...ascoltatori, f];
      return () => { ascoltatori = ascoltatori.filter((x) => x !== f); };
    },
    () => gol,
    () => gol,
  );
}

/** Il punteggio dal vivo riferito a una partita precisa, orientato come la scheda. */
export function liveDi(match: Match | null | undefined, live: Live | null): Live | null {
  if (!match) return null;
  return orienta(
    { kickoff: match.kickoff, status: match.status, casa: match.home.name ?? match.home.shortName },
    prossima ? { kickoff: prossima.kickoff, casa: prossima.home } : null,
    live,
  );
}

/**
 * Tutto il dal vivo di una partita precisa, in una chiamata sola.
 *
 * Esiste per non ripetere la guardia in ogni schermata. `useGolVivo` e
 * `useCronacaVivo` leggono lo stato globale del modulo e non sanno di quale
 * partita si parla: chi le usa direttamente deve ricordarsi di confrontarla
 * con quella seguita, e in `match/[id].tsx` non ce l'ho fatto -- la cronaca di
 * oggi compariva su tutte le partite future.
 *
 * Con questo la dimenticanza non e piu possibile: senza `vivo` le liste
 * tornano vuote.
 */
export function useCronacaDi(match: Match | null | undefined): {
  vivo: Live | null;
  gol: readonly GolVivo[];
  cartellini: readonly CartellinoVivo[];
  cambi: readonly CambioVivo[];
} {
  const vivo = liveDi(match, useLive());
  const tuttiGol = useGolVivo();
  const resto = useCronacaVivo();
  const filtrata = cronacaDi(vivo, tuttiGol, resto.cartellini, resto.cambi);
  return { vivo, ...filtrata };
}
