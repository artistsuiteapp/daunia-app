import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/*
 * Quiz e sondaggi.
 *
 * La cosa da provare per prima e la piu noiosa da guardare: che la risposta
 * giusta non esca dal database prima del tempo. Un quiz il cui client conosce
 * la risposta non e un quiz, e con la chiave anonima dentro l'app "non la
 * mostriamo nell'interfaccia" non vuol dire niente.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const MIGRAZIONI = join(QUI, '..', 'migrations');

let db;
const ANNA = '11111111-1111-1111-1111-111111111111';
const BEPPE = '22222222-2222-2222-2222-222222222222';
let domanda;
let chiusa;
let sondaggio;

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
  await db.exec(readFileSync(join(MIGRAZIONI, '20260911150000_quiz_e_sondaggi.sql'), 'utf8'));

  domanda = (await db.query(`
    insert into quiz_domande (partita, fase, testo, opzioni, giusta, spiegazione)
    values ('m1', 'pre', 'In che anno il Foggia vinse il campionato di Serie B?',
            array['1970', '1991', '1978'], 1, 'Serie B 1990-91, con Zeman in panchina.')
    returning id
  `)).rows[0].id;

  chiusa = (await db.query(`
    insert into quiz_domande (partita, fase, testo, opzioni, giusta, chiude_il)
    values ('m1', 'pre', 'Domanda gia scaduta, non deve accettare risposte',
            array['si', 'no'], 0, now() - interval '1 hour')
    returning id
  `)).rows[0].id;

  sondaggio = (await db.query(`
    insert into sondaggi (partita, fase, testo, opzioni)
    values ('m1', 'intervallo', 'Come sta giocando il Foggia?', array['bene', 'cosi cosi', 'male'])
    returning id
  `)).rows[0].id;
});

test('la vista pubblica non contiene la risposta giusta', async () => {
  const colonne = (await db.query(`
    select column_name from information_schema.columns
    where table_name = 'quiz_pubblici' order by column_name
  `)).rows.map((r) => r.column_name);
  assert.ok(!colonne.includes('giusta'), `la vista espone ${colonne.join(', ')}`);
  assert.ok(colonne.includes('opzioni'));
});

test('la tabella delle domande non ha nessuna politica di lettura', async () => {
  const politiche = (await db.query(`
    select cmd from pg_policies where tablename = 'quiz_domande'
  `)).rows.map((r) => r.cmd);
  assert.ok(!politiche.includes('SELECT'), `politiche trovate: ${politiche.join(', ')}`);
});

test('chi risponde giusto prende i punti e vede la spiegazione', async () => {
  await db.exec(`set prova.utente = '${ANNA}'`);
  const r = (await db.query('select * from rispondi_quiz($1, 1::smallint)', [domanda])).rows[0];
  assert.equal(r.esatta, true);
  assert.equal(r.punti, 20);
  assert.equal(r.gia_risposto, false);
  assert.match(r.spiegazione, /Zeman/);
});

test('rispondere due volte non ripaga e non cambia la risposta', async () => {
  const r = (await db.query('select * from rispondi_quiz($1, 0::smallint)', [domanda])).rows[0];
  assert.equal(r.gia_risposto, true);
  assert.equal(r.punti, 0);
  assert.equal(r.esatta, true, 'la prima risposta resta quella buona');
  const totale = (await db.query('select punti_totali($1) as p', [ANNA])).rows[0].p;
  assert.equal(totale, 20);
});

test('chi sbaglia non prende punti ma scopre la risposta', async () => {
  await db.exec(`set prova.utente = '${BEPPE}'`);
  const r = (await db.query('select * from rispondi_quiz($1, 0::smallint)', [domanda])).rows[0];
  assert.equal(r.esatta, false);
  assert.equal(r.punti, 0);
  assert.equal(r.corretta, 1);
});

test('una domanda chiusa non accetta risposte', async () => {
  await assert.rejects(
    db.query('select * from rispondi_quiz($1, 0::smallint)', [chiusa]),
    /non e aperta/,
  );
});

test('una risposta fuori elenco viene rifiutata', async () => {
  const altra = (await db.query(`
    insert into quiz_domande (partita, fase, testo, opzioni, giusta)
    values ('m1', 'post', 'Quante reti ha segnato il Foggia in casa?', array['una', 'due'], 0)
    returning id
  `)).rows[0].id;
  await assert.rejects(db.query('select * from rispondi_quiz($1, 7::smallint)', [altra]), /fuori elenco/);
});

test('senza account non si risponde', async () => {
  await db.exec("set prova.utente = ''");
  await assert.rejects(db.query('select * from rispondi_quiz($1, 1::smallint)', [domanda]), /serve un account/);
});

test('il sondaggio si vota, si puo cambiare idea, e paga una volta sola', async () => {
  await db.exec(`set prova.utente = '${ANNA}'`);
  assert.equal((await db.query('select vota_sondaggio($1, 0::smallint) as p', [sondaggio])).rows[0].p, 5);
  assert.equal((await db.query('select vota_sondaggio($1, 2::smallint) as p', [sondaggio])).rows[0].p, 0);

  const mio = (await db.query('select scelta from sondaggio_voti where utente = $1', [ANNA])).rows[0];
  assert.equal(mio.scelta, 2, 'deve restare l ultima scelta');
  assert.equal((await db.query('select punti_totali($1) as p', [ANNA])).rows[0].p, 25);
});

test('i risultati escono contati, non uno per uno', async () => {
  await db.exec(`set prova.utente = '${BEPPE}'`);
  await db.query('select vota_sondaggio($1, 2::smallint)', [sondaggio]);
  const righe = (await db.query('select scelta, quanti from sondaggio_risultati where sondaggio = $1', [sondaggio])).rows;
  assert.deepEqual(righe, [{ scelta: 2, quanti: 2 }]);
});

test('il riepilogo dice quante ne ha prese', async () => {
  await db.exec(`set prova.utente = '${ANNA}'`);
  const r = (await db.query("select * from quiz_fatti('m1')")).rows[0];
  assert.equal(r.risposte, 1);
  assert.equal(r.giuste, 1);
});
