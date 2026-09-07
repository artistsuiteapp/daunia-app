import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  statoMigliore, statoMese, chiaveMese, meseChiuso, VOTAZIONE_APERTA,
} from '../lib/premi-core.ts';

const FINE = Date.parse('2026-09-06T21:00:00Z');
const PROSSIMA = '2026-09-12T16:00:00Z';
const dopo = (ore: number) => FINE + ore * 3_600_000;

test('si vota nelle ventiquattro ore dopo il fischio', () => {
  assert.equal(statoMigliore(FINE, PROSSIMA, dopo(0.1)).fase, 'votazione');
  assert.equal(statoMigliore(FINE, PROSSIMA, dopo(23.9)).fase, 'votazione');
});

test('il conto alla rovescia dice quanto resta', () => {
  const s = statoMigliore(FINE, PROSSIMA, dopo(1));
  assert.equal(s.fase, 'votazione');
  if (s.fase === 'votazione') assert.equal(s.scadeFra, VOTAZIONE_APERTA - 3_600_000);
});

test('passate le ventiquattro ore resta il risultato', () => {
  assert.equal(statoMigliore(FINE, PROSSIMA, dopo(25)).fase, 'risultato');
  assert.equal(statoMigliore(FINE, PROSSIMA, dopo(100)).fase, 'risultato');
});

test('il giorno prima della partita successiva sparisce', () => {
  // Monopoli-Foggia e il 12 alle 16: dall 11 alle 16 in poi, niente
  const vigilia = Date.parse('2026-09-11T16:30:00Z');
  assert.equal(statoMigliore(FINE, PROSSIMA, vigilia).fase, 'niente');
});

test('prima del triplice fischio non c e niente da votare', () => {
  assert.equal(statoMigliore(FINE, PROSSIMA, FINE - 60_000).fase, 'niente');
  assert.equal(statoMigliore(null, PROSSIMA, dopo(2)).fase, 'niente');
});

test('senza partita successiva il risultato resta', () => {
  // fine stagione: non c e una prossima gara che lo scalzi
  assert.equal(statoMigliore(FINE, null, dopo(200)).fase, 'risultato');
});

test('il mese si scrive anno-mese', () => {
  assert.equal(chiaveMese(new Date(2026, 8, 15)), '2026-09');
  assert.equal(chiaveMese(new Date(2026, 0, 1)), '2026-01');
});

test('dentro il mese la classifica e aperta', () => {
  const s = statoMese(new Date(2026, 8, 15));
  assert.deepEqual(s, { mese: '2026-09', chiuso: false });
});

test('il primo del mese vale ancora il verdetto di quello prima', () => {
  const s = statoMese(new Date(2026, 9, 1));
  assert.deepEqual(s, { mese: '2026-09', chiuso: true });
});

test('a gennaio il mese prima e dicembre dell anno scorso', () => {
  const s = statoMese(new Date(2027, 0, 1));
  assert.deepEqual(s, { mese: '2026-12', chiuso: true });
});

test('un mese passato risulta chiuso', () => {
  assert.equal(meseChiuso('2026-08', new Date(2026, 8, 10)), true);
  assert.equal(meseChiuso('2026-09', new Date(2026, 8, 10)), false);
});
