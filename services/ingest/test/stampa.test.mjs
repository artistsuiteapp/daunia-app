/**
 * Prove sulla rassegna stampa, senza rete: si parte da un RSS finto.
 *
 * Quello che conta qui non e il parsing in se, e la regola che il corpo non
 * entra e il sommario resta corto. Quella e la promessa fatta alle redazioni,
 * ed e l'unica cosa in questo file che, se si rompe, si rompe in silenzio.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { accorcia, articolo, daRifare, idArticolo, immagineDa, leggiVoci, quando, FILTRO_FOGGIA, SOGLIA } from '../src/sources/stampa.mjs';

const FEED = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <item>
    <title><![CDATA[Todisco: &#8220;Dispiace per il risultato&#8221;]]></title>
    <link>https://esempio.it/todisco-dispiace/</link>
    <pubDate>Sun, 07 Sep 2026 21:09:45 +0000</pubDate>
    <dc:creator><![CDATA[Armando Borrelli]]></dc:creator>
    <category><![CDATA[FOGGIA CALCIO]]></category>
    <description><![CDATA[<p>Il terzino del <b>Foggia</b> ha commentato la sconfitta.</p>]]></description>
  </item>
  <item>
    <title>Cronaca: incidente sulla statale</title>
    <link>https://esempio.it/incidente/</link>
    <pubDate>Sat, 06 Sep 2026 08:00:00 +0000</pubDate>
    <description>Traffico bloccato per due ore.</description>
  </item>
  <item>
    <title>Senza link, va scartato</title>
    <pubDate>Fri, 05 Sep 2026 08:00:00 +0000</pubDate>
  </item>
</channel>
</rss>`;

const TESTATA = { id: 'esempio', filtro: null };
const GENERALISTA = { id: 'generalista', filtro: FILTRO_FOGGIA };

test('legge titolo, link, data, autore e categoria', () => {
  const voci = leggiVoci(FEED);
  assert.equal(voci.length, 2, 'la voce senza link non conta');
  assert.equal(voci[0].titolo, 'Todisco: “Dispiace per il risultato”');
  assert.equal(voci[0].link, 'https://esempio.it/todisco-dispiace/');
  assert.equal(voci[0].autore, 'Armando Borrelli');
  assert.equal(voci[0].categoria, 'FOGGIA CALCIO');
});

test('il sommario perde i marcatori HTML', () => {
  const [voce] = leggiVoci(FEED);
  assert.equal(voce.sommario, 'Il terzino del Foggia ha commentato la sconfitta.');
  assert.ok(!voce.sommario.includes('<'), 'niente HTML nel sommario');
});

test('un articolo non porta il corpo, solo il sommario', () => {
  const a = articolo(TESTATA, leggiVoci(FEED)[0]);
  assert.ok(!('body' in a) && !('corpo' in a) && !('testo' in a));
  assert.deepEqual(
    Object.keys(a).sort(),
    ['autore', 'categoria', 'data', 'id', 'immagine', 'sommario', 'testata', 'titolo', 'url'],
  );
});

test('il sommario si ferma sotto i 180 caratteri, su uno spazio', () => {
  const lungo = 'parola '.repeat(80);
  const corto = accorcia(lungo);
  assert.ok(corto.length <= 181, `lungo ${corto.length}`);
  assert.ok(corto.endsWith('…'));
  assert.ok(!corto.includes('parol…'), 'non spezza a meta una parola');
});

test('un testo gia corto resta intatto, senza puntini', () => {
  assert.equal(accorcia('Due righe e basta.'), 'Due righe e basta.');
});

test('una data illeggibile vale null, e l articolo si scarta', () => {
  assert.equal(quando('domani mattina'), null);
  assert.equal(articolo(TESTATA, { titolo: 'x', link: 'https://e.it/x', data: 'boh', sommario: '' }), null);
});

test('la testata generalista tiene solo cio che parla di Foggia', () => {
  const voci = leggiVoci(FEED);
  assert.ok(articolo(GENERALISTA, voci[0]), 'la dichiarazione del terzino passa');
  assert.equal(articolo(GENERALISTA, voci[1]), null, 'l incidente sulla statale no');
});

test('due link diversi non condividono mai l id', () => {
  const base = 'https://esempio.it/una-dichiarazione-molto-lunga-del-direttore-sportivo-a-margine-';
  assert.notEqual(idArticolo('e', `${base}della-partita-di-ieri`), idArticolo('e', `${base}della-partita-di-oggi`));
  assert.equal(idArticolo('e', `${base}x`), idArticolo('e', `${base}x`), 'stesso link, stesso id');
});

test('l immagine viene dall og:image della pagina', () => {
  const html = `<html><head>
    <meta property="og:image" content="https://esempio.it/foto.jpg" />
    <meta property="og:image:width" content="1206" />
  </head></html>`;
  assert.equal(immagineDa(html), 'https://esempio.it/foto.jpg');
});

test('l immagine regge l ordine invertito degli attributi e il ripiego su twitter', () => {
  assert.equal(
    immagineDa('<meta content="https://esempio.it/a.png" property="og:image">'),
    'https://esempio.it/a.png',
  );
  assert.equal(
    immagineDa('<meta name="twitter:image" content="https://esempio.it/b.png">'),
    'https://esempio.it/b.png',
  );
});

test('senza og:image resta null, e un percorso relativo non conta', () => {
  assert.equal(immagineDa('<html><head><title>niente</title></head></html>'), null);
  assert.equal(immagineDa('<meta property="og:image" content="/wp-content/foto.jpg">'), null);
});

test('si ripassa dai feed solo dopo la soglia', () => {
  const t0 = Date.parse('2026-09-08T06:00:00.000Z');
  const prima = { aggiornatoIl: new Date(t0).toISOString(), articoli: [{ id: 'x' }] };

  // la soglia si legge da dove sta, invece di ripeterne il valore qui: cosi
  // cambiarla non fa fallire un test che sta solo descrivendo la regola
  assert.equal(daRifare(prima, t0 + SOGLIA - 60 * 1000), false, 'un minuto prima si sta fermi');
  assert.equal(daRifare(prima, t0 + SOGLIA), true, 'alla soglia si riparte');
});

test('la soglia sta sotto le sei ore del cron', () => {
  // se fosse piu lunga dell'intervallo fra due giri, ci sarebbero giri che non
  // guardano mai i feed: e' il difetto per cui le notizie sembravano ferme
  assert.ok(SOGLIA <= 6 * 60 * 60 * 1000, `soglia di ${SOGLIA / 3600000} ore`);
});

test('senza giro precedente, o con un giro vuoto, si scarica comunque', () => {
  const adesso = Date.parse('2026-09-08T06:00:00.000Z');
  assert.equal(daRifare(null, adesso), true);
  assert.equal(daRifare({ articoli: [{ id: 'x' }] }, adesso), true, 'manca l ora');
  assert.equal(
    daRifare({ aggiornatoIl: new Date(adesso).toISOString(), articoli: [] }, adesso),
    true,
    'ora fresca ma niente dentro: si riprova',
  );
});
