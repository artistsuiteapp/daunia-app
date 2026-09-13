/**
 * Quanto sono vecchi i dati che l'app sta mostrando.
 *
 * PERCHE SERVE
 *
 * Ogni guasto di questi giorni e' stato silenzioso. La cache degli id della
 * Lega era ferma dal 7 settembre, l'ingest ha fallito venticinque volte in una
 * notte, il sito e' rimasto indietro di tre giorni: in tutti e tre i casi l'app
 * mostrava numeri con la stessa faccia sicura di sempre, e ce ne siamo accorti
 * perche' qualcuno ha notato un dettaglio storto.
 *
 * Un'app che dice da quando sono fermi i suoi dati trasforma quella categoria
 * di guasti da "invisibile per giorni" a "visibile alla prima apertura". Non
 * ripara niente da sola, ma smette di far sembrare tutto a posto.
 *
 * LE SOGLIE
 *
 * L'ingest gira ogni venti minuti. Sotto l'ora e' normale e non si dice niente:
 * un avviso che compare sempre non lo legge piu' nessuno. Fra un'ora e sei si
 * segnala, sopra le sei si dice che qualcosa non va -- a quel punto sono almeno
 * diciotto giri saltati di fila e non e' piu' una coincidenza.
 */

export type Freschezza =
  /** tutto normale: non si mostra niente */
  | { stato: 'fresco'; minuti: number }
  /** fermo da un po': si dice, senza allarmare */
  | { stato: 'indietro'; minuti: number; testo: string }
  /** fermo da troppo: qualcosa e rotto */
  | { stato: 'fermo'; minuti: number; testo: string }
  /** non si sa nemmeno quando: peggio che vecchio */
  | { stato: 'ignoto'; minuti: null; testo: string };

const ORA = 60;
const SOGLIA_INDIETRO = ORA;
const SOGLIA_FERMO = 6 * ORA;

/** "23 minuti", "3 ore", "2 giorni" — come lo direbbe una persona. */
export function durata(minuti: number): string {
  if (minuti < 60) return `${minuti} ${minuti === 1 ? 'minuto' : 'minuti'}`;
  const ore = Math.floor(minuti / 60);
  if (ore < 24) return `${ore} ${ore === 1 ? 'ora' : 'ore'}`;
  const giorni = Math.floor(ore / 24);
  return `${giorni} ${giorni === 1 ? 'giorno' : 'giorni'}`;
}

export function freschezza(generatedAt: unknown, adesso = Date.now()): Freschezza {
  const t = typeof generatedAt === 'string' ? Date.parse(generatedAt) : NaN;
  if (!Number.isFinite(t)) {
    return { stato: 'ignoto', minuti: null, testo: 'Non si sa da quando sono fermi i dati.' };
  }

  /*
   * Una data nel futuro si tratta come adesso, non come un numero negativo.
   * Succede con l'orologio del telefono spostato, ed e piu utile non dire
   * niente che scrivere "aggiornati fra due ore".
   */
  const minuti = Math.max(0, Math.floor((adesso - t) / 60_000));

  if (minuti < SOGLIA_INDIETRO) return { stato: 'fresco', minuti };
  if (minuti < SOGLIA_FERMO) {
    return { stato: 'indietro', minuti, testo: `Dati di ${durata(minuti)} fa.` };
  }
  return {
    stato: 'fermo',
    minuti,
    testo: `Dati fermi da ${durata(minuti)}. Qualcosa non sta aggiornando.`,
  };
}
