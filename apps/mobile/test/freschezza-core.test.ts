import { test } from 'node:test';
import assert from 'node:assert/strict';

import { durata, freschezza } from '../lib/freschezza-core.ts';

const ADESSO = Date.parse('2026-09-13T08:00:00.000Z');
const faMinuti = (m: number) => new Date(ADESSO - m * 60_000).toISOString();

test('sotto l ora non si dice niente: un avviso che c e sempre non lo legge nessuno', () => {
  assert.equal(freschezza(faMinuti(0), ADESSO).stato, 'fresco');
  assert.equal(freschezza(faMinuti(25), ADESSO).stato, 'fresco');
  assert.equal(freschezza(faMinuti(59), ADESSO).stato, 'fresco');
});

test('fra un ora e sei si segnala', () => {
  const f = freschezza(faMinuti(90), ADESSO);
  assert.equal(f.stato, 'indietro');
  assert.equal(f.stato === 'indietro' && f.testo, 'Dati di 1 ora fa.');
});

test('sopra le sei ore sono diciotto giri saltati: non e piu una coincidenza', () => {
  const f = freschezza(faMinuti(7 * 60), ADESSO);
  assert.equal(f.stato, 'fermo');
  assert.match(f.stato === 'fermo' ? f.testo : '', /Qualcosa non sta aggiornando/);
});

test('la notte in cui l ingest e fallito 25 volte si sarebbe vista', () => {
  // dalle 18:01 alle 08:00 del giorno dopo, con l app che diceva tutto a posto
  const f = freschezza('2026-09-12T18:01:00.000Z', Date.parse('2026-09-13T08:00:00.000Z'));
  assert.equal(f.stato, 'fermo');
  assert.equal(f.stato === 'fermo' && f.testo, 'Dati fermi da 13 ore. Qualcosa non sta aggiornando.');
});

test('senza data si dice che non si sa, che e peggio che vecchio', () => {
  assert.equal(freschezza(undefined, ADESSO).stato, 'ignoto');
  assert.equal(freschezza('domani', ADESSO).stato, 'ignoto');
  assert.equal(freschezza(12345, ADESSO).stato, 'ignoto');
});

test('un orologio del telefono avanti non fa scrivere numeri negativi', () => {
  const f = freschezza(new Date(ADESSO + 2 * 3600_000).toISOString(), ADESSO);
  assert.equal(f.stato, 'fresco');
  assert.equal(f.minuti, 0);
});

test('le durate si leggono come le direbbe una persona', () => {
  assert.equal(durata(1), '1 minuto');
  assert.equal(durata(45), '45 minuti');
  assert.equal(durata(60), '1 ora');
  assert.equal(durata(200), '3 ore');
  assert.equal(durata(60 * 24), '1 giorno');
  assert.equal(durata(60 * 24 * 3), '3 giorni');
});
