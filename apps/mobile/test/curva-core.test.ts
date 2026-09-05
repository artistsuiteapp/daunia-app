import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { conta, undici, consenso, confronta, striscia, stricciaARischio, BONUS_PIENO } from '../lib/curva-core.ts';

const XI = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

test('conta le presenze e ordina per voti', () => {
  const r = conta([['a', 'b'], ['a', 'c'], ['a', 'b']]);
  assert.deepEqual(r, [{ id: 'a', voti: 3 }, { id: 'b', voti: 2 }, { id: 'c', voti: 1 }]);
});

test('lo stesso nome due volte nella stessa formazione vale uno', () => {
  assert.deepEqual(conta([['a', 'a', 'a']]), [{ id: 'a', voti: 1 }]);
});

test('a pari voti l ordine e stabile', () => {
  assert.deepEqual(conta([['b'], ['a']]).map((x) => x.id), ['a', 'b']);
});

test('nessuna formazione, nessun conteggio', () => {
  assert.deepEqual(conta([]), []);
});

test('l undici della curva si ferma a undici', () => {
  const tante = [Array.from({ length: 20 }, (_, i) => `p${i}`)];
  assert.equal(undici(tante).length, 11);
});

test('il consenso e una percentuale sui votanti', () => {
  const c = consenso(conta([['a', 'b'], ['a']]), 2);
  assert.equal(c.get('a'), 100);
  assert.equal(c.get('b'), 50);
});

test('zero votanti non fa dividere per zero', () => {
  assert.equal(consenso(conta([['a']]), 0).size, 0);
});

test('un punto per ogni nome giusto', () => {
  const e = confronta(['a', 'b', 'c'], ['a', 'b', 'z']);
  assert.deepEqual(e.azzeccati, ['a', 'b']);
  assert.deepEqual(e.sbagliati, ['c']);
  assert.equal(e.punti, 2);
  assert.equal(e.pieno, false);
});

test('undici su undici prende il bonus', () => {
  const e = confronta(XI(11), XI(11));
  assert.equal(e.pieno, true);
  assert.equal(e.punti, 11 + BONUS_PIENO);
});

test('dieci su undici non prende il bonus', () => {
  const mia = [...XI(10), 'sbagliato'];
  const e = confronta(mia, XI(11));
  assert.equal(e.punti, 10);
  assert.equal(e.pieno, false);
});

test('formazione ufficiale incompleta: niente bonus', () => {
  const e = confronta(XI(11), XI(11).slice(0, 9));
  assert.equal(e.pieno, false);
});

test('la striscia conta le giornate di fila dall ultima', () => {
  assert.equal(striscia(['g1', 'g2', 'g3'], ['g1', 'g2', 'g3']), 3);
  assert.equal(striscia(['g1', 'g2', 'g3'], ['g2', 'g3']), 2);
  assert.equal(striscia(['g1', 'g2', 'g3'], ['g1', 'g3']), 1);
});

test('saltare l ultima giornata azzera la striscia', () => {
  assert.equal(striscia(['g1', 'g2', 'g3'], ['g1', 'g2']), 0);
});

test('nessuna giornata giocata, nessuna striscia', () => {
  assert.equal(striscia([], ['g1']), 0);
});

test('da due giornate in su la striscia vale un avviso', () => {
  assert.equal(stricciaARischio(1), false);
  assert.equal(stricciaARischio(2), true);
});
