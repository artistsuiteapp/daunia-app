import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { discordanza, elencoMarcatori, latoDi, minutoOra } from '../lib/tabellone-core.ts';

test('un gol nostro sta a sinistra solo quando giochiamo in casa', () => {
  assert.equal(latoDi(true, true), 'casa');
  assert.equal(latoDi(true, false), 'ospiti');
  assert.equal(latoDi(false, true), 'ospiti');
  assert.equal(latoDi(false, false), 'casa');
});

test('il minuto col recupero diventa un numero', () => {
  assert.equal(minutoOra('45+2'), 47);
  assert.equal(minutoOra('67'), 67);
  assert.equal(minutoOra('90 + 5'), 95);
  assert.equal(minutoOra(null), null);
  assert.equal(minutoOra('HT'), null);
  assert.equal(minutoOra('0'), null);
});

const ROSA = [
  { id: 'a', name: 'Emanuele Saro', shortName: 'Saro', number: 1 },
  { id: 'b', name: 'Nicolo Todisco', shortName: 'Todisco', number: 23 },
  { id: 'c', name: 'Mattia Luciani', shortName: 'Luciani', number: 9 },
  { id: 'd', name: 'Davide Marfella', shortName: 'Marfella', number: 12 },
];

test('in cima all elenco ci sono i titolari di oggi, in ordine di numero', () => {
  const e = elencoMarcatori(ROSA, [
    { numero: 23, nome: 'Todisco' },
    { numero: 1, nome: 'Saro' },
  ]);
  assert.deepEqual(e.slice(0, 2).map((x) => x.nome), ['Saro', 'Todisco']);
  assert.ok(e.slice(0, 2).every((x) => x.inCampo));
  // il resto della rosa viene dopo, e nessuno compare due volte
  assert.deepEqual(e.slice(2).map((x) => x.nome), ['Luciani', 'Marfella']);
  assert.equal(new Set(e.map((x) => x.nome)).size, e.length);
});

test('chi gioca ma non e in rosa nei dati compare lo stesso', () => {
  const e = elencoMarcatori(ROSA, [{ numero: 77, nome: 'Bigonzoni' }]);
  assert.equal(e[0].nome, 'Bigonzoni');
  assert.equal(e[0].id, null);
  assert.equal(e[0].inCampo, true);
});

test('senza formazione si usa tutta la rosa', () => {
  const e = elencoMarcatori(ROSA, null);
  assert.equal(e.length, 4);
  assert.ok(e.every((x) => !x.inCampo));
});

test('la discordanza si dice solo quando c e', () => {
  assert.equal(discordanza({ casa: 1, ospiti: 0 }, { casa: 1, ospiti: 0 }), null);
  assert.equal(discordanza({ casa: 1, ospiti: 0 }, { casa: null, ospiti: null }), null);
  assert.equal(discordanza({ casa: 1, ospiti: 0 }, { casa: 1, ospiti: 1 }), 'Le fonti dicono 1-1');
});
