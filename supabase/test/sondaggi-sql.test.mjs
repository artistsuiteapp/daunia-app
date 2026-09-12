import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/*
 * I sondaggi.
 *
 * Le due cose che contano: i voti escono contati e mai uno per uno, e i punti
 * arrivano una volta sola anche a chi cambia idea tre volte.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const MIGRAZIONI = join(QUI, '..', 'migrations');

let db;
const ANNA = '11111111-1111-1111-1111-111111111111';
const BEPPE = '22222222-2222-2222-2222-222222222222';
let sondaggio;
let chiuso;

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    create extension if not exists plpgsql;
    do $ruoli$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    end $ruoli$;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('prova.utente', true), '')::uuid;
    $$;
    create or replace function e_admin() returns boolean language sql stable as $$ select false; $$;

    create table profiles (id uuid primary key, nome text not null, avatar text);
    create table pronostici (utente uuid references profiles, partita text, casa smallint, ospiti smallint,
      creato_il timestamptz default now(), primary key (utente, partita));
    create table voti (utente uuid references profiles, partita text, giocatore text, voto smallint,
      primary key (utente, partita, giocatore));
    create table mvp_voti (utente uuid references profiles, partita text, giocatore text, primary key (utente, partita));
    create table partite_chiuse (partita text primary key, casa smallint, ospiti smallint, chiusa_il timestamptz default now());
    create table stato_partita (partita text primary key, casa smallint, ospiti smallint, stato text, finita_il timestamptz);

    insert into profiles (id, nome) values ('${ANNA}', 'Anna'), ('${BEPPE}', 'Beppe');
  `);

  await db.exec(readFileSync(join(MIGRAZIONI, '20260911140000_punti_e_classifiche.sql'), 'utf8'));
  await db.exec(readFileSync(join(MIGRAZIONI, '20260911150000_sondaggi.sql'), 'utf8'));

  sondaggio = (await db.query(`
    insert into sondaggi (partita, fase, testo, opzioni)
    values ('m1', 'intervallo', 'Come sta giocando il Foggia?', array['bene', 'cosi cosi', 'male'])
    returning id
  `)).rows[0].id;

  chiuso = (await db.query(`
    insert into sondaggi (partita, fase, testo, opzioni, chiude_il)
    values ('m1', 'pre', 'Sondaggio gia scaduto', array['si', 'no'], now() - interval '1 hour')
    returning id
  `)).rows[0].id;
});

test('si vota, si puo cambiare idea, e si paga una volta sola', async () => {
  await db.exec(`set prova.utente = '${ANNA}'`);
  assert.equal((await db.query('select vota_sondaggio($1, 0::smallint) as p', [sondaggio])).rows[0].p, 5);
  assert.equal((await db.query('select vota_sondaggio($1, 2::smallint) as p', [sondaggio])).rows[0].p, 0);

  const mio = (await db.query('select scelta from sondaggio_voti where utente = $1', [ANNA])).rows[0];
  assert.equal(mio.scelta, 2, 'deve restare l ultima scelta');
  assert.equal((await db.query('select punti_totali($1) as p', [ANNA])).rows[0].p, 5);
});

test('i risultati escono contati, non uno per uno', async () => {
  await db.exec(`set prova.utente = '${BEPPE}'`);
  await db.query('select vota_sondaggio($1, 2::smallint)', [sondaggio]);
  const righe = (await db.query('select scelta, quanti from sondaggio_risultati where sondaggio = $1', [sondaggio])).rows;
  assert.deepEqual(righe, [{ scelta: 2, quanti: 2 }]);
});

test('la tabella dei voti si legge solo per la propria riga', async () => {
  const politiche = (await db.query(`
    select cmd, qual from pg_policies where tablename = 'sondaggio_voti'
  `)).rows;
  assert.equal(politiche.length, 1);
  assert.equal(politiche[0].cmd, 'SELECT');
  assert.match(politiche[0].qual, /uid\(\)/);
});

test('un sondaggio chiuso non accetta voti', async () => {
  await assert.rejects(db.query('select vota_sondaggio($1, 0::smallint)', [chiuso]), /non e aperto/);
});

test('una scelta fuori elenco viene rifiutata', async () => {
  await assert.rejects(db.query('select vota_sondaggio($1, 9::smallint)', [sondaggio]), /fuori elenco/);
});

test('senza account non si vota', async () => {
  await db.exec("set prova.utente = ''");
  await assert.rejects(db.query('select vota_sondaggio($1, 0::smallint)', [sondaggio]), /serve un account/);
});
