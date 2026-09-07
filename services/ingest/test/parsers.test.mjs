/**
 * Test sui parser, su snapshot reali salvati in __fixtures__.
 * Gira senza rete e senza dipendenze: `node --test services/ingest/test/`
 *
 * Se Wikipedia cambia la struttura delle pagine, questi test si rompono prima
 * che si rompa l'app.
 */
import { test, describe } from 'node:test';
import { porta } from '../src/sources/apifootball.mjs';
import { classifica, chiave } from '../src/sources/divieti.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseSquad, parseMatches, parseStandings } from '../src/sources/wikipedia.mjs';
import { buildKickoff, parseMatchday, plain, templateParams, extractTemplates } from '../src/sources/wikitext.mjs';
import { teamKey, slugify, stripHtml } from '../src/util.mjs';
import { makeTeamResolver } from '../src/team-resolver.mjs';
import { buildStadium, ZACCHERIA_CAPACITY } from '../src/stadium.mjs';
import { buildTickets, deriveStats } from '../src/derive.mjs';
import { parseTeamStats, parseTrend } from '../src/sources/wikipedia.mjs';

const fixture = (n) => readFileSync(new URL(`../__fixtures__/${n}`, import.meta.url), 'utf8');
const CLUB = fixture('club-season.wikitext');
const TABLE = fixture('standings.wikitext');

describe('wikitext', () => {
  test('estrae i template contando le graffe annidate', () => {
    const wt = '{{A|x={{B|1}}|y=2}} coda {{A|z=3}}';
    const found = extractTemplates(wt, 'A');
    assert.equal(found.length, 2);
    assert.equal(templateParams(found[0].block).x, '{{B|1}}');
    assert.equal(templateParams(found[0].block).y, '2');
  });

  test('non spezza i parametri sulle pipe dentro i wikilink', () => {
    const p = templateParams('{{X|nome=[[Mario Rossi (calciatore)|Rossi]]|n=9}}');
    assert.equal(p.n, '9');
    assert.equal(plain(p.nome), 'Rossi');
  });

  test('costruisce la data con il fuso dichiarato', () => {
    assert.equal(buildKickoff('24 agosto', '2026', '21:00 CEST'), '2026-08-24T19:00:00.000Z');
    assert.equal(buildKickoff('12 gennaio', '2027', '14:30 CET'), '2027-01-12T13:30:00.000Z');
  });

  test('data assente restituisce null invece di una data inventata', () => {
    assert.equal(buildKickoff('', '2026', '15:00'), null);
    assert.equal(buildKickoff('30 mesenoto', '2026', '15:00'), null);
  });

  test('legge il numero di giornata', () => {
    assert.equal(parseMatchday('1ª giornata'), 1);
    assert.equal(parseMatchday('16º turno'), 16);
    assert.equal(parseMatchday('Primo turno'), null);
  });
});

describe('rosa', () => {
  const squad = parseSquad(CLUB);

  test('trova una rosa plausibile', () => {
    assert.ok(squad.length >= 20, `solo ${squad.length} giocatori`);
    assert.ok(squad.length <= 40);
  });

  test('ogni giocatore ha nome e ruolo valido', () => {
    for (const p of squad) {
      assert.ok(p.name.length > 2, `nome sospetto: ${p.name}`);
      assert.ok(p.role === null || ['P', 'D', 'C', 'A'].includes(p.role), `ruolo ${p.role}`);
      assert.ok(p.number === null || (p.number > 0 && p.number < 100), `numero ${p.number}`);
    }
  });

  test('scioglie i wikilink nei nomi', () => {
    assert.ok(squad.every((p) => !p.name.includes('[[')), 'wikilink non sciolto');
    assert.ok(squad.every((p) => !p.name.includes('|')), 'pipe residua nel nome');
  });

  test('i numeri di maglia non si ripetono fra i giocatori in rosa', () => {
    const nums = squad.filter((p) => p.number && !p.onLoan).map((p) => p.number);
    assert.equal(new Set(nums).size, nums.length, 'numero di maglia duplicato');
  });
});

describe('partite', () => {
  const warnings = [];
  const matches = parseMatches(CLUB, { season: '2026-2027', competition: 'Serie C', warnings });

  test('trova il calendario completo', () => {
    assert.ok(matches.length >= 30, `solo ${matches.length} partite`);
  });

  test('il Foggia compare in ogni partita', () => {
    for (const m of matches) {
      const has = /foggia/i.test(`${m.homeName} ${m.awayName}`);
      assert.ok(has, `partita senza Foggia: ${m.homeName}-${m.awayName}`);
    }
  });

  test('foggiaHome corrisponde alla squadra di casa', () => {
    for (const m of matches) {
      assert.equal(m.foggiaHome, /foggia/i.test(m.homeName), `${m.homeName}-${m.awayName}`);
    }
  });

  test('una partita finita ha punteggio, una da giocare no', () => {
    for (const m of matches) {
      if (m.status === 'finished') assert.ok(m.score, `${m.id} finita senza punteggio`);
      else assert.equal(m.score, null, `${m.id} non finita ma con punteggio`);
    }
  });

  test('il risultato dal punto di vista del Foggia e coerente col punteggio', () => {
    for (const m of matches.filter((x) => x.score)) {
      const mine = m.foggiaHome ? m.score.home : m.score.away;
      const theirs = m.foggiaHome ? m.score.away : m.score.home;
      const expected = mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
      assert.equal(m.foggiaResult, expected, `${m.homeName}-${m.awayName}`);
    }
  });

  test('il numero di gol registrati corrisponde al punteggio', () => {
    for (const m of matches.filter((x) => x.score && x.goals.length)) {
      const home = m.goals.filter((g) => g.side === 'home').length;
      const away = m.goals.filter((g) => g.side === 'away').length;
      assert.equal(home, m.score.home, `gol casa ${m.homeName}-${m.awayName}`);
      assert.equal(away, m.score.away, `gol trasferta ${m.homeName}-${m.awayName}`);
    }
  });

  test('i marcatori hanno un nome vero, non un residuo di markup', () => {
    for (const m of matches) {
      for (const g of m.goals) {
        assert.ok(g.scorer.length > 1, `marcatore vuoto in ${m.id}`);
        assert.ok(!/[{}[\]|]/.test(g.scorer), `markup nel marcatore: ${g.scorer}`);
        assert.ok(g.minute > 0 && g.minute <= 120, `minuto ${g.minute}`);
      }
    }
  });

  test('zero spettatori resta zero e non diventa dato mancante', () => {
    const closedDoors = matches.filter((m) => m.attendance === 0);
    assert.ok(closedDoors.length >= 1, 'nessuna partita a porte chiuse riconosciuta');
    for (const m of matches) {
      assert.ok(m.attendance === null || m.attendance >= 0, `spettatori ${m.attendance}`);
    }
  });

  test('la Coppa Italia e separata dal campionato dalla sezione, non dal testo', () => {
    const coppa = matches.filter((m) => /coppa/i.test(m.competition));
    assert.ok(coppa.length >= 1, 'nessuna partita di coppa riconosciuta');
    assert.ok(matches.some((m) => m.competition === 'Serie C'), 'nessuna partita di campionato');
  });

  test('le date fuori stagione vengono corrette e segnalate', () => {
    const window = { from: Date.UTC(2026, 6, 1), to: Date.UTC(2027, 5, 30) };
    for (const m of matches.filter((x) => x.kickoff)) {
      const t = Date.parse(m.kickoff);
      assert.ok(t >= window.from && t <= window.to, `${m.id} fuori stagione: ${m.kickoff}`);
    }
    assert.ok(warnings.some((w) => /Anno corretto/.test(w)), 'la correzione non e stata segnalata');
  });
});

describe('classifica', () => {
  const rows = parseStandings(TABLE);

  test('venti squadre, posizioni da 1 a 20 senza buchi', () => {
    assert.equal(rows.length, 20);
    assert.deepEqual(rows.map((r) => r.position), Array.from({ length: 20 }, (_, i) => i + 1));
  });

  test('giocate uguale vinte piu pareggiate piu perse', () => {
    for (const r of rows) {
      assert.equal(r.won + r.drawn + r.lost, r.played, `${r.teamName}`);
    }
  });

  test('i punti tornano contando la penalizzazione', () => {
    for (const r of rows) {
      assert.equal(r.points, r.won * 3 + r.drawn + r.penalty, `${r.teamName}`);
    }
  });

  test('riconosce una penalizzazione reale', () => {
    assert.ok(rows.some((r) => r.penalty < 0), 'nessuna penalizzazione rilevata');
  });

  test('la differenza reti torna', () => {
    for (const r of rows) assert.equal(r.goalDiff, r.goalsFor - r.goalsAgainst, `${r.teamName}`);
  });

  test('il Foggia e in classifica', () => {
    assert.ok(rows.some((r) => /foggia/i.test(r.teamName)));
  });
});

describe('incrocio fra le due fonti', () => {
  const teams = new Map([
    ['foggia', { id: 'foggia', name: 'CALCIO FOGGIA 1920', shortName: 'Foggia', crest: 'x', isFoggia: true }],
    ['audace-cerignola', { id: 'audace-cerignola', name: 'AUDACE CERIGNOLA', shortName: 'Audace Cerignola', crest: 'x', isFoggia: false }],
    ['az-picerno', { id: 'az-picerno', name: 'AZ PICERNO', shortName: 'AZ Picerno', crest: 'x', isFoggia: false }],
    ['monopoli', { id: 'monopoli', name: 'SS MONOPOLI 1966', shortName: 'Monopoli', crest: 'x', isFoggia: false }],
  ]);
  const resolve = makeTeamResolver(teams);

  test('nomi lunghi e corti si incrociano', () => {
    assert.equal(resolve('Cerignola')?.id, 'audace-cerignola');
    assert.equal(resolve('Picerno')?.id, 'az-picerno');
    assert.equal(resolve('Foggia')?.id, 'foggia');
    assert.equal(resolve('SS MONOPOLI 1966')?.id, 'monopoli');
  });

  test('una squadra sconosciuta resta null invece di agganciarsi alla sbagliata', () => {
    assert.equal(resolve('Barletta'), null);
    assert.equal(resolve('Inter U23'), null);
  });

  test('la normalizzazione toglie forme societarie e anni', () => {
    assert.equal(teamKey('US SALERNITANA 1919'), teamKey('Salernitana'));
    assert.equal(teamKey('ATALANTA BC U23'), teamKey('Atalanta U23'));
  });
});

describe('stadio', () => {
  const stadium = buildStadium({ id: 'x', homeName: 'Foggia', awayName: 'Cerignola' }, null);

  test('le capienze dei settori sommano alla capienza dichiarata', () => {
    const sum = stadium.sectors.reduce((a, s) => a + s.capacity, 0);
    assert.equal(sum, ZACCHERIA_CAPACITY);
  });

  test('i settori dello stesso lato non si sovrappongono', () => {
    for (const side of ['north', 'south', 'east', 'west']) {
      const spans = stadium.sectors
        .filter((s) => s.side === side)
        .map((s) => {
          const c = s.geometry.shift ?? 0;
          return [c - s.geometry.length / 2, c + s.geometry.length / 2];
        })
        .sort((a, b) => a[0] - b[0]);
      for (let i = 1; i < spans.length; i++) {
        assert.ok(spans[i][0] >= spans[i - 1][1] - 0.01, `sovrapposizione sul lato ${side}`);
      }
    }
  });

  test('il riempimento simulato e deterministico e nel range valido', () => {
    const a = buildStadium({ id: 'm1', homeName: 'Foggia', awayName: 'Cerignola' }, null);
    const b = buildStadium({ id: 'm1', homeName: 'Foggia', awayName: 'Cerignola' }, null);
    for (let i = 0; i < a.sectors.length; i++) {
      assert.equal(a.sectors[i].occupancy, b.sectors[i].occupancy, 'riempimento non deterministico');
      assert.ok(a.sectors[i].occupancy > 0 && a.sectors[i].occupancy < 1);
      assert.equal(a.sectors[i].occupancyIsSimulated, true, 'il dato simulato deve essere dichiarato');
    }
  });

  test('senza partita non si inventa un riempimento', () => {
    const empty = buildStadium(null, null);
    assert.ok(empty.sectors.every((s) => s.occupancy === null));
  });
});

describe('statistiche di squadra', () => {
  const comps = parseTeamStats(CLUB);

  test('trova almeno il campionato', () => {
    assert.ok(comps.length >= 1);
    assert.ok(comps.some((c) => /serie c/i.test(c.competition)));
  });

  test('casa e trasferta hanno numeri non negativi', () => {
    for (const c of comps) {
      for (const side of [c.home, c.away]) {
        for (const k of ['won', 'drawn', 'lost', 'goalsFor', 'goalsAgainst']) {
          assert.ok(Number.isInteger(side[k]) && side[k] >= 0, `${c.competition} ${k}=${side[k]}`);
        }
      }
    }
  });
});

describe('andamento stagionale', () => {
  const trend = parseTrend(CLUB);

  test('copre tutte le giornate del girone', () => {
    assert.ok(trend.length >= 30, `solo ${trend.length} giornate`);
    assert.deepEqual(trend.map((t) => t.matchday), trend.map((_, i) => i + 1));
  });

  test('luogo e risultato usano i valori attesi', () => {
    for (const t of trend) {
      assert.ok(t.venue === null || t.venue === 'home' || t.venue === 'away', `luogo ${t.venue}`);
      assert.ok(t.result === null || ['W', 'D', 'L'].includes(t.result), `risultato ${t.result}`);
      assert.ok(t.position === null || (t.position >= 1 && t.position <= 20), `posizione ${t.position}`);
    }
  });

  test('una giornata con posizione ha anche un risultato', () => {
    for (const t of trend) {
      if (t.position !== null) assert.notEqual(t.result, null, `g${t.matchday} ha posizione ma non risultato`);
    }
  });
});

describe('statistiche ricavate', () => {
  const matches = [
    {
      status: 'finished', foggiaHome: true, score: { home: 2, away: 0 },
      home: { shortName: 'Foggia' }, away: { shortName: 'Tizio' }, attendance: 5000,
      goals: [
        { minute: 10, extra: null, side: 'home', scorer: 'Rossi', ownGoal: false },
        { minute: 80, extra: null, side: 'home', scorer: 'Rossi', ownGoal: false },
      ],
    },
    {
      status: 'finished', foggiaHome: false, score: { home: 3, away: 0 },
      home: { shortName: 'Caio' }, away: { shortName: 'Foggia' }, attendance: null,
      goals: [
        { minute: 20, extra: null, side: 'home', scorer: 'Bianchi', ownGoal: false },
        { minute: 50, extra: null, side: 'home', scorer: 'Bianchi', ownGoal: false },
        { minute: 90, extra: 3, side: 'home', scorer: 'Verdi', ownGoal: false },
      ],
    },
    { status: 'scheduled', foggiaHome: true, score: null, home: {}, away: {}, goals: [], attendance: null },
  ];
  const d = deriveStats(matches, [{ position: 4 }, { position: 9 }]);

  test('conta solo le partite giocate', () => {
    assert.equal(d.played, 2);
  });

  test('gol fatti e subiti dal punto di vista del Foggia', () => {
    assert.equal(d.goalsFor, 2);
    assert.equal(d.goalsAgainst, 3);
  });

  test('porta inviolata e partite senza segnare', () => {
    assert.equal(d.cleanSheets, 1);
    assert.equal(d.failedToScore, 1);
  });

  test('i marcatori escludono i gol avversari', () => {
    assert.deepEqual(d.scorers, [{ name: 'Rossi', goals: 2 }]);
  });

  test('il recupero finisce nell ultima fascia', () => {
    const last = d.byWindow[d.byWindow.length - 1];
    assert.equal(last.conceded, 1, 'il 90+3 doveva cadere in 76-90');
  });

  test('migliore e peggiore posizione', () => {
    assert.equal(d.bestPosition, 4);
    assert.equal(d.worstPosition, 9);
  });

  test('la media spettatori ignora le partite senza dato', () => {
    assert.equal(d.homeAttendanceAvg, 5000);
  });
});

describe('biglietti', () => {
  const stadium = buildStadium({ id: 'm', homeName: 'Foggia', awayName: 'Tizio' }, null);
  const offers = buildTickets(stadium);

  test('un offerta per settore', () => {
    assert.equal(offers.length, stadium.sectors.length);
  });

  /*
   * Questi tre test dicono cosa NON deve tornare.
   *
   * Prima ce n'erano due che verificavano che i disponibili stessero dentro la
   * capienza e che il ridotto costasse meno dell'intero: numeri coerenti fra
   * loro e inventati tutti e due. La coerenza di un dato falso non lo rende
   * vero, e quei test proteggevano proprio quello che andava tolto.
   */
  test('nessun prezzo: quelli veri li ha Vivaticket', () => {
    for (const o of offers) {
      assert.equal(o.price, undefined, o.sectorName);
      assert.equal(o.reducedPrice, undefined, o.sectorName);
    }
  });

  test('nessun posto disponibile inventato', () => {
    for (const o of offers) assert.equal(o.available, undefined, o.sectorName);
  });

  test('la capienza resta, e dichiara di essere una stima', () => {
    for (const o of offers) {
      assert.ok(o.capacity > 0, o.sectorName);
      assert.equal(o.capacityIsEstimated, true, o.sectorName);
    }
  });
});

describe('utility', () => {
  test('slugify normalizza accenti e apostrofi', () => {
    assert.equal(slugify("Felice D'Amico"), 'felice-damico');
    assert.equal(slugify('Miroslav Ilicic'), 'miroslav-ilicic');
  });

  test('stripHtml decodifica le entity di WordPress', () => {
    assert.equal(stripHtml('DALL&#8217;ATALANTA ARRIVA <b>ZUCCON</b>'), 'DALL’ATALANTA ARRIVA ZUCCON');
    assert.equal(stripHtml('CLASSIFICA &#8211; GIR. C'), 'CLASSIFICA – GIR. C');
  });
});

/* ------------------------------------------------- divieti di trasferta */


describe('divieti di trasferta', () => {
  /*
   * I titoli qui sotto sono veri, presi dalla stampa che copre il Foggia. Se un
   * giorno smettono di essere riconosciuti vuol dire che il modo di scrivere e
   * cambiato e il riconoscimento va rifatto: e per questo che stanno in un test
   * invece che in un commento.
   */
  test('riconosce il divieto ai residenti dai titoli veri', () => {
    assert.equal(classifica('Cerignola, trasferta vietata per il derby di Foggia')?.stato, 'vietata-residenti');
    assert.equal(classifica('Massimino blindato: trasferta vietata ai tifosi del Foggia per Catania-Foggia')?.stato, 'vietata-residenti');
    assert.equal(classifica('Vietata la vendita dei biglietti ai residenti nella provincia di Foggia')?.stato, 'vietata-residenti');
  });

  test('il settore ospiti chiuso vince sul divieto generico', () => {
    // gli articoli che parlano di settore chiuso spesso dicono anche
    // "trasferta vietata": deve prevalere il caso piu specifico
    const t = 'Foggia-Audace il 6 settembre senza tifosi ospiti: trasferta vietata ai gialloblu';
    assert.equal(classifica(t)?.stato, 'ospiti-chiuso');
  });

  test('riconosce anche il caso buono', () => {
    assert.equal(classifica('Trasferta consentita ai tifosi rossoneri')?.stato, 'aperta');
  });

  test('una notizia qualsiasi non diventa un divieto', () => {
    assert.equal(classifica('Il Foggia vince 2-1 al Zaccheria'), null);
    assert.equal(classifica('Biglietti in vendita per la trasferta di Monopoli'), null);
  });

  test('i nomi delle squadre si incontrano nonostante le sigle', () => {
    assert.equal(chiave('SS MONOPOLI 1966'), 'monopoli');
    assert.equal(chiave('Audace Cerignola'), 'audace cerignola');
    assert.equal(chiave('Inter U23'), 'inter');
    // i punti tenevano insieme la sigla e la facevano sopravvivere
    assert.equal(chiave('A.C. Trapani'), 'trapani');
    assert.equal(chiave('AZ Picerno'), 'az picerno');
  });
});

/*
 * Le due porte di API-Football.
 *
 * Sbagliare l'intestazione non da un errore chiaro: il servizio risponde 403
 * "Missing mandatory HTTP Headers", che sembra un problema di chiave. Meglio
 * accorgersene qui.
 */
test('la porta diretta usa x-apisports-key', () => {
  const p = porta(undefined);
  assert.equal(p.base, 'https://v3.football.api-sports.io');
  assert.deepEqual(p.intestazioni('K'), { 'x-apisports-key': 'K' });
});

test('la porta RapidAPI usa x-rapidapi-key e vuole anche l host', () => {
  const p = porta('rapidapi');
  assert.equal(p.base, 'https://api-football-v1.p.rapidapi.com/v3');
  assert.deepEqual(p.intestazioni('K'), {
    'x-rapidapi-key': 'K',
    'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
  });
});

test('qualunque altro valore resta sulla porta diretta', () => {
  // "diretto", vuoto, un refuso: non deve mai finire per sbaglio su RapidAPI
  for (const v of ['diretto', '', 'rapid', undefined, null]) {
    assert.equal(porta(v).base, 'https://v3.football.api-sports.io');
  }
});
