import * as THREE from 'three';
import type { StadiumSector } from '@satanelli/core';

/**
 * Geometria parametrica dello stadio.
 *
 * Niente modello GLTF: ogni tribuna si genera da lunghezza, profondita, numero di file
 * e altezze. Tre motivi pratici: il bundle resta leggero, ogni settore e gia una mesh
 * separata quindi il tap si risolve con un raycast, e ricolorare per riempimento e
 * solo un cambio di materiale.
 *
 * Sistema di riferimento: campo sul piano XZ centrato nell'origine, X lungo la
 * lunghezza (105 m), Z lungo la larghezza (68 m), Y verso l'alto.
 *   west / east   -> tribune sui lati lunghi, corrono lungo X, si allontanano lungo Z
 *   north / south -> curve dietro le porte, corrono lungo Z, si allontanano lungo X
 */

/** Profilo a gradoni della gradinata, visto di lato. */
function rakeShape(sector: StadiumSector): THREE.Shape {
  const { depth, rows, baseHeight, topHeight } = sector.geometry;
  const stepDepth = depth / rows;
  const stepRise = (topHeight - baseHeight) / rows;

  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(0, baseHeight);
  for (let i = 0; i < rows; i++) {
    const x = i * stepDepth;
    const y = baseHeight + i * stepRise;
    shape.lineTo(x + stepDepth, y);
    shape.lineTo(x + stepDepth, y + stepRise);
  }
  shape.lineTo(depth, 0);
  shape.closePath();
  return shape;
}

export type SectorMesh = {
  sector: StadiumSector;
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
  rotation: [number, number, number];
};

export function buildSectorMesh(sector: StadiumSector): SectorMesh {
  const { length, offset } = sector.geometry;
  const shift = (sector.geometry as { shift?: number }).shift ?? 0;

  // ExtrudeGeometry lavora sul piano XY ed estrude lungo Z: qui X = profondita,
  // Y = altezza, Z = sviluppo della tribuna. Poi si ruota e si posiziona.
  const geometry = new THREE.ExtrudeGeometry(rakeShape(sector), {
    depth: length,
    bevelEnabled: false,
    steps: 1,
  });
  // centra lo sviluppo sull'origine cosi offset e shift restano leggibili
  geometry.translate(0, 0, -length / 2);
  geometry.computeVertexNormals();

  switch (sector.side) {
    // lato lungo ovest: la profondita cresce verso -Z, lo sviluppo e lungo X
    case 'west':
      return { sector, geometry, position: [shift, 0, -offset], rotation: [0, Math.PI / 2, 0] };
    case 'east':
      return { sector, geometry, position: [shift, 0, offset], rotation: [0, -Math.PI / 2, 0] };
    // curve: la profondita cresce lungo X, lo sviluppo e lungo Z
    case 'north':
      return { sector, geometry, position: [offset, 0, shift], rotation: [0, 0, 0] };
    case 'south':
    default:
      return { sector, geometry, position: [-offset, 0, shift], rotation: [0, Math.PI, 0] };
  }
}

/** Verde del prato, leggermente variato per non sembrare un rettangolo piatto. */
export const PITCH_COLOR = '#1f6b2e';

/**
 * Colore del settore in funzione del riempimento: verde quando c'e posto,
 * rosso quando e quasi pieno. Grigio quando il dato non c'e.
 */
export function occupancyColor(occupancy: number | null): string {
  if (occupancy === null) return '#3A3A44';
  const t = Math.max(0, Math.min(1, occupancy));
  // da verde (140) a rosso (0) passando per giallo
  const hue = 140 - 140 * t;
  return `hsl(${hue}, 62%, ${38 + 8 * (1 - t)}%)`;
}

export const SELECTED_COLOR = '#EE1111';
