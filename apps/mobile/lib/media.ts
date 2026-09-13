/**
 * Cosa si carica dai server di terzi, distinto per tipo.
 *
 * La differenza non e di gusto ma di rischio, e i due casi non sono uguali:
 *
 * - Gli STEMMI servono a dire quale squadra gioca. Mostrare il marchio altrui
 *   per identificare quel soggetto e uso descrittivo, ammesso dall'art. 21 del
 *   Codice della Proprieta Industriale quando e necessario a indicare la
 *   destinazione del servizio. Restano collegati, non copiati: la Corte UE ha
 *   distinto il collegamento a contenuto gia liberamente accessibile (BestWater,
 *   C-348/13) dalla ripubblicazione di una copia (Renckhoff, C-161/17). Copiarli
 *   sul nostro server sarebbe la seconda, ed e la cosa piu rischiosa delle due.
 *
 * - Le FOTO di giocatori e articoli sono opere fotografiche di chi le ha
 *   scattate, e non c'e nessun uso descrittivo che le giustifichi: una foto non
 *   serve a identificare la squadra, serve a illustrare. Restano spente finche
 *   non ci sono immagini nostre o di una fototeca autorizzata.
 */
export const REMOTE = {
  crests: true,
  photos: false,
} as const;

/** Stemma di una squadra: passa. */
export function crest(uri: string | null | undefined): string | null {
  return REMOTE.crests ? uri ?? null : null;
}

/** Foto di persone o di articoli: passa solo se esplicitamente consentito. */
export function photo(uri: string | null | undefined): string | null {
  return REMOTE.photos ? uri ?? null : null;
}

/*
 * LE IMMAGINI NOSTRE NON SONO FOTO DI TERZI
 *
 * Il difetto che questa parte ripara: l'immagine che una persona carica nel
 * proprio profilo finisce sul NOSTRO archivio, ma passava dallo stesso
 * `photo()` delle foto dei giocatori. Con `photos: false` veniva scartata come
 * se fosse di qualcun altro, e in home, in classifica e in chat restava
 * l'iniziale del nome. Nel profilo si vedeva, perche li l'immagine non passa
 * di qui: una stessa persona vedeva la propria foto in un posto e non
 * nell'altro, e sembrava che il caricamento non avesse funzionato.
 *
 * Il permesso di chi ha caricato la propria faccia ce l'abbiamo: e sua e l'ha
 * messa lei. Il motivo per cui `photos` resta spento -- le opere fotografiche
 * di chi le ha scattate -- qui non c'entra.
 */
/*
 * Conta chi serve l'immagine, non come finisce l'indirizzo.
 *
 * La prima versione guardava solo se l'indirizzo conteneva il percorso
 * dell'archivio, e `https://server-qualsiasi/storage/v1/object/public/avatar/x`
 * passava: chiunque poteva mettere in classifica e in chat un'immagine servita
 * da un server suo, compreso un pixel che annota chi la guarda. Il database ora
 * rifiuta quegli indirizzi, ma quelli gia salvati li rifiuta anche l'app.
 *
 * Con un'espressione e non con `new URL()`: su React Native `URL` e parziale e
 * alcune proprieta lanciano un'eccezione invece di rispondere.
 */
const ARCHIVIO_NOSTRO = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/storage\/v1\/object\/public\/avatar\/[A-Za-z0-9._\-/]+$/;

/** Il progetto Supabase dell'app, se si sa: `abcd` da `https://abcd.supabase.co`. */
function progettoNostro(): string | null {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  return /^https:\/\/([a-z0-9-]+)\.supabase\.co/.exec(base.trim())?.[1] ?? null;
}

/** Vero se l'immagine sta sul nostro archivio, non su un server altrui. */
export function nostra(uri: string | null | undefined, progetto: string | null = progettoNostro()): boolean {
  if (typeof uri !== 'string') return false;
  const trovato = ARCHIVIO_NOSTRO.exec(uri.trim());
  if (!trovato) return false;
  return progetto === null || trovato[1] === progetto;
}

/**
 * Il ritratto di una persona: l'avatar caricato da lei passa sempre, la foto
 * presa da un sito altrui segue la regola di `photo()`.
 */
export function ritratto(uri: string | null | undefined): string | null {
  if (!uri) return null;
  return nostra(uri) ? uri : photo(uri);
}
