import { useEffect, useSyncExternalStore } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import { supabase, backendAttivo } from './supabase';
import { registra } from './misure';
import { maschera } from './filtro-core.ts';
import { utenteCorrente } from './auth';

/**
 * La Curva, con un modello solo: la discussione.
 *
 * Prima c'erano due cose da capire prima di scrivere — la bacheca per i pezzi
 * lunghi, le stanze per i messaggi brevi — e nessuno sapeva quale usare. Ora un
 * contributo e sempre lo stesso oggetto: titolo, testo, risposte sotto. Un
 * articolo e una discussione con un testo lungo, un "chi c'e domenica?" e una
 * discussione con due righe. Gli argomenti sono etichette, non stanze.
 *
 * La chat perdeva tutto il giorno dopo: niente ricerca, nessuno che risponde a
 * un messaggio di tre giorni prima, e all'arrivo degli account niente su cui
 * moderare. Il filo di discussione regge da trent'anni perche una tifoseria non
 * e mai tutta collegata nello stesso momento.
 *
 * Due modi di funzionare, stessa interfaccia verso le schermate.
 *
 * Con il database configurato e un account attivo, tutto passa da Supabase.
 * Senza, resta la dimostrazione: gli esempi qui sotto piu quello che scrivi, che
 * rimane nella memoria del browser. Le schermate chiamano le stesse funzioni e
 * non sanno quale dei due sta girando: e per questo che il passaggio non ha
 * richiesto di toccarle.
 */

/*
 * L'ordine e quello con cui compaiono: davanti le cose di cui si parla ogni
 * settimana, in fondo quelle che si aprono ogni tanto.
 *
 * Tredici sono tanti, e i primi mesi molti resteranno vuoti. E un compromesso
 * accettato: una categoria vuota si nota meno di una discussione sulle
 * penalizzazioni finita dentro "Fuori tema".
 */
export const TOPICS = [
  'Partita', 'Formazione', 'Mercato', 'Società', 'Arbitri',
  'Trasferte', 'Biglietti', 'Tifoseria', 'Zaccheria', 'Serie C',
  'Giovanili', 'Memoria', 'Fuori tema',
] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_ICON: Record<Topic, keyof typeof Ionicons.glyphMap> = {
  Partita: 'football',
  Formazione: 'grid',
  Mercato: 'swap-horizontal',
  Società: 'business',
  Arbitri: 'flag',
  Trasferte: 'car-sport',
  Biglietti: 'ticket',
  Tifoseria: 'flame',
  Zaccheria: 'location',
  'Serie C': 'trophy',
  Giovanili: 'school',
  Memoria: 'time',
  'Fuori tema': 'chatbubbles',
};

export type Reply = {
  id: string;
  author: string;
  body: string;
  date: string;
  sample: boolean;
  /** chi l'ha scritta: serve a decidere se mostrare modifica e cestino */
  autoreId?: string | null;
  modificata?: boolean;
};

export type Discussion = {
  id: string;
  /** chi l'ha aperta: serve a decidere se mostrare modifica e cestino */
  autoreId?: string | null;
  author: string;
  title: string;
  body: string;
  topic: Topic;
  date: string;
  replies: Reply[];
  likes: number;
  /** true = esempio, non scritto da una persona vera */
  sample: boolean;
};

/** Ultima attivita: serve a tenere in cima i fili vivi. */
export function lastActivity(d: Discussion): string {
  return d.replies.length ? d.replies[d.replies.length - 1]!.date : d.date;
}

/*
 * Qui c'erano dieci discussioni finte, con autori inventati -- Michele P.,
 * Rita C. -- e risposte scritte a tavolino. Servivano a far vedere come
 * sarebbe stata la Curva piena, ma un tifoso che apre l'app e legge un
 * commento non ha modo di sapere che nessuno l'ha scritto.
 *
 * Una bacheca vuota dice la verita: che si comincia adesso.
 */

/* ---------------------------------------------------- quello che scrivi tu */

const KEY = 'daunia.curva.v2';

type Stored = { discussions: Discussion[]; replies: Array<Reply & { on: string }> };

function read(): Stored {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as Stored) : { discussions: [], replies: [] };
  } catch {
    return { discussions: [], replies: [] };
  }
}

let mine = read();
const listeners = new Set<() => void>();
let all: Discussion[] = [];

function rebuild() {
  const merged = [...mine.discussions].map((d) => ({
    ...d,
    replies: [...d.replies, ...mine.replies.filter((x) => x.on === d.id)],
  }));
  all = merged.sort((a, b) => lastActivity(b).localeCompare(lastActivity(a)));
}
rebuild();

function commit() {
  rebuild();
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(mine));
  } catch {
    /* niente memoria: resta solo per questa sessione */
  }
  listeners.forEach((l) => l());
}

/* --------------------------------------------------------------- database */

type RigaProfilo = { nome: string | null } | null;
type RigaRisposta = {
  id: string; testo: string; creata_il: string; autore: string; modificata_il?: string | null; profiles: RigaProfilo;
};
type RigaDiscussione = {
  id: string; titolo: string; testo: string; argomento: string;
  creata_il: string; attiva_il: string; autore: string;
  profiles: RigaProfilo; risposte: RigaRisposta[] | null;
};

const soloData = (iso: string) => iso.slice(0, 10);

function daRiga(r: RigaDiscussione): Discussion {
  const mio = utenteCorrente()?.id;
  return {
    id: r.id,
    author: r.profiles?.nome ?? 'Tifoso',
    autoreId: r.autore,
    title: r.titolo,
    body: r.testo,
    topic: r.argomento as Topic,
    date: soloData(r.creata_il),
    likes: 0,
    sample: false,
    replies: (r.risposte ?? [])
      .sort((a, b) => a.creata_il.localeCompare(b.creata_il))
      .map((x) => ({
        id: x.id,
        author: x.profiles?.nome ?? 'Tifoso',
        body: x.testo,
        date: soloData(x.creata_il),
        sample: x.autore !== mio ? true : false,
        autoreId: x.autore,
        modificata: Boolean((x as { modificata_il?: string | null }).modificata_il),
      })),
  };
}

let caricamentoAvviato = false;

/** Scarica le discussioni e sostituisce la cache. Silenzioso: se fallisce restano gli esempi. */
export async function ricarica() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('discussioni')
    .select('id, titolo, testo, argomento, creata_il, attiva_il, autore, modificata_il, profiles(nome), risposte(id, testo, creata_il, autore, modificata_il, profiles(nome))')
    .order('attiva_il', { ascending: false })
    .limit(100);
  if (error || !data) return;
  all = (data as unknown as RigaDiscussione[]).map(daRiga);
  listeners.forEach((l) => l());
}

export function useDiscussions(): Discussion[] {
  useEffect(() => {
    if (!backendAttivo || caricamentoAvviato) return;
    caricamentoAvviato = true;
    void ricarica();
  }, []);

  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => listeners.delete(l); },
    () => all,
    () => all,
  );
}

export function discussionById(id: string): Discussion | null {
  return all.find((d) => d.id === id) ?? null;
}

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Copre le parolacce invece di respingere il messaggio.
 *
 * Il cancello vero e il trigger in Postgres, che copre le stesse parole con la
 * stessa regola: quello qui serve a far vedere subito com'e venuto il testo,
 * senza aspettare il giro sul server. Passarci due volte non cambia niente,
 * perche una parola gia coperta non e piu una parolaccia.
 *
 * Vale anche per la modalita senza account, dove il database non c'e proprio e
 * questa e l'unica regola che gira.
 */
function copri(testo: string): string {
  return maschera(testo).testo;
}

/**
 * Traduce il rifiuto del database in una frase leggibile.
 *
 * Il trigger alza 'bestemmia' o 'parolaccia', che va bene per i registri e non
 * per una persona. Se il messaggio arriva cosi com'e, chi legge non capisce e
 * riscrive peggio.
 */
function tradotto(messaggio: string): string {
  if (messaggio.includes('bestemmia')) {
    return 'Qui le bestemmie non passano. Riscrivi senza e il messaggio parte.';
  }
  if (messaggio.includes('parolaccia')) {
    return 'C\'è una parola che qui non passa. Riscrivi e il messaggio parte.';
  }
  return messaggio;
}

export async function addDiscussion(input: { author: string; title: string; body: string; topic: Topic }) {
  const titolo = copri(input.title.trim());
  const testo = copri(input.body.trim());
  const u = utenteCorrente();
  if (supabase && u) {
    const { data, error } = await supabase.from('discussioni').insert({
      autore: u.id,
      titolo,
      testo,
      argomento: input.topic,
    }).select('id').single();
    if (error) throw new Error(tradotto(error.message));
    registra('curva_scritto');
    await ricarica();
    return { id: (data as { id: string }).id } as Discussion;
  }
  return aggiungiInLocale({ ...input, title: titolo, body: testo });
}

function aggiungiInLocale(input: { author: string; title: string; body: string; topic: Topic }) {
  const d: Discussion = {
    id: `mine-${Date.now()}`,
    author: input.author.trim() || 'Tu',
    title: input.title.trim(),
    body: input.body.trim(),
    topic: input.topic,
    date: today(),
    replies: [],
    likes: 0,
    sample: false,
  };
  mine = { ...mine, discussions: [d, ...mine.discussions] };
  commit();
  return d;
}

export async function addReply(on: string, author: string, body: string) {
  const text = copri(body.trim());
  if (!text) return;
  const u = utenteCorrente();
  if (supabase && u) {
    const { error } = await supabase.from('risposte').insert({
      discussione: on, autore: u.id, testo: text,
    });
    if (error) throw new Error(tradotto(error.message));
    registra('curva_scritto');
    await ricarica();
    return;
  }
  mine = {
    ...mine,
    replies: [...mine.replies, {
      id: `mine-r-${Date.now()}`, on, author: author.trim() || 'Tu', body: text,
      date: today(), sample: false,
    }],
  };
  commit();
}

export async function removeDiscussion(id: string) {
  const u = utenteCorrente();
  if (supabase && u) {
    await supabase.from('discussioni').delete().eq('id', id).eq('autore', u.id);
    await ricarica();
    return;
  }
  mine = {
    discussions: mine.discussions.filter((d) => d.id !== id),
    replies: mine.replies.filter((r) => r.on !== id),
  };
  commit();
}

export function like(id: string) {
  const target = all.find((d) => d.id === id);
  if (target) { target.likes += 1; listeners.forEach((l) => l()); }
}

/** Quante ne ho scritte io, fra discussioni e risposte. */
export function mineCount() {
  return mine.discussions.length + mine.replies.length;
}

/* ------------------------------------------------- modifica e cancellazione */

/** Vero se quel pezzo l'ho scritto io: senza account, mai. */
export function eMio(autoreId: string | null | undefined): boolean {
  const u = utenteCorrente();
  return Boolean(u && autoreId && u.id === autoreId);
}

/**
 * Corregge una risposta gia pubblicata.
 *
 * Il filtro vale anche qui, e non solo nell'app: il trigger nel database scatta
 * sulle modifiche come sugli inserimenti. Senza, bastava pubblicare pulito e
 * correggere dopo.
 */
export async function modificaRisposta(id: string, testo: string) {
  const t = copri(testo.trim());
  if (t.length < 2) throw new Error('Il messaggio è troppo corto.');

  const u = utenteCorrente();
  if (supabase && u) {
    const { error } = await supabase.from('risposte')
      .update({ testo: t, modificata_il: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(tradotto(error.message));
    await ricarica();
    return;
  }
  mine = {
    ...mine,
    replies: mine.replies.map((r) => (r.id === id ? { ...r, body: t } : r)),
  };
  commit();
}

/** Cancella una propria risposta. */
export async function cancellaRisposta(id: string) {
  const u = utenteCorrente();
  if (supabase && u) {
    const { error } = await supabase.from('risposte').delete().eq('id', id);
    if (error) throw new Error(error.message);
    await ricarica();
    return;
  }
  mine = { ...mine, replies: mine.replies.filter((r) => r.id !== id) };
  commit();
}

/** Corregge una discussione: titolo e testo insieme, come si e scritta. */
export async function modificaDiscussione(id: string, titolo: string, testo: string) {
  const t = copri(titolo.trim());
  const c = copri(testo.trim());
  const u = utenteCorrente();
  if (supabase && u) {
    const { error } = await supabase.from('discussioni')
      .update({ titolo: t, testo: c, modificata_il: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(tradotto(error.message));
    await ricarica();
    return;
  }
  mine = {
    ...mine,
    discussions: mine.discussions.map((d) => (d.id === id ? { ...d, title: t, body: c } : d)),
  };
  commit();
}
