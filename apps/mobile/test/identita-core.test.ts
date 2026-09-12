import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { tintaNome } from '../lib/identita-core.ts';
import { LIVELLI } from '../lib/match-center-core.ts';

/*
 * Il colore di un nome e una promessa: se cambia da una schermata all'altra,
 * chi legge smette di fidarsi di quello che vede.
 */

test('admin sempre rosso, anche a zero punti', () => {
  assert.equal(tintaNome('admin', 0).colore, '#FF3B3B');
  assert.equal(tintaNome('admin', 99999).colore, '#FF3B3B');
  assert.equal(tintaNome('admin', 0).etichetta, 'Admin');
});

test('il ruolo vince sul livello', () => {
  const leggenda = LIVELLI[LIVELLI.length - 1]!;
  assert.notEqual(tintaNome('admin', leggenda.soglia).colore, leggenda.colore);
  assert.notEqual(tintaNome('moderatore', leggenda.soglia).colore, leggenda.colore);
});

test('admin e moderatore si distinguono a colpo d’occhio', () => {
  const a = tintaNome('admin', 0);
  const m = tintaNome('moderatore', 0);
  assert.notEqual(a.colore, m.colore);
  assert.notEqual(a.spilletta, m.spilletta);
});

test('un utente prende il colore del suo livello', () => {
  for (const l of LIVELLI) {
    assert.equal(tintaNome('utente', l.soglia).colore, l.colore);
    assert.equal(tintaNome('utente', l.soglia).etichetta, l.nome);
  }
});

test('senza punti noti il nome resta bianco invece di fingere un livello', () => {
  const t = tintaNome('utente', null);
  assert.equal(t.colore, '#FFFFFF');
  assert.equal(t.etichetta, null);
  assert.equal(t.spilletta, null);
});

test('nessuno tranne chi modera porta la spilletta', () => {
  assert.equal(tintaNome('utente', 5000).spilletta, null);
  assert.equal(tintaNome('anonimo', 0).spilletta, null);
});
