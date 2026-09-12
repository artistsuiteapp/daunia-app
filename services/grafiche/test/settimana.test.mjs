import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { lunedi, periodo, chiaveIso, disegna } from '../settimana.mjs';

/*
 * Le settimane ISO.
 *
 * Sono la cosa che sembra banale e non lo e: l'anno della settimana non e
 * sempre l'anno della data. Il 1 gennaio 2027 cade di venerdi e appartiene
 * alla settimana 53 del 2026. Se il conto sbaglia, a Capodanno la grafica
 * pesca la classifica della settimana sbagliata e nessuno se ne accorge
 * finche qualcuno non protesta.
 */

const d = (iso) => new Date(iso);

test('il lunedi e il lunedi, anche partendo da domenica', () => {
  assert.equal(lunedi(d('2026-09-11T12:00:00Z')).toISOString().slice(0, 10), '2026-09-07');
  assert.equal(lunedi(d('2026-09-13T23:00:00Z')).toISOString().slice(0, 10), '2026-09-07');
  assert.equal(lunedi(d('2026-09-07T00:00:00Z')).toISOString().slice(0, 10), '2026-09-07');
});

test('la settimana ISO si scrive come nel database', () => {
  assert.match(chiaveIso(d('2026-09-11T12:00:00Z')), /^\d{4}-W\d{2}$/);
  assert.equal(chiaveIso(d('2026-09-07T00:00:00Z')), chiaveIso(d('2026-09-13T23:59:00Z')));
});

test('a cavallo dell anno la settimana resta quella giusta', () => {
  // il 1 gennaio 2027 e venerdi: settimana 53 del 2026
  assert.equal(chiaveIso(d('2027-01-01T12:00:00Z')), '2026-W53');
  // il 4 gennaio 2027 e lunedi: prima settimana del 2027
  assert.equal(chiaveIso(d('2027-01-04T12:00:00Z')), '2027-W01');
});

test('il periodo si legge in italiano, anche a cavallo di due mesi', () => {
  assert.equal(periodo(d('2026-09-11T12:00:00Z')).etichetta, '7–13 settembre');
  assert.equal(periodo(d('2026-09-02T12:00:00Z')).etichetta, '31 agosto – 6 settembre');
});

test('la grafica ha la misura delle storie e non sfora in basso', () => {
  const svg = disegna({
    classifica: [
      { posizione: 1, nome: 'Anna', punti: 100 },
      { posizione: 2, nome: 'Beppe', punti: 80 },
      { posizione: 3, nome: 'Carla', punti: 60 },
      { posizione: 4, nome: 'Dario', punti: 40 },
      { posizione: 5, nome: 'Elena', punti: 20 },
    ],
    strisce: [{ nome: 'Anna', striscia: 4 }, { nome: 'Beppe', striscia: 3 }],
    periodo: periodo(d('2026-09-11T12:00:00Z')),
  });

  assert.match(svg, /width="1080" height="1920"/);

  // niente deve finire sotto il piede: li sopra ci va l'interfaccia di Instagram
  const fondi = [...svg.matchAll(/<rect x="80" y="(\d+)" width="920" height="(\d+)"/g)]
    .map((m) => Number(m[1]) + Number(m[2]));
  assert.ok(Math.max(...fondi) <= 1560, `il contenuto arriva a ${Math.max(...fondi)}`);
});

test('senza nessuno si dice, invece di disegnare una classifica vuota', () => {
  const svg = disegna({ classifica: [], strisce: [], periodo: periodo(d('2026-09-11T12:00:00Z')) });
  assert.match(svg, /non ha giocato nessuno/);
});
