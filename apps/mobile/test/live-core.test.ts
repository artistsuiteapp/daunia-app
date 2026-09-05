import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { finestraAperta, leggiEvento, orienta } from '../lib/live-core.ts';

const KICKOFF = '2026-09-06T19:00:00Z';
const T = Date.parse(KICKOFF);

test('la finestra si apre dieci minuti prima e resta aperta tre ore', () => {
  assert.equal(finestraAperta(KICKOFF, T - 11 * 60_000), false);
  assert.equal(finestraAperta(KICKOFF, T - 9 * 60_000), true);
  assert.equal(finestraAperta(KICKOFF, T + 60 * 60_000), true);
  assert.equal(finestraAperta(KICKOFF, T + 3 * 60 * 60_000 + 1000), false);
});

test('senza calcio d inizio la finestra resta chiusa', () => {
  assert.equal(finestraAperta(null, T), false);
  assert.equal(finestraAperta('non una data', T), false);
});

test('legge punteggio e fase da lookupevent', () => {
  const l = leggiEvento({ strStatus: '2H', intHomeScore: '2', intAwayScore: '1' }, 1000);
  assert.deepEqual(l, {
    stato: '2H', fase: 'secondo tempo', casa: 2, ospite: 1, finita: false, aggiornato: 1000,
  });
});

test('zero a zero non diventa nullo', () => {
  const l = leggiEvento({ strStatus: '1H', intHomeScore: '0', intAwayScore: '0' });
  assert.equal(l?.casa, 0);
  assert.equal(l?.ospite, 0);
});

test('punteggio assente prima del fischio', () => {
  const l = leggiEvento({ strStatus: 'NS', intHomeScore: null, intAwayScore: null });
  assert.equal(l?.casa, null);
  assert.equal(l?.finita, false);
});

test('riconosce le partite chiuse', () => {
  assert.equal(leggiEvento({ strStatus: 'FT' })?.finita, true);
  assert.equal(leggiEvento({ strStatus: 'AET' })?.finita, true);
  assert.equal(leggiEvento({ strStatus: 'HT' })?.finita, false);
});

test('stato sconosciuto non fa esplodere niente', () => {
  const l = leggiEvento({ strStatus: 'XYZ' });
  assert.equal(l?.stato, 'XYZ');
  assert.equal(l?.fase, 'xyz');
});

const vivo = leggiEvento({ strStatus: '2H', intHomeScore: '2', intAwayScore: '1' })!;
const partita = { kickoff: KICKOFF, status: 'scheduled', casa: 'Foggia' };
const fonte = { kickoff: KICKOFF, casa: 'Foggia' };

test('stesso ordine di squadre: il punteggio resta com e', () => {
  const r = orienta(partita, fonte, vivo);
  assert.equal(r?.casa, 2);
  assert.equal(r?.ospite, 1);
});

test('la fonte inverte le squadre: il punteggio si gira', () => {
  const r = orienta(partita, { kickoff: KICKOFF, casa: 'Audace Cerignola' }, vivo);
  assert.equal(r?.casa, 1);
  assert.equal(r?.ospite, 2);
});

test('nomi scritti diversamente non fanno girare il punteggio', () => {
  const r = orienta({ ...partita, casa: 'Foggia' }, { kickoff: KICKOFF, casa: 'Foggia Calcio' }, vivo);
  assert.equal(r?.casa, 2);
});

test('altra partita, altro giorno: niente punteggio', () => {
  assert.equal(orienta({ ...partita, kickoff: '2026-09-13T19:00:00Z' }, fonte, vivo), null);
});

test('partita gia archiviata: vince il risultato nei dati', () => {
  assert.equal(orienta({ ...partita, status: 'finished' }, fonte, vivo), null);
});

test('non ancora iniziata: niente punteggio', () => {
  const ns = leggiEvento({ strStatus: 'NS' })!;
  assert.equal(orienta(partita, fonte, ns), null);
});
