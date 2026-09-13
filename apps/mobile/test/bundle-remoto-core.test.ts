import { test } from 'node:test';
import assert from 'node:assert/strict';

import { daSostituire, istante, valido } from '../lib/bundle-remoto-core.ts';

const buono = (quando: string) => ({
  meta: { generatedAt: quando },
  teams: [{ id: 'foggia' }],
  matches: [{ id: 'm1' }],
  standings: [{ pos: 1 }],
  squad: [{ id: 'p1' }],
  // applicaBundle legge anche questi: se mancano lancia a sostituzione iniziata
  news: [],
  stadium: { name: 'Zaccheria' },
  stats: { trend: [], competitions: [] },
});

test('un bundle completo e valido', () => {
  assert.equal(valido(buono('2026-09-12T17:03:51.555Z')), true);
});

test('la pagina di accesso di una rete wifi non passa per un bundle', () => {
  assert.equal(valido('<html><body>Accedi alla rete</body></html>'), false);
  assert.equal(valido({ errore: 'non trovato' }), false);
  assert.equal(valido(null), false);
});

test('un bundle senza partite viene rifiutato', () => {
  // sintatticamente corretto ma impossibile: un calendario vuoto non esiste
  assert.equal(valido({ ...buono('2026-09-12T00:00:00Z'), matches: [] }), false);
});

test('un bundle troncato a meta viene rifiutato', () => {
  const rotto = buono('2026-09-12T00:00:00Z') as Record<string, unknown>;
  delete rotto.standings;
  assert.equal(valido(rotto), false);
});

test('una data non leggibile non fa data', () => {
  assert.equal(valido(buono('domani')), false);
  assert.equal(istante({ meta: { generatedAt: 'domani' } }), 0);
  assert.equal(istante({}), 0);
});

test('si sostituisce solo con dati piu freschi', () => {
  const ora = Date.parse('2026-09-12T17:00:00Z');
  assert.equal(daSostituire(ora, buono('2026-09-12T18:00:00Z')), true);
  assert.equal(daSostituire(ora, buono('2026-09-12T16:00:00Z')), false);
});

test('a parita di istante non si tocca niente', () => {
  const quando = '2026-09-12T17:00:00Z';
  assert.equal(daSostituire(Date.parse(quando), buono(quando)), false);
});

test('dati mai visti prima si accettano sempre', () => {
  assert.equal(daSostituire(0, buono('2020-01-01T00:00:00Z')), true);
});

test('un bundle non valido non sostituisce niente, anche se dice di essere nuovo', () => {
  // il caso pericoloso: risposta fresca ma vuota. Deve perdere contro dati vecchi e buoni.
  const finto = { meta: { generatedAt: '2030-01-01T00:00:00Z' }, matches: [], teams: [], standings: [], squad: [] };
  assert.equal(daSostituire(Date.parse('2026-01-01T00:00:00Z'), finto), false);
});

test('un bundle datato nel futuro si rifiuta: bloccherebbe per sempre ogni aggiornamento', () => {
  // si accetta solo cio che e piu fresco, quindi un orologio impazzito in avanti
  // verrebbe salvato nel telefono e nessun bundle vero sarebbe mai piu abbastanza nuovo
  const fraDueGiorni = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
  assert.equal(valido(buono(fraDueGiorni)), false);
});

test('un piccolo scarto di orologio si tollera', () => {
  const fraUnOra = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  assert.equal(valido(buono(fraUnOra)), true);
});

test('senza news, stadio o statistiche il bundle non passa', () => {
  for (const campo of ['news', 'stadium', 'stats']) {
    const rotto = buono('2026-09-12T00:00:00Z') as Record<string, unknown>;
    delete rotto[campo];
    assert.equal(valido(rotto), false, `manca ${campo}`);
  }
});
