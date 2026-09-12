import test from 'node:test';
import assert from 'node:assert/strict';

import { travesti, travestiTutti, eLaNostra, CASA, OSPITI } from './livescore.ts';
import { golVero, contaGol, cronologia } from './punteggio.ts';

/*
 * Il punto di questi test non e' il travestimento in se': e' che quello che
 * sta a valle -- il conteggio, la cronaca, il filtro sul rigore sbagliato --
 * continui a funzionare con la fonte nuova senza essere stato toccato.
 */

test('il gol normale conta e porta il nome', () => {
  const [e] = travestiTutti([{ event: 'GOAL', time: '23', is_home: true, player: { name: 'Rossi' } }]);
  assert.equal(golVero(e), true);
  assert.equal(e.player?.name, 'Rossi');
  assert.equal(e.time?.elapsed, 23);
  assert.equal(e.team?.id, CASA);
});

test('il gol su rigore conta come gol', () => {
  const [e] = travestiTutti([{ event: 'GOAL_PENALTY', time: '61', is_home: false, player: { name: 'Bianchi' } }]);
  assert.equal(golVero(e), true);
  assert.equal(e.team?.id, OSPITI);
});

test('il rigore SBAGLIATO non diventa un gol', () => {
  const [e] = travestiTutti([{ event: 'MISSED_PENALTY', time: '70', is_home: true, player: { name: 'Verdi' } }]);
  assert.equal(golVero(e), false, 'e il difetto che nessuno perdona: gol annunciato e mai segnato');
});

test('l autogol si sposta dalla parte giusta', () => {
  // segnato da un giocatore di casa: il punto va agli ospiti
  const ev = travestiTutti([{ event: 'OWN_GOAL', time: '30', is_home: true, player: { name: 'Neri' } }]);
  assert.deepEqual(contaGol(ev, CASA, true), { casa: 0, ospiti: 1 });
});

test('il punteggio dagli eventi torna, in casa e fuori', () => {
  const ev = travestiTutti([
    { event: 'GOAL', time: '10', is_home: true, player: { name: 'A' } },
    { event: 'GOAL_PENALTY', time: '55', is_home: false, player: { name: 'B' } },
    { event: 'GOAL', time: '80', is_home: false, player: { name: 'C' } },
  ]);
  // noi in casa
  assert.deepEqual(contaGol(ev, CASA, true), { casa: 1, ospiti: 2 });
  // noi in trasferta: siamo gli OSPITI, e il conto si specchia
  assert.deepEqual(contaGol(ev, OSPITI, false), { casa: 1, ospiti: 2 });
});

test('il secondo giallo arriva come rosso, cosi parte l espulsione', () => {
  const [e] = travestiTutti([{ event: 'YELLOW_RED_CARD', time: '80', is_home: true, player: { name: 'Gialli' } }]);
  assert.equal(e.type, 'Card');
  assert.ok(String(e.detail).includes('Red'), 'il guardiano cerca "Red" dentro detail');
});

test('il giallo semplice NON fa partire l espulsione', () => {
  const [e] = travestiTutti([{ event: 'YELLOW_CARD', time: '20', is_home: true, player: { name: 'A' } }]);
  assert.equal(String(e.detail).includes('Red'), false);
});

test('la cronaca esce in ordine e con i nomi', () => {
  const ev = travestiTutti([
    { event: 'GOAL', time: '77', is_home: false, player: { name: 'Tardi' } },
    { event: 'GOAL_PENALTY', time: '9', is_home: false, player: { name: 'Presto' } },
  ]);
  const c = cronologia(ev, OSPITI, false);
  assert.deepEqual(c.map((v) => v.chi), ['Presto', 'Tardi']);
});

test('un evento che non conosciamo si scarta invece di rompere', () => {
  assert.equal(travesti({ event: 'VAR_REVIEW', time: '5', is_home: true }), null);
  assert.equal(travestiTutti([{ event: 'BOH' }, { event: 'GOAL', time: '1', is_home: true }]).length, 1);
  assert.deepEqual(travestiTutti(null), []);
  assert.deepEqual(travestiTutti(undefined), []);
});

test('un minuto illeggibile non diventa zero', () => {
  const [e] = travestiTutti([{ event: 'GOAL', time: 'HT', is_home: true, player: { name: 'X' } }]);
  assert.equal(e.time?.elapsed, null, 'zero vorrebbe dire "al primo minuto", che e una bugia');
});

test('riconosce la nostra partita comunque sia scritta', () => {
  assert.equal(eLaNostra({ home: { name: 'SS Monopoli 1966' }, away: { name: 'Calcio Foggia 1920' } }), true);
  assert.equal(eLaNostra({ home: { name: 'FOGGIA' }, away: { name: 'Savoia' } }), true);
  assert.equal(eLaNostra({ home: { name: 'Benevento' }, away: { name: 'Casertana' } }), false);
});
