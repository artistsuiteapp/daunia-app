import type { Player } from '@satanelli/core';
import { squad, lineups, type LineupPlayer, type MatchLineup } from './data';
import { DEPARTED, spotOf, type Spot } from './squad-overrides';

/**
 * Formazione: quella vera se la partita e stata giocata, altrimenti la probabile.
 *
 * La vera arriva da API-Football, piano gratuito, ed e l'undici sceso in campo
 * con numeri di maglia e panchina. Quella che manca e la disposizione: il campo
 * `formation` per la Serie C torna vuoto, quindi le caselle del 3-5-2 vengono
 * riempite col ruolo di ciascuno (vedi squad-overrides.ts).
 *
 * La probabile resta per la prossima partita, quando l'undici non esiste
 * ancora. E' costruita dalla rosa reale, preferendo il numero di maglia basso a
 * parita di ruolo, e va letta come supposizione.
 */

export type Slot = {
  player: Player | null;
  /** posizione in percentuale sul campo: 0 la porta, 100 l'attacco */
  x: number;
  y: number;
};

export const FORMATION = '3-5-2';

/** Il 3-5-2 visto da dietro la propria porta. Ogni casella dice chi ci va. */
const SHAPE: Array<{ want: Spot[]; x: number; y: number }> = [
  { want: ['POR'], x: 50, y: 2 },

  { want: ['DC'], x: 24, y: 24 },
  { want: ['DC'], x: 50, y: 19 },
  { want: ['DC'], x: 76, y: 24 },

  { want: ['TS', 'TD'], x: 8, y: 52 },
  { want: ['MED'], x: 31, y: 47 },
  { want: ['MED'], x: 50, y: 57 },
  { want: ['MED', 'EST'], x: 69, y: 47 },
  { want: ['TD', 'EST'], x: 92, y: 52 },

  { want: ['PUN'], x: 35, y: 86 },
  { want: ['PUN', 'ALA'], x: 65, y: 86 },
];

const num = (p: Player) => p.number ?? 999;

/** Rosa al netto di chi e uscito e dei prestiti in uscita. */
export function activeSquad(): Player[] {
  return squad.filter((p) => !p.onLoan && !DEPARTED.includes(p.shortName));
}

export function probableLineup(): { slots: Slot[]; bench: Player[]; formation: string } {
  const pool = [...activeSquad()].sort((a, b) => num(a) - num(b));
  const used = new Set<string>();

  const take = (want: Spot[]): Player | null => {
    // si prova ruolo per ruolo nell'ordine dichiarato: il primo e la scelta
    // naturale, gli altri sono i ripieghi accettabili per quella casella
    for (const w of want) {
      const found = pool.find((p) => !used.has(p.id) && spotOf(p.shortName) === w);
      if (found) {
        used.add(found.id);
        return found;
      }
    }
    // nessuno copre il ruolo: si prende chi resta del reparto piu vicino
    const fallback = pool.find((p) => !used.has(p.id));
    if (fallback) used.add(fallback.id);
    return fallback ?? null;
  };

  const slots: Slot[] = SHAPE.map((s) => ({ player: take(s.want), x: s.x, y: s.y }));
  const bench = pool.filter((p) => !used.has(p.id)).slice(0, 12);

  return { slots, bench, formation: FORMATION };
}


// ------------------------------------------------------------ formazione vera

/** Il ruolo grezzo di API-Football, quando il nostro non conosce il giocatore. */
const DA_POS: Record<string, Spot> = { G: 'POR', D: 'DC', M: 'MED', F: 'PUN' };

/** Cognome confrontabile: "G. Saro" e "Gianluca Saro" devono cadere sullo stesso. */
function cognome(nome: string | null): string {
  if (!nome) return '';
  const parti = String(nome).replace(/\./g, ' ').split(/\s+/).filter((x) => x.length > 1);
  return (parti[parti.length - 1] ?? '').toLowerCase();
}

/** Incrocia un nome di API-Football con la rosa: prima il numero, poi il cognome. */
function trova(p: LineupPlayer): Player | null {
  if (p.number !== null) {
    const perNumero = squad.find((x) => x.number === p.number);
    if (perNumero) return perNumero;
  }
  const c = cognome(p.name);
  return squad.find((x) => cognome(x.shortName) === c || cognome(x.name) === c) ?? null;
}

export type Formazione = {
  slots: Slot[];
  bench: Player[];
  formation: string;
  /** vera = undici ufficiale della partita; probabile = costruita dalla rosa */
  vera: boolean;
  /** i nomi che la rosa non conosce, mostrati comunque */
  estranei: string[];
};

/** L'ultima formazione vera disponibile, o quella di una data precisa. */
export function realLineup(date?: string): MatchLineup | null {
  const con = lineups.filter((m) => m.lineups?.some((l) => l.isFoggia && l.startXI.length));
  if (!con.length) return null;
  if (date) return con.find((m) => m.date === date) ?? null;
  return con.slice().sort((a, b) => b.date.localeCompare(a.date))[0] ?? null;
}

/**
 * Dispone un undici vero sul campo.
 *
 * Il modulo non arriva dalla fonte: `formation` per la Serie C torna vuoto. Ma
 * l'undici si, quindi la disposizione si ricava dai ruoli. Non si cerca piu di
 * far combaciare ogni casella con un ruolo esatto: quando un ruolo mancava, il
 * ripiego infilava un difensore nella casella del portiere e i due si
 * sovrapponevano.
 *
 * Ora e piu semplice e non puo rompersi: il portiere da parte, gli altri dieci
 * ordinati da chi difende a chi attacca, poi tre dietro, cinque in mezzo e due
 * davanti. Dentro ogni linea i piu centrali stanno in mezzo e i piu larghi
 * sulle fasce.
 */

/** Quanto un ruolo sta avanti: serve a dividere le tre linee. */
const AVANTI: Record<Spot, number> = {
  POR: -1, DC: 0, TD: 1, TS: 1, MED: 2, EST: 3, ALA: 4, PUN: 5,
};
/** Quanto un ruolo sta largo: serve a ordinare i giocatori dentro una linea. */
const LARGO: Record<Spot, number> = {
  POR: 0, DC: 0, TD: 2, TS: 2, MED: 0, EST: 2, ALA: 1, PUN: 0,
};

type InCampo = { player: Player; spot: Spot | null; number: number };

/** Riempie una linea partendo dal centro: i piu larghi finiscono sulle fasce. */
function disponi(riga: InCampo[], xs: number[], y: number): Slot[] {
  const perLarghezza = [...riga].sort(
    (a, b) => (LARGO[a.spot ?? 'MED'] ?? 0) - (LARGO[b.spot ?? 'MED'] ?? 0),
  );
  // ordine delle caselle: prima quella centrale, poi verso l'esterno
  const ordine = xs
    .map((x, i) => ({ x, i }))
    .sort((a, b) => Math.abs(a.x - 50) - Math.abs(b.x - 50));

  const slots: Slot[] = xs.map((x) => ({ player: null, x, y }));
  ordine.forEach((casella, k) => {
    slots[casella.i].player = perLarghezza[k]?.player ?? null;
  });
  return slots;
}

export function lineupFromMatch(m: MatchLineup): Formazione | null {
  const lato = m.lineups.find((l) => l.isFoggia);
  if (!lato || !lato.startXI.length) return null;

  const estranei: string[] = [];
  const in_campo: InCampo[] = lato.startXI.map((p) => {
    const noto = trova(p);
    if (noto) {
      return {
        player: noto,
        spot: spotOf(noto.shortName) ?? DA_POS[p.pos ?? ''] ?? null,
        number: p.number ?? noto.number ?? 999,
      };
    }
    estranei.push(p.name ?? '?');
    const finto = {
      id: `api-${p.number ?? p.name}`,
      name: p.name ?? '',
      shortName: (p.name ?? '').split(' ').pop() ?? '',
      number: p.number,
      role: 'C',
      roleLabel: '',
      nationality: null,
      photo: null,
      onLoan: false,
      source: 'api-football',
    } as unknown as Player;
    return { player: finto, spot: DA_POS[p.pos ?? ''] ?? null, number: p.number ?? 999 };
  });

  // il portiere e chi ha il ruolo; se nessuno ce l'ha, il primo della lista
  const iPortiere = in_campo.findIndex((x) => x.spot === 'POR');
  const portiere = in_campo[iPortiere >= 0 ? iPortiere : 0];
  const resto = in_campo
    .filter((x) => x !== portiere)
    .sort((a, b) => {
      const d = (AVANTI[a.spot ?? 'MED'] ?? 2) - (AVANTI[b.spot ?? 'MED'] ?? 2);
      return d !== 0 ? d : a.number - b.number;
    });

  const slots: Slot[] = [
    { player: portiere?.player ?? null, x: 50, y: 2 },
    ...disponi(resto.slice(0, 3), [24, 50, 76], 24),
    ...disponi(resto.slice(3, 8), [8, 31, 50, 69, 92], 52),
    ...disponi(resto.slice(8, 10), [35, 65], 86),
  ];

  const bench = lato.bench
    .map((p) => trova(p))
    .filter((p): p is Player => Boolean(p))
    .slice(0, 12);

  return { slots, bench, formation: FORMATION, vera: true, estranei };
}

/** La formazione da mostrare per una partita: vera se c'e, altrimenti probabile. */
export function lineupPerPartita(date?: string): Formazione {
  const vera = realLineup(date);
  const disposta = vera ? lineupFromMatch(vera) : null;
  if (disposta) return disposta;
  const p = probableLineup();
  return { ...p, vera: false, estranei: [] };
}

/**
 * Gli id di rosa dell'undici ufficiale di una partita.
 *
 * Serve al confronto con la Formazione della Curva: la fonte manda nomi e
 * numeri, la curva vota id. Chi non e in rosa non entra nel confronto, perche
 * nessuno avrebbe potuto schierarlo.
 */
export function idsUfficiali(m: MatchLineup): string[] {
  const lato = m.lineups.find((l) => l.isFoggia);
  if (!lato) return [];
  return lato.startXI
    .map((p) => trova(p))
    .filter((p): p is Player => Boolean(p))
    .map((p) => p.id);
}
