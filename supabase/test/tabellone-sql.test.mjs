import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

/*
 * Il tabellone a mano, provato sul database vero.
 *
 * Le domande a cui risponde: un gol segnato a mano cambia il punteggio, un gol
 * annullato lo rimette com'era (anche quando in mezzo ce ne sono altri), e chi
 * non e amministratore non puo toccare niente.
 */

const M = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations') + '/';
const ADMIN = '11111111-1111-1111-1111-111111111111';
const TIFOSO = '22222222-2222-2222-2222-222222222222';
let db;

const come = async (chi) => db.exec(`set prova.utente = '${chi ?? ''}'`);
const riga = async () => (await db.query("select * from stato_partita where partita = 'p1'")).rows[0];
const mano = async (azione, args = {}) => {
  const p = {
    p_partita: 'p1', p_azione: azione, p_lato: null, p_nostro: null, p_chi: null,
    p_minuto: null, p_casa: null, p_ospiti: null, p_voce: null, p_valore: null, p_stato: null,
    ...args,
  };
  const nomi = Object.keys(p);
  const sql = `select tabellone_a_mano(${nomi.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
  return (await db.query(sql, nomi.map((n) => p[n]))).rows[0].r;
};

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('prova.utente', true), '')::uuid; $$;
    do $r$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if;
    end $r$;
    create table profiles (id uuid primary key, nome text, ruolo text not null default 'utente');
    create or replace function e_admin() returns boolean language sql stable as $$
      select coalesce((select ruolo = 'admin' from profiles where id = auth.uid()), false); $$;
    create table stato_partita (
      partita text primary key,
      casa smallint, ospiti smallint, stato text,
      gol jsonb not null default '[]'::jsonb,
      finita_il timestamptz,
      aggiornato_il timestamptz not null default now()
    );
    insert into profiles values ('${ADMIN}', 'Salvatore', 'admin'), ('${TIFOSO}', 'Tifoso', 'utente');
    insert into stato_partita (partita, casa, ospiti, stato) values ('p1', 0, 0, '1H');
  `);
  await db.exec(readFileSync(M + '20260916090000_tabellone_a_mano.sql', 'utf8'));
  await come(ADMIN);
});

test('un gol a mano cambia il punteggio e lascia il marcatore nella cronaca', async () => {
  const r = await mano('gol', { p_lato: 'casa', p_nostro: true, p_chi: 'Luciani', p_minuto: 12 });
  assert.equal(r.casa, 1);
  assert.equal(r.ospiti, 0);
  const voce = r.gol.at(-1);
  assert.equal(voce.chi, 'Luciani');
  assert.equal(voce.minuto, '12');
  assert.equal(voce.fonte, 'admin');
  const dal_db = await riga();
  assert.equal(dal_db.casa, 1);
  assert.equal(dal_db.manuale, true);
});

test('il gol dell avversario si segna dallo stesso posto', async () => {
  const r = await mano('gol', { p_lato: 'ospiti', p_nostro: false, p_minuto: 30 });
  assert.deepEqual([r.casa, r.ospiti], [1, 1]);
});

test('annullare un gol rifa il conto anche dei gol arrivati dopo', async () => {
  const dopo = await mano('gol', { p_lato: 'casa', p_nostro: true, p_chi: 'Petito', p_minuto: 67 });
  assert.deepEqual([dopo.casa, dopo.ospiti], [2, 1]);

  // si annulla il primo, quello del 12esimo: resta 1-1, e il gol del 67esimo
  // deve diventare l'1-1 del Foggia, non restare segnato 2-1
  const primo = dopo.gol.find((g) => g.minuto === '12');
  const r = await mano('annulla', { p_voce: primo.id, p_lato: 'casa' });
  assert.deepEqual([r.casa, r.ospiti], [1, 1]);
  assert.equal(r.gol.length, 2);
  const petito = r.gol.find((g) => g.chi === 'Petito');
  assert.deepEqual([petito.casa, petito.ospiti], [1, 1]);
  assert.equal(r.annullati.length, 1);
  assert.equal(r.annullati[0].chi, 'Luciani');
});

test('un gol arrivato dalle fonti si puo annullare lo stesso', async () => {
  await db.exec(`update stato_partita set gol = gol || jsonb_build_array(
    jsonb_build_object('minuto','80','chi',null,'nostro',false,'casa',1,'ospiti',2,'fonte','eventi')),
    manuale_base = jsonb_build_object('casa',0,'ospiti',1) where partita = 'p1'`);
  const prima = await mano('accendi');
  assert.deepEqual([prima.casa, prima.ospiti], [1, 2]);

  const r = await mano('annulla', { p_minuto: 80, p_lato: 'ospiti' });
  assert.deepEqual([r.casa, r.ospiti], [1, 1]);
});

test('il recupero si scrive e si cancella', async () => {
  assert.equal((await mano('recupero', { p_valore: 5 })).recupero, 5);
  assert.equal((await riga()).recupero, 5);
  assert.equal((await mano('recupero', { p_valore: null })).recupero, null);
});

test('correggere il punteggio non perde i gol gia segnati', async () => {
  const r = await mano('punteggio', { p_casa: 3, p_ospiti: 1 });
  assert.deepEqual([r.casa, r.ospiti], [3, 1]);
  // i marcatori restano dove sono
  assert.ok(r.gol.some((g) => g.chi === 'Petito'));
});

test('spegnere restituisce la partita al guardiano', async () => {
  const r = await mano('spegni');
  assert.equal(r.manuale, false);
  assert.equal((await riga()).manuale, false);
  // e riaccendendo si riparte dal punteggio che c'era
  assert.equal((await mano('accendi')).casa, 3);
});

test('chi non e amministratore non tocca niente', async () => {
  await come(TIFOSO);
  await assert.rejects(() => mano('gol', { p_lato: 'casa', p_nostro: true }), /amministratori/);
  await come(null);
  await assert.rejects(() => mano('accendi'), /amministratori/);
  await come(ADMIN);
});

test('a partita chiusa il risultato non si tocca piu', async () => {
  const r = await mano('fine');
  assert.equal(r.stato, 'FT');
  assert.ok((await riga()).finita_il);
  await assert.rejects(() => mano('gol', { p_lato: 'casa', p_nostro: true }), /chiusa/);
});
