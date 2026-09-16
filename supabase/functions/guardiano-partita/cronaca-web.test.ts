import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  formazioniDaDiretta, leggiDiretta, nomeTestata, recuperoDaDiretta, trovaDiretta, righe,
} from './cronaca-web.ts';

/*
 * La prova gira sull'articolo vero di Foggia-Savoia del 15 settembre, salvato
 * com'era. Se la testata cambia il modo di scrivere le formazioni, questa
 * prova fallisce prima della partita, non durante.
 */
const QUI = dirname(fileURLToPath(import.meta.url));
type Articolo = { id: number; title: { rendered: string }; content: { rendered: string } };
const leggi = (nome: string) =>
  JSON.parse(readFileSync(join(QUI, '__fixtures__', nome), 'utf8')) as Articolo;
const articolo = leggi('diretta-calciofoggia.json');
const html = articolo.content.rendered;
/* La seconda testata scrive le formazioni dentro il tabellino, senza titolo. */
const altra = leggi('diretta-foggiacalciomania.json').content.rendered;

test('legge le formazioni ufficiali dalla diretta scritta', () => {
  const f = formazioniDaDiretta(html, 'Foggia', 'Savoia');
  assert.ok(f);
  assert.equal(f.casa.squadra, 'Foggia');
  assert.equal(f.casa.giocatori.length, 11);
  assert.equal(f.casa.giocatori[0].nome, 'Saro');
  assert.equal(f.casa.allenatore, 'Gaetano Auteri');
  assert.equal(f.ospiti.squadra, 'Savoia');
  assert.equal(f.ospiti.giocatori.length, 11);
  assert.equal(f.ospiti.allenatore, 'Alessandro Formisano');
});

test('le squadre stanno dalla parte giusta anche se l articolo le inverte', () => {
  const f = formazioniDaDiretta(html, 'Savoia', 'Foggia');
  assert.equal(f?.casa.squadra, 'Savoia');
  assert.equal(f?.ospiti.squadra, 'Foggia');
});

test('senza il blocco delle formazioni non inventa niente', () => {
  assert.equal(formazioniDaDiretta('<p>Prepartita: si gioca alle 21.</p>', 'Foggia', 'Savoia'), null);
  assert.equal(formazioniDaDiretta(null), null);
  // un elenco corto non e una formazione
  assert.equal(
    formazioniDaDiretta('<h3>Formazioni ufficiali</h3><p>Foggia: Saro, Todisco, Seck</p>'),
    null,
  );
});

test('legge le formazioni anche dalla seconda testata, che le mette nel tabellino', () => {
  const f = formazioniDaDiretta(altra, 'Foggia', 'Savoia');
  assert.ok(f);
  assert.equal(f.casa.squadra, 'Foggia');
  assert.equal(f.casa.modulo, '4-3-3');
  assert.equal(f.casa.giocatori.length, 11);
  assert.equal(f.casa.giocatori[0].nome, 'Saro');
  // i cambi scritti fra parentesi non diventano un giocatore in piu
  assert.ok(!f.casa.giocatori.some((g) => /Coulibaly/i.test(g.nome)));
  assert.equal(f.casa.allenatore, 'Gaetano Auteri');
  assert.equal(f.ospiti.squadra, 'Savoia');
  assert.equal(f.ospiti.giocatori.length, 11);
  // la panchina e fatta come una formazione: non deve prendere il posto di una squadra
  assert.ok(!/disposizione/i.test(f.ospiti.squadra));
});

test('le testate si chiamano col loro nome', () => {
  assert.equal(nomeTestata(0), 'calciofoggia.it');
  assert.equal(nomeTestata(1), 'foggiacalciomania.com');
  assert.equal(nomeTestata(9), 'calciofoggia.it');
});

test('prende i minuti di recupero annunciati', () => {
  // nell'articolo: "45' - Due minuti di recupero" e "90' - Cinque minuti di recupero"
  assert.deepEqual(recuperoDaDiretta(html), { minuto: 90, minuti: 5 });
});

test('vale il cartello del tempo che si sta giocando', () => {
  assert.deepEqual(recuperoDaDiretta(html, '1H'), { minuto: 45, minuti: 2 });
  assert.deepEqual(recuperoDaDiretta(html, '2H'), { minuto: 90, minuti: 5 });
  // all'intervallo non c'e nessun recupero in corso
  assert.equal(recuperoDaDiretta(html, 'HT'), null);
});

test('il recupero si legge anche scritto in cifre', () => {
  const finto = ['90&#8242; &#8211; 4 minuti di recupero.', '45&#8242; &#8211; Due minuti di recupero.']
    .join('<br />');
  assert.deepEqual(recuperoDaDiretta(finto, '2H'), { minuto: 90, minuti: 4 });
});

test('una riga che nomina il recupero senza numeri non conta', () => {
  assert.equal(recuperoDaDiretta('<p>70&#8242; &#8211; Si riprende dopo il recupero.</p>'), null);
});

test('le righe della diretta si separano sui ritorni a capo veri', () => {
  const r = righe('<p>uno<br />due</p><p>tre</p>');
  assert.deepEqual(r, ['uno', 'due', 'tre']);
});

/** L'elenco degli articoli, poi il testo di quello scelto: come risponde WordPress. */
const finge = (elenco: Array<{ id: number; titolo: string }>, chiamate: string[] = []) =>
  async (url: string) => {
    chiamate.push(url);
    const uno = /posts\/(\d+)/.exec(url);
    if (uno) {
      const p = elenco.find((x) => x.id === Number(uno[1]));
      return p ? { id: p.id, title: { rendered: p.titolo }, content: { rendered: html } } : null;
    }
    return elenco.map((p) => ({ id: p.id, title: { rendered: p.titolo } }));
  };

test('cerca la diretta di questa partita e non quella della settimana scorsa', async () => {
  const chiamate: string[] = [];
  const d = await trovaDiretta('Foggia', 'Savoia', Date.parse('2026-09-15T19:00:00Z'), finge([
    { id: 1, titolo: 'Il Foggia in ritiro' },
    { id: 2, titolo: 'Foggia-Savoia 0-0 (risultato finale)' },
  ], chiamate));
  assert.equal(d?.id, 2);
  assert.equal(d?.testata, 0);
  // la finestra parte da prima del fischio: senza, si prende la diretta vecchia
  assert.match(chiamate[0], /after=2026-09-15T13:00:00/);
  // e si chiedono solo i titoli: il testo si prende dopo, uno solo
  assert.doesNotMatch(chiamate[0], /_fields=id,title,content/);
});

test('fra piu articoli sulla partita si prende quello della diretta', async () => {
  const d = await trovaDiretta('Foggia', 'Savoia', Date.now(), finge([
    { id: 7, titolo: 'Foggia-Savoia: i convocati rossoneri' },
    { id: 8, titolo: 'Diretta: Foggia-Savoia 0 - 0' },
  ]));
  assert.equal(d?.id, 8);
});

test('se la prima testata non ha niente si prova la seconda', async () => {
  const chiamate: string[] = [];
  const finto = async (url: string) => {
    chiamate.push(url);
    if (url.includes('calciofoggia.it')) return [];
    const uno = /posts\/(\d+)/.exec(url);
    if (uno) return { id: 55, title: { rendered: 'Diretta: Foggia-Savoia' }, content: { rendered: altra } };
    return [{ id: 55, title: { rendered: 'Diretta: Foggia-Savoia' } }];
  };
  const d = await trovaDiretta('Foggia', 'Savoia', Date.now(), finto);
  assert.equal(d?.testata, 1);
  assert.ok(formazioniDaDiretta(d.contenuto, 'Foggia', 'Savoia'));
  assert.ok(chiamate.some((u) => u.includes('foggiacalciomania.com')));
});

test('la diretta gia trovata si rilegge per id, senza ricercarla', async () => {
  const chiamate: string[] = [];
  const d = await leggiDiretta(0, 244682, finge([{ id: 244682, titolo: 'Foggia-Savoia' }], chiamate));
  assert.equal(d?.id, 244682);
  assert.ok(formazioniDaDiretta(d.contenuto, 'Foggia', 'Savoia'));
  assert.equal(chiamate.length, 1);
  assert.match(chiamate[0], /posts\/244682/);
});

test('senza articolo della partita non si ripiega su un altro pezzo', async () => {
  assert.equal(
    await trovaDiretta('Foggia', 'Savoia', Date.now(), finge([{ id: 9, titolo: 'Mercato, si chiude' }])),
    null,
  );
});
