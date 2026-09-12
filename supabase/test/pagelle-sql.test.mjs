import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/*
 * L'archivio delle pagelle.
 *
 * Due cose da tenere: che i voti singoli non escano mai, e che il migliore non
 * venga incoronato da una persona sola. La seconda e il motivo per cui esiste
 * una soglia: in una partita votata da due, il "migliore della Curva" sarebbe
 * l'opinione di due persone spacciata per un verdetto.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const MIGRAZIONI = join(QUI, '..', 'migrations');

let db;
const TIFOSI = [
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
];

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    create extension if not exists plpgsql;
    do $r$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end $r$;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid; $$;
    create table profiles (id uuid primary key, nome text not null);
    create table voti (
      utente uuid not null references profiles, partita text not null, giocatore text not null,
      voto smallint not null, primary key (utente, partita, giocatore)
    );
    insert into profiles values ('${TIFOSI[0]}','Anna'), ('${TIFOSI[1]}','Beppe'), ('${TIFOSI[2]}','Carla');
  `);

  await db.exec(readFileSync(join(MIGRAZIONI, '20260911190000_archivio_pagelle.sql'), 'utf8'));

  // partita m1: votata da tutti e tre. Saro il migliore, Panico il peggiore.
  for (const u of TIFOSI) {
    await db.query('insert into voti values ($1, $2, $3, $4)', [u, 'm1', 'Saro', 8]);
    await db.query('insert into voti values ($1, $2, $3, $4)', [u, 'm1', 'Gallo', 6]);
    await db.query('insert into voti values ($1, $2, $3, $4)', [u, 'm1', 'Panico', 4]);
  }
  // partita m2: votata da una persona sola
  await db.query('insert into voti values ($1, $2, $3, $4)', [TIFOSI[0], 'm2', 'Merdji', 9]);
});

const riassunto = async (partite) =>
  (await db.query('select * from pagelle_riassunto($1)', [partite])).rows;

test('una riga per partita, con i conti giusti', async () => {
  const r = (await riassunto(['m1'])).find((x) => x.partita === 'm1');
  assert.equal(r.votanti, 3);
  assert.equal(r.voti, 9);
  assert.equal(Number(r.media), 6);
});

test('il migliore e chi ha la media piu alta', async () => {
  const r = (await riassunto(['m1']))[0];
  assert.equal(r.migliore, 'Saro');
  assert.equal(Number(r.media_migliore), 8);
});

test('con meno di tre voti il migliore non si dichiara', async () => {
  const r = (await riassunto(['m2']))[0];
  assert.equal(r.votanti, 1);
  assert.equal(r.migliore, null, 'una persona sola non incorona nessuno');
});

test('le partite senza voti non compaiono', async () => {
  const r = await riassunto(['m1', 'm2', 'mai-giocata']);
  assert.deepEqual(r.map((x) => x.partita).sort(), ['m1', 'm2']);
});

test('si chiedono tutte insieme, non una per volta', async () => {
  const r = await riassunto(['m1', 'm2']);
  assert.equal(r.length, 2);
});

test('non esce nessun voto singolo', async () => {
  // si guarda la firma della funzione, non il risultato di una chiamata: se un
  // giorno qualcuno aggiunge una colonna con dentro il voto di qualcuno, deve
  // saltare qui e non in produzione
  const firma = (await db.query(`
    select pg_get_function_result(oid) as risultato
    from pg_proc where proname = 'pagelle_riassunto'
  `)).rows[0].risultato;

  assert.match(firma, /media/);
  for (const vietata of ['utente', 'voto smallint', 'voto integer']) {
    assert.ok(!firma.includes(vietata), `la firma espone ${vietata}: ${firma}`);
  }
});
