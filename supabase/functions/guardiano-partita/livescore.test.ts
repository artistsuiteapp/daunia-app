import test from 'node:test';
import assert from 'node:assert/strict';

import { travesti, travestiTutti, eLaNostra, eventiDi, trovaPartita, CASA, OSPITI } from './livescore.ts';
import { golVero, contaGol, cronologia, cartelliniECambi } from './punteggio.ts';

/*
 * Il punto di questi test non e' il travestimento in se': e' che quello che
 * sta a valle -- il conteggio, la cronaca, il filtro sul rigore sbagliato --
 * continui a funzionare con la fonte nuova senza essere stato toccato.
 */

test('il gol normale conta e porta il nome', () => {
  const [e] = travestiTutti([{ event: 'GOAL', time: '23', is_home: true, player: { name: 'Rossi' } }]);
  assert.equal(golVero(e), true);
  assert.equal(e.player?.name, 'Rossi');
  assert.equal(e.time?.elapsed, 23);
  assert.equal(e.team?.id, CASA);
});

test('il gol su rigore conta come gol', () => {
  const [e] = travestiTutti([{ event: 'GOAL_PENALTY', time: '61', is_home: false, player: { name: 'Bianchi' } }]);
  assert.equal(golVero(e), true);
  assert.equal(e.team?.id, OSPITI);
});

test('il rigore SBAGLIATO non diventa un gol', () => {
  const [e] = travestiTutti([{ event: 'MISSED_PENALTY', time: '70', is_home: true, player: { name: 'Verdi' } }]);
  assert.equal(golVero(e), false, 'e il difetto che nessuno perdona: gol annunciato e mai segnato');
});

test('l autogol si sposta dalla parte giusta', () => {
  // segnato da un giocatore di casa: il punto va agli ospiti
  const ev = travestiTutti([{ event: 'OWN_GOAL', time: '30', is_home: true, player: { name: 'Neri' } }]);
  assert.deepEqual(contaGol(ev, CASA, true), { casa: 0, ospiti: 1 });
});

test('il punteggio dagli eventi torna, in casa e fuori', () => {
  const ev = travestiTutti([
    { event: 'GOAL', time: '10', is_home: true, player: { name: 'A' } },
    { event: 'GOAL_PENALTY', time: '55', is_home: false, player: { name: 'B' } },
    { event: 'GOAL', time: '80', is_home: false, player: { name: 'C' } },
  ]);
  // noi in casa
  assert.deepEqual(contaGol(ev, CASA, true), { casa: 1, ospiti: 2 });
  // noi in trasferta: siamo gli OSPITI, e il conto si specchia
  assert.deepEqual(contaGol(ev, OSPITI, false), { casa: 1, ospiti: 2 });
});

test('il secondo giallo arriva come rosso, cosi parte l espulsione', () => {
  const [e] = travestiTutti([{ event: 'YELLOW_RED_CARD', time: '80', is_home: true, player: { name: 'Gialli' } }]);
  assert.equal(e.type, 'Card');
  assert.ok(String(e.detail).includes('Red'), 'il guardiano cerca "Red" dentro detail');
});

test('il giallo semplice NON fa partire l espulsione', () => {
  const [e] = travestiTutti([{ event: 'YELLOW_CARD', time: '20', is_home: true, player: { name: 'A' } }]);
  assert.equal(String(e.detail).includes('Red'), false);
});

test('la cronaca esce in ordine e con i nomi', () => {
  const ev = travestiTutti([
    { event: 'GOAL', time: '77', is_home: false, player: { name: 'Tardi' } },
    { event: 'GOAL_PENALTY', time: '9', is_home: false, player: { name: 'Presto' } },
  ]);
  const c = cronologia(ev, OSPITI, false);
  assert.deepEqual(c.map((v) => v.chi), ['Presto', 'Tardi']);
});

test('un evento che non conosciamo si scarta invece di rompere', () => {
  assert.equal(travesti({ event: 'VAR_REVIEW', time: '5', is_home: true }), null);
  assert.equal(travestiTutti([{ event: 'BOH' }, { event: 'GOAL', time: '1', is_home: true }]).length, 1);
  assert.deepEqual(travestiTutti(null), []);
  assert.deepEqual(travestiTutti(undefined), []);
});

test('un minuto illeggibile non diventa zero', () => {
  const [e] = travestiTutti([{ event: 'GOAL', time: 'HT', is_home: true, player: { name: 'X' } }]);
  assert.equal(e.time?.elapsed, null, 'zero vorrebbe dire "al primo minuto", che e una bugia');
});

test('riconosce la nostra partita comunque sia scritta', () => {
  assert.equal(eLaNostra({ home: { name: 'SS Monopoli 1966' }, away: { name: 'Calcio Foggia 1920' } }), true);
  assert.equal(eLaNostra({ home: { name: 'FOGGIA' }, away: { name: 'Savoia' } }), true);
  assert.equal(eLaNostra({ home: { name: 'Benevento' }, away: { name: 'Casertana' } }), false);
});


/*
 * I nomi dei parametri, non solo quelli degli eventi.
 *
 * La loro pagina dice che gli eventi si chiedono con `id`. E' sbagliata:
 * rispondono `success: false` e "Match with id `` does not eixst" -- il
 * parametro non arriva proprio, e l'errore non dice quale sia il problema.
 * Il nome giusto e' `match_id`, ed e' quello che l'ingest usa in produzione
 * da giorni. Questi due test guardano l'indirizzo che parte davvero.
 */
function intercetta(risposta: unknown) {
  const visti: string[] = [];
  const vero = globalThis.fetch;
  globalThis.fetch = ((u: string | URL) => {
    visti.push(String(u));
    return Promise.resolve(new Response(JSON.stringify(risposta), {
      status: 200, headers: { 'content-type': 'application/json' },
    }));
  }) as typeof fetch;
  return { visti, basta: () => { globalThis.fetch = vero; } };
}

test('gli eventi si chiedono con match_id, non con id', async () => {
  const spia = intercetta({ success: true, data: { event: [] } });
  try {
    await eventiDi('730116', { key: 'k', secret: 's' });
  } finally {
    spia.basta();
  }
  const url = spia.visti[0] ?? '';
  assert.match(url, /[?&]match_id=730116(&|$)/, `manca match_id: ${url}`);
  assert.doesNotMatch(url, /[?&]id=730116(&|$)/, 'con `id` rispondono che la partita non esiste');
});

test('la partita si cerca per competizione, campionato prima e coppa poi', async () => {
  const spia = intercetta({ success: true, data: { match: [] } });
  try {
    await trovaPartita({ key: 'k', secret: 's' });
  } finally {
    spia.basta();
  }
  assert.equal(spia.visti.length, 2, 'niente in campionato: si guarda anche in coppa');
  assert.match(spia.visti[0], /matches\/live\.json\?.*competition_id=181/);
  assert.match(spia.visti[1], /competition_id=180/);
});

test('trova la nostra partita nel feed e ne prende l id', async () => {
  const spia = intercetta({
    success: true,
    data: { match: [
      { id: 731197, home: { name: 'Cosenza Calcio' }, away: { name: 'Cavese' }, status: 'IN PLAY', scores: { score: '0 - 0' } },
      { id: 731200, home: { name: 'Monopoli' }, away: { name: 'Foggia' }, status: 'IN PLAY', scores: { score: '0 - 1' } },
    ] },
  });
  let trovata;
  try {
    trovata = await trovaPartita({ key: 'k', secret: 's' });
  } finally {
    spia.basta();
  }
  assert.equal(trovata?.id, '731200');
  assert.equal(trovata?.punteggio, '0 - 1');
  assert.equal(spia.visti.length, 1, 'trovata in campionato: la coppa non si chiede');
});

/*
 * I cartellini e i cambi dal vivo: il pezzo che mancava in Monopoli-Foggia.
 * Si controlla la catena intera, dagli eventi di live-score-api fino alla
 * forma che finisce in `stato_partita`.
 */
test('il giallo arriva con minuto, nome e lato', () => {
  const ev = travestiTutti([{ event: 'YELLOW_CARD', time: '5', is_home: false, player: { name: 'G. Todisco' } }]);
  const { cartellini } = cartelliniECambi(ev, OSPITI);
  assert.deepEqual(cartellini, [{ minuto: 5, chi: 'G. Todisco', nostro: true, rosso: false }]);
});

test('il secondo giallo risulta rosso', () => {
  const ev = travestiTutti([{ event: 'YELLOW_RED_CARD', time: '80', is_home: true, player: { name: 'Tizio' } }]);
  const { cartellini } = cartelliniECambi(ev, OSPITI);
  assert.equal(cartellini[0].rosso, true);
  assert.equal(cartellini[0].nostro, false, 'era del Monopoli');
});

test('il cambio porta chi esce e chi entra', () => {
  const ev = travestiTutti([
    { event: 'SUBSTITUTION', time: '61', is_home: false, player: { name: 'Esce' }, info: { name: 'Entra' } },
  ]);
  const { cambi } = cartelliniECambi(ev, OSPITI);
  assert.deepEqual(cambi, [{ minuto: 61, esce: 'Esce', entra: 'Entra', nostro: true }]);
});

test('cartellini e cambi escono in ordine di minuto', () => {
  const ev = travestiTutti([
    { event: 'RED_CARD', time: '70', is_home: true, player: { name: 'B' } },
    { event: 'YELLOW_CARD', time: '12', is_home: true, player: { name: 'A' } },
  ]);
  const { cartellini } = cartelliniECambi(ev, OSPITI);
  assert.deepEqual(cartellini.map((c) => c.chi), ['A', 'B']);
});

test('i gol non finiscono fra i cartellini', () => {
  const ev = travestiTutti([
    { event: 'GOAL', time: '10', is_home: true, player: { name: 'X' } },
    { event: 'GOAL_PENALTY', time: '20', is_home: true, player: { name: 'Y' } },
  ]);
  const { cartellini, cambi } = cartelliniECambi(ev, OSPITI);
  assert.equal(cartellini.length, 0);
  assert.equal(cambi.length, 0);
});

/*
 * La scheda della partita dentro `matches/events`: punteggio, stato e minuto.
 * Il formato e copiato da una risposta vera (Monopoli-Foggia, 12 settembre).
 */
import { leggiPartita, punteggioDaLsa, statoDaLsa, minutoDaLsa } from './livescore.ts';

test('il punteggio di live-score-api si legge, e solo quello', () => {
  assert.deepEqual(punteggioDaLsa('1 - 0'), { casa: 1, ospiti: 0 });
  assert.deepEqual(punteggioDaLsa('2-3'), { casa: 2, ospiti: 3 });
  assert.equal(punteggioDaLsa('? - ?'), null);
  assert.equal(punteggioDaLsa(''), null);
  assert.equal(punteggioDaLsa(null), null);
});

test('lo stato di live-score-api diventa quello di TheSportsDB, e il tempo lo dice il minuto', () => {
  assert.equal(statoDaLsa('IN PLAY', '12'), '1H');
  assert.equal(statoDaLsa('IN PLAY', '45+'), '1H');
  assert.equal(statoDaLsa('ADDED TIME', '45+'), '1H');
  assert.equal(statoDaLsa('IN PLAY', '46'), '2H');
  assert.equal(statoDaLsa('IN PLAY', '90+'), '2H');
  assert.equal(statoDaLsa('HALF TIME BREAK', 'HT'), 'HT');
  assert.equal(statoDaLsa('FINISHED', 'FT'), 'FT');
  assert.equal(statoDaLsa('NOT STARTED', ''), 'NS');
  // uno stato che non si conosce non si mescola a quello dell'altra fonte
  assert.equal(statoDaLsa('INSUFFICIENT DATA', '?'), null);
  assert.equal(statoDaLsa('IN PLAY', ''), null);
});

test('il minuto di live-score-api perde il "+" del recupero, che l app sa far avanzare', () => {
  assert.equal(minutoDaLsa('34'), '34');
  assert.equal(minutoDaLsa('45+'), '45');
  assert.equal(minutoDaLsa('90+'), '90');
  assert.equal(minutoDaLsa("67'"), '67');
  assert.equal(minutoDaLsa('HT'), null);
  assert.equal(minutoDaLsa(''), null);
});

test('una lettura porta eventi, punteggio, stato e da che parte gioca il Foggia', async () => {
  const vecchio = globalThis.fetch;
  globalThis.fetch = (async () => new Response(JSON.stringify({
    success: true,
    data: {
      match: { status: 'IN PLAY', time: '37', scores: { score: '1 - 0' }, home: { name: 'Monopoli' }, away: { name: 'Foggia' } },
      event: [{ event: 'YELLOW_CARD', time: 5, is_home: false, player: { name: 'G. Todisco' } }],
    },
  }))) as typeof fetch;
  try {
    const l = await leggiPartita('731535', { key: 'k', secret: 's' });
    assert.ok(l);
    assert.equal(l.eventi.length, 1);
    assert.deepEqual(l.punteggio, { casa: 1, ospiti: 0 });
    assert.equal(l.stato, '1H');
    assert.equal(l.minuto, '37');
    assert.equal(l.foggiaInCasa, false);
  } finally {
    globalThis.fetch = vecchio;
  }
});

test('una partita senza eventi e una lettura buona, una chiamata fallita no', async () => {
  const vecchio = globalThis.fetch;
  try {
    globalThis.fetch = (async () => new Response(JSON.stringify({
      success: true, data: { match: { status: 'IN PLAY', time: '3', scores: { score: '0 - 0' }, home: { name: 'Foggia' } }, event: [] },
    }))) as typeof fetch;
    const vuota = await leggiPartita('1', { key: 'k', secret: 's' });
    assert.ok(vuota, 'nei primi minuti una partita senza eventi e normale: non e un guasto');
    assert.deepEqual(vuota.eventi, []);

    globalThis.fetch = (async () => new Response(JSON.stringify({ success: false, error: 'x' }))) as typeof fetch;
    assert.equal(await leggiPartita('1', { key: 'k', secret: 's' }), null);
  } finally {
    globalThis.fetch = vecchio;
  }
});
