import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

import { LIVELLI } from '../../apps/mobile/lib/match-center-core.ts';

/*
 * I livelli stanno in due posti, e ci stanno per un motivo: la tabella `livelli`
 * nel database, e la copia in match-center-core.ts che serve anche senza rete e
 * a chi non ha fatto l'accesso.
 *
 * Due copie pero si allontanano da sole, e chi ci rimette e uno che si vede
 * cambiare livello passando da una schermata all'altra. Qui si applicano le
 * migrazioni su Postgres vero e si confronta la tabella con la lista.
 *
 * Si guarda il RISULTATO, non il testo delle migrazioni: il nome del primo
 * livello viene scritto da una migrazione e corretto da una successiva, e
 * leggere la prima direbbe ancora "Curva Sud".
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const MIGRAZIONI = join(QUI, '..', 'migrations');

let righe;

before(async () => {
  const db = await PGlite.create();
  await db.exec(`
    create extension if not exists plpgsql;
    do $r$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end $r$;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$ select null::uuid; $$;
    create table profiles (id uuid primary key, nome text not null, avatar text);
    create table pronostici (utente uuid references profiles, partita text, casa smallint, ospiti smallint,
      creato_il timestamptz default now(), primary key (utente, partita));
    create table voti (utente uuid references profiles, partita text, giocatore text, voto smallint,
      primary key (utente, partita, giocatore));
    create table mvp_voti (utente uuid references profiles, partita text, giocatore text, primary key (utente, partita));
    create table partite_chiuse (partita text primary key, casa smallint, ospiti smallint, chiusa_il timestamptz default now());
    create table stato_partita (partita text primary key, casa smallint, ospiti smallint, stato text, finita_il timestamptz);
  `);

  for (const f of ['20260911140000_punti_e_classifiche.sql', '20260911180000_livello_occasionale.sql']) {
    await db.exec(readFileSync(join(MIGRAZIONI, f), 'utf8'));
  }

  righe = (await db.query('select soglia, nome, colore from livelli order by soglia')).rows;
});

test('la tabella e la lista nel codice dicono la stessa cosa', () => {
  assert.deepEqual(
    righe,
    LIVELLI.map((l) => ({ soglia: l.soglia, nome: l.nome, colore: l.colore })),
  );
});

test('il primo gradino si chiama Occasionale', () => {
  assert.equal(righe[0].nome, 'Occasionale');
  assert.equal(righe[0].soglia, 0);
});

test('gli altri tre non sono stati toccati', () => {
  assert.deepEqual(righe.slice(1).map((r) => r.nome), ['Rossonero', 'Ultras', 'Leggenda']);
});
