import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ancoraDaGiocare, calendarioDa, daAllineare } from './calendario.ts';

const ORA = Date.parse('2026-09-13T12:00:00Z');
const MINUTO = 60_000;

test('le partite del calendario passano con id, orario e punteggio', () => {
  const righe = calendarioDa([
    { id: 'wp-2026-2027-003', kickoff: '2026-09-06T19:00:00.000Z', status: 'finished', score: { home: 0, away: 2 } },
    { id: 'wp-2026-2027-005', kickoff: '2026-09-15T19:00:00.000Z', status: 'scheduled', score: null },
  ]);
  assert.deepEqual(righe, [
    { partita: 'wp-2026-2027-003', kickoff: '2026-09-06T19:00:00.000Z', casa: 0, ospiti: 2, finita: true },
    { partita: 'wp-2026-2027-005', kickoff: '2026-09-15T19:00:00.000Z', casa: null, ospiti: null, finita: false },
  ]);
});

test('finita senza punteggio non e finita: non deve pagare punti', () => {
  const [r] = calendarioDa([{ id: 'wp-1', kickoff: '2026-09-06T19:00:00Z', status: 'finished', score: { home: 1, away: null } }]);
  assert.equal(r.finita, false);
});

test('le voci rotte restano fuori, e un id doppio conta una volta', () => {
  const righe = calendarioDa({ matches: [
    { id: 'wp-1', kickoff: 'non una data' },
    { id: '', kickoff: '2026-09-06T19:00:00Z' },
    { id: 'con spazi e roba lunga', kickoff: '2026-09-06T19:00:00Z' },
    { id: 'wp-2', kickoff: '2026-09-06T19:00:00Z', score: { home: 99, away: -1 } },
    { id: 'wp-2', kickoff: '2026-09-07T19:00:00Z' },
    null,
  ] });
  assert.deepEqual(righe, [
    { partita: 'wp-2', kickoff: '2026-09-06T19:00:00.000Z', casa: null, ospiti: null, finita: false },
  ]);
  assert.deepEqual(calendarioDa('non un elenco'), []);
});

test('si riallinea ogni mezz ora, e subito se non lo si e mai fatto', () => {
  assert.equal(daAllineare(null, ORA, 30 * MINUTO), true);
  assert.equal(daAllineare(new Date(ORA - 10 * MINUTO).toISOString(), ORA, 30 * MINUTO), false);
  assert.equal(daAllineare(new Date(ORA - 31 * MINUTO).toISOString(), ORA, 30 * MINUTO), true);
  // una data nel futuro lontano non blocca per sempre
  assert.equal(daAllineare('2099-01-01T00:00:00Z', ORA, 30 * MINUTO), true);
});

test('la partita appena finita non torna prossima', () => {
  const tre = 3 * 60 * MINUTO;
  assert.equal(ancoraDaGiocare('2026-09-12T16:00:00Z', ORA, tre), false);
  assert.equal(ancoraDaGiocare('2026-09-15T19:00:00Z', ORA, tre), true);
  // dentro la finestra dopo il fischio resta quella di riferimento
  assert.equal(ancoraDaGiocare('2026-09-13T10:00:00Z', ORA, tre), true);
  assert.equal(ancoraDaGiocare('boh', ORA, tre), false);
});
