import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  contaGol, concorda, titoloGol, golVero, golDalTabellone, oraItaliana, proteggi, type EventoAF,
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

test('la cronaca porta il punteggio di quel momento, non quello finale', async () => {
  const { cronologia } = await import('./punteggio.ts');
  const e: EventoAF[] = [
    // di proposito in disordine: l'ordine lo deve mettere la funzione
    gol(ALTRI, 'Normal Goal', { time: { elapsed: 21 }, player: { name: 'M. Perlingieri' } }),
    gol(ALTRI, 'Normal Goal', { time: { elapsed: 2 }, player: { name: 'A. Boccadamo' } }),
  ];
  // Foggia in casa: i gol sono degli ospiti
  assert.deepEqual(cronologia(e, FOGGIA, true), [
    { minuto: '2', chi: 'A. Boccadamo', casa: 0, ospiti: 1, nostro: false, fonte: 'eventi' },
    { minuto: '21', chi: 'M. Perlingieri', casa: 0, ospiti: 2, nostro: false, fonte: 'eventi' },
  ]);
});

test("l'autogol si vede nel nome e conta per l'altra squadra", async () => {
  const { cronologia } = await import('./punteggio.ts');
  const e: EventoAF[] = [gol(FOGGIA, 'Own Goal', { time: { elapsed: 60 }, player: { name: 'P. Rossi' } })];
  assert.deepEqual(cronologia(e, FOGGIA, true), [
    { minuto: '60', chi: 'P. Rossi (aut.)', casa: 0, ospiti: 1, nostro: false, fonte: 'eventi' },
  ]);
});

test('il rigore sbagliato non entra nella cronaca', async () => {
  const { cronologia } = await import('./punteggio.ts');
  const e: EventoAF[] = [
    gol(FOGGIA, 'Missed Penalty', { time: { elapsed: 30 }, player: { name: 'Tizio' } }),
    gol(FOGGIA, 'Normal Goal', { time: { elapsed: 70 }, player: { name: 'Caio' } }),
  ];
  const c = cronologia(e, FOGGIA, true);
  assert.equal(c.length, 1);
  assert.equal(c[0].chi, 'Caio');
});

/*
 * L'orario nelle notifiche.
 *
 * Il promemoria del pronostico diceva "Manca un'ora" e poteva partire in
 * qualsiasi punto della finestra: in Monopoli-Foggia e' arrivato con tre
 * minuti da giocare dicendo ancora un'ora.
 */
test('l ora e quella italiana, non quella del server', () => {
  // le Edge Function girano in UTC: senza fuso questo direbbe 19:00
  assert.equal(oraItaliana('2026-09-15T19:00:00.000Z'), '21:00');
});

test('l ora legale finisce e il conto cambia da solo', () => {
  // fine ottobre: da qui in poi Roma e UTC+1, non piu UTC+2
  assert.equal(oraItaliana('2026-12-06T14:30:00.000Z'), '15:30');
});

test('una data illeggibile non stampa Invalid Date dentro una notifica', () => {
  assert.equal(oraItaliana('domani'), '');
  assert.equal(oraItaliana(''), '');
});

/*
 * proteggi(): quello che si sa non si perde.
 *
 * All'intervallo di Monopoli-Foggia eventi_detti e tornato a una firma sola e
 * il guardiano ha riannunciato il gol. Sono le notifiche doppie.
 */
test('la memoria di cosa e stato annunciato non si restringe', () => {
  const riga = { eventi_detti: ['gol-36-noi', 'inizio-1', 'formazioni-1'] };
  const patch = { eventi_detti: ['gol-36-noi'] };

  const out = proteggi(patch, riga) as { eventi_detti: string[] };
  assert.deepEqual([...out.eventi_detti].sort(), ['formazioni-1', 'gol-36-noi', 'inizio-1']);
});

test('una firma nuova si aggiunge, non sostituisce', () => {
  const riga = { eventi_detti: ['inizio-1'] };
  const patch = { eventi_detti: ['intervallo-1'] };

  const out = proteggi(patch, riga) as { eventi_detti: string[] };
  assert.deepEqual([...out.eventi_detti].sort(), ['inizio-1', 'intervallo-1']);
});

test('una lettura a vuoto non cancella gol, cartellini o cambi', () => {
  const riga = {
    gol: [{ minuto: 36 }],
    cartellini: [{ minuto: 5 }, { minuto: 29 }],
    cambi: [{ minuto: 60 }],
  };
  const patch = { gol: [], cartellini: [], cambi: [], casa: 1 };

  const out = proteggi(patch, riga);
  assert.equal('gol' in out, false, 'i gol non si toccano');
  assert.equal('cartellini' in out, false, 'i cartellini nemmeno');
  assert.equal('cambi' in out, false, 'i cambi nemmeno');
  assert.equal(out.casa, 1, 'il resto della patch passa');
});

test('una lista che cresce si scrive: gli eventi non si annullano', () => {
  const riga = { cartellini: [{ minuto: 5 }] };
  const patch = { cartellini: [{ minuto: 5 }, { minuto: 29 }] };

  const out = proteggi(patch, riga) as { cartellini: unknown[] };
  assert.equal(out.cartellini.length, 2);
});

test('la prima lista di una partita si scrive anche se prima era vuota', () => {
  const riga = { gol: [] };
  const patch = { gol: [{ minuto: 12 }] };

  const out = proteggi(patch, riga) as { gol: unknown[] };
  assert.equal(out.gol.length, 1);
});

test('una patch che non nomina una lista la lascia stare', () => {
  const riga = { gol: [{ minuto: 36 }], cartellini: [{ minuto: 5 }] };
  const patch = { casa: 1, ospiti: 0 };

  const out = proteggi(patch, riga);
  assert.deepEqual(out, { casa: 1, ospiti: 0 });
});

test('proteggi non modifica la patch che riceve', () => {
  // il chiamante la usa ancora dopo: mutarla di nascosto sarebbe una trappola
  const riga = { gol: [{ minuto: 36 }] };
  const patch = { gol: [] as unknown[] };

  proteggi(patch, riga);
  assert.deepEqual(patch, { gol: [] });
});
