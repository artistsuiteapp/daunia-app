import * as THREE from 'three';
import type { StadiumSector } from '@satanelli/core';
import { makeWordMask } from './font5x7';

/**
 * Superficie dei seggiolini.
 *
 * Sopra la struttura in cemento viene appoggiata una griglia di celle, una per
 * blocco di posti: ogni cella ha il suo colore in vertex color. Cosi si ottengono
 * le fasce rosso, nero e bianco che si vedono nelle foto aeree, e soprattutto il
 * mosaico "FOGGIA" sulla Curva Nord, senza usare nessuna texture (che su
 * expo-gl richiederebbe un canvas che in React Native non c'e).
 */

export type SeatMode = 'realistic' | 'occupancy';

const COL = {
  red: new THREE.Color('#b6121b'),
  redDark: new THREE.Color('#7d0d13'),
  black: new THREE.Color('#17171b'),
  white: new THREE.Color('#e8e6e2'),
  concrete: new THREE.Color('#6b6255'),
};

/**
 * Tonalita della folla vista dall'alto: domina lo scuro dei giubbotti, con dentro
 * qualche punto chiaro e qualche macchia rossa di sciarpe e maglie.
 * Una tavolozza tutta beige leggeva come sabbia, non come pubblico.
 */
const CROWD = [
  '#2e2a28', '#3a3330', '#4a403b', '#241f1e', '#514640',
  '#8a7263', '#b39c88', '#d3c3b1',
  '#7d1a1c', '#a02226',
].map((h) => new THREE.Color(h));

/** Pesi: piu scuro che chiaro, cosi la massa non sembra una spiaggia. */
const CROWD_WEIGHTS = [0.17, 0.16, 0.14, 0.12, 0.11, 0.09, 0.07, 0.05, 0.05, 0.04];

function crowdColour(r: number): THREE.Color {
  let acc = 0;
  for (let i = 0; i < CROWD_WEIGHTS.length; i++) {
    acc += CROWD_WEIGHTS[i]!;
    if (r <= acc) return CROWD[i]!;
  }
  return CROWD[0]!;
}

/** Rumore deterministico: la stessa cella ha sempre lo stesso colore fra un frame e l'altro. */
function hash(x: number, y: number, seed: number) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

/**
 * Motivo dei seggiolini per il settore, senza pubblico.
 * Le curve alternano fasce rosse e nere, le tribune hanno piu rosso.
 */
function seatColor(sector: StadiumSector, row: number, col: number): THREE.Color {
  const isCurve = sector.side === 'north' || sector.side === 'south';
  const band = isCurve ? Math.floor(row / 3) % 4 : Math.floor(row / 4) % 5;
  if (isCurve) return [COL.red, COL.black, COL.red, COL.white][band]!;
  return [COL.red, COL.red, COL.black, COL.red, COL.white][band]!;
}

export type SeatingResult = {
  geometry: THREE.BufferGeometry;
  rows: number;
  cols: number;
};

export function buildSeating(sector: StadiumSector, mode: SeatMode): SeatingResult {
  const { length, depth, rows, baseHeight, topHeight } = sector.geometry;
  // celle piu strette sulle curve: servono abbastanza colonne perche la scritta
  // "FOGGIA" entri a scala doppia e si legga come nelle foto
  const isCurve = sector.side === 'north' || sector.side === 'south';
  // celle piu strette dove va la scritta, cosi entra a scala doppia
  const cellW = sector.id === 'tribuna-est' ? 0.86 : isCurve ? 0.92 : 1.15;
  const cols = Math.max(8, Math.round(length / cellW));
  const stepDepth = depth / rows;
  const stepRise = (topHeight - baseHeight) / rows;

  // nelle foto aeree la scritta "FOGGIA" e sulla gradinata lunga di fronte
  // alla Tribuna Centrale, non su una curva
  const mask = sector.id === 'tribuna-est' ? makeWordMask('FOGGIA', cols, rows) : null;

  // In modalita "tifosi" si riempie tutto: e una resa grafica, non una
  // previsione di quanti biglietti sono venduti. La disponibilita vera sta solo
  // su Vivaticket, e questa app non la conosce.
  const filledRows = mode === 'occupancy'
    ? rows
    : 0;

  const positions = new Float32Array(rows * cols * 6 * 3);
  const colours = new Float32Array(rows * cols * 6 * 3);
  const tmp = new THREE.Color();
  let p = 0;
  let c = 0;

  for (let r = 0; r < rows; r++) {
    const x0 = r * stepDepth;
    const x1 = x0 + stepDepth * 0.94;
    const y = baseHeight + r * stepRise + 0.06;

    for (let j = 0; j < cols; j++) {
      const z0 = -length / 2 + j * (length / cols);
      const z1 = z0 + (length / cols) * 0.94;

      // due triangoli per cella, vista dall'alto
      const quad = [x0, y, z0, x1, y, z0, x1, y, z1, x0, y, z0, x1, y, z1, x0, y, z1];
      positions.set(quad, p);
      p += 18;

      let col: THREE.Color;
      if (mask?.(j, r)) {
        col = COL.white;
      } else if (r < filledRows) {
        col = crowdColour(hash(j, r, 3));
      } else {
        col = seatColor(sector, r, j);
      }
      // variazione minima per non avere superfici piatte come un cartone
      tmp.copy(col).multiplyScalar(0.9 + hash(j, r, 11) * 0.2);

      for (let k = 0; k < 6; k++) {
        colours[c] = tmp.r; colours[c + 1] = tmp.g; colours[c + 2] = tmp.b;
        c += 3;
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  geometry.computeVertexNormals();
  return { geometry, rows, cols };
}

export const CONCRETE = '#6b6255';
export const CONCRETE_DARK = '#4c463d';
