import test from 'node:test';
import assert from 'node:assert/strict';

import { traduciEventi } from '../src/sources/livescore.mjs';

/*
 * I nomi degli eventi sono quelli della pagina "getting match events data" di
 * live-score-api, copiati e non indovinati. Il primo giro li aveva indovinati
 * e un gol su rigore spariva dal tabellino senza dare errore.
 */

test('il gol su rigore finisce nel tabellino', () => {
  const { gol } = traduciEventi([
    { event: 'GOAL_PENALTY', time: '62', is_home: false, player: { name: 'Rossi' } },
  ]);
  assert.equal(gol.length, 1);
  assert.equal(gol[0].scorer, 'Rossi');
  assert.equal(gol[0].penalty, true);
  assert.equal(gol[0].ownGoal, false);
  assert.equal(gol[0].side, 'away');
});

test('il rigore sbagliato non diventa un gol', () => {
  const { gol } = traduciEventi([
    { event: 'MISSED_PENALTY', time: '70', is_home: true, player: { name: 'Bianchi' } },
  ]);
  assert.equal(gol.length, 0);
});

test('il gol normale resta un gol normale', () => {
  const { gol } = traduciEventi([
    { event: 'GOAL', time: '12', is_home: true, player: { name: 'Verdi' } },
  ]);
  assert.equal(gol[0].penalty, false);
  assert.equal(gol[0].ownGoal, false);
  assert.equal(gol[0].side, 'home');
});

test('l autogol vale per l altra squadra', () => {
  const { gol } = traduciEventi([
    { event: 'OWN_GOAL', time: '30', is_home: true, player: { name: 'Neri' } },
  ]);
  assert.equal(gol[0].ownGoal, true);
  assert.equal(gol[0].side, 'away', 'segnato da un giocatore di casa: il punto va agli ospiti');
});

test('il secondo giallo e un rosso', () => {
  const { cartellini } = traduciEventi([
    { event: 'YELLOW_RED_CARD', time: '80', is_home: true, player: { name: 'Gialli' } },
  ]);
  assert.equal(cartellini.length, 1);
  assert.equal(cartellini[0].rosso, true);
});

test('giallo e rosso semplici restano distinti', () => {
  const { cartellini } = traduciEventi([
    { event: 'YELLOW_CARD', time: '20', is_home: true, player: { name: 'A' } },
    { event: 'RED_CARD', time: '55', is_home: false, player: { name: 'B' } },
  ]);
  assert.equal(cartellini[0].rosso, false);
  assert.equal(cartellini[1].rosso, true);
});

test('la sostituzione porta chi esce e chi entra', () => {
  const { cambi } = traduciEventi([
    { event: 'SUBSTITUTION', time: '65', is_home: true, player: { name: 'Esce' }, info: { name: 'Entra' } },
  ]);
  assert.deepEqual(cambi, [{ minute: 65, esce: 'Esce', entra: 'Entra', side: 'home' }]);
});

test('i gol escono in ordine di minuto', () => {
  const { gol } = traduciEventi([
    { event: 'GOAL', time: '77', is_home: true, player: { name: 'Tardi' } },
    { event: 'GOAL_PENALTY', time: '9', is_home: true, player: { name: 'Presto' } },
  ]);
  assert.deepEqual(gol.map((g) => g.scorer), ['Presto', 'Tardi']);
});

test('un evento senza minuto valido si salta invece di rompere', () => {
  const { gol, cartellini, cambi } = traduciEventi([
    { event: 'GOAL', time: 'HT', is_home: true, player: { name: 'X' } },
    { event: 'GOAL', is_home: true, player: { name: 'Y' } },
  ]);
  assert.equal(gol.length + cartellini.length + cambi.length, 0);
});
