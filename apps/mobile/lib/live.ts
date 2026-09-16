/**
 * Punteggio dal vivo.
 *
 * Il guardiano scrive la partita in `stato_partita` tre volte al minuto, e
 * l'app la riceve con Realtime appena cambia. Una lettura della riga ogni tanto
 * resta come rete: ogni minuto con Realtime collegato, ogni quindici secondi
 * senza.
 *
 * L'id della partita arriva dall'ingest in data/prossima.json, dentro il bundle:
 * cosi il telefono non deve cercarselo a ogni apertura.
 *
 * Il dal vivo si accende da dieci minuti prima del calcio d'inizio a tre ore
 * dopo, e si spegne quando l'app va in secondo piano. Se una lettura fallisce
 * si tiene l'ultimo punteggio buono: meglio un dato di un minuto fa che una
 * schermata vuota.
 *
 * I conti stanno in live-core.ts, che e senza React e sotto test.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { Match } from '@satanelli/core';

import { prossima } from './data';
import { useDati } from './bundle-remoto';
import { supabase } from './supabase';
import {
  cronacaDi, daChiedere, finestraAperta, leggiEvento, orienta, realtimeAffidabile, type Live,
} from './live-core';

export type { Live } from './live-core';

const BASE = 'https://www.thesportsdb.com/api/v1/json/123';
/** il passo della rete di sicurezza: quanto spesso ci si chiede se rileggere la riga */
const OGNI = 15_000;
/** ogni quanto si guarda se la finestra della partita si e aperta */
const CONTROLLO = 60_000;
/** dopo quanto si riprova un canale Realtime caduto: raddoppia a ogni caduta, fino a un minuto */
const RIPROVA = 5_000;
const RIPROVA_MASSIMA = 60_000;
/** ogni quanto si ridisegna il minuto fra un aggiornamento e l'altro */
const BATTITO = 15_000;

let stato: Live | null = null;
/** i gol della partita in corso, col minuto: la cronologia che il guardiano registra */
let gol: GolVivo[] = [];
/** cartellini e cambi della partita in corso: prima si vedevano solo il giorno dopo */
let cartellini: CartellinoVivo[] = [];
let cambi: CambioVivo[] = [];
/** i gol annullati: restano nella cronaca, sbarrati, perche la gente li ha visti */
let annullati: GolAnnullato[] = [];
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
let controllo: ReturnType<typeof setInterval> | null = null;
let riprova: ReturnType<typeof setTimeout> | null = null;
/** la partita che si sta seguendo: se il bundle nuovo ne porta un'altra, si ricomincia */
let seguita: string | null = null;
/** vero quando Realtime ha confermato l'iscrizione alla riga */
let collegato = false;
/** l'ultimo evento arrivato da Realtime: il silenzio dice che il canale si e piantato */
let ultimoEvento = 0;
/** cadute di fila del canale: un Realtime che rifiuta sempre non va martellato ogni cinque secondi */
let cadute = 0;
let ultimaDomanda = 0;

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
  fonte?: 'vero' | 'stimato' | 'eventi' | 'admin';
  /** c'e solo sui gol scritti dal pannello: serve per poterli annullare */
  id?: string | null;
  /** da che parte del campo, come l'ha scritto il pannello */
  lato?: 'casa' | 'ospiti';
};

/** Un gol tolto dal tabellone: annullato dall'arbitro, o segnato per sbaglio. */
export type GolAnnullato = {
  id?: string | null;
  minuto?: string | null;
  chi?: string | null;
  nostro?: boolean;
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
  /** i minuti di recupero annunciati: non li pubblica nessuna fonte dal vivo */
  recupero?: number | null;
  /** vero quando il tabellone lo sta tenendo un amministratore */
  manuale?: boolean | null;
  annullati?: GolAnnullato[] | null;
};

/** L'undici ufficiale scritto dal guardiano, com'e nel database. */
export type ColonnaVivo = {
  squadra: string; modulo: string | null; allenatore: string | null;
  giocatori: Array<{ numero: number | null; nome: string; ruolo: string | null }>;
};
export type FormazioneVivo = {
  casa: ColonnaVivo;
  ospiti: ColonnaVivo;
  /** chi l'ha pubblicata, quando non e il sito della Lega: "calciofoggia.it" */
  fonte?: string | null;
};

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
    recupero: r.recupero ?? null,
    manuale: r.manuale ?? false,
  }, Number.isFinite(scritto) ? scritto : Date.now());
}

/*
 * Al triplice fischio non si smette piu di ascoltare.
 *
 * Prima qui si chiudeva tutto appena la partita risultava finita. Ma il
 * guardiano mostra la fine subito e chiude il risultato qualche minuto dopo,
 * quando le fonti lo confermano: un gol al novantacinquesimo arrivato in
 * ritardo, o il nome di un marcatore, sarebbero rimasti fuori fino alla
 * riapertura dell'app. Si continua fino alla fine della finestra.
 */
function applica(letto: Live | null, cronologia?: GolVivo[] | null, r?: Riga) {
  if (Array.isArray(cronologia)) gol = cronologia;
  if (Array.isArray(r?.cartellini)) cartellini = r.cartellini;
  if (Array.isArray(r?.cambi)) cambi = r.cambi;
  if (Array.isArray(r?.annullati)) annullati = r.annullati;
  if (!letto) { if (Array.isArray(cronologia)) annuncia(); return; }
  stato = letto;
  annuncia();
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
    .select('stato, casa, ospiti, minuto, gol, cartellini, cambi, aggiornato_il, finita_il, formazione, recupero, manuale, annullati')
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
  ultimaDomanda = Date.now();
  if (await chiediAlDatabase()) return;
  await chiediAllaFonte();
}

/** l'abbonamento alle modifiche della riga: uno solo per tutta l'app */
let canale: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;

/*
 * Un canale nuovo a ogni iscrizione, e uno caduto si rifa.
 *
 * Prima il canale si chiudeva con `unsubscribe()` e si riapriva con lo stesso
 * nome. Il client Supabase, trovando un canale con quel nome ancora in uscita,
 * restituiva quello: la nuova iscrizione non partiva, e appena l'uscita finiva
 * l'app restava senza Realtime fino al riavvio, con la sola lettura periodica.
 * Succedeva tornando all'app subito dopo averla lasciata.
 *
 * E se il canale cade da solo -- rete che cambia, telefono che dorme -- prima
 * nessuno lo rifaceva.
 */
function ascoltaIlDatabase() {
  const id = prossima?.eventId;
  if (!supabase || !id || canale) return;
  const client = supabase;
  const c = client
    .channel(`partita-${id}-${Date.now()}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'stato_partita', filter: `partita=eq.${id}` },
      (m) => {
        ultimoEvento = Date.now();
        const r = m.new as Riga;
        finitaIl = r.finita_il ?? null;
        formazioneVivo = r.formazione ?? null;
        applica(daRiga(r), r.gol ?? [], r);
      },
    )
    .subscribe((s) => {
      // un canale gia sostituito non decide piu niente
      if (canale !== c) return;
      collegato = s === 'SUBSCRIBED';
      // appena collegati si rilegge la riga: quello che e cambiato mentre ci si
      // collegava non arriva da Realtime
      if (s === 'SUBSCRIBED') { cadute = 0; ultimoEvento = Date.now(); void chiedi(); return; }
      if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') {
        canale = null;
        void client.removeChannel(c);
        const attesa = Math.min(RIPROVA * 2 ** cadute, RIPROVA_MASSIMA);
        cadute += 1;
        if (!riprova) riprova = setTimeout(() => { riprova = null; avvia(); }, attesa);
      }
    });
  canale = c;
}

/**
 * Accende quello che serve, se la finestra della partita e aperta.
 *
 * Si puo chiamare quante volte si vuole: accende solo quello che manca. E si
 * chiama da sola ogni minuto (`controllo`), perche prima partiva solo
 * all'apertura dell'app: chi la apriva alle 20:40 per una partita delle 21:00 e
 * la teneva davanti non riceveva mai niente, perche alle 20:40 la finestra era
 * ancora chiusa e nessuno ricontrollava.
 */
function avvia() {
  const id = prossima?.eventId ? String(prossima.eventId) : null;
  /*
   * Il bundle nuovo porta un'altra partita: si lascia quella vecchia, e con lei
   * tutto quello che se ne sapeva.
   *
   * L'app installata resta in memoria per giorni. Senza questo la fine della
   * partita di sabato restava in `finitaIl`, e la chat di martedi si
   * considerava chiusa venti minuti dopo sabato fino alla prima lettura.
   */
  if (id !== seguita) {
    ferma();
    seguita = id;
    const cera = stato || gol.length || cartellini.length || cambi.length || annullati.length
      || finitaIl || formazioneVivo;
    stato = null;
    gol = [];
    cartellini = [];
    cambi = [];
    annullati = [];
    finitaIl = null;
    formazioneVivo = null;
    cadute = 0;
    if (cera) annuncia();
  }
  if (!finestraAperta(prossima?.kickoff)) { ferma(); return; }

  ascoltaIlDatabase();

  /*
   * Il battito del cronometro.
   *
   * Il dato dal server arriva a ogni cambio; senza questo il minuto sullo
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

  if (timer) return;
  // un colpo subito: la riga puo essere cambiata mentre l'app era chiusa
  void chiedi();
  timer = setInterval(() => {
    if (!finestraAperta(prossima?.kickoff)) { ferma(); return; }
    const adesso = Date.now();
    const affidabile = realtimeAffidabile(collegato, ultimoEvento, Boolean(stato?.finita), adesso);
    if (daChiedere(affidabile, ultimaDomanda, adesso)) void chiedi();
  }, OGNI);
}

function ferma() {
  if (timer) clearInterval(timer);
  timer = null;
  if (battito) clearInterval(battito);
  battito = null;
  if (riprova) clearTimeout(riprova);
  riprova = null;
  collegato = false;
  if (canale) {
    const c = canale;
    canale = null;
    void supabase?.removeChannel(c);
  }
}

/** L'app torna in primo piano o si apre: il controllo della finestra riparte. */
function accendi() {
  if (!controllo) controllo = setInterval(avvia, CONTROLLO);
  avvia();
}

/** L'app va in secondo piano: si spegne tutto, batteria e connessioni comprese. */
function spegni() {
  if (controllo) clearInterval(controllo);
  controllo = null;
  ferma();
}

/**
 * Il punteggio dal vivo, se c'e. Il poller e uno solo per tutta l'app, anche se
 * la scheda partita compare in piu schermate insieme.
 */
export function useLive(): Live | null {
  // cambia a ogni bundle scaricato: la partita da seguire puo essere un'altra
  const versione = useDati();
  useEffect(() => {
    if (AppState.currentState !== 'background') accendi();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') accendi(); else spegni();
    });
    return () => { sub.remove(); };
  }, [versione]);

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
export function useCronacaVivo(): {
  cartellini: CartellinoVivo[]; cambi: CambioVivo[]; annullati: GolAnnullato[];
} {
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
let cronacaCache: { cartellini: CartellinoVivo[]; cambi: CambioVivo[]; annullati: GolAnnullato[] } = {
  cartellini, cambi, annullati,
};
function cronacaFerma() {
  if (cronacaCache.cartellini !== cartellini || cronacaCache.cambi !== cambi
      || cronacaCache.annullati !== annullati) {
    cronacaCache = { cartellini, cambi, annullati };
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
  annullati: readonly GolAnnullato[];
} {
  const vivo = liveDi(match, useLive());
  const tuttiGol = useGolVivo();
  const resto = useCronacaVivo();
  const filtrata = cronacaDi(vivo, tuttiGol, resto.cartellini, resto.cambi, resto.annullati);
  return { vivo, ...filtrata };
}
