import type { Player } from '@satanelli/core';
import { squad } from './data';

/**
 * Formazione probabile.
 *
 * Wikipedia non pubblica le formazioni di Serie C, e il sito del club non le
 * compila: qui si costruisce una disposizione plausibile prendendo dalla rosa
 * reale i giocatori con il numero piu basso per reparto, che nel calcio italiano
 * e una buona approssimazione dei titolari. E dichiarata come probabile in ogni
 * schermata che la usa, e diventa quella vera appena il club apre il dato.
 */

export type Slot = {
  player: Player | null;
  /** posizione in percentuale sul campo: 0 la porta, 100 l'attacco */
  x: number;
  y: number;
};

export const FORMATION = '3-5-2';

/** Griglia del 3-5-2 vista da dietro la porta: x da sinistra, y dalla propria area. */
const SHAPE: Array<{ role: 'P' | 'D' | 'C' | 'A'; x: number; y: number }> = [
  { role: 'P', x: 50, y: 8 },
  { role: 'D', x: 24, y: 26 },
  { role: 'D', x: 50, y: 22 },
  { role: 'D', x: 76, y: 26 },
  { role: 'C', x: 10, y: 50 },
  { role: 'C', x: 33, y: 46 },
  { role: 'C', x: 50, y: 54 },
  { role: 'C', x: 67, y: 46 },
  { role: 'C', x: 90, y: 50 },
  { role: 'A', x: 38, y: 78 },
  { role: 'A', x: 62, y: 78 },
];

export function probableLineup(): { slots: Slot[]; bench: Player[]; formation: string } {
  const byRole = (r: string) => squad
    .filter((p) => p.role === r && !p.onLoan)
    .sort((a, b) => (a.number ?? 99) - (b.number ?? 99));

  const pools: Record<string, Player[]> = {
    P: byRole('P'), D: byRole('D'), C: byRole('C'), A: byRole('A'),
  };
  const used = new Set<string>();

  const slots: Slot[] = SHAPE.map(({ role, x, y }) => {
    const player = pools[role]!.find((p) => !used.has(p.id)) ?? null;
    if (player) used.add(player.id);
    return { player, x, y };
  });

  const bench = squad.filter((p) => !used.has(p.id) && !p.onLoan).slice(0, 9);
  return { slots, bench, formation: FORMATION };
}
