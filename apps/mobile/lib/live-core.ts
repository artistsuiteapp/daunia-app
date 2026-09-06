/**
 * Regole del punteggio dal vivo, senza React e senza rete.
 *
 * Stanno qui per essere provate: `live.ts` ci mette intorno il timer, il
 * fetch e l'aggancio alle schermate, ma la parte che puo sbagliare i conti e
 * questa, ed e coperta dai test.
 */

export type Live = {
  stato: string;
  fase: string;
  casa: number | null;
  ospite: number | null;
  finita: boolean;
  aggiornato: number;
};

export const PRIMA = 10 * 60 * 1000;
export const DOPO = 3 * 60 * 60 * 1000;

/** Come TheSportsDB chiama le fasi di gioco, dette in italiano. */
const FASI: Record<string, string> = {
  NS: 'sta per iniziare',
  '1H': 'primo tempo',
  HT: 'intervallo',
  '2H': 'secondo tempo',
  ET: 'supplementari',
  BT: 'intervallo supplementari',
  P: 'rigori',
  PEN: 'rigori',
  AET: 'finita ai supplementari',
  FT: 'finita',
  PST: 'rinviata',
  SUSP: 'sospesa',
  CANC: 'annullata',
  ABD: 'sospesa',
};
const FINITE = ['FT', 'AET', 'PEN', 'CANC', 'ABD'];

function numero(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Vero se adesso ha senso interrogare la fonte per questa partita. */
export function finestraAperta(kickoff: string | null | undefined, adesso = Date.now()): boolean {
  const t = kickoff ? Date.parse(kickoff) : NaN;
  if (!Number.isFinite(t)) return false;
  return adesso >= t - PRIMA && adesso <= t + DOPO;
}

/** Trasforma la risposta di lookupevent.php in quello che serve alla scheda. */
export function leggiEvento(e: unknown, adesso = Date.now()): Live | null {
  if (!e || typeof e !== 'object') return null;
  const r = e as Record<string, unknown>;
  const s = String(r.strStatus ?? '').trim() || 'NS';
  return {
    stato: s,
    fase: FASI[s] ?? s.toLowerCase(),
    casa: numero(r.intHomeScore),
    ospite: numero(r.intAwayScore),
    finita: FINITE.includes(s),
    aggiornato: adesso,
  };
}

/** Quanto dura l'intervallo, per stimare il minuto nella ripresa. */
export const PAUSA = 15 * 60 * 1000;

/**
 * Il minuto di gioco, stimato dal calcio d'inizio.
 *
 * TheSportsDB per la Serie C non manda `strProgress`: il campo torna vuoto,
 * quindi il minuto vero non esiste da nessuna parte. Si calcola dall'orario,
 * ed e una stima: il recupero del primo tempo e l'intervallo vero non si
 * sanno. Sbaglia di qualche minuto, ma dice la cosa che serve davvero, cioe
 * a che punto siamo. Meglio "23'" quasi giusto che una schermata muta.
 *
 * Torna null quando il minuto non ha senso: prima del fischio, all'intervallo,
 * a partita finita.
 */
export function minutoStimato(
  kickoff: string | null | undefined,
  stato: string,
  adesso = Date.now(),
): number | null {
  const t = kickoff ? Date.parse(kickoff) : NaN;
  if (!Number.isFinite(t)) return null;
  const passati = adesso - t;
  if (passati < 0) return null;

  const minuti = Math.floor(passati / 60_000) + 1;
  if (stato === '1H') return Math.min(Math.max(minuti, 1), 45);
  if (stato === '2H') {
    const dopoPausa = Math.floor((passati - PAUSA) / 60_000) + 1;
    return Math.min(Math.max(dopoPausa, 46), 90);
  }
  return null;
}

/**
 * Come si scrive lo stato della partita sotto il punteggio.
 *
 * "2° tempo · 67'" quando si gioca, il nome della fase quando il minuto non
 * si puo dire. Il minuto non porta l'apostrofo del tempo reale perche non lo
 * e: e una stima, e fingere i secondi sarebbe una bugia piccola e inutile.
 */
export function etichettaFase(
  live: Live | null,
  kickoff: string | null | undefined,
  adesso = Date.now(),
): string {
  if (!live) return '';
  const m = minutoStimato(kickoff, live.stato, adesso);
  const nome = live.stato === '1H' ? '1° tempo' : live.stato === '2H' ? '2° tempo' : live.fase;
  return m === null ? nome : `${nome} · ${m}'`;
}

const pulisci = (s: string | null | undefined) =>
  String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

/**
 * Orienta il punteggio come la scheda della partita: `casa` deve sempre essere
 * la squadra di casa di quella partita, anche se la fonte le elenca al
 * contrario.
 *
 * Torna null quando il dato non riguarda quella partita, quando non e ancora
 * iniziata o quando il risultato definitivo e gia nei dati.
 */
export function orienta(
  partita: { kickoff: string | null; status: string; casa: string | null } | null,
  fonte: { kickoff: string | null; casa: string | null } | null,
  live: Live | null,
): Live | null {
  if (!partita || !fonte || !live) return null;
  if (partita.status === 'finished') return null;
  if (!partita.kickoff || !fonte.kickoff) return null;
  if (partita.kickoff.slice(0, 10) !== fonte.kickoff.slice(0, 10)) return null;
  if (live.stato === 'NS') return null;

  const a = pulisci(fonte.casa);
  const b = pulisci(partita.casa);
  const invertita = Boolean(a) && Boolean(b) && !a.includes(b) && !b.includes(a);
  return invertita ? { ...live, casa: live.ospite, ospite: live.casa } : live;
}
