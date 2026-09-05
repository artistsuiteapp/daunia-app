/**
 * Correzioni alla rosa, verificate a mano.
 *
 * Wikipedia tiene la rosa aggiornata a grandi linee ma non i ruoli specifici, e
 * resta indietro sulle uscite. Questo file e il posto dove si mettono le
 * correzioni: si aggiorna a mano guardando una fonte affidabile, non si genera.
 *
 * Ultimo controllo: 5 settembre 2026, confronto con la scheda rosa di
 * Transfermarkt. Trenta nomi su Wikipedia contro ventinove li: la differenza e
 * Agnelli. I ruoli dettagliati vengono da li e servono a schierare la squadra
 * come si schiera davvero, invece di andare per numero di maglia.
 */

/** Non fanno piu parte della rosa: si escludono da tutto. */
export const DEPARTED = ['Agnelli'];

export type Spot = 'POR' | 'DC' | 'TD' | 'TS' | 'MED' | 'EST' | 'ALA' | 'PUN';

/**
 * Ruolo di campo per cognome. Serve a mettere i terzini sulle fasce e i centrali
 * in mezzo: senza questo un 3-5-2 finisce con cinque mediani in fila.
 */
export const SPOT: Record<string, Spot> = {
  Marfella: 'POR', Saro: 'POR', Testa: 'POR',

  Seck: 'DC', 'Di Pasquale': 'DC', Azarovs: 'DC', Parisy: 'DC',
  Todisco: 'TD', Berra: 'TD', Demeter: 'TS',

  Coulibaly: 'MED', Gallo: 'MED', Haoudi: 'MED', Ngana: 'MED',
  Zuccon: 'MED', Chiara: 'MED', Miu: 'MED',
  Maestrelli: 'EST',

  Oviszach: 'ALA', 'Del Sole': 'ALA', Touré: 'ALA', Bigonzoni: 'ALA', Smeraldi: 'ALA',
  Luciani: 'PUN', Merdji: 'PUN', Ravasio: 'PUN',
  'Pio Petito': 'PUN', Panico: 'PUN', Paolino: 'PUN',
};

export function spotOf(shortName: string): Spot | null {
  return SPOT[shortName] ?? null;
}
