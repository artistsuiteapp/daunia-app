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
