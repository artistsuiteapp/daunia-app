import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { crest, photo, nostra, ritratto } from '../lib/media.ts';

/*
 * La regola che ha fatto sparire le foto del profilo.
 *
 * Un avatar caricato da chi usa l'app sta sul nostro archivio e deve passare;
 * una foto presa dal sito di qualcun altro no. Prima passavano tutte e due
 * dalla stessa funzione, e con le foto di terzi spente spariva anche la
 * propria faccia: in home restava l'iniziale del nome mentre nel profilo
 * l'immagine si vedeva.
 */

const MIA = 'https://idofdpaftnaoyvuplksq.supabase.co/storage/v1/object/public/avatar/abc/1757.jpg';
const ALTRUI = 'https://www.calciofoggia1920.net/wp-content/uploads/2025/foto-giocatore.jpg';

test('l avatar caricato da una persona passa', () => {
  assert.equal(nostra(MIA), true);
  assert.equal(ritratto(MIA), MIA);
});

test('la foto presa da un sito altrui resta spenta', () => {
  assert.equal(nostra(ALTRUI), false);
  assert.equal(ritratto(ALTRUI), null);
  assert.equal(photo(ALTRUI), null);
});

test('senza immagine non si inventa niente', () => {
  assert.equal(ritratto(null), null);
  assert.equal(ritratto(undefined), null);
  assert.equal(ritratto(''), null);
});

test('un indirizzo che somiglia al nostro senza esserlo non passa', () => {
  // stessa coda, altro dominio: conta il percorso dell'archivio, non il nome
  assert.equal(nostra('https://tizio.example.com/avatar/mia.jpg'), false);
  assert.equal(nostra('https://tizio.example.com/storage/v1/object/public/foto/mia.jpg'), false);
});

test('il percorso dell archivio su un server altrui non basta', () => {
  // il difetto della prima versione: bastava che l'indirizzo contenesse il percorso
  assert.equal(nostra('https://tizio.example.com/storage/v1/object/public/avatar/abc/1757.jpg'), false);
  assert.equal(nostra('http://idofdpaftnaoyvuplksq.supabase.co/storage/v1/object/public/avatar/abc/1.jpg'), false);
  assert.equal(nostra('https://idofdpaftnaoyvuplksq.supabase.co.tizio.com/storage/v1/object/public/avatar/abc/1.jpg'), false);
  assert.equal(nostra('https://idofdpaftnaoyvuplksq.supabase.co/storage/v1/object/public/avatar/abc/1.jpg?x=https://tizio.com'), false);
  assert.equal(ritratto('https://tizio.example.com/storage/v1/object/public/avatar/abc/1757.jpg'), null);
});

test('un altro progetto Supabase non e il nostro archivio', () => {
  assert.equal(nostra(MIA, 'idofdpaftnaoyvuplksq'), true);
  assert.equal(nostra(MIA, 'unaltroprogetto'), false);
});

test('gli stemmi restano collegati, non copiati', () => {
  const stemma = 'https://www.calciofoggia1920.net/loghi/picerno.png';
  assert.equal(crest(stemma), stemma);
});
