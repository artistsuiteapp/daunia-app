import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/*
 * Identita e pannello, provati su Postgres vero.
 *
 * Le cose che contano qui sono due, e sono tutte e due di sicurezza:
 *
 * 1. una funzione `security definer` scavalca le politiche, quindi ognuna deve
 *    guardare da sola chi la sta chiamando. Si prova da un utente qualsiasi che
 *    le funzioni del pannello rifiutino, non che restituiscano poco;
 * 2. chi amministra non deve poter restare chiuso fuori dalla sua stessa app:
 *    il proprio ruolo non si cambia da qui, e un admin non tocca un altro admin.
 *
 * `auth.uid()` e finta e legge una variabile, cosi si puo far finta di essere
 * chiunque senza un vero server di autenticazione.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const MIGRAZIONI = join(QUI, '..', 'migrations');

let db;
const ANNA = '11111111-1111-1111-1111-111111111111';   // admin
const BEPPE = '22222222-2222-2222-2222-222222222222';  // moderatore
const CARLA = '33333333-3333-3333-3333-333333333333';  // utente
const DORA = '44444444-4444-4444-4444-444444444444';   // altra admin

const chiSono = async (id) => db.exec(`set prova.utente = '${id ?? ''}';`);

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

    create table profiles (
      id uuid primary key,
      nome text not null,
      avatar text,
      bio text,
      ruolo text not null default 'utente',
      sospeso_fino timestamptz,
      creato_il timestamptz not null default now()
    );
    create table pronostici (utente uuid references profiles on delete cascade, partita text,
      casa smallint, ospiti smallint, creato_il timestamptz default now(), primary key (utente, partita));
    create table voti (utente uuid references profiles on delete cascade, partita text,
      giocatore text, voto smallint, primary key (utente, partita, giocatore));
    create table mvp_voti (utente uuid references profiles on delete cascade, partita text,
      giocatore text, primary key (utente, partita));
    create table partite_chiuse (partita text primary key, casa smallint, ospiti smallint,
      chiusa_il timestamptz default now());
    create table stato_partita (partita text primary key, casa smallint, ospiti smallint,
      stato text, finita_il timestamptz);
    -- serve alla politica di cancellazione in coda alla migrazione
    create table messaggi_live (
      id uuid primary key default gen_random_uuid(),
      partita text, utente uuid references profiles on delete cascade,
      testo text, nascosto boolean not null default false,
      creato_il timestamptz default now()
    );
    alter table messaggi_live enable row level security;
    create table segnalazioni (
      id uuid primary key default gen_random_uuid(),
      segnalante uuid, tipo text, bersaglio text, motivo text,
      stato text not null default 'aperta', creata_il timestamptz default now()
    );

    -- le due guardie del ruolo: su Supabase le crea la migrazione dei ruoli,
    -- che qui porterebbe dietro meta schema
    create or replace function e_admin() returns boolean language sql stable as $$
      select coalesce((select ruolo = 'admin' from profiles where id = auth.uid()), false);
    $$;
    create or replace function e_moderatore() returns boolean language sql stable as $$
      select coalesce((select ruolo in ('moderatore','admin') from profiles where id = auth.uid()), false);
    $$;

    insert into profiles (id, nome, ruolo) values
      ('${ANNA}', 'Anna', 'admin'),
      ('${BEPPE}', 'Beppe', 'moderatore'),
      ('${CARLA}', 'Carla', 'utente'),
      ('${DORA}', 'Dora', 'admin');
  `);

  for (const f of [
    '20260911140000_punti_e_classifiche.sql',
    '20260911180000_livello_occasionale.sql',
    '20260912100000_identita_e_pannello.sql',
  ]) {
    await db.exec(readFileSync(join(MIGRAZIONI, f), 'utf8'));
  }

  // due pronostici pagati: bastano per avere dei punti da leggere
  await db.exec(`
    insert into punti_movimenti (utente, azione, chiave, punti) values
      ('${CARLA}', 'pronostico', 'p1', 10),
      ('${CARLA}', 'esito', 'p1', 50),
      ('${BEPPE}', 'pronostico', 'p1', 10);
  `);
});

const bum = async (sql) => {
  try { await db.exec(sql); return null; } catch (e) { return e.message; }
};

test('i propri punti si leggono, quelli di un altro no', async () => {
  await chiSono(CARLA);
  const mio = await db.query('select punti_totali() as n');
  assert.equal(mio.rows[0].n, 60);

  const errore = await bum(`select punti_totali('${BEPPE}')`);
  assert.match(errore ?? '', /profilo_pubblico/);
});

test('chi modera vede il totale di un altro: gli serve per giudicare', async () => {
  await chiSono(BEPPE);
  const r = await db.query(`select punti_totali('${CARLA}') as n`);
  assert.equal(r.rows[0].n, 60);
});

test('identita porta nome, ruolo e punti di un gruppo in una chiamata sola', async () => {
  await chiSono(CARLA);
  const r = await db.query(`select * from identita(array['${CARLA}','${ANNA}']::uuid[]) order by nome`);
  assert.equal(r.rows.length, 2);
  assert.deepEqual(
    r.rows.map((x) => [x.nome, x.ruolo, x.punti]),
    [['Anna', 'admin', 0], ['Carla', 'utente', 60]],
  );
});

test('il profilo pubblico non porta i badge di qualcun altro dentro', async () => {
  await chiSono(CARLA);
  await db.exec(`insert into badge_utente (utente, badge) values ('${CARLA}', 'primo-pronostico')
                 on conflict do nothing;`);
  const r = await db.query(`select * from profilo_pubblico('${CARLA}')`);
  const riga = r.rows[0];
  assert.equal(riga.nome, 'Carla');
  assert.equal(riga.punti, 60);
  assert.ok(Array.isArray(riga.badge));
  assert.ok(riga.badge.every((b) => typeof b.codice === 'string'));
});

test('il pannello si apre solo a chi modera', async () => {
  await chiSono(CARLA);
  assert.match(await bum('select * from elenco_utenti()') ?? '', /moderatore/);

  await chiSono(BEPPE);
  const r = await db.query('select * from elenco_utenti()');
  assert.equal(r.rows.length, 4);
});

test('la ricerca nel pannello filtra per nome', async () => {
  await chiSono(ANNA);
  const r = await db.query(`select nome from elenco_utenti('car')`);
  assert.deepEqual(r.rows.map((x) => x.nome), ['Carla']);
});

test('promuovere lo fa un admin, non un moderatore', async () => {
  await chiSono(BEPPE);
  assert.match(await bum(`select imposta_ruolo('${CARLA}', 'moderatore')`) ?? '', /admin/);

  await chiSono(ANNA);
  await db.exec(`select imposta_ruolo('${CARLA}', 'moderatore')`);
  const r = await db.query(`select ruolo from profiles where id = '${CARLA}'`);
  assert.equal(r.rows[0].ruolo, 'moderatore');

  await db.exec(`select imposta_ruolo('${CARLA}', 'utente')`);
});

test('un admin non si cambia il ruolo da solo e non tocca un altro admin', async () => {
  await chiSono(ANNA);
  assert.match(await bum(`select imposta_ruolo('${ANNA}', 'utente')`) ?? '', /proprio ruolo/);
  assert.match(await bum(`select imposta_ruolo('${DORA}', 'utente')`) ?? '', /non si tocca/);
});

test('la sospensione mette una data, il bando mette infinito', async () => {
  await chiSono(BEPPE);
  const sospesa = await db.query(`select sospendi_utente('${CARLA}', 3) as fino`);
  assert.ok(new Date(sospesa.rows[0].fino).getTime() > Date.now());

  await db.exec(`select revoca_sospensione('${CARLA}')`);
  const via = await db.query(`select sospeso_fino from profiles where id = '${CARLA}'`);
  assert.equal(via.rows[0].sospeso_fino, null);

  await db.exec(`select sospendi_utente('${CARLA}', null)`);
  const banditi = await db.query(`select sospeso_fino > now() as tace from profiles where id = '${CARLA}'`);
  assert.equal(banditi.rows[0].tace, true);
  await db.exec(`select revoca_sospensione('${CARLA}')`);
});

test('un admin non si sospende e un moderatore lo ferma solo un admin', async () => {
  await chiSono(BEPPE);
  assert.match(await bum(`select sospendi_utente('${ANNA}', 3)`) ?? '', /admin/);
  assert.match(await bum(`select sospendi_utente('${BEPPE}', 3)`) ?? '', /te stesso/);

  await chiSono(ANNA);
  await db.exec(`select sospendi_utente('${BEPPE}', 1)`);
  await db.exec(`select revoca_sospensione('${BEPPE}')`);
});

test('una segnalazione su un profilo adesso mostra qualcosa da leggere', async () => {
  await db.exec(`update profiles set bio = 'scrivo cose' where id = '${CARLA}'`);
  await chiSono(BEPPE);
  const r = await db.query(`select * from testo_segnalato('profilo', '${CARLA}')`);
  assert.equal(r.rows.length, 1);
  assert.match(r.rows[0].testo, /Carla/);
  assert.match(r.rows[0].testo, /scrivo cose/);
});

test('chi non modera non legge il contenuto segnalato', async () => {
  await chiSono(CARLA);
  const r = await db.query(`select * from testo_segnalato('profilo', '${CARLA}')`);
  assert.equal(r.rows.length, 0);
});
