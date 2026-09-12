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
  /** il minuto vero quando la fonte ce l'ha: "48", col recupero "45+5" */
  minuto: string | null;
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
    minuto: r.strProgress ? String(r.strProgress).trim() || null : null,
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

/** la chat apre dieci minuti prima del fischio */
export const CHAT_PRIMA = 10 * 60 * 1000;
/** e chiude venti minuti dopo il triplice */
export const CHAT_DOPO = 20 * 60 * 1000;
/** se la fine non si sa, si chiude a due ore e venti dal fischio d'inizio */
export const CHAT_TETTO = 140 * 60 * 1000;

/**
 * Quando la chat della partita e aperta.
 *
 * Apre dieci minuti prima del fischio e chiude venti minuti dopo il triplice.
 * Non venti minuti dopo un orario calcolato: fra recuperi e ritardi la
 * differenza e di dieci minuti buoni, e sono proprio quelli in cui la gente
 * commenta. La fine vera la scrive il guardiano in `finita_il`.
 *
 * Se quell'istante non c'e -- backend giu, o partita mai cominciata -- si
 * chiude comunque a due ore e venti dal fischio, altrimenti una stanza
 * resterebbe aperta per sempre.
 */
export function chatAperta(
  kickoff: string | null | undefined,
  finitaIl: string | number | null | undefined,
  adesso = Date.now(),
): boolean {
  const t = kickoff ? Date.parse(kickoff) : NaN;
  if (!Number.isFinite(t)) return false;
  if (adesso < t - CHAT_PRIMA) return false;

  const fine = typeof finitaIl === 'number' ? finitaIl : finitaIl ? Date.parse(finitaIl) : NaN;
  if (Number.isFinite(fine)) return adesso <= fine + CHAT_DOPO;
  return adesso <= t + CHAT_TETTO;
}

/**
 * Vero se la partita e oggi: serve alla home per dire che ci sara la chat.
 *
 * Si guarda il giorno locale, non le ore mancanti: "oggi si gioca" ha senso
 * dalla mattina, non da due ore prima.
 */
export function eOggi(kickoff: string | null | undefined, adesso = Date.now()): boolean {
  const t = kickoff ? Date.parse(kickoff) : NaN;
  if (!Number.isFinite(t)) return false;
  const a = new Date(t);
  const b = new Date(adesso);
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

/** oltre questo, un dato fermo non si fa piu avanzare: il guardiano e giu */
export const DERIVA_MASSIMA = 5;

/**
 * Il minuto adesso, partendo da quello che ha scritto il guardiano.
 *
 * Il guardiano aggiorna una volta al minuto, quindi il minuto letto dal
 * database e vecchio fino a sessanta secondi: sullo schermo si vedeva il tempo
 * indietro, e a scatti. Qui avanza da solo fra un aggiornamento e l'altro, che
 * e' quello che fa un cronometro.
 *
 * Il recupero avanza sulla sua parte: "45+5" diventa "45+6", non "46". E oltre
 * i regolamentari si passa al recupero invece di scrivere "94", che nessun
 * tabellone scrive.
 *
 * Non avanza all'infinito: se il dato e' fermo da piu di qualche minuto vuol
 * dire che la fonte o il guardiano si sono fermati, e continuare a far correre
 * il cronometro sarebbe inventare.
 */
export function minutoCorrente(
  base: string | null | undefined,
  scrittoIl: string | number | null | undefined,
  stato: string,
  adesso = Date.now(),
): string | null {
  if (!base) return null;
  const t = typeof scrittoIl === 'number' ? scrittoIl : scrittoIl ? Date.parse(scrittoIl) : NaN;
  if (!Number.isFinite(t)) return base;

  const passati = Math.floor((adesso - t) / 60_000);
  if (passati <= 0) return base;
  if (passati > DERIVA_MASSIMA) return base;

  const m = /^(\d+)(?:\+(\d+))?$/.exec(base.trim());
  if (!m) return base;

  const regolamentari = stato === '1H' ? 45 : stato === '2H' ? 90 : null;
  const primo = Number(m[1]);
  const recupero = m[2] === undefined ? null : Number(m[2]);

  // gia' nel recupero: cresce quello, la parte davanti resta ferma
  if (recupero !== null) return `${primo}+${recupero + passati}`;

  const avanti = primo + passati;
  if (regolamentari !== null && avanti > regolamentari) {
    return `${regolamentari}+${avanti - regolamentari}`;
  }
  return String(avanti);
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
  // il minuto vero, quando c'e, batte sempre la stima: porta anche il recupero.
  // Fatto avanzare fino ad adesso, altrimenti resta indietro di un minuto.
  const m = minutoCorrente(live.minuto, live.aggiornato, live.stato, adesso)
    ?? minutoStimato(kickoff, live.stato, adesso);
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

/**
 * La cronaca dal vivo appartiene a UNA partita sola: quella che il guardiano
 * sta seguendo.
 *
 * Gol, cartellini e cambi stanno in una variabile globale del modulo, perche'
 * ce n'e' sempre al massimo una in corso. La scheda di una partita futura pero'
 * non ha ancora eventi propri, e leggendo quella globale mostrava la cronaca
 * della partita di oggi: aprendo Foggia-Savoia si leggevano i cartellini di
 * Monopoli-Foggia.
 *
 * `vivo` e' gia' il verdetto giusto -- lo produce `orienta()`, che pretende la
 * stessa data e la stessa squadra di casa della partita seguita. Qui si usa per
 * spegnere tutto il resto: senza di lui non esiste nessuna cronaca dal vivo.
 *
 * Le liste vuote sono sempre le stesse per identita: React confronta i
 * risultati cosi', e restituirne di nuove a ogni giro farebbe ridisegnare la
 * schermata all infinito.
 */
const NIENTE_GOL: readonly never[] = [];
const NIENTE_CARTELLINI: readonly never[] = [];
const NIENTE_CAMBI: readonly never[] = [];

export function cronacaDi<G, C, S>(
  vivo: Live | null,
  gol: readonly G[],
  cartellini: readonly C[],
  cambi: readonly S[],
): { gol: readonly G[]; cartellini: readonly C[]; cambi: readonly S[] } {
  if (!vivo) {
    return { gol: NIENTE_GOL, cartellini: NIENTE_CARTELLINI, cambi: NIENTE_CAMBI };
  }
  return { gol, cartellini, cambi };
}
