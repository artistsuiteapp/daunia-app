import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

/*
 * Le strisce: quante ne ha indovinate di fila, contate all'indietro
 * dall'ultima partita chiusa.
 *
 * Il caso che conta e l'ultimo test: chi ha sbagliato l'ultima non deve
 * comparire, nemmeno se prima ne aveva indovinate dieci. Una striscia rotta e
 * una striscia finita, e una grafica che festeggia chi ha appena sbagliato si
 * nota subito.
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
const M = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations') + '/';
let db;
const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    create extension if not exists plpgsql;
    do $r$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end $r$;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('prova.utente', true), '')::uuid; $$;
    create table profiles (id uuid primary key, nome text, avatar text);
    create table pronostici (utente uuid references profiles, partita text, casa smallint, ospiti smallint,
      creato_il timestamptz default now(), primary key (utente, partita));
    create table voti (utente uuid references profiles, partita text, giocatore text, voto smallint, primary key (utente,partita,giocatore));
    create table mvp_voti (utente uuid references profiles, partita text, giocatore text, primary key (utente,partita));
    create table partite_chiuse (partita text primary key, casa smallint, ospiti smallint, chiusa_il timestamptz default now());
    create table stato_partita (partita text primary key, casa smallint, ospiti smallint, stato text, finita_il timestamptz);
    insert into profiles values ('${A}','Anna',null), ('${B}','Beppe',null);
  `);
  await db.exec(readFileSync(M + '20260911140000_punti_e_classifiche.sql', 'utf8'));
  await db.exec(readFileSync(M + '20260911160000_strisce.sql', 'utf8'));

  // quattro partite chiuse, in ordine
  for (const [p, c, o, g] of [['p1',1,0,1],['p2',2,2,2],['p3',0,1,3],['p4',3,1,4]]) {
    await db.query(`insert into partite_chiuse (partita, casa, ospiti, chiusa_il) values ($1,$2,$3, now() - interval '${5-g} day')`, [p,c,o]);
  }
});

test('la striscia conta gli esiti di fila, a partire dall ultima', async () => {
  // Anna: p1 esito ok, p2 sbagliato, p3 ok, p4 ok -> striscia 2
  for (const [p, c, o] of [['p1',2,0],['p2',3,0],['p3',0,2],['p4',2,1]]) {
    await db.query('insert into pronostici values ($1,$2,$3,$4)', [A,p,c,o]);
  }
  const r = (await db.query('select * from strisce(10)')).rows;
  const anna = r.find((x) => x.nome === 'Anna');
  assert.equal(anna.striscia, 2);
});

test('chi le indovina tutte ha la striscia lunga quanto la sua storia', async () => {
  for (const [p, c, o] of [['p3',0,3],['p4',4,2]]) {
    await db.query('insert into pronostici values ($1,$2,$3,$4)', [B,p,c,o]);
  }
  const beppe = (await db.query('select * from strisce(10)')).rows.find((x) => x.nome === 'Beppe');
  assert.equal(beppe.striscia, 2);
});

test('saltare una giornata non rompe la striscia', async () => {
  // Beppe non ha pronosticato p1 e p2 e resta a 2
  const beppe = (await db.query('select * from strisce(10)')).rows.find((x) => x.nome === 'Beppe');
  assert.equal(beppe.striscia, 2);
});

test('chi ha sbagliato l ultima non compare', async () => {
  await db.query('insert into partite_chiuse (partita, casa, ospiti, chiusa_il) values ($1,$2,$3, now())', ['p5',0,0]);
  await db.query('insert into pronostici values ($1,$2,$3,$4)', [A,'p5',5,0]);
  const anna = (await db.query('select * from strisce(10)')).rows.find((x) => x.nome === 'Anna');
  assert.equal(anna, undefined);
});

test('la propria striscia si legge dal profilo', async () => {
  await db.exec(`set prova.utente = '${B}'`);
  assert.equal((await db.query('select mia_striscia() as s')).rows[0].s, 2);
  await db.exec(`set prova.utente = '${A}'`);
  assert.equal((await db.query('select mia_striscia() as s')).rows[0].s, 0);
});
