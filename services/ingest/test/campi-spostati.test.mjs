import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { applicaCampiSpostati } from '../src/campi-spostati.mjs';

const QUI = path.dirname(fileURLToPath(import.meta.url));

function partita(kickoff, casa, ospite, venue) {
  return { kickoff, home: { shortName: casa }, away: { shortName: ospite }, venue, city: null };
}

test('sposta la partita giusta e lascia stare le altre', () => {
  const partite = [
    partita('2026-09-12T16:00:00.000Z', 'Monopoli', 'Foggia', 'Stadio Vito Simone Veneziani'),
    partita('2026-09-15T19:00:00.000Z', 'Foggia', 'Savoia', 'Stadio Pino Zaccheria'),
  ];
  const avvisi = applicaCampiSpostati(partite, [{
    quando: '2026-09-12', casa: 'Monopoli', ospite: 'Foggia',
    campo: 'Stadio San Nicola', citta: 'Bari', perche: 'il Veneziani non e agibile',
  }]);

  assert.equal(partite[0].venue, 'Stadio San Nicola');
  assert.equal(partite[0].city, 'Bari');
  assert.equal(partite[0].campoSpostato.eraPrevisto, 'Stadio Vito Simone Veneziani');
  assert.equal(partite[1].venue, 'Stadio Pino Zaccheria', 'la giornata dopo non si tocca');
  assert.equal(avvisi.length, 1);
});

test('funziona anche sulla partita appena uscita da Wikipedia', () => {
  // Li' i nomi stanno in homeName/awayName, non in home/away: e' la forma su
  // cui gli spostamenti girano davvero, perche' precedono normalize().
  const partite = [{
    kickoff: '2026-09-12T16:00:00.000Z',
    homeName: 'Monopoli', awayName: 'Foggia',
    venue: 'Stadio Vito Simone Veneziani', city: 'Monopoli',
  }];
  const avvisi = applicaCampiSpostati(partite, [{
    quando: '2026-09-12', casa: 'Monopoli', ospite: 'Foggia',
    campo: 'Stadio San Nicola', citta: 'Bari',
  }]);
  assert.equal(partite[0].venue, 'Stadio San Nicola');
  assert.equal(partite[0].city, 'Bari');
  assert.match(avvisi[0], /da "Stadio Vito Simone Veneziani" a "Stadio San Nicola"/);
});

test('la data e quella italiana, non UTC', () => {
  // Fischio alle 00:30 del 13 in Italia: per UTC e ancora il 12.
  const partite = [partita('2026-09-12T22:30:00.000Z', 'Monopoli', 'Foggia', 'Veneziani')];
  applicaCampiSpostati(partite, [{ quando: '2026-09-13', casa: 'Monopoli', ospite: 'Foggia', campo: 'San Nicola' }]);
  assert.equal(partite[0].venue, 'San Nicola');
});

test('accenti e punteggiatura nei nomi non contano', () => {
  const partite = [partita('2026-09-12T16:00:00.000Z', 'Città di Varese', 'Foggia', 'X')];
  applicaCampiSpostati(partite, [{ quando: '2026-09-12', casa: 'Citta di Varese', ospite: 'Foggia', campo: 'Y' }]);
  assert.equal(partite[0].venue, 'Y');
});

test('una riga che non trova la partita avvisa invece di rompere', () => {
  const partite = [partita('2026-09-12T16:00:00.000Z', 'Monopoli', 'Foggia', 'Veneziani')];
  const avvisi = applicaCampiSpostati(partite, [{ quando: '2026-08-01', casa: 'Monopoli', ospite: 'Foggia', campo: 'Z' }]);
  assert.equal(partite[0].venue, 'Veneziani');
  assert.match(avvisi[0], /nessuna partita corrisponde/);
});

test('ingressi malformati non buttano giu l ingest', () => {
  assert.deepEqual(applicaCampiSpostati(null, []), []);
  assert.deepEqual(applicaCampiSpostati([], null), []);
  const p = [partita('2026-09-12T16:00:00.000Z', 'Monopoli', 'Foggia', 'Veneziani')];
  applicaCampiSpostati(p, [{ quando: '2026-09-12' }]); // senza campo: si salta
  assert.equal(p[0].venue, 'Veneziani');
});

test('il file vero e leggibile e ha i campi che servono', async () => {
  const righe = JSON.parse(await readFile(path.join(QUI, '..', 'campi-spostati.json'), 'utf8'));
  assert.ok(Array.isArray(righe));
  for (const r of righe) {
    assert.match(r.quando, /^\d{4}-\d{2}-\d{2}$/, 'la data va scritta come 2026-09-12');
    assert.ok(r.campo, 'senza campo la riga non fa niente');
    assert.ok(Array.isArray(r.fonti) && r.fonti.length, 'un cambio di stadio senza fonte non si mette');
  }
});
