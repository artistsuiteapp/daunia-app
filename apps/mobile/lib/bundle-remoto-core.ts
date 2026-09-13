/**
 * Le regole per accettare o rifiutare un bundle scaricato.
 *
 * Stanno qui, senza rete e senza React, perche sono la parte che puo fare il
 * danno grosso: un bundle sbagliato applicato al posto di uno buono svuota
 * calendario, classifica e rosa in un colpo solo, e l'utente vede un'app rotta
 * senza capire perche. Sotto test, come gli altri *-core.
 */

/** Quel poco che deve esserci perche un bundle valga la pena di sostituire quello attuale. */
export type BundleMinimo = {
  meta?: { generatedAt?: unknown } | null;
  teams?: unknown;
  matches?: unknown;
  standings?: unknown;
  squad?: unknown;
};

/**
 * Vero se quello che e arrivato e davvero un bundle.
 *
 * Serve contro il caso normale, non contro quello raro: una rete di hotel o di
 * stadio che risponde con la sua pagina di accesso, GitHub che risponde 404 con
 * del testo, un file scaricato a meta. In tutti e tre `JSON.parse` puo anche
 * riuscire, e senza questo controllo l'app si svuoterebbe.
 *
 * Le partite devono essere piu di zero: un bundle con la lista vuota e sintatticamente
 * corretto ma non e mai un bundle buono -- il Foggia un calendario ce l'ha sempre.
 */
/** Quanto avanti puo stare un orologio prima che il bundle sia da buttare. */
const GRAZIA_FUTURO = 24 * 60 * 60 * 1000;

export function valido(x: unknown): x is BundleMinimo & { meta: { generatedAt: string } } {
  if (!x || typeof x !== 'object') return false;
  const b = x as BundleMinimo;
  const quando = b.meta?.generatedAt;
  if (typeof quando !== 'string' || Number.isNaN(Date.parse(quando))) return false;
  if (!Array.isArray(b.matches) || b.matches.length === 0) return false;
  if (!Array.isArray(b.teams) || b.teams.length === 0) return false;
  if (!Array.isArray(b.standings)) return false;
  if (!Array.isArray(b.squad)) return false;
  /*
   * Anche i campi che applicaBundle legge senza chiedere permesso. Uno che
   * manca faceva passare la validazione e poi lanciava a sostituzione iniziata.
   */
  if (!Array.isArray((b as { news?: unknown }).news)) return false;
  if (!(b as { stadium?: unknown }).stadium) return false;
  if (!(b as { stats?: unknown }).stats) return false;

  /*
   * Una data nel futuro e' un bundle che non si potra' piu' sostituire.
   *
   * Si accetta solo cio' che e' piu' fresco, quindi un `generatedAt` sbagliato in
   * avanti -- un orologio impazzito sul server dell'ingest -- verrebbe salvato nel
   * telefono, riapplicato a ogni avvio, e da li in poi nessun bundle vero
   * sarebbe mai piu' abbastanza nuovo. L'app resterebbe congelata per sempre,
   * senza dare segno di niente.
   */
  if (Date.parse(quando) > Date.now() + GRAZIA_FUTURO) return false;
  return true;
}

/**
 * Quando l'ingest ha prodotto questi dati, in millisecondi. `0` se non si sa.
 *
 * Non pretende un bundle intero: accetta qualsiasi cosa abbia un `meta`, perche
 * serve anche a datare i dati gia in uso, che sono tenuti a pezzi e non come un
 * oggetto solo.
 */
export function istante(x: unknown): number {
  const quando = (x as BundleMinimo | null)?.meta?.generatedAt;
  if (typeof quando !== "string") return 0;
  const t = Date.parse(quando);
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Vero se `arrivato` va messo al posto dei dati prodotti a `attuale`.
 *
 * A parita di istante non si sostituisce: ridisegnare tutte le schermate per
 * dati identici e lavoro sprecato, e sul telefono si vede come uno sfarfallio.
 *
 * Piu vecchio viene rifiutato, e non e teoria: la copia salvata nel telefono
 * puo essere piu fresca di quella cotta nell'app, e senza questo confronto
 * l'app cotta la sovrascriverebbe a ogni riapertura, tornando indietro ogni volta.
 */
export function daSostituire(attuale: number, arrivato: unknown): boolean {
  if (!valido(arrivato)) return false;
  return istante(arrivato) > attuale;
}
