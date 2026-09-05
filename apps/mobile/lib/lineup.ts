import type { Player } from '@satanelli/core';
import { squad } from './data';
import { DEPARTED, spotOf, type Spot } from './squad-overrides';

/**
 * Formazione probabile.
 *
 * Le formazioni di Serie C non le pubblica nessuna fonte aperta, quindi va
 * costruita. Prima si prendeva il numero di maglia piu basso per reparto, che
 * dava una squadra impossibile: cinque mediani in fila e nessun terzino.
 *
 * Ora ogni casella del modulo chiede un ruolo di campo preciso (vedi
 * squad-overrides.ts) e si sceglie fra chi lo ricopre davvero, preferendo il
 * numero di maglia basso a parita di ruolo. Resta una supposizione, ed e
 * dichiarata come tale in ogni schermata che la usa.
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
