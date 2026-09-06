/**
 * Trasferte: chi ci va, da dove, e prima di tutto se ci puo andare.
 *
 * PERCHE ESISTE
 *
 * Il divieto per le partite a rischio colpisce i RESIDENTI nella provincia,
 * salvo Tessera del tifoso. Non tutti, e non tutte le partite. Un foggiano che
 * vive a Bologna quasi mai e toccato: puo comprare, spesso anche fuori dal
 * settore ospiti. Ma legge "trasferta vietata" sui giornali e rinuncia.
 *
 * La provincia di Foggia ha il peggior saldo migratorio interno d'Italia.
 * Quelli che in trasferta ci possono andare davvero sono proprio gli emigrati,
 * e non si conoscono fra loro.
 *
 * COSA NON SI SCRIVE QUI
 *
 * Nessun contatto. Non c'e una colonna per il telefono e non deve esserci:
 * pubblicare recapiti di terzi su una piattaforma che gestisci tu e il modo
 * piu rapido di prendersi una grana seria. Ci si scrive nel filo della
 * trasferta, dove c'e moderazione e si vede quello che succede.
 */
import { useEffect, useSyncExternalStore } from 'react';

import { supabase } from './supabase';
import { utenteCorrente } from './auth';
import { type Canale } from './contatti-core.ts';

export type Stato = 'aperta' | 'vietata-residenti' | 'ospiti-chiuso' | 'non-confermato';

export type Divieto = {
  partita: string;
  stato: Stato;
  fonte_nome: string | null;
  fonte_url: string | null;
  nota: string | null;
  confermato_il: string | null;
};

export type Mezzo = 'macchina' | 'treno' | 'pullman' | 'aereo' | 'ci-sono-gia';

export type Presenza = {
  partita: string;
  utente: string;
  citta: string;
  mezzo: Mezzo;
  posti: number;
  nota: string | null;
};

export const MEZZI: Record<Mezzo, string> = {
  macchina: 'In macchina',
  treno: 'In treno',
  pullman: 'In pullman',
  aereo: 'In aereo',
  'ci-sono-gia': 'Abito lì vicino',
};

/**
 * Cosa dice la scheda, per ogni stato.
 *
 * La riga di `chiPuo` e il motivo per cui la sezione esiste: dice a chi vive
 * fuori che il divieto non lo riguarda. Senza quella riga questa e l'ennesima
 * pagina di notizie.
 */
export const SPIEGAZIONI: Record<Stato, { titolo: string; chiPuo: string; grave: boolean }> = {
  aperta: {
    titolo: 'Trasferta aperta',
    chiPuo: 'Biglietti in vendita senza limitazioni.',
    grave: false,
  },
  'vietata-residenti': {
    titolo: 'Vietata ai residenti in provincia di Foggia',
    chiPuo: 'Se risiedi fuori dalla provincia puoi comprare. Chi risiede a Foggia solo con la Tessera del tifoso.',
    grave: true,
  },
  'ospiti-chiuso': {
    titolo: 'Settore ospiti chiuso',
    chiPuo: 'Nessun biglietto nel settore ospiti. Fuori da quel settore dipende dal provvedimento: verifica prima di partire.',
    grave: true,
  },
  'non-confermato': {
    titolo: 'Non ancora confermato',
    chiPuo: 'Non ci risulta ancora nessun provvedimento. Non vuol dire che sia aperta: controlla i canali ufficiali.',
    grave: false,
  },
};

export type Contatto = { partita: string; utente: string; canale: Canale; riferimento: string };

type Store = {
  divieti: Record<string, Divieto>;
  presenze: Record<string, Presenza[]>;
  /** contatti visibili: solo di chi va a una partita a cui vai anche tu */
  contatti: Record<string, Contatto[]>;
  io: string | null;
  chieste: string[];
};

let store: Store = { divieti: {}, presenze: {}, contatti: {}, io: null, chieste: [] };
const ascoltatori = new Set<() => void>();

function annuncia() { ascoltatori.forEach((f) => f()); }
const sottoscrivi = (f: () => void) => { ascoltatori.add(f); return () => { ascoltatori.delete(f); }; };
const istantanea = () => store;

/** Aggancia la schermata e chiede i dati di quelle partite una volta sola. */
export function useTrasferte(partite: string[]): Store {
  const chiave = partite.join(',');
  useEffect(() => { void carica(partite); }, [chiave]);
  return useSyncExternalStore(sottoscrivi, istantanea, istantanea);
}

export async function carica(partite: string[]) {
  if (!supabase || !partite.length) return;
  const nuove = partite.filter((p) => !store.chieste.includes(p));
  if (!nuove.length) return;
  store = { ...store, chieste: [...store.chieste, ...nuove] };

  const [d, t, c, u] = await Promise.all([
    supabase.from('divieti').select('*').in('partita', nuove),
    supabase.from('trasferte').select('*').in('partita', nuove),
    // torna vuoto per chi non ha dichiarato di andarci: e la policy a decidere,
    // non il client, quindi qui non c'e niente da filtrare
    supabase.from('trasferte_contatti').select('*').in('partita', nuove),
    utenteCorrente(),
  ]);

  const divieti = { ...store.divieti };
  for (const r of (d.data ?? []) as Divieto[]) divieti[r.partita] = r;

  const presenze = { ...store.presenze };
  for (const p of nuove) presenze[p] = [];
  for (const r of (t.data ?? []) as Presenza[]) (presenze[r.partita] ??= []).push(r);

  const contatti = { ...store.contatti };
  for (const p of nuove) contatti[p] = [];
  for (const r of (c.data ?? []) as Contatto[]) (contatti[r.partita] ??= []).push(r);

  store = { ...store, divieti, presenze, contatti, io: u?.id ?? null };
  annuncia();
}

/** Chi sono io, per riconoscere la mia riga nell'elenco. */
export function ioSono(): string | null {
  return store.io;
}

/**
 * Il contatto di una persona per quella trasferta.
 *
 * Se torna null puo voler dire due cose: che non l'ha lasciato, o che non hai
 * diritto di vederlo perche non hai detto che ci vai. La schermata spiega quale
 * delle due, altrimenti sembra che l'app sia rotta.
 */
export function contattoDi(partita: string, utente: string): Contatto | null {
  return (store.contatti[partita] ?? []).find((c) => c.utente === utente) ?? null;
}

/** Lo stato di una trasferta. Senza dato si dice che non si sa, non che e aperta. */
export function divietoDi(partita: string): Divieto {
  return store.divieti[partita] ?? {
    partita, stato: 'non-confermato', fonte_nome: null, fonte_url: null, nota: null, confermato_il: null,
  };
}

export function chiVa(partita: string): Presenza[] {
  return store.presenze[partita] ?? [];
}

/** Raggruppate per citta: e cosi che due di Bologna si accorgono l'uno dell'altro. */
export function perCitta(partita: string): Array<{ citta: string; gente: Presenza[] }> {
  const m = new Map<string, Presenza[]>();
  for (const p of chiVa(partita)) {
    const c = p.citta.trim();
    m.set(c, [...(m.get(c) ?? []), p]);
  }
  return [...m.entries()]
    .map(([citta, gente]) => ({ citta, gente }))
    .sort((a, b) => b.gente.length - a.gente.length || a.citta.localeCompare(b.citta));
}

export function postiLiberi(partita: string): number {
  return chiVa(partita).reduce((n, p) => n + (p.posti || 0), 0);
}

export async function miaPresenza(partita: string): Promise<Presenza | null> {
  const u = await utenteCorrente();
  if (!u) return null;
  return chiVa(partita).find((p) => p.utente === u.id) ?? null;
}

/**
 * Dichiara che ci vai. Serve un account: senza, non c'e nessuno da avvisare.
 *
 * Il contatto e facoltativo e si scrive dopo la presenza, perche la tabella dei
 * contatti punta a quella delle trasferte: senza esserci dentro, non esiste
 * niente a cui attaccarlo.
 */
export async function ciVado(partita: string, dati: {
  citta: string;
  mezzo: Mezzo;
  posti: number;
  nota?: string;
  canale?: Canale | null;
  riferimento?: string | null;
}) {
  const u = await utenteCorrente();
  if (!supabase || !u) throw new Error('Per dire che ci vai serve un account.');

  const { error } = await supabase.from('trasferte').upsert({
    partita,
    utente: u.id,
    citta: dati.citta.trim(),
    mezzo: dati.mezzo,
    posti: dati.posti,
    nota: dati.nota?.trim() || null,
  }, { onConflict: 'partita,utente' });

  if (error) {
    // il trigger del filtro alza 'bestemmia' o 'parolaccia': va tradotto,
    // altrimenti chi legge non capisce e riscrive peggio
    if (error.message.includes('bestemmia')) throw new Error('Nella nota c\'è una bestemmia. Riscrivila e riprova.');
    if (error.message.includes('parolaccia')) throw new Error('Nella nota c\'è una parola che non passa. Riscrivila e riprova.');
    throw new Error(error.message);
  }

  if (dati.canale && dati.riferimento?.trim()) {
    await supabase.from('trasferte_contatti').upsert({
      partita, utente: u.id, canale: dati.canale, riferimento: dati.riferimento.trim(),
    }, { onConflict: 'partita,utente' });
  } else {
    // niente contatto significa toglierlo, non lasciarlo com'era
    await supabase.from('trasferte_contatti').delete().eq('partita', partita).eq('utente', u.id);
  }

  store = { ...store, chieste: store.chieste.filter((x) => x !== partita) };
  await carica([partita]);
}

export async function nonCiVado(partita: string) {
  const u = await utenteCorrente();
  if (!supabase || !u) return;
  // il contatto se ne va con la presenza: la chiave esterna lo porta via da
  // sola, ma dirlo qui evita di doverlo ricordare leggendo lo schema
  await supabase.from('trasferte').delete().eq('partita', partita).eq('utente', u.id);
  store = { ...store, chieste: store.chieste.filter((x) => x !== partita) };
  await carica([partita]);
}
