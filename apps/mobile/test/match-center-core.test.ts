import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  faseDi, pronosticoAperto, mancaAl, livelloDi, alProssimoLivello, LIVELLI,
} from '../lib/match-center-core.ts';

const CALCIO_INIZIO = '2026-09-12T16:00:00.000Z';
const t = (iso: string) => Date.parse(iso);

test('prima del fischio si sta nella fase prima', () => {
  assert.equal(faseDi({ kickoff: CALCIO_INIZIO }, null, t('2026-09-12T12:00:00Z')), 'prima');
});

test('con i dati dal vivo si e in partita', () => {
  assert.equal(faseDi({ kickoff: CALCIO_INIZIO }, { stato: '1H', finita: false }, t('2026-09-12T16:20:00Z')), 'live');
});

test('HT e intervallo, non partita in corso', () => {
  assert.equal(faseDi({ kickoff: CALCIO_INIZIO }, { stato: 'HT', finita: false }, t('2026-09-12T16:50:00Z')), 'intervallo');
});

test('finita batte tutto il resto', () => {
  // lo stato puo restare indietro: se la fonte dice finita, e finita
  assert.equal(faseDi({ kickoff: CALCIO_INIZIO }, { stato: '2H', finita: true }, t('2026-09-12T17:50:00Z')), 'post');
  assert.equal(faseDi({ kickoff: CALCIO_INIZIO, status: 'finished' }, null, t('2026-09-12T17:50:00Z')), 'post');
});

test('senza dati dal vivo, dal fischio in poi si considera in corso', () => {
  assert.equal(faseDi({ kickoff: CALCIO_INIZIO }, null, t('2026-09-12T16:30:00Z')), 'live');
});

test('dopo tre ore senza notizie la partita e finita lo stesso', () => {
  // se no una gara di cui la fonte ha smesso di parlare resta "sta per
  // cominciare" per sempre
  assert.equal(faseDi({ kickoff: CALCIO_INIZIO }, null, t('2026-09-12T20:30:00Z')), 'post');
});

test('senza partita non si inventa niente', () => {
  assert.equal(faseDi(null, null), 'prima');
  assert.equal(faseDi({ kickoff: null }, null), 'prima');
});

test('il pronostico si chiude al fischio', () => {
  assert.equal(pronosticoAperto({ kickoff: CALCIO_INIZIO }, t('2026-09-12T15:59:00Z')), true);
  assert.equal(pronosticoAperto({ kickoff: CALCIO_INIZIO }, t('2026-09-12T16:00:01Z')), false);
  assert.equal(pronosticoAperto({ kickoff: null }), false);
});

test('mancaAl conta in avanti e all indietro', () => {
  assert.equal(mancaAl(CALCIO_INIZIO, t('2026-09-12T15:00:00Z')), 60 * 60 * 1000);
  assert.ok((mancaAl(CALCIO_INIZIO, t('2026-09-12T17:00:00Z')) ?? 0) < 0);
  assert.equal(mancaAl(null), null);
});

test('i livelli salgono e non scendono', () => {
  assert.equal(livelloDi(0).nome, 'Occasionale');
  assert.equal(livelloDi(249).nome, 'Occasionale');
  assert.equal(livelloDi(250).nome, 'Rossonero');
  assert.equal(livelloDi(2999).nome, 'Ultras');
  assert.equal(livelloDi(100000).nome, 'Leggenda');
});

test('alProssimoLivello tace solo in cima', () => {
  assert.equal(alProssimoLivello(0)?.mancano, 250);
  assert.equal(alProssimoLivello(900)?.livello.nome, 'Ultras');
  assert.equal(alProssimoLivello(5000), null);
});
