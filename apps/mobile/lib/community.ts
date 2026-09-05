import { useSyncExternalStore } from 'react';

/**
 * Blog dei tifosi, versione dimostrativa.
 *
 * Non c'e nessun server e nessun account: i post di esempio sono scritti dentro
 * questo file, e quelli che scrive chi prova l'app restano nel suo browser e non
 * partono da li. E una scelta, non una scorciatoia: finche non si raccolgono
 * dati di persone non si e titolari di un trattamento, quindi durante la
 * raccolta fondi il progetto non ha obblighi GDPR ne obblighi da prestatore di
 * hosting. Quando arriva il backend, cambia solo questo file.
 */

export type FanComment = {
  id: string;
  author: string;
  body: string;
  date: string;
};

export type FanPost = {
  id: string;
  author: string;
  title: string;
  excerpt: string;
  body: string;
  date: string;
  topic: Topic;
  likes: number;
  comments: FanComment[];
  /** true = esempio scritto per la dimostrazione, non un post di un utente vero */
  sample: boolean;
};

export const TOPICS = ['Partita', 'Curva', 'Mercato', 'Trasferte', 'Memoria'] as const;
export type Topic = (typeof TOPICS)[number];

/* ------------------------------------------------------------------ esempi */

const SAMPLES: FanPost[] = [
  {
    id: 's1',
    author: 'Michele P.',
    title: 'Una rete subita in centottanta minuti',
    excerpt: 'Il dato di inizio stagione che nessuno sta guardando non è quanti gol facciamo.',
    body: `Quattro punti in due giornate si commentano da soli e non dicono granché. Il numero che mi ha fatto rileggere due volte il tabellino e un altro: una rete subita in centottanta minuti.

Chi va allo stadio da un po' sa cosa vuol dire. Non è che siamo diventati una corazzata, è che finalmente la squadra torna dietro tutta insieme. Il centrocampo scala, i due centrali non restano mai da soli, e quando ripartono gli avversari trovano gente davanti.

Poi certo, davanti si fa fatica. Ma preferisco una squadra che impara a non prenderle e poi trova il gol, che il contrario. Il contrario l'abbiamo già visto e sappiamo come finisce.`,
    date: '2026-09-01',
    topic: 'Partita',
    likes: 34,
    comments: [
      { id: 'c1', author: 'Antonio', body: 'Concordo. Aggiungo che anche i terzini stanno più bassi rispetto all\'anno scorso.', date: '2026-09-01' },
      { id: 'c2', author: 'Rita', body: 'Speriamo regga anche quando alzeremo il baricentro.', date: '2026-09-02' },
    ],
    sample: true,
  },
  {
    id: 's2',
    author: 'Giuseppe L.',
    title: 'Il rumore della Est quando entra la squadra',
    excerpt: 'Ci sono cose che non finiscono nelle statistiche e valgono il biglietto lo stesso.',
    body: `Ho portato mio figlio la prima volta a maggio. Aveva sette anni e per tutta la settimana mi aveva chiesto se era vero che si sente da fuori.

Siamo entrati venti minuti prima. Lui guardava il campo vuoto e non capiva perché fossimo arrivati così presto. Poi la gradinata ha cominciato a riempirsi, e quando e uscita la squadra per il riscaldamento si e girato verso di me con gli occhi larghi e non ha detto niente.

Ecco, quello. Nessun dato sulla percentuale di riempimento riesce a spiegarlo, e va bene così.`,
    date: '2026-08-28',
    topic: 'Curva',
    likes: 61,
    comments: [
      { id: 'c3', author: 'Salvo', body: 'La prima volta di mio nipote è stata identica. Non ha parlato per dieci minuti.', date: '2026-08-29' },
    ],
    sample: true,
  },
  {
    id: 's3',
    author: 'Francesca D.',
    title: 'Perché il Cerignola non è una partita come le altre',
    excerpt: 'Non è questione di classifica. Sono quaranta chilometri e ci si conosce tutti.',
    body: `Ogni volta che spiego questa partita a qualcuno che non è di qua devo partire dalla geografia. Quaranta chilometri. Molti di noi hanno parenti là, o ci lavorano, o ci hanno studiato.

Non è una rivalità costruita a tavolino né una di quelle inventate dai social negli ultimi anni. È semplicemente che il lunedì mattina qualcuno in ufficio ha da dire qualcosa, e per una settimana la partita continua fuori dal campo.

Per questo il risultato pesa il doppio anche a settembre, quando la classifica non vuol dire ancora niente.`,
    date: '2026-09-02',
    topic: 'Partita',
    likes: 48,
    comments: [
      { id: 'c4', author: 'Michele P.', body: 'Confermo, mia moglie è di Cerignola. In casa è una settimana complicata.', date: '2026-09-03' },
      { id: 'c5', author: 'Nicola', body: 'E poi vinciamo e non se ne parla più.', date: '2026-09-03' },
    ],
    sample: true,
  },
  {
    id: 's4',
    author: 'Nicola R.',
    title: 'Monopoli in trasferta: come ci organizziamo',
    excerpt: 'Due ore di macchina, e conviene mettersi d\'accordo prima invece che il sabato sera.',
    body: `Apro il discorso adesso così c'è tempo. Per Monopoli si va in macchina, sono poco più di due ore, e da soli non ha senso.

Io parto dal centro e ho tre posti. Se qualcuno viene dalla zona di via Napoli conviene trovarsi lì e fare due macchine invece di quattro.

Sul settore ospiti aspettiamo la comunicazione ufficiale prima di dire cavolate: appena esce la mettiamo qui.`,
    date: '2026-08-30',
    topic: 'Trasferte',
    likes: 22,
    comments: [
      { id: 'c6', author: 'Pasquale', body: 'Io ho due posti e parto dalla zona università.', date: '2026-08-30' },
    ],
    sample: true,
  },
  {
    id: 's5',
    author: 'Antonio V.',
    title: 'Quello che chiedo a questa squadra',
    excerpt: 'Non promesse. Solo che si veda che ci tengono quanto ci teniamo noi.',
    body: `Ho smesso da un pezzo di fare previsioni a settembre. Le ho sbagliate tutte, e quelle azzeccate erano fortuna.

Quindi non chiedo la promozione né dieci vittorie di fila. Chiedo una cosa sola, che poi è quella che si vede dalla gradinata anche quando si perde: che alla fine dei novanta minuti si capisca che hanno dato tutto.

Quando succede, il risultato lo accetti. Quando non succede, non c'è classifica che tenga.`,
    date: '2026-08-25',
    topic: 'Curva',
    likes: 73,
    comments: [],
    sample: true,
  },
  {
    id: 's6',
    author: 'Rita C.',
    title: 'Per chi non c\'era negli anni di Zeman',
    excerpt: 'Me lo chiedono spesso i più giovani. Provo a spiegarlo senza fare il vecchio nostalgico.',
    body: `Mi capita spesso che qualcuno più giovane mi chieda com'era davvero. È una domanda difficile, perché il rischio e raccontarla come una favola.

La verità è che era una squadra che giocava in un modo che a quei tempi non faceva nessuno, e che perdeva anche parecchio proprio per quello. Ma allo stadio ci andavi sapendo che qualcosa sarebbe successo, in un senso o nell'altro.

Non credo che si possa rifare, e non credo nemmeno che serva. Però quella cosa lì, uscire di casa sapendo che ti divertirai comunque vada, quella si che me la riprenderei.`,
    date: '2026-08-20',
    topic: 'Memoria',
    likes: 95,
    comments: [
      { id: 'c7', author: 'Giuseppe L.', body: 'Ben detto. Non rifacciamola, raccontiamola e basta.', date: '2026-08-21' },
    ],
    sample: true,
  },
];

/* ---------------------------------------------------- post di chi prova l'app */

const KEY = 'daunia.curva.v1';

/**
 * Su web si usa la memoria del browser. Su telefono non c'e localStorage e non
 * si aggiunge una dipendenza per una demo: i post restano finche l'app e aperta.
 */
function readStored(): FanPost[] {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? (JSON.parse(raw) as FanPost[]) : [];
  } catch {
    return [];
  }
}

let mine: FanPost[] = readStored();
const listeners = new Set<() => void>();
let snapshot: FanPost[] = [...mine, ...SAMPLES];

function commit() {
  snapshot = [...mine, ...SAMPLES];
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(mine));
  } catch {
    /* memoria non disponibile: il post vive solo in questa sessione */
  }
  listeners.forEach((l) => l());
}

export function usePosts(): FanPost[] {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot,
    () => snapshot,
  );
}

export function postById(id: string): FanPost | null {
  return snapshot.find((p) => p.id === id) ?? null;
}

export function addPost(input: { author: string; title: string; body: string; topic: Topic }) {
  const body = input.body.trim();
  const post: FanPost = {
    id: `mine-${Date.now()}`,
    author: input.author.trim() || 'Tu',
    title: input.title.trim(),
    excerpt: body.length > 120 ? `${body.slice(0, 117)}...` : body,
    body,
    date: new Date().toISOString().slice(0, 10),
    topic: input.topic,
    likes: 0,
    comments: [],
    sample: false,
  };
  mine = [post, ...mine];
  commit();
  return post;
}

export function removePost(id: string) {
  mine = mine.filter((p) => p.id !== id);
  commit();
}

export function toggleLike(id: string) {
  const target = snapshot.find((p) => p.id === id);
  if (!target) return;
  target.likes += 1;
  commit();
}

export const sampleCount = SAMPLES.length;
