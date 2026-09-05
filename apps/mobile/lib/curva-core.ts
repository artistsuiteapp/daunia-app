/**
 * La Formazione della Curva: i conti.
 *
 * Perche esiste. Le formazioni ufficiali non escono giorni prima: escono verso
 * un'ora dal fischio d'inizio, e prima non esistono da nessuna parte. Per sei
 * giorni su sette la domanda "chi deve giocare" non ha una risposta pubblica.
 * Questa e la risposta: la danno i tifosi, e il lunedi successivo si vede chi
 * aveva ragione.
 *
 * Qui non c'e React ne rete: solo le regole, cosi si possono provare.
 */

export const ROSA_XI = 11;
/** chi indovina l'undici intero prende questo in piu */
export const BONUS_PIENO = 5;

export type Conteggio = { id: string; voti: number };

/** Quante volte ogni giocatore e stato schierato. Ordine stabile: piu voti, poi id. */
export function conta(formazioni: string[][]): Conteggio[] {
  const m = new Map<string, number>();
  for (const f of formazioni) {
    // uno stesso nome due volte nella stessa formazione vale uno
    for (const id of new Set(f)) m.set(id, (m.get(id) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([id, voti]) => ({ id, voti }))
    .sort((a, b) => (b.voti - a.voti) || a.id.localeCompare(b.id));
}

/** L'undici della curva: i piu votati, fino a undici. */
export function undici(formazioni: string[][]): Conteggio[] {
  return conta(formazioni).slice(0, ROSA_XI);
}

/** Quanti tifosi hanno schierato un certo giocatore, in percentuale. */
export function consenso(conteggi: Conteggio[], totale: number): Map<string, number> {
  const m = new Map<string, number>();
  if (totale <= 0) return m;
  for (const c of conteggi) m.set(c.id, Math.round((c.voti / totale) * 100));
  return m;
}

export type Esito = { azzeccati: string[]; sbagliati: string[]; punti: number; pieno: boolean };

/**
 * Confronto fra la formazione di un tifoso e quella vera.
 *
 * Un punto per ogni nome giusto, piu un bonus se sono giusti tutti e undici.
 * Non conta l'ordine: schierare Saro in porta o a destra e lo stesso, perche il
 * modulo non lo pubblica nessuno e non si puo chiedere di indovinarlo.
 */
export function confronta(mia: string[], ufficiale: string[]): Esito {
  const veri = new Set(ufficiale);
  const miei = [...new Set(mia)];
  const azzeccati = miei.filter((id) => veri.has(id));
  const sbagliati = miei.filter((id) => !veri.has(id));
  const pieno = azzeccati.length === ROSA_XI && ufficiale.length === ROSA_XI;
  return {
    azzeccati,
    sbagliati,
    punti: azzeccati.length + (pieno ? BONUS_PIENO : 0),
    pieno,
  };
}

/**
 * La striscia: quante giornate di fila hai schierato la squadra, contando
 * all'indietro dall'ultima giocata.
 *
 * Si rompe alla prima giornata saltata. Serve una regola sola e chiara, perche
 * e la cosa che riporta la gente nell'app il mercoledi.
 */
export function striscia(giornate: string[], mie: Iterable<string>): number {
  const fatte = new Set(mie);
  let n = 0;
  for (let i = giornate.length - 1; i >= 0; i--) {
    if (!fatte.has(giornate[i])) break;
    n += 1;
  }
  return n;
}

/**
 * Vero se saltando la prossima giornata la striscia si perde.
 *
 * E l'unico avviso che l'app si permette di dare: "hai tre giornate di fila,
 * non buttarle".
 */
export function stricciaARischio(striscia: number): boolean {
  return striscia >= 2;
}
