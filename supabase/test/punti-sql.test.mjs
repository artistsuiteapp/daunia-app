import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/*
 * I punti, provati su Postgres vero.
 *
 * Qui si controlla la cosa che conta piu di tutte: che la stessa azione non
 * paghi due volte. Il guardiano puo rielaborare la stessa partita, un trigger
 * puo ripartire, una rete puo far arrivare due volte la stessa chiamata. Se
 * l'idempotenza non tiene, la classifica e finta e non c'e modo di accorgersene
 * guardandola.
 *
 * Le tabelle di contorno (profiles, pronostici, stato_partita...) qui sono
 * ricreate in piccolo: servono solo a far girare i trigger. auth.uid() e una
 * funzione finta che legge una variabile, cosi si puo far finta di essere
 * qualcuno.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const MIGRAZIONE = join(QUI, '..', 'migrations', '20260911140000_punti_e_classifiche.sql');

let db;
const ANNA = '11111111-1111-1111-1111-111111111111';
const BEPPE = '22222222-2222-2222-2222-222222222222';
const CARLA = '33333333-3333-3333-3333-333333333333';

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    create extension if not exists plpgsql;
    -- su Supabase questi ruoli ci sono gia; qui vanno creati, se no le revoche
    -- della migrazione falliscono con "role anon does not exist"
    do $ruoli$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
    end $ruoli$;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('prova.utente', true), '')::uuid;
    $$;

    create table profiles (
      id uuid primary key,
      nome text not null,
      avatar text
    );
    create table pronostici (
      utente uuid not null references profiles on delete cascade,
      partita text not null,
      casa smallint not null,
      ospiti smallint not null,
      creato_il timestamptz not null default now(),
      primary key (utente, partita)
    );
    create table voti (
      utente uuid not null references profiles on delete cascade,
      partita text not null,
      giocatore text not null,
      voto smallint not null,
      primary key (utente, partita, giocatore)
    );
    create table mvp_voti (
      utente uuid not null references profiles on delete cascade,
      partita text not null,
      giocatore text not null,
      primary key (utente, partita)
    );
    create table partite_chiuse (
      partita text primary key,
      casa smallint not null,
      ospiti smallint not null,
      chiusa_il timestamptz not null default now()
    );
    create table stato_partita (
      partita text primary key,
      casa smallint,
      ospiti smallint,
      stato text,
      finita_il timestamptz
    );

    insert into profiles (id, nome) values
      ('${ANNA}', 'Anna'), ('${BEPPE}', 'Beppe'), ('${CARLA}', 'Carla');
  `);

  await db.exec(readFileSync(MIGRAZIONE, 'utf8'));
});

const punti = async (chi) => (await db.query('select punti_totali($1) as p', [chi])).rows[0].p;

test('il pronostico paga appena si mette', async () => {
  await db.query("insert into pronostici (utente, partita, casa, ospiti) values ($1, 'm1', 2, 0)", [ANNA]);
  assert.equal(await punti(ANNA), 10);
});

test('cambiare il pronostico non ripaga', async () => {
  await db.query("update pronostici set casa = 3 where utente = $1 and partita = 'm1'", [ANNA]);
  assert.equal(await punti(ANNA), 10);
});

test('le pagelle si pagano una volta per partita, non una per giocatore', async () => {
  for (const g of ['Saro', 'Berra', 'Gallo', 'Panico']) {
    await db.query('insert into voti (utente, partita, giocatore, voto) values ($1, $2, $3, 7)', [ANNA, 'm1', g]);
  }
  assert.equal(await punti(ANNA), 15);
});

test('il triplice fischio chiude la partita e paga i pronostici', async () => {
  await db.query("insert into pronostici (utente, partita, casa, ospiti) values ($1, 'm2', 1, 0)", [ANNA]);   // esatto
  await db.query("insert into pronostici (utente, partita, casa, ospiti) values ($1, 'm2', 3, 1)", [BEPPE]);  // esito
  await db.query("insert into pronostici (utente, partita, casa, ospiti) values ($1, 'm2', 0, 2)", [CARLA]);  // niente

  await db.query("insert into stato_partita (partita, casa, ospiti, stato) values ('m2', 1, 0, 'FT')");
  await db.query("update stato_partita set finita_il = now() where partita = 'm2'");

  const chiusa = (await db.query("select casa, ospiti from partite_chiuse where partita = 'm2'")).rows[0];
  assert.deepEqual(chiusa, { casa: 1, ospiti: 0 });

  assert.equal(await punti(ANNA), 15 + 10 + 100);
  assert.equal(await punti(BEPPE), 10 + 50);
  assert.equal(await punti(CARLA), 10);
});

test('chiudere due volte la stessa partita non paga due volte', async () => {
  const prima = await punti(ANNA);
  await db.query("select chiudi_partita('m2', 1, 0)");
  await db.query("update stato_partita set finita_il = now() where partita = 'm2'");
  assert.equal(await punti(ANNA), prima);
});

test('il risultato esatto non si somma all esito', async () => {
  const righe = (await db.query(
    "select azione from punti_movimenti where utente = $1 and chiave = 'm2' order by azione", [ANNA],
  )).rows.map((r) => r.azione);
  assert.deepEqual(righe, ['pronostico', 'risultato']);
});

test('la condivisione paga una volta al giorno', async () => {
  await db.exec(`set prova.utente = '${BEPPE}'`);
  const primo = (await db.query('select punti_condivisione() as p')).rows[0].p;
  const secondo = (await db.query('select punti_condivisione() as p')).rows[0].p;
  assert.equal(primo, 5);
  assert.equal(secondo, 0);
});

test('la classifica mette in ordine e numera le posizioni', async () => {
  const righe = (await db.query("select posizione, nome, punti from classifica('settimana', 10)")).rows;
  assert.equal(righe[0].nome, 'Anna');
  assert.ok(righe[0].punti > righe[1].punti, 'Anna deve stare davanti');
  assert.deepEqual(righe.map((r) => r.posizione), [1, 2, 3]);
});

test('la propria posizione si trova anche da fuori i primi', async () => {
  await db.exec(`set prova.utente = '${CARLA}'`);
  const mia = (await db.query("select * from mia_posizione('settimana')")).rows[0];
  assert.equal(mia.posizione, 3);
  assert.equal(mia.quanti_in_classifica, 3);
});

test('la stagione comincia a luglio', async () => {
  const r = (await db.query(`
    select stagione_di('2026-09-11T12:00:00Z'::timestamptz) as autunno,
           stagione_di('2027-02-11T12:00:00Z'::timestamptz) as inverno,
           stagione_di('2026-06-11T12:00:00Z'::timestamptz) as giugno
  `)).rows[0];
  assert.equal(r.autunno, '2026-27');
  assert.equal(r.inverno, '2026-27');
  assert.equal(r.giugno, '2025-26');
});

test('i livelli salgono con i punti', async () => {
  const r = (await db.query(`
    select livello_di(0) as zero, livello_di(300) as trecento,
           livello_di(1500) as millecinque, livello_di(9000) as novemila
  `)).rows[0];
  assert.deepEqual(r, { zero: 'Curva Sud', trecento: 'Rossonero', millecinque: 'Ultras', novemila: 'Leggenda' });
});

test('i badge arrivano da soli e non si duplicano', async () => {
  const suoi = (await db.query(
    'select badge from badge_utente where utente = $1 order by badge', [ANNA],
  )).rows.map((r) => r.badge);
  assert.ok(suoi.includes('primo-pronostico'), JSON.stringify(suoi));
  assert.ok(suoi.includes('risultato-esatto'), JSON.stringify(suoi));

  await db.query('select aggiorna_badge($1)', [ANNA]);
  const dopo = (await db.query('select count(*)::int as n from badge_utente where utente = $1', [ANNA])).rows[0].n;
  assert.equal(dopo, suoi.length);
});

test('una tariffa che non esiste non paga niente', async () => {
  const prima = await punti(ANNA);
  await db.query("select assegna_punti($1, 'inventata', 'x')", [ANNA]).catch(() => {});
  assert.equal(await punti(ANNA), prima);
});
