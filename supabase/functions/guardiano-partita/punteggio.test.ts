import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  contaGol, concorda, titoloGol, golVero, golDalTabellone, type EventoAF,
} from './punteggio.ts';

const FOGGIA = 521;
const ALTRI = 999;

const gol = (team: number, detail = 'Normal Goal', extra: Partial<EventoAF> = {}): EventoAF =>
  ({ type: 'Goal', detail, team: { id: team }, time: { elapsed: 10 }, ...extra });

test('un rigore sbagliato non e un gol', () => {
  assert.equal(golVero(gol(FOGGIA, 'Missed Penalty')), false);
  assert.equal(golVero(gol(FOGGIA, 'Penalty')), true);
});

test('i rigori finali non entrano nel punteggio', () => {
  assert.equal(golVero(gol(FOGGIA, 'Penalty', { comments: 'Penalty Shootout' })), false);
});

test('i cartellini non sono gol', () => {
  assert.equal(golVero({ type: 'Card', detail: 'Red Card', team: { id: FOGGIA } }), false);
});

test('conta i gol delle due squadre, col Foggia in casa', () => {
  const e = [gol(FOGGIA), gol(ALTRI), gol(FOGGIA, 'Penalty')];
  assert.deepEqual(contaGol(e, FOGGIA, true), { casa: 2, ospiti: 1 });
});

test('col Foggia fuori casa i lati si girano', () => {
  const e = [gol(FOGGIA), gol(ALTRI), gol(ALTRI)];
  assert.deepEqual(contaGol(e, FOGGIA, false), { casa: 2, ospiti: 1 });
});

test("l'autogol vale per chi lo subisce, non per chi lo segna", () => {
  // un nostro giocatore la mette dentro: il punto e loro
  assert.deepEqual(contaGol([gol(FOGGIA, 'Own Goal')], FOGGIA, true), { casa: 0, ospiti: 1 });
  // un loro giocatore la mette dentro: il punto e nostro
  assert.deepEqual(contaGol([gol(ALTRI, 'Own Goal')], FOGGIA, true), { casa: 1, ospiti: 0 });
});

test('un rigore sbagliato non sposta il conto', () => {
  const e = [gol(FOGGIA), gol(FOGGIA, 'Missed Penalty')];
  assert.deepEqual(contaGol(e, FOGGIA, true), { casa: 1, ospiti: 0 });
});

test('due fonti uguali fanno un accordo', () => {
  const a = concorda({ casa: 1, ospiti: 0 }, { casa: 1, ospiti: 0 });
  assert.deepEqual(a, { punteggio: { casa: 1, ospiti: 0 }, concordi: true, fonte: 'accordo' });
});

test('due fonti diverse non fanno un accordo, e vince chi ha visto il gol', () => {
  const a = concorda({ casa: 0, ospiti: 0 }, { casa: 1, ospiti: 0 });
  assert.equal(a.concordi, false);
  assert.equal(a.fonte, 'eventi');
  assert.deepEqual(a.punteggio, { casa: 1, ospiti: 0 });
});

test('il terzo parere rompe la parita', () => {
  const a = concorda({ casa: 0, ospiti: 0 }, { casa: 1, ospiti: 0 }, { casa: 1, ospiti: 0 });
  assert.equal(a.concordi, true);
  assert.deepEqual(a.punteggio, { casa: 1, ospiti: 0 });
});

test('tre pareri diversi restano non confermati', () => {
  const a = concorda({ casa: 0, ospiti: 0 }, { casa: 1, ospiti: 0 }, { casa: 2, ospiti: 0 });
  assert.equal(a.concordi, false);
  assert.equal(a.fonte, 'arbitro');
});

test('senza nessuna fonte non si inventa niente', () => {
  assert.deepEqual(concorda(null, null), { punteggio: null, concordi: false, fonte: 'nessuna' });
});

test('il titolo porta il punteggio solo quando e confermato', () => {
  const ok = concorda({ casa: 2, ospiti: 1 }, { casa: 2, ospiti: 1 });
  assert.equal(titoloGol(true, ok), 'GOL DEL FOGGIA! 2-1');

  const litigio = concorda({ casa: 0, ospiti: 0 }, { casa: 1, ospiti: 0 });
  assert.equal(titoloGol(true, litigio), 'GOL DEL FOGGIA!');
  assert.equal(titoloGol(false, litigio), 'Gol subito.');
});

test('il titolo non stampa mai un punteggio che non ha', () => {
  assert.equal(titoloGol(true, concorda(null, null)), 'GOL DEL FOGGIA!');
});

test('il tabellone da solo riconosce chi ha segnato', () => {
  const nostro = golDalTabellone({ casa: 0, ospiti: 0 }, { casa: 1, ospiti: 0 }, true);
  assert.deepEqual(nostro, { nostro: true });

  const loro = golDalTabellone({ casa: 0, ospiti: 0 }, { casa: 0, ospiti: 1 }, true);
  assert.deepEqual(loro, { nostro: false });
});

test('fuori casa il verso si gira anche qui', () => {
  const nostro = golDalTabellone({ casa: 0, ospiti: 0 }, { casa: 0, ospiti: 1 }, false);
  assert.deepEqual(nostro, { nostro: true });
});

test('un tabellone fermo non annuncia niente', () => {
  assert.equal(golDalTabellone({ casa: 1, ospiti: 1 }, { casa: 1, ospiti: 1 }, true), null);
});

test('alla prima lettura non si annuncia un gol mai visto succedere', () => {
  assert.equal(golDalTabellone(null, { casa: 2, ospiti: 0 }, true), null);
});

test('se salgono tutti e due, il nostro gol resta vero', () => {
  const a = golDalTabellone({ casa: 0, ospiti: 0 }, { casa: 1, ospiti: 1 }, true);
  assert.deepEqual(a, { nostro: true });
});

test('il minuto stimato serve ai gol letti dal tabellone', async () => {
  const { minutoStimato } = await import('./punteggio.ts');
  const KO = '2026-09-06T19:00:00Z';
  const t = (m: number) => Date.parse(KO) + m * 60_000;

  assert.equal(minutoStimato(KO, '1H', t(22.5)), 23);
  assert.equal(minutoStimato(KO, '1H', t(60)), 45);
  assert.equal(minutoStimato(KO, '2H', t(60)), 46);
  assert.equal(minutoStimato(KO, 'HT', t(50)), null);
  assert.equal(minutoStimato(null, '1H', t(10)), null);
});
