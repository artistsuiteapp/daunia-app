/**
 * live-score-api per il guardiano.
 *
 * PERCHE
 *
 * I nomi dei marcatori li chiedeva ad API-Football. Quell'account e' stato
 * sospeso due volte, e il 12 settembre risultava sospeso di nuovo: cento
 * chiamate al giorno sono poche quando l'ingest ne fa gia' quaranta e il
 * guardiano trenta. live-score-api ne da' 1.500 al giorno anche in prova, e
 * l'ingest lo usa gia' per i tabellini delle partite finite -- quindi copre la
 * Serie C, verificato, non sperato.
 *
 * COSA NON CAMBIA
 *
 * Il punteggio resta di TheSportsDB. Qui si prendono i NOMI, e se questo
 * modulo tace non succede niente di grave: il gol viene annunciato lo stesso
 * leggendo il tabellone, senza il nome di chi ha segnato. Era gia' cosi'.
 *
 * LA FORMA DEGLI EVENTI
 *
 * Non si traducono a valle: si travestono da eventi API-Football, e tutto
 * quello che sta sotto -- `golVero`, `contaGol`, `cronologia`, l'espulsione --
 * resta identico e resta testato. Cambiare la fonte il giorno della partita
 * senza toccare la logica del punteggio e' l'unico modo prudente di farlo.
 */
import type { EventoAF } from './punteggio.ts';

const BASE = 'https://livescore-api.com/api-client';

/** Serie C italiana. In catalogo c'e' anche una Serie C brasiliana, la 253. */
export const SERIE_C_ITALIA = '181';
/** La Coppa Italia di Serie C: il Foggia ci gioca ad agosto, ed e' un'altra competizione. */
export const COPPA_ITALIA_C = '180';

/** Squadre finte, per far tornare i conti a valle. */
export const CASA = 1;
export const OSPITI = 2;

export type EventoLSA = {
  event?: string;
  time?: string | number;
  is_home?: boolean;
  player?: { name?: string | null } | null;
  info?: { name?: string | null } | null;
};

/**
 * Un evento di live-score-api travestito da evento API-Football.
 *
 * I nomi vengono dalla loro pagina "getting match events data" e sono copiati,
 * non indovinati: nell'ingest erano stati indovinati e un gol su rigore
 * spariva dal tabellino senza dare errore.
 *
 * GOAL, GOAL_PENALTY, OWN_GOAL, YELLOW_CARD, RED_CARD, YELLOW_RED_CARD,
 * SUBSTITUTION, MISSED_PENALTY.
 */
export function travesti(e: EventoLSA): EventoAF | null {
  const minuto = Number(e?.time);
  const time = { elapsed: Number.isFinite(minuto) ? minuto : null };
  const player = { name: e?.player?.name ?? null };
  const team = { id: e?.is_home ? CASA : OSPITI };

  switch (e?.event) {
    case 'GOAL':
      return { type: 'Goal', detail: 'Normal Goal', time, team, player };
    case 'GOAL_PENALTY':
      return { type: 'Goal', detail: 'Penalty', time, team, player };
    case 'OWN_GOAL':
      // Come in API-Football, l'autogol porta la squadra di CHI LO SEGNA, non
      // di chi ne guadagna: `contaGol` e `cronologia` lo girano gia' loro.
      return { type: 'Goal', detail: 'Own Goal', time, team, player };
    case 'MISSED_PENALTY':
      // `golVero` lo scarta guardando proprio questa etichetta. Va passato
      // lo stesso invece di buttarlo qui: e' la loro prova che il filtro
      // serve, e se un giorno cambia nome il test se ne accorge.
      return { type: 'Goal', detail: 'Missed Penalty', time, team, player };
    case 'YELLOW_CARD':
      return { type: 'Card', detail: 'Yellow Card', time, team, player };
    case 'RED_CARD':
      return { type: 'Card', detail: 'Red Card', time, team, player };
    case 'YELLOW_RED_CARD':
      // Secondo giallo: in campo il giocatore esce, quindi vale come rosso e
      // deve far partire la notifica dell'espulsione.
      return { type: 'Card', detail: 'Second Yellow card, Red Card', time, team, player };
    case 'SUBSTITUTION':
      return { type: 'subst', detail: 'Substitution', time, team, player };
    default:
      return null;
  }
}

export function travestiTutti(eventi: EventoLSA[] | null | undefined): EventoAF[] {
  return (eventi ?? []).map(travesti).filter((x): x is EventoAF => x !== null);
}

/** Il nome della squadra ridotto all'osso, per confrontarlo senza sorprese. */
function pulisci(s: unknown): string {
  return String(s ?? '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
}

export function eLaNostra(m: { home?: { name?: string }; away?: { name?: string } }, noi = 'foggia'): boolean {
  const n = pulisci(noi);
  return pulisci(m?.home?.name).includes(n) || pulisci(m?.away?.name).includes(n);
}

type Chiavi = { key: string; secret: string };

async function chiedi(percorso: string, params: Record<string, string>, c: Chiavi, scadenza = 8000) {
  const q = new URLSearchParams({ key: c.key, secret: c.secret, ...params });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), scadenza);
  try {
    const r = await fetch(`${BASE}/${percorso}.json?${q}`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return j?.success ? j.data : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/**
 * L'id della nostra partita nel loro catalogo.
 *
 * Non lo teniamo in `stato_partita` apposta: aggiungere una colonna vuol dire
 * una migrazione, e una migrazione il pomeriggio della partita e' un rischio
 * che non vale un id. Costa una chiamata su millecinquecento al giorno.
 *
 * Il campionato prima, la coppa solo se li' non c'e' niente.
 */
export async function trovaPartita(c: Chiavi): Promise<{ id: string; stato: string; punteggio: string | null } | null> {
  for (const competition_id of [SERIE_C_ITALIA, COPPA_ITALIA_C]) {
    const d = await chiedi('matches/live', { competition_id }, c);
    const nostra = (d?.match ?? []).find(eLaNostra);
    if (nostra) {
      return { id: String(nostra.id), stato: String(nostra.status ?? ''), punteggio: nostra.scores?.score ?? null };
    }
  }
  return null;
}

/** Gli eventi della partita, gia' travestiti. */
export async function eventiDi(id: string, c: Chiavi): Promise<EventoAF[]> {
  const d = await chiedi('matches/events', { id }, c);
  return travestiTutti(d?.event);
}
