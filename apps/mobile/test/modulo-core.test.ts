import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  righeDelModulo, larghezze, altezze, inOrdine, postiDelModulo, pesoRuolo,
} from '../lib/modulo-core.ts';

/*
 * La disposizione in campo.
 *
 * Il bug che questi test impediscono: per Foggia-Cerignola la Lega elencava sei
 * "Difensore", tre "Centrocampista" e un "Attaccante", ma il modulo era
 * 4-2-3-1. Raggruppando per ruolo uscivano sei uomini in difesa.
 */

test('legge le righe di un modulo', () => {
  assert.deepEqual(righeDelModulo('4-2-3-1'), [4, 2, 3, 1]);
  assert.deepEqual(righeDelModulo('5-4-1'), [5, 4, 1]);
  assert.deepEqual(righeDelModulo('3-5-2'), [3, 5, 2]);
  assert.deepEqual(righeDelModulo('4-4-2'), [4, 4, 2]);
});

test('un modulo che non somma dieci non e un modulo', () => {
  // il portiere non entra nel conto: 4+4+3 sono undici di movimento
  assert.equal(righeDelModulo('4-4-3'), null);
  assert.equal(righeDelModulo('4-3'), null);
  assert.equal(righeDelModulo(''), null);
  assert.equal(righeDelModulo(null), null);
  assert.equal(righeDelModulo('modulo sconosciuto'), null);
});

test('le righe si allargano al crescere degli uomini', () => {
  assert.deepEqual(larghezze(1), [50]);
  const tre = larghezze(3);
  const cinque = larghezze(5);
  assert.equal(tre.length, 3);
  assert.equal(cinque.length, 5);
  // una difesa a cinque tocca le fasce piu di un tridente
  assert.ok(cinque[0] < tre[0], 'cinque uomini devono stare piu larghi');
  // simmetriche attorno al centro
  assert.equal(tre[0] + tre[2], 100);
  assert.equal(cinque[0] + cinque[4], 100);
});

test('le righe si distribuiscono dal centrocampo all attacco', () => {
  const quattro = altezze(4);
  assert.equal(quattro.length, 4);
  for (let i = 1; i < quattro.length; i++) {
    assert.ok(quattro[i] > quattro[i - 1], 'ogni riga deve stare davanti alla precedente');
  }
  assert.ok(quattro[0] > 4, 'nessuna riga sopra il portiere');
  assert.ok(quattro[3] <= 90, 'nessuno fuori dal campo');
});

test('ordina dal piu arretrato al piu avanzato', () => {
  const g = [
    { nome: 'punta', ruolo: 'Attaccante' },
    { nome: 'terzino', ruolo: 'Difensore' },
    { nome: 'mediano', ruolo: 'Centrocampista' },
  ];
  assert.deepEqual(inOrdine(g).map((x) => x.nome), ['terzino', 'mediano', 'punta']);
});

test('a parita di ruolo vince l ordine dell elenco', () => {
  const g = [
    { nome: 'primo', ruolo: 'Difensore' },
    { nome: 'secondo', ruolo: 'Difensore' },
    { nome: 'terzo', ruolo: 'Difensore' },
  ];
  assert.deepEqual(inOrdine(g).map((x) => x.nome), ['primo', 'secondo', 'terzo']);
});

test('un ruolo sconosciuto finisce a centrocampo, non in porta', () => {
  assert.equal(pesoRuolo('Ala tornante'), 2);
  assert.equal(pesoRuolo(null), 2);
  assert.equal(pesoRuolo('Portiere'), 0);
});

test('il caso vero: 4-2-3-1 mette quattro in difesa, non sei', () => {
  const posti = postiDelModulo('4-2-3-1', 11);
  assert.equal(posti.length, 11);
  assert.deepEqual(posti[0], { x: 50, y: 4 }, 'il primo posto e il portiere');

  const perRiga = new Map<number, number>();
  for (const p of posti.slice(1)) perRiga.set(p.y, (perRiga.get(p.y) ?? 0) + 1);
  assert.deepEqual([...perRiga.values()], [4, 2, 3, 1]);
});

test('il 5-4-1 del Cerignola', () => {
  const posti = postiDelModulo('5-4-1', 11);
  const perRiga = new Map<number, number>();
  for (const p of posti.slice(1)) perRiga.set(p.y, (perRiga.get(p.y) ?? 0) + 1);
  assert.deepEqual([...perRiga.values()], [5, 4, 1]);
});

test('modulo illeggibile: si ripiega, non si esplode', () => {
  const posti = postiDelModulo('boh', 11);
  assert.equal(posti.length, 11);
  const perRiga = new Map<number, number>();
  for (const p of posti.slice(1)) perRiga.set(p.y, (perRiga.get(p.y) ?? 0) + 1);
  assert.deepEqual([...perRiga.values()], [4, 3, 3]);
});

test('modulo che non combacia con gli uomini in campo: si ripiega', () => {
  // dieci in campo ma il modulo ne vuole dieci di movimento: non torna
  const posti = postiDelModulo('4-2-3-1', 10);
  assert.equal(posti.length, 11, 'la disposizione di ripiego resta completa');
});
