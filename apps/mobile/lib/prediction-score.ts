/**
 * La regola del pronostico, isolata e senza dipendenze.
 *
 * Sta in un file suo perche e l'unica parte con una logica che si puo sbagliare,
 * e cosi si puo provare con node senza tirarsi dietro React. Il resto di
 * fanplay.ts e memoria e stato.
 */

/** Esito di una partita dal punto di vista della squadra di casa. */
export type Outcome = 1 | 0 | -1;

export function outcome(home: number, away: number): Outcome {
  if (home === away) return 0;
  return home > away ? 1 : -1;
}

/**
 * Tre punti il risultato esatto, uno l'esito.
 *
 * L'esito comprende il pareggio, non solo chi vince: chi dice 1-1 e vede finire
 * 2-2 ha indovinato come e andata e prende il punto. Un pareggio vale zero da
 * entrambe le parti, quindi il confronto torna senza casi speciali.
 */
export function scorePrediction(
  guess: readonly [number, number],
  actual: { home: number; away: number },
): 0 | 1 | 3 {
  if (guess[0] === actual.home && guess[1] === actual.away) return 3;
  return outcome(guess[0], guess[1]) === outcome(actual.home, actual.away) ? 1 : 0;
}
