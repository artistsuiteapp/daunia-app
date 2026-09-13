import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const decodificaUri = require('../lib/decodifica-uri.js') as (s: unknown) => string;

/*
 * Il sostituto di decode-uri-component dentro l'app.
 *
 * Due cose da provare: che sugli indirizzi normali dia lo stesso risultato di
 * prima, altrimenti si rompe la navigazione, e che su un indirizzo costruito
 * per bloccare l'app risponda subito.
 */

test('gli indirizzi normali si decodificano come prima', () => {
  const casi: Array<[string, string]> = [
    ['wp-2026-2027-004', 'wp-2026-2027-004'],
    ['Foggia%20vs%20Savoia', 'Foggia vs Savoia'],
    ['citt%C3%A0+di+Foggia', 'città di Foggia'],
    ['%F0%9F%94%B4%E2%9A%AB', '🔴⚫'],
    ['a%2Bb%3Dc%26d', 'a+b=c&d'],
    ['', ''],
  ];
  for (const [dentro, atteso] of casi) assert.equal(decodificaUri(dentro), atteso);
});

test('una sequenza rotta decodifica quello che puo e lascia il resto', () => {
  assert.equal(decodificaUri('citt%C3%A0%E0%A4'), 'città%E0%A4');
  assert.equal(decodificaUri('%'), '%');
  // %25 e un byte valido, il simbolo di percento: lo stesso risultato dell'originale
  assert.equal(decodificaUri('100%25%'), '100%%');
  assert.equal(decodificaUri('%ZZciao%C3%A8'), '%ZZciaoè');
});

test('un indirizzo costruito per bloccare l app risponde subito', () => {
  // con la versione di prima questo teneva fermo il telefono per minuti
  const cattivo = '%F0%9F%98'.repeat(4_000);
  const t = performance.now();
  const fuori = decodificaUri(cattivo);
  assert.ok(performance.now() - t < 200, 'deve restare sotto i 200 ms');
  assert.equal(fuori, cattivo);
});

test('se non riceve una stringa lo dice come l originale', () => {
  assert.throws(() => decodificaUri(42), TypeError);
});
