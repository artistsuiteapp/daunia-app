import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { outcome, scorePrediction } from '../lib/prediction-score.ts';

test('risultato esatto: tre punti', () => {
  assert.equal(scorePrediction([2, 1], { home: 2, away: 1 }), 3);
  assert.equal(scorePrediction([0, 0], { home: 0, away: 0 }), 3);
  assert.equal(scorePrediction([1, 3], { home: 1, away: 3 }), 3);
});

test('esito giusto e punteggio sbagliato: un punto', () => {
  assert.equal(scorePrediction([2, 1], { home: 3, away: 0 }), 1);
  assert.equal(scorePrediction([0, 1], { home: 1, away: 4 }), 1);
});

// e il caso che aveva il testo sbagliato: "azzecchi chi vince" non lo copriva,
// perche in un pareggio non vince nessuno eppure il punto si prende
test('pareggio previsto e pareggio uscito, punteggi diversi: un punto', () => {
  assert.equal(scorePrediction([1, 1], { home: 2, away: 2 }), 1);
  assert.equal(scorePrediction([0, 0], { home: 3, away: 3 }), 1);
});

test('esito sbagliato: zero', () => {
  assert.equal(scorePrediction([2, 1], { home: 1, away: 2 }), 0);
  assert.equal(scorePrediction([1, 1], { home: 2, away: 0 }), 0);
  assert.equal(scorePrediction([2, 0], { home: 1, away: 1 }), 0);
});

test('un pareggio vale zero da entrambe le parti', () => {
  assert.equal(outcome(1, 1), 0);
  assert.equal(outcome(4, 4), 0);
  assert.equal(outcome(2, 1), 1);
  assert.equal(outcome(1, 2), -1);
});
