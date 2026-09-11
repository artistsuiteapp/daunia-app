/**
 * In che momento della partita siamo, e cosa ha senso mostrare.
 *
 * Sta in un file suo, senza React e senza rete, perche e la parte che decide
 * tutto il resto: se la fase e sbagliata il Match Center mostra il pronostico a
 * partita finita e le pagelle prima del fischio d'inizio.
 */

export type Fase = 'prima' | 'live' | 'intervallo' | 'post';

/** Quanto dopo il calcio d'inizio una partita senza dati dal vivo e da considerare finita. */
export const FINITA_DOPO = 3 * 60 * 60 * 1000;

/** Gli stati in cui la partita e ferma a meta. */
const INTERVALLO = ['HT', 'BT'];

/**
 * La fase.
 *
 * L'ordine dei controlli e la regola vera: prima si guarda se e finita, poi se
 * e ferma, poi se sta giocando. Al contrario, una partita finita con lo stato
 * ancora a "2H" verrebbe data per in corso, e la finestra dei voti non si
 * aprirebbe mai.
 *
 * Il tetto delle tre ore serve alle partite di cui non arriva piu niente: senza,
 * una gara di cui la fonte ha smesso di parlare resta "sta per cominciare" per
 * sempre.
 */
export function faseDi(
  partita: { kickoff: string | null; status?: string } | null | undefined,
  live: { stato: string; finita: boolean } | null | undefined,
  adesso = Date.now(),
): Fase {
  if (!partita) return 'prima';

  if (live?.finita || partita.status === 'finished') return 'post';
  if (live && INTERVALLO.includes(live.stato)) return 'intervallo';
  if (live) return 'live';

  const t = partita.kickoff ? Date.parse(partita.kickoff) : NaN;
  if (Number.isFinite(t) && adesso > t + FINITA_DOPO) return 'post';
  if (Number.isFinite(t) && adesso >= t) return 'live';

  return 'prima';
}

/** Il pronostico si chiude al fischio d'inizio: dopo non e piu un pronostico. */
export function pronosticoAperto(
  partita: { kickoff: string | null } | null | undefined,
  adesso = Date.now(),
): boolean {
  const t = partita?.kickoff ? Date.parse(partita.kickoff) : NaN;
  return Number.isFinite(t) && adesso < t;
}

/** Quanto manca, in millisecondi. Negativo se e gia passato. */
export function mancaAl(kickoff: string | null | undefined, adesso = Date.now()): number | null {
  const t = kickoff ? Date.parse(kickoff) : NaN;
  return Number.isFinite(t) ? t - adesso : null;
}

/**
 * I livelli, gli stessi che stanno nella tabella `livelli`.
 *
 * Sono ripetuti qui perche servono anche a chi non ha fatto l'accesso e a chi
 * e senza rete, e perche una chiamata in piu per quattro righe che non cambiano
 * mai non ha senso. Un test confronta questa lista con quella nella migrazione:
 * se le due si allontanano se ne accorge il test, non un tifoso che si vede
 * cambiare livello aprendo una schermata diversa.
 */
export const LIVELLI = [
  { soglia: 0, nome: 'Curva Sud', colore: '#9aa0a6' },
  { soglia: 250, nome: 'Rossonero', colore: '#ee1111' },
  { soglia: 1000, nome: 'Ultras', colore: '#ffb300' },
  { soglia: 3000, nome: 'Leggenda', colore: '#8e7cff' },
] as const;

export type Livello = (typeof LIVELLI)[number];

export function livelloDi(punti: number): Livello {
  let fuori: Livello = LIVELLI[0];
  for (const l of LIVELLI) if (punti >= l.soglia) fuori = l;
  return fuori;
}

/** Quanto manca al livello dopo. Null quando si e gia in cima. */
export function alProssimoLivello(punti: number): { livello: Livello; mancano: number } | null {
  const dopo = LIVELLI.find((l) => l.soglia > punti);
  return dopo ? { livello: dopo, mancano: dopo.soglia - punti } : null;
}
