import test from 'node:test';
import assert from 'node:assert/strict';

import { travesti, travestiTutti, eLaNostra, eventiDi, trovaPartita, CASA, OSPITI } from './livescore.ts';
import { golVero, contaGol, cronologia } from './punteggio.ts';

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
