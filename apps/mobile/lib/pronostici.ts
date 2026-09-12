import { useEffect, useState } from 'react';

import { supabase } from './supabase';
import { useSessione, utenteCorrente } from './auth';
import { scorePrediction } from './prediction-score';

/**
 * I propri pronostici, con com'e' andata.
 *
 * DA DOVE VIENE OGNI PEZZO
 *
 * Il pronostico e' nostro e si legge dalla tabella. Il risultato vero sta in
 * `partite_chiuse`, che e' pubblica. I punti stanno nei movimenti, che sono
 * solo propri. Tre letture e non una join lato server: sono poche righe, e
 * tenerle separate vuol dire che nessuna delle tre puo far uscire dati altrui.
 *
 * L'esito NON si ricalcola qui per decidere quanto vale: quello lo ha gia'
 * deciso il database quando la partita e' stata chiusa, e i punti sono quelli
 * registrati. Qui si ricalcola solo per dire "ci avevi preso" anche nel caso in
 * cui i punti non ci siano ancora, o siano stati presi prima di un cambio di
 * tariffa.
 */

export type MioPronostico = {
  partita: string;
  casa: number;
  ospiti: number;
  /** null finche' la partita non e' chiusa */
  risultato: { casa: number; ospiti: number } | null;
  /** 0 niente, 1 esito, 3 risultato esatto -- la scala di prediction-score */
  bonta: 0 | 1 | 3 | null;
  /** i punti davvero registrati per quella partita */
  punti: number;
};

export async function caricaMieiPronostici(): Promise<MioPronostico[]> {
  const u = utenteCorrente();
  if (!supabase || !u) return [];

  const { data: miei } = await supabase
    .from('pronostici')
    .select('partita, casa, ospiti')
    .eq('utente', u.id);

  const righe = (miei ?? []) as Array<{ partita: string; casa: number; ospiti: number }>;
  if (righe.length === 0) return [];

  const ids = righe.map((r) => r.partita);
  const [{ data: chiuse }, { data: movimenti }] = await Promise.all([
    supabase.from('partite_chiuse').select('partita, casa, ospiti').in('partita', ids),
    supabase.from('punti_movimenti').select('chiave, punti, azione')
      .eq('utente', u.id).in('chiave', ids),
  ]);

  const finite = new Map<string, { casa: number; ospiti: number }>();
  for (const c of ((chiuse ?? []) as Array<{ partita: string; casa: number; ospiti: number }>)) {
    finite.set(c.partita, { casa: Number(c.casa), ospiti: Number(c.ospiti) });
  }

  const puntiPer = new Map<string, number>();
  for (const m of ((movimenti ?? []) as Array<{ chiave: string; punti: number; azione: string }>)) {
    // il punto del pronostico messo non c'entra con l'averci preso: qui si
    // contano solo i premi dell'esito e del risultato
    if (m.azione !== 'esito' && m.azione !== 'risultato') continue;
    puntiPer.set(m.chiave, (puntiPer.get(m.chiave) ?? 0) + Number(m.punti));
  }

  return righe.map((r) => {
    const vero = finite.get(r.partita) ?? null;
    return {
      partita: r.partita,
      casa: Number(r.casa),
      ospiti: Number(r.ospiti),
      risultato: vero,
      bonta: vero ? scorePrediction([Number(r.casa), Number(r.ospiti)], { home: vero.casa, away: vero.ospiti }) : null,
      punti: puntiPer.get(r.partita) ?? 0,
    };
  });
}

/** Quante ne ha indovinate di fila, contate dal database. */
export async function caricaMiaStriscia(): Promise<number> {
  if (!supabase || !utenteCorrente()) return 0;
  const { data, error } = await supabase.rpc('mia_striscia');
  return error ? 0 : Number(data ?? 0);
}

export function useMieiPronostici() {
  const { utente } = useSessione();
  const [righe, setRighe] = useState<MioPronostico[]>([]);
  const [striscia, setStriscia] = useState(0);
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    let vivo = true;
    if (!utente) { setRighe([]); setStriscia(0); setCaricato(true); return; }
    setCaricato(false);
    void Promise.all([caricaMieiPronostici(), caricaMiaStriscia()]).then(([p, s]) => {
      if (!vivo) return;
      setRighe(p);
      setStriscia(s);
      setCaricato(true);
    });
    return () => { vivo = false; };
  }, [utente?.id]);

  const chiusi = righe.filter((r) => r.risultato);
  const presi = chiusi.filter((r) => (r.bonta ?? 0) > 0).length;
  const esatti = chiusi.filter((r) => r.bonta === 3).length;

  return { righe, striscia, caricato, giocati: righe.length, chiusi: chiusi.length, presi, esatti };
}

/* ==================================================================== *
 *  Il pronostico della prossima partita: uno solo, e sta sul server.   *
 * ==================================================================== *
 *
 * PERCHE QUESTA PARTE ESISTE
 *
 * Prima il pronostico viveva in due posti che non si parlavano: una copia nel
 * telefono (lib/fanplay.ts) e una riga nel database. Il telefono la scriveva
 * sempre, il database solo quando l'invio riusciva -- e se non riusciva nessuno
 * lo diceva, perche la scrittura partiva senza guardare la risposta. Risultato:
 * il Match Center mostrava "hai pronosticato 1-2" e la schermata dei pronostici
 * diceva "non hai ancora pronosticato". Erano tutte e due sincere: guardavano
 * due cose diverse.
 *
 * Adesso la verita e una sola, il database. La copia locale resta solo per far
 * comparire subito il numero mentre la risposta arriva, e viene buttata appena
 * il server risponde. Se il server dice di no, si vede scritto.
 */

const CACHE_LOCALE = 'daunia.pronostici.v2';

type Coppia = { casa: number; ospiti: number };

let mieiPerPartita: Record<string, Coppia> = leggiCopia();
let caricatoDalServer = false;
const perPronostici = new Set<() => void>();

function leggiCopia(): Record<string, Coppia> {
  try {
    const raw = globalThis.localStorage?.getItem(CACHE_LOCALE);
    return raw ? (JSON.parse(raw) as Record<string, Coppia>) : {};
  } catch { return {}; }
}

function salvaCopia() {
  try { globalThis.localStorage?.setItem(CACHE_LOCALE, JSON.stringify(mieiPerPartita)); }
  catch { /* senza memoria si riparte dal server a ogni apertura: va bene lo stesso */ }
}

function avvisaPronostici() { for (const f of perPronostici) f(); }

/** Rilegge dal server tutti i propri pronostici. E questa la verita. */
export async function ricaricaPronostici(): Promise<void> {
  const u = utenteCorrente();
  if (!supabase || !u) {
    mieiPerPartita = {};
    caricatoDalServer = false;
    salvaCopia();
    avvisaPronostici();
    return;
  }
  const { data, error } = await supabase
    .from('pronostici').select('partita, casa, ospiti').eq('utente', u.id);
  if (error) return;
  const nuovo: Record<string, Coppia> = {};
  for (const r of ((data ?? []) as Array<{ partita: string; casa: number; ospiti: number }>)) {
    nuovo[r.partita] = { casa: Number(r.casa), ospiti: Number(r.ospiti) };
  }
  mieiPerPartita = nuovo;
  caricatoDalServer = true;
  salvaCopia();
  avvisaPronostici();
  void recuperaVecchi();
}

/*
 * Ripesca i pronostici rimasti solo nel telefono.
 *
 * Prima la scrittura verso il server partiva senza guardare la risposta, e
 * quando falliva -- rete assente, sessione scaduta, oppure il pronostico messo
 * prima di aver fatto l'accesso -- restava solo la copia locale. Chi lo aveva
 * fatto vedeva il suo 1-2 nel Match Center e "nessun pronostico" nell'altra
 * schermata, e aveva ragione a non capirci niente.
 *
 * Gira una volta per apertura, in silenzio. Quelli di partite gia cominciate li
 * rifiuta il database, ed e giusto cosi: non si pronostica a cose fatte.
 */
let recuperoFatto = false;

async function recuperaVecchi(): Promise<void> {
  if (recuperoFatto || !supabase || !utenteCorrente()) return;
  recuperoFatto = true;

  let vecchi: Record<string, [number, number]> = {};
  try {
    const raw = globalThis.localStorage?.getItem('daunia.fanplay.v1');
    vecchi = raw ? ((JSON.parse(raw) as { predictions?: Record<string, [number, number]> }).predictions ?? {}) : {};
  } catch { return; }

  let recuperati = 0;
  for (const [partita, coppia] of Object.entries(vecchi)) {
    if (mieiPerPartita[partita] || !Array.isArray(coppia)) continue;
    const r = await salvaPronostico(partita, Number(coppia[0]), Number(coppia[1]));
    if (r.ok) recuperati += 1;
  }
  if (recuperati) avvisaPronostici();
}

export function pronosticoDi(partita: string | null | undefined): Coppia | null {
  return partita ? mieiPerPartita[partita] ?? null : null;
}

/**
 * Il messaggio del database, tradotto in italiano da leggere.
 *
 * Un errore tecnico in inglese sotto un tasto "Salva" fa pensare che l'app sia
 * rotta anche quando il motivo e semplicissimo.
 */
function spiega(messaggio: string): string {
  const m = messaggio.toLowerCase();
  if (m.includes('cominciata') || m.includes('iniziata')) {
    return 'La partita è già cominciata: i pronostici si chiudono al fischio d’inizio.';
  }
  if (m.includes('sospeso')) return 'Il tuo account è sospeso: non puoi giocare il pronostico.';
  if (m.includes('jwt') || m.includes('not authenticated') || m.includes('row-level')) {
    return 'La tua sessione è scaduta. Esci e rientra, poi riprova.';
  }
  if (m.includes('failed to fetch') || m.includes('network')) {
    return 'Non c’è collegamento. Riprova quando torna la rete.';
  }
  return 'Non è riuscito a salvare. Riprova fra poco.';
}

/**
 * Salva il pronostico e aspetta la risposta.
 *
 * Aspettare e il punto: prima si scriveva e si andava avanti senza guardare, e
 * un rifiuto del server passava inosservato.
 */
export async function salvaPronostico(
  partita: string, casa: number, ospiti: number,
): Promise<{ ok: boolean; messaggio: string }> {
  const u = utenteCorrente();
  if (!supabase) return { ok: false, messaggio: 'Il pronostico ha bisogno del collegamento.' };
  if (!u) return { ok: false, messaggio: 'Per giocare il pronostico serve un account.' };
  if (!Number.isInteger(casa) || !Number.isInteger(ospiti) || casa < 0 || ospiti < 0 || casa > 9 || ospiti > 9) {
    return { ok: false, messaggio: 'Metti due numeri da 0 a 9.' };
  }

  const { error } = await supabase
    .from('pronostici')
    .upsert({ utente: u.id, partita, casa, ospiti }, { onConflict: 'utente,partita' });

  if (error) return { ok: false, messaggio: spiega(error.message) };

  mieiPerPartita = { ...mieiPerPartita, [partita]: { casa, ospiti } };
  salvaCopia();
  avvisaPronostici();
  return { ok: true, messaggio: `Salvato: ${casa}–${ospiti}.` };
}

/**
 * Il pronostico di una partita, con quello che serve per mostrarlo e cambiarlo.
 *
 * `caricato` dice se il server ha gia risposto: finche e falso non si scrive
 * "non hai ancora pronosticato", perche potrebbe non essere vero e sarebbe
 * proprio l'errore di prima.
 */
export function usePronostico(partita: string | null | undefined) {
  const { utente } = useSessione();
  const [, forza] = useState(0);

  useEffect(() => {
    const l = () => forza((n) => n + 1);
    perPronostici.add(l);
    return () => { perPronostici.delete(l); };
  }, []);

  useEffect(() => {
    if (!utente) { mieiPerPartita = {}; caricatoDalServer = false; salvaCopia(); avvisaPronostici(); return; }
    void ricaricaPronostici();
  }, [utente?.id]);

  return {
    mio: pronosticoDi(partita),
    caricato: caricatoDalServer || !utente,
    conAccount: Boolean(utente),
  };
}
