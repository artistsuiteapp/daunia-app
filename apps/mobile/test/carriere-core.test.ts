import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

import { indicizza, minutiAPartita, normalizzaNome, dataLeggibile, type Archivio } from '../lib/carriere-core.ts';

const archivio = JSON.parse(readFileSync(new URL('../../../data/carriere.json', import.meta.url), 'utf8')) as Archivio;
const squad = JSON.parse(readFileSync(new URL('../../../data/squad.json', import.meta.url), 'utf8')) as Array<{ name: string }>;
const indice = indicizza(archivio);

test('la rosa attuale si aggancia all archivio', () => {
  // se questo numero scende, un nome e cambiato e va sistemato in
  // carriere-core.ts, non nella schermata
  const agganciati = squad.filter((p) => indice.carrieraDi(p.name) || indice.anagraficaDi(p.name));
  assert.ok(agganciati.length >= 24, `agganciati solo ${agganciati.length} su ${squad.length}`);
});

test('i numeri stanno in piedi da soli', () => {
  for (const c of indice.piuPresenti(40)) {
    assert.equal(c.stagioni.reduce((n, s) => n + s.p, 0), c.presenze, c.nome);
    assert.equal(c.stagioni.reduce((n, s) => n + s.m, 0), c.minuti, c.nome);
    // nessuno gioca piu di 120 minuti a partita, nemmeno con i supplementari.
    // E il controllo che ha preso la colonna sbagliata la prima volta.
    if (c.presenze >= 5) {
      assert.ok(c.minuti / c.presenze <= 120, `${c.nome}: ${c.minuti} minuti in ${c.presenze} partite`);
    }
  }
});

test('il piu presente di sempre e in cima', () => {
  const primo = indice.piuPresenti(1)[0]!;
  assert.ok(primo.presenze > 200, `il primo ha solo ${primo.presenze} presenze`);
});

test('minutiAPartita tace quando le partite sono troppo poche', () => {
  const finto = { idTm: null, nome: 'x', ruolo: '', gol: 0, stagioni: [] };
  assert.equal(minutiAPartita({ ...finto, presenze: 3, minuti: 270 }), null);
  assert.equal(minutiAPartita({ ...finto, presenze: 10, minuti: 900 }), 90);
});

test('il nome si normalizza uguale con accenti e senza', () => {
  assert.equal(normalizzaNome('Álex Sánchez'), normalizzaNome('Alex Sanchez'));
  assert.equal(normalizzaNome('  Isyakha   Touré '), 'isyakha toure');
});

test('la fonte e dichiarata insieme ai numeri', () => {
  assert.match(indice.fonte.presoIl, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(indice.fonte.nome, 'Transfermarkt');
});

test('la data della lettura si legge con l anno', () => {
  assert.equal(dataLeggibile('2026-09-11'), '11 settembre 2026');
  assert.equal(dataLeggibile('storta'), 'storta');
});
