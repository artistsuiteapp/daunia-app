import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/*
 * Tutte le migrazioni, in ordine, su un Postgres vero.
 *
 * Gli altri test caricano una migrazione sola sopra tabelle scritte a mano, e
 * vanno bene per provare una funzione. Per la sicurezza non bastano: una
 * politica di una migrazione vecchia e un trigger di una nuova si parlano, e
 * quello che conta e il risultato di tutte insieme.
 *
 * Quello che Supabase ha e Postgres no -- auth, storage, cron, vault, realtime --
 * e finto qui sotto, il minimo perche le migrazioni passino.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const MIGRAZIONI = join(QUI, '..', 'migrations');

export async function databaseCompleto() {
  const db = await PGlite.create();
  await db.exec(`
    do $r$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
      if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
    end $r$;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid(), email text,
      raw_user_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('prova.utente', true), '')::uuid $$;
    create function auth.role() returns text language sql stable as
      $$ select coalesce(nullif(current_setting('prova.ruolo', true), ''), 'anon') $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
    create schema storage;
    create table storage.buckets (id text primary key, name text, public boolean default false,
      file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text,
      name text, owner uuid, created_at timestamptz default now());
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as
      $$ select string_to_array(name, '/') $$;
    create schema cron;
    create table cron.job (jobid serial, jobname text, schedule text, command text, active boolean default true);
    create function cron.schedule(n text, s text, c text) returns bigint language sql as
      $$ insert into cron.job (jobname, schedule, command) values (n, s, c) returning jobid $$;
    create function cron.unschedule(n text) returns boolean language sql as
      $$ delete from cron.job where jobname = n returning true $$;
    create schema net;
    create table net._http_response (id bigint, status_code int, content text, created timestamptz);
    create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
      headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000) returns bigint
      language sql as $$ select 1::bigint $$;
    create schema vault;
    create table vault.decrypted_secrets (name text, decrypted_secret text);
    create function vault.create_secret(s text, n text default null, d text default null) returns uuid
      language sql as $$ insert into vault.decrypted_secrets values (n, s); select gen_random_uuid() $$;
    create schema realtime;
    create table realtime.messages (id bigserial, topic text, extension text, payload jsonb);
    alter table realtime.messages enable row level security;
    create function realtime.topic() returns text language sql stable as
      $$ select current_setting('prova.topic', true) $$;
    create publication supabase_realtime;
    create schema extensions;
  `);

  for (const f of readdirSync(MIGRAZIONI).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRAZIONI, f), 'utf8')
      .replace(/create extension if not exists (pg_cron|pg_net)[^;]*;/gi, '')
      // una funzione e non una stringa: in una stringa sostitutiva "$$" vale "$"
      .replace(/create extension if not exists unaccent[^;]*;/gi,
        () => 'create or replace function unaccent(t text) returns text language sql immutable as $$ select t $$;');
    try {
      await db.exec(sql);
    } catch (e) {
      throw new Error(`${f}: ${e.message}`);
    }
  }

  // i permessi che Supabase da di suo ai due ruoli dell'app
  await db.exec(`
    grant usage on schema public, auth, storage, realtime to anon, authenticated;
    grant all on all tables in schema public to anon, authenticated;
    grant all on all sequences in schema public to anon, authenticated;
    grant execute on all functions in schema auth to anon, authenticated;
  `);
  return db;
}

/** Esegue `fn` come farebbe una richiesta dall'app: da utente, o da anonimo con `null`. */
export async function come(db, utente, fn) {
  await db.exec(`
    reset role;
    set prova.utente = '${utente ?? ''}';
    set prova.ruolo = '${utente ? 'authenticated' : 'anon'}';
    set role ${utente ? 'authenticated' : 'anon'};
  `);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; set prova.utente = ''; set prova.ruolo = '';`);
  }
}
