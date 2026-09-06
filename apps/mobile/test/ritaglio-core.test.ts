import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { scalaMinima, limita, calcolaRitaglio, vistaIniziale } from '../lib/ritaglio-core.ts';

const LATO = 300;

test('la scala minima fa coprire il riquadro dal lato corto', () => {
  // foto orizzontale: e l'altezza a dover coprire
  assert.equal(scalaMinima({ larghezza: 1200, altezza: 600 }, 300), 0.5);
  // foto verticale: la larghezza
  assert.equal(scalaMinima({ larghezza: 600, altezza: 1200 }, 300), 0.5);
  // gia quadrata
  assert.equal(scalaMinima({ larghezza: 300, altezza: 300 }, 300), 1);
});

test('la vista iniziale centra la foto', () => {
  const img = { larghezza: 1200, altezza: 600 };
  const v = vistaIniziale(img, LATO);
  assert.equal(v.zoom, 1);
  // larghezza scalata 600, riquadro 300: sporge 300, meta per parte
  assert.equal(v.x, -150);
  assert.equal(v.y, 0);
});

test('non si puo trascinare fuori lasciando buchi', () => {
  const img = { larghezza: 1200, altezza: 600 };
  // strattonata verso destra oltre il limite
  assert.equal(limita(img, LATO, { zoom: 1, x: 500, y: 0 }).x, 0);
  // e verso sinistra
  assert.equal(limita(img, LATO, { zoom: 1, x: -9999, y: 0 }).x, -300);
});

test('lo zoom sta fra 1 e 6', () => {
  const img = { larghezza: 600, altezza: 600 };
  assert.equal(limita(img, LATO, { zoom: 0.2, x: 0, y: 0 }).zoom, 1);
  assert.equal(limita(img, LATO, { zoom: 99, x: 0, y: 0 }).zoom, 6);
});

test('senza zoom e centrata si ritaglia il quadrato centrale', () => {
  const img = { larghezza: 1200, altezza: 600 };
  const r = calcolaRitaglio(img, LATO, vistaIniziale(img, LATO));
  // il quadrato centrale di una foto 1200x600 e 600x600 a partire da x=300
  assert.equal(r.lato, 600);
  assert.equal(r.sx, 300);
  assert.equal(r.sy, 0);
});

test('raddoppiando lo zoom si ritaglia meta lato', () => {
  const img = { larghezza: 1000, altezza: 1000 };
  const r = calcolaRitaglio(img, LATO, limita(img, LATO, { zoom: 2, x: -500, y: -500 }));
  assert.equal(r.lato, 500);
});

test('una foto piu piccola del riquadro viene ingrandita, non lasciata vuota', () => {
  const img = { larghezza: 100, altezza: 100 };
  const r = calcolaRitaglio(img, LATO, vistaIniziale(img, LATO));
  assert.equal(r.lato, 100);
  assert.equal(r.sx, 0);
  assert.equal(r.sy, 0);
});

test('una immagine senza dimensioni non fa esplodere i conti', () => {
  const r = calcolaRitaglio({ larghezza: 0, altezza: 0 }, LATO, { zoom: 1, x: 0, y: 0 });
  assert.ok(Number.isFinite(r.sx) && Number.isFinite(r.sy) && Number.isFinite(r.lato));
});
