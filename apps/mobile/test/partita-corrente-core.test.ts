import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { Match, TeamStats } from '@satanelli/core';
import {
  fondi, fondiTutte, ultimaGiocata, leggiMinuto, esitoFoggia, scartoDa, conLaPartitaNuova,
} from '../lib/partita-corrente-core.ts';

/*
 * La finestra fra il triplice fischio e la ripubblicazione del sito.
 *
 * In quei minuti la home legge il dal vivo e le statistiche leggono l'archivio,
 * e dicono cose diverse. Questi test descrivono come si mettono d'accordo.
 */

const partita = (extra: Partial<Match> = {}): Match => ({
  id: 'm1',
  kickoff: '2026-09-12T16:00:00.000Z',
  status: 'scheduled',
  matchday: 3,
  competition: 'Serie C',
  season: '2026-2027',
  home: { id: 'monopoli', name: 'Monopoli', shortName: 'Monopoli', crest: null },
  away: { id: 'foggia', name: 'Foggia', shortName: 'Foggia', crest: null },
  score: null,
  venue: null, city: null, attendance: null, referee: null,
  goals: [],
  foggiaHome: false,
  foggiaResult: null,
  ticketUrl: null, reportUrl: null,
  source: 'wikipedia' as Match['source'],
  ...extra,
});

test('a partita finita il dal vivo scrive punteggio, stato ed esito', () => {
  const m = fondi(partita(), { stato: 'FT', finita: true, casa: 1, ospite: 2 });
  assert.equal(m.status, 'finished');
  assert.deepEqual(m.score, { home: 1, away: 2 });
  // il Foggia gioca fuori: 1-2 e una vittoria
  assert.equal(m.foggiaResult, 'W');
});

test('a partita in corso il punteggio vale lo stesso, l esito no', () => {
  const m = fondi(partita(), { stato: '2H', finita: false, casa: 0, ospite: 1 });
  assert.equal(m.status, 'live');
  assert.deepEqual(m.score, { home: 0, away: 1 });
  assert.equal(m.foggiaResult, null, 'a partita in corso non si dichiara un esito');
});

test('senza dal vivo non si tocca niente', () => {
  const base = partita();
  assert.equal(fondi(base, null), base);
  assert.equal(fondi(base, { stato: 'NS', finita: false, casa: null, ospite: null }), base);
});

test('la cronaca dell archivio batte quella dal vivo', () => {
  /*
   * Quella dell'ingest ha i nomi dei marcatori, quella dal vivo spesso no:
   * sostituirne una completa con una parziale sarebbe un passo indietro.
   */
  const conGol = partita({
    status: 'finished',
    score: { home: 1, away: 2 },
    goals: [{ minute: 12, extra: null, scorer: 'Merdji', side: 'away', ownGoal: false, penalty: false }],
  });
  const m = fondi(conGol, { stato: 'FT', finita: true, casa: 1, ospite: 2 },
    [{ minuto: '12', nostro: true }]);
  assert.equal(m.goals[0]!.scorer, 'Merdji');
  assert.equal(m.goals.length, 1);
});

test('senza cronaca in archivio si prende quella dal vivo, anche senza nomi', () => {
  const m = fondi(partita(), { stato: 'FT', finita: true, casa: 1, ospite: 2 }, [
    { minuto: '23', nostro: true },
    { minuto: '45+2', nostro: false },
    { minuto: '71', chi: 'Ravasio', nostro: true },
  ]);
  assert.equal(m.goals.length, 3);
  // il Foggia gioca fuori: i suoi gol stanno dalla parte degli ospiti
  assert.equal(m.goals[0]!.side, 'away');
  assert.equal(m.goals[1]!.side, 'home');
  assert.deepEqual([m.goals[1]!.minute, m.goals[1]!.extra], [45, 2]);
  assert.equal(m.goals[2]!.scorer, 'Ravasio');
  assert.equal(m.goals[0]!.scorer, '', 'senza nome non si inventa niente');
});

test('si fonde solo la partita che il guardiano sta seguendo', () => {
  const elenco = [partita({ id: 'a' }), partita({ id: 'b' })];
  const fuse = fondiTutte(elenco, 'b', { stato: 'FT', finita: true, casa: 3, ospite: 0 });
  assert.equal(fuse[0]!.status, 'scheduled');
  assert.equal(fuse[1]!.status, 'finished');
});

test('l ultima giocata e la piu recente, non la prima dell elenco', () => {
  const elenco = [
    partita({ id: 'vecchia', kickoff: '2026-08-16T19:00:00.000Z', status: 'finished' }),
    partita({ id: 'nuova', kickoff: '2026-09-06T16:00:00.000Z', status: 'finished' }),
    partita({ id: 'futura', kickoff: '2026-09-12T16:00:00.000Z' }),
  ];
  assert.equal(ultimaGiocata(elenco)?.id, 'nuova');
  assert.equal(ultimaGiocata([]), null);
});

test('leggiMinuto capisce il recupero e si arrende sul resto', () => {
  assert.deepEqual(leggiMinuto('48'), { minuto: 48, extra: null });
  assert.deepEqual(leggiMinuto('45+5'), { minuto: 45, extra: 5 });
  assert.deepEqual(leggiMinuto('90 + 3'), { minuto: 90, extra: 3 });
  assert.deepEqual(leggiMinuto('HT'), { minuto: null, extra: null });
  assert.deepEqual(leggiMinuto(null), { minuto: null, extra: null });
});

test('esitoFoggia guarda da che parte sta il Foggia', () => {
  assert.equal(esitoFoggia(2, 0, true), 'W');
  assert.equal(esitoFoggia(2, 0, false), 'L');
  assert.equal(esitoFoggia(1, 1, true), 'D');
});

/* ----------------------------------------------------- le statistiche */

const stats = (): TeamStats => ({
  competitions: [],
  trend: [],
  derived: {
    played: 4, cleanSheets: 1, failedToScore: 1,
    goalsFor: 3, goalsAgainst: 5, avgGoalsFor: 0.75, avgGoalsAgainst: 1.25,
    biggestWin: 'Crotone 0-1 Foggia', worstLoss: 'Foggia 0-2 Audace Cerignola',
    bestPosition: 6, worstPosition: 10,
    byWindow: [
      { label: "1-15'", scored: 1, conceded: 0 },
      { label: "16-30'", scored: 0, conceded: 1 },
      { label: "76-90'", scored: 0, conceded: 2 },
    ],
    scorers: [{ name: 'Ravasio', goals: 2 }],
    homeAttendanceAvg: null,
  },
});

test('la partita nuova entra nei conti', () => {
  const finita = partita({
    status: 'finished', score: { home: 0, away: 3 },
    goals: [
      { minute: 10, extra: null, scorer: 'Ravasio', side: 'away', ownGoal: false, penalty: false },
      { minute: 20, extra: null, scorer: '', side: 'away', ownGoal: false, penalty: false },
      { minute: 80, extra: null, scorer: 'Merdji', side: 'away', ownGoal: false, penalty: false },
    ],
  });
  const d = conLaPartitaNuova(stats(), finita).derived;

  assert.equal(d.played, 5);
  assert.equal(d.goalsFor, 6);
  assert.equal(d.goalsAgainst, 5);
  assert.equal(d.avgGoalsFor, 1.2);
  assert.equal(d.cleanSheets, 2, 'zero subiti: porta inviolata');
  assert.equal(d.failedToScore, 1, 'ha segnato, quindi non cambia');
  assert.equal(d.biggestWin, 'Monopoli 0-3 Foggia', 'tre di scarto battono uno');
  assert.equal(d.worstLoss, 'Foggia 0-2 Audace Cerignola', 'non e una sconfitta');
});

test('le fasce dei gol seguono il minuto', () => {
  const finita = partita({
    status: 'finished', score: { home: 1, away: 1 },
    goals: [
      { minute: 5, extra: null, scorer: '', side: 'away', ownGoal: false, penalty: false },
      { minute: 88, extra: null, scorer: '', side: 'home', ownGoal: false, penalty: false },
    ],
  });
  const w = conLaPartitaNuova(stats(), finita).derived.byWindow;
  assert.deepEqual(w.find((x) => x.label === "1-15'"), { label: "1-15'", scored: 2, conceded: 0 });
  assert.deepEqual(w.find((x) => x.label === "76-90'"), { label: "76-90'", scored: 0, conceded: 3 });
});

test('i marcatori senza nome non entrano in elenco', () => {
  const finita = partita({
    status: 'finished', score: { home: 0, away: 2 },
    goals: [
      { minute: 10, extra: null, scorer: 'Ravasio', side: 'away', ownGoal: false, penalty: false },
      { minute: 70, extra: null, scorer: '', side: 'away', ownGoal: false, penalty: false },
    ],
  });
  const s = conLaPartitaNuova(stats(), finita).derived.scorers;
  assert.deepEqual(s, [{ name: 'Ravasio', goals: 3 }]);
});

test('una partita non finita non entra nei conti', () => {
  const inCorso = partita({ status: 'live', score: { home: 0, away: 1 } });
  assert.deepEqual(conLaPartitaNuova(stats(), inCorso).derived, stats().derived);
});

test('scartoDa legge il punteggio dall etichetta', () => {
  assert.equal(scartoDa('Crotone 0-1 Foggia'), 1);
  assert.equal(scartoDa('Foggia 3-0 Monopoli'), 3);
  assert.equal(scartoDa(null), null);
});

test('la partita nuova entra anche nel conto per competizione', () => {
  const base = stats();
  base.competitions = [{
    competition: 'Serie C',
    points: null,
    home: { won: 0, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 3 },
    away: { won: 1, drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0 },
  }];

  // Monopoli-Foggia 0-3: il Foggia gioca fuori e vince
  const finita = partita({ status: 'finished', score: { home: 0, away: 3 } });
  const c = conLaPartitaNuova(base, finita).competitions[0]!;

  assert.deepEqual(c.away, { won: 2, drawn: 0, lost: 0, goalsFor: 4, goalsAgainst: 0 });
  assert.deepEqual(c.home, { won: 0, drawn: 1, lost: 1, goalsFor: 1, goalsAgainst: 3 }, 'la casa non si tocca');
});

test('una competizione mai vista si aggiunge invece di sparire', () => {
  const base = stats();
  base.competitions = [];
  const coppa = partita({
    status: 'finished', competition: 'Coppa Italia Serie C',
    foggiaHome: true, score: { home: 1, away: 2 },
  });
  const c = conLaPartitaNuova(base, coppa).competitions;
  assert.equal(c.length, 1);
  assert.equal(c[0]!.competition, 'Coppa Italia Serie C');
  assert.deepEqual(c[0]!.home, { won: 0, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 2 });
});

test('la posizione in classifica non si inventa', () => {
  const finita = partita({ status: 'finished', score: { home: 0, away: 1 } });
  const dopo = conLaPartitaNuova(stats(), finita);
  assert.deepEqual(dopo.trend, stats().trend);
  assert.equal(dopo.derived.bestPosition, 6);
});
