import archivio from '../../../data/carriere.json';

import { indicizza, type Archivio } from './carriere-core.ts';

/**
 * L'archivio vero, attaccato alle funzioni che stanno in carriere-core.ts.
 *
 * Qui dentro c'e solo il collegamento al file di dati: i conti e le ricerche
 * stanno nel core, che e senza dati apposta e quindi si puo provare.
 */
const indice = indicizza(archivio as unknown as Archivio);

export const FONTE = indice.fonte;
export const carrieraDi = indice.carrieraDi;
export const anagraficaDi = indice.anagraficaDi;
export const piuPresenti = indice.piuPresenti;

export { minutiAPartita, normalizzaNome, dataLeggibile } from './carriere-core.ts';
export type { Carriera, Anagrafica, StagioneCarriera } from './carriere-core.ts';
