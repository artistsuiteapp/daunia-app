import { useEffect, useSyncExternalStore } from 'react';
import type { Ionicons } from '@expo/vector-icons';

import { supabase, backendAttivo } from './supabase';
import { controlla, spiegazione } from './filtro-core.ts';
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

export const TOPICS = [
  'Partita', 'Formazione', 'Mercato', 'Trasferte', 'Zaccheria', 'Giovanili', 'Memoria', 'Fuori tema',
] as const;
export type Topic = (typeof TOPICS)[number];

export const TOPIC_ICON: Record<Topic, keyof typeof Ionicons.glyphMap> = {
  Partita: 'football',
  Formazione: 'grid',
  Mercato: 'swap-horizontal',
  Trasferte: 'car-sport',
  Zaccheria: 'location',
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
};

export type Discussion = {
  id: string;
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

/* ------------------------------------------------------------------ esempi */

let n = 0;
const r = (author: string, body: string, date: string): Reply =>
  ({ id: `r${++n}`, author, body, date, sample: true });

const SAMPLES: Discussion[] = [
  {
    id: 's1',
    author: 'Michele P.',
    topic: 'Partita',
    date: '2026-09-01',
    title: 'Una rete subita in centottanta minuti',
    body: `Quattro punti in due giornate si commentano da soli e non dicono granché. Il numero che mi ha fatto rileggere due volte il tabellino è un altro: una rete subita in centottanta minuti.

Chi va allo stadio da un po' sa cosa vuol dire. Non è che siamo diventati una corazzata, è che finalmente la squadra torna dietro tutta insieme. Il centrocampo scala, i due centrali non restano mai da soli, e quando ripartono gli avversari trovano gente davanti.

Poi certo, davanti si fa fatica. Ma preferisco una squadra che impara a non prenderle e poi trova il gol, che il contrario. Il contrario l'abbiamo già visto e sappiamo come finisce.`,
    likes: 34,
    sample: true,
    replies: [
      r('Antonio', "Concordo. Aggiungo che anche i terzini stanno più bassi rispetto all'anno scorso.", '2026-09-01'),
      r('Rita', 'Speriamo regga anche quando alzeremo il baricentro.', '2026-09-02'),
      r('Nicola', 'Basta un gol e poi la difendiamo. Dietro stiamo messi bene davvero.', '2026-09-03'),
    ],
  },
  {
    id: 's2',
    author: 'Giuseppe L.',
    topic: 'Zaccheria',
    date: '2026-08-28',
    title: 'Il rumore della Est quando entra la squadra',
    body: `Ho portato mio figlio la prima volta a maggio. Aveva sette anni e per tutta la settimana mi aveva chiesto se era vero che si sente da fuori.

Siamo entrati venti minuti prima. Lui guardava il campo vuoto e non capiva perché fossimo arrivati così presto. Poi la gradinata ha cominciato a riempirsi, e quando è uscita la squadra per il riscaldamento si è girato verso di me con gli occhi larghi e non ha detto niente.

Ecco, quello. Nessun dato sulla percentuale di riempimento riesce a spiegarlo, e va bene così.`,
    likes: 61,
    sample: true,
    replies: [
      r('Salvo', 'La prima volta di mio nipote è stata identica. Non ha parlato per dieci minuti.', '2026-08-29'),
      r('Francesca D.', 'Il bello è che poi ci tornano da soli, a vent\'anni, senza che glielo dica nessuno.', '2026-08-30'),
    ],
  },
  {
    id: 's3',
    author: 'Francesca D.',
    topic: 'Partita',
    date: '2026-09-02',
    title: 'Perché il Cerignola non è una partita come le altre',
    body: `Ogni volta che spiego questa partita a qualcuno che non è di qua devo partire dalla geografia. Quaranta chilometri. Molti di noi hanno parenti là, o ci lavorano, o ci hanno studiato.

Non è una rivalità costruita a tavolino né una di quelle inventate dai social negli ultimi anni. È semplicemente che il lunedì mattina qualcuno in ufficio ha da dire qualcosa, e per una settimana la partita continua fuori dal campo.

Per questo il risultato pesa il doppio anche a settembre, quando la classifica non vuol dire ancora niente.`,
    likes: 48,
    sample: true,
    replies: [
      r('Michele P.', 'Confermo, mia moglie è di Cerignola. In casa è una settimana complicata.', '2026-09-03'),
      r('Nicola', 'E poi vinciamo e non se ne parla più.', '2026-09-03'),
      r('Giuseppe L.', "Ricordati che l'hai scritto, poi te lo rileggiamo lunedì.", '2026-09-04'),
    ],
  },
  {
    id: 's4',
    author: 'Nicola R.',
    topic: 'Trasferte',
    date: '2026-08-30',
    title: 'Monopoli il 13: chi si organizza in macchina?',
    body: `Apro il discorso adesso così c'è tempo. Per Monopoli si va in macchina, sono poco più di due ore, e da soli non ha senso.

Io parto dal centro e ho tre posti. Se qualcuno viene dalla zona di via Napoli conviene trovarsi lì e fare due macchine invece di quattro.

Sul settore ospiti aspettiamo la comunicazione ufficiale prima di dire cavolate: appena esce la mettiamo qui.`,
    likes: 22,
    sample: true,
    replies: [
      r('Pasquale', 'Io ho due posti e parto dalla zona università.', '2026-08-30'),
      r('Rita', 'Aspettiamo la comunicazione sul settore ospiti prima di prenotare qualsiasi cosa.', '2026-08-31'),
    ],
  },
  {
    id: 's5',
    author: 'Antonio V.',
    topic: 'Formazione',
    date: '2026-09-04',
    title: 'Ravasio dentro subito o si aspetta?',
    body: `È arrivato da tre giorni. Io lo terrei in panchina e lo farei entrare nella ripresa, quando gli altri sono stanchi.

Del Sole invece lo vedo titolare: serve uno che salti l'uomo, e finora non ne abbiamo avuti.

A centrocampo con Zuccon cambia parecchio: è la prima volta quest'anno che c'è una vera alternativa in mezzo.`,
    likes: 29,
    sample: true,
    replies: [
      r('Giuseppe L.', 'Io non toccherei la difesa. Una rete presa in centottanta minuti non si tocca.', '2026-09-04'),
      r('Francesca D.', "D'accordo su Del Sole. Ma Ravasio ha bisogno di minuti, non di panchina.", '2026-09-04'),
    ],
  },
  {
    id: 's6',
    author: 'Rita C.',
    topic: 'Memoria',
    date: '2026-08-20',
    title: "Per chi non c'era negli anni di Zeman",
    body: `Mi capita spesso che qualcuno più giovane mi chieda com'era davvero. È una domanda difficile, perché il rischio è raccontarla come una favola.

La verità è che era una squadra che giocava in un modo che a quei tempi non faceva nessuno, e che perdeva anche parecchio proprio per quello. Ma allo stadio ci andavi sapendo che qualcosa sarebbe successo, in un senso o nell'altro.

Non credo che si possa rifare, e non credo nemmeno che serva. Però quella cosa lì, uscire di casa sapendo che ti divertirai comunque vada, quella sì che me la riprenderei.`,
    likes: 95,
    sample: true,
    replies: [
      r('Giuseppe L.', 'Ben detto. Non rifacciamola, raccontiamola e basta.', '2026-08-21'),
      r('Nicola', 'Il punto non era vincere. Era che uscivi di casa sapendo che ti saresti divertito.', '2026-08-22'),
    ],
  },
  {
    id: 's7',
    author: 'Nicola R.',
    topic: 'Mercato',
    date: '2026-09-01',
    title: 'Chiuso con tre arrivi: bilancio onesto',
    body: `Del Sole, Ravasio e Zuccon. Onestamente meglio di come temevo a luglio, quando sembrava che non arrivasse nessuno.

Due davanti erano l'urgenza vera e sono arrivati. Adesso resta da vedere se si incastrano con chi c'era già, e quella è una cosa che si capisce a novembre, non adesso.

Il giudizio vero si dà a gennaio.`,
    likes: 18,
    sample: true,
    replies: [
      r('Rita', 'Sono d\'accordo. A settembre le pagelle di mercato non le ho mai capite.', '2026-09-02'),
    ],
  },
  {
    id: 's8',
    author: 'Francesca D.',
    topic: 'Zaccheria',
    date: '2026-09-04',
    title: '5.329 abbonati: per la Serie C è tanta roba',
    body: `Vuol dire mezza gradinata già impegnata prima ancora di cominciare, e in questa categoria è un numero che poche piazze fanno.

Il punto adesso è un altro: riempirla anche a novembre, quando piove e siamo a metà classifica. Quello è il momento in cui si vede chi c'è davvero.`,
    likes: 41,
    sample: true,
    replies: [
      r('Antonio', 'Novembre è sempre il mese della verità, ogni anno.', '2026-09-04'),
      r('Michele P.', 'Con questi numeri qualche partita in più la reggiamo anche sotto la pioggia.', '2026-09-05'),
    ],
  },
  {
    id: 's9',
    author: 'Rita C.',
    topic: 'Giovanili',
    date: '2026-09-03',
    title: 'Qualcuno segue la Primavera?',
    body: `Mi hanno parlato di un centrocampista del 2008 che sta facendo bene. Qualcuno li vede giocare?

Se cresce uno di qui vale il doppio, sempre, e mi sembra che nessuno ne parli mai.`,
    likes: 12,
    sample: true,
    replies: [
      r('Michele P.', 'Vero. Se cresce uno di qui vale il doppio.', '2026-09-03'),
    ],
  },
  {
    id: 's10',
    author: 'Pasquale M.',
    topic: 'Fuori tema',
    date: '2026-09-05',
    title: 'Domenica c\'è la navetta dal centro?',
    body: `L'anno scorso c'era, quest'anno non ho visto nessuna comunicazione. Qualcuno sa qualcosa?`,
    likes: 6,
    sample: true,
    replies: [
      r('Antonio', "Non ho visto niente nemmeno io. Se scopro qualcosa lo scrivo qui.", '2026-09-05'),
    ],
  },
];

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
  const merged = [...mine.discussions, ...SAMPLES].map((d) => ({
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
  id: string; testo: string; creata_il: string; autore: string; profiles: RigaProfilo;
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
      })),
  };
}

let caricamentoAvviato = false;

/** Scarica le discussioni e sostituisce la cache. Silenzioso: se fallisce restano gli esempi. */
export async function ricarica() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('discussioni')
    .select('id, titolo, testo, argomento, creata_il, attiva_il, autore, profiles(nome), risposte(id, testo, creata_il, autore, profiles(nome))')
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
 * Ferma qui quello che il database fermerebbe comunque.
 *
 * Il cancello vero e il trigger in Postgres: un controllo nell'app si aggira
 * chiamando l'API con la chiave anonima. Questo serve a un'altra cosa, a dire
 * subito perche, invece di far premere invia e rispondere con un errore.
 *
 * Vale anche per la modalita senza account, dove il database non c'e proprio.
 */
function fermaSeOffensivo(...pezzi: Array<string | undefined>) {
  const esito = controlla(pezzi.filter(Boolean).join(' '));
  if (!esito.pulito) throw new Error(spiegazione(esito) ?? 'Messaggio non pubblicabile.');
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
  fermaSeOffensivo(input.title, input.body);
  const u = utenteCorrente();
  if (supabase && u) {
    const { data, error } = await supabase.from('discussioni').insert({
      autore: u.id,
      titolo: input.title.trim(),
      testo: input.body.trim(),
      argomento: input.topic,
    }).select('id').single();
    if (error) throw new Error(tradotto(error.message));
    await ricarica();
    return { id: (data as { id: string }).id } as Discussion;
  }
  return aggiungiInLocale(input);
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
  const text = body.trim();
  if (!text) return;
  fermaSeOffensivo(text);
  const u = utenteCorrente();
  if (supabase && u) {
    const { error } = await supabase.from('risposte').insert({
      discussione: on, autore: u.id, testo: text,
    });
    if (error) throw new Error(tradotto(error.message));
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
