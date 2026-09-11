import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { PGlite } from '@electric-sql/pglite';

/*
 * Il filtro del database, provato su Postgres vero.
 *
 * PERCHE SERVE
 *
 * La regola che decide non e quella nell'app: e questa, perche un controllo
 * nel client si aggira chiamando l'API con la chiave anonima. Ed e anche
 * quella che nessuno provava, perche per farlo servirebbe un Postgres acceso.
 *
 * PGlite e Postgres compilato in WebAssembly: parte dentro node in un secondo,
 * senza Docker e senza server. Cosi la copia che conta ha gli stessi casi di
 * quella in apps/mobile/lib/filtro-core.ts, e quando le due si allontanano se
 * ne accorge un test invece di un tifoso.
 *
 * unaccent non c'e in PGlite. Qui sotto se ne mette una fatta a mano che
 * traslittera le lettere accentate italiane: per queste prove e la stessa cosa.
 */

const QUI = dirname(fileURLToPath(import.meta.url));
const MIGRAZIONI = join(QUI, '..', 'migrations');

let db;

before(async () => {
  db = await PGlite.create();
  await db.exec(`
    create extension if not exists plpgsql;
    create or replace function unaccent(t text) returns text language sql immutable as $fn$
      select translate($1,
        'àáâãäåèéêëìíîïòóôõöùúûüçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ',
        'aaaaaaeeeeiiiiooooouuuucnAAAAAAEEEEIIIIOOOOOUUUUCN');
    $fn$;
  `);

  // le migrazioni del filtro creano anche trigger su tabelle che qui non
  // esistono: si tolgono, la tabella di prova ha il suo piu sotto
  const senzaTrigger = (sql) => sql
    .replace(/create extension[^;]*;/gi, '')
    .replace(/drop trigger[^;]*;/gi, '')
    .replace(/create trigger[^;]*;/gi, '');

  for (const f of [
    '20260906060000_filtro_offese.sql',
    '20260906061000_filtro_translate.sql',
    '20260906062000_trigger_per_colonne.sql',
  ]) {
    await db.exec(senzaTrigger(readFileSync(join(MIGRAZIONI, f), 'utf8')));
  }
  await db.exec(readFileSync(join(MIGRAZIONI, '20260911120000_copri_invece_di_bloccare.sql'), 'utf8'));

  await db.exec(`
    create table prova (id serial primary key, titolo text, testo text);
    create trigger copri_offese before insert or update on prova
      for each row execute function maschera_offese();
  `);
});

const coperto = async (testo) => (await db.query('select maschera_testo($1) as fuori', [testo])).rows[0].fuori;

test('la parolaccia si copre e il resto della frase resta', async () => {
  assert.equal(await coperto('che coglione l’arbitro'), 'che c******* l’arbitro');
  assert.equal(await coperto('ma che cazzo, davvero?'), 'ma che c****, davvero?');
});

test('la bestemmia si copre su due parole e attaccata', async () => {
  assert.equal(await coperto('dio porco che partita'), 'd** p**** che partita');
  assert.equal(await coperto('porcodio'), 'p*******');
});

test('quello che deve passare passa intatto', async () => {
  for (const frase of [
    'che gol di Petito al 24esimo',
    'la diocesi di Foggia',
    'il cane di Dio',
    'porco cane che sfortuna',
    'recitemmo la formazione',
    'la chitarra di mio fratello',
  ]) {
    assert.equal(await coperto(frase), frase, frase);
  }
});

test('i numeri al posto delle lettere non salvano', async () => {
  assert.equal(await coperto('c4zz0'), 'c****');
});

test('la famiglia ki te mu ort si copre', async () => {
  assert.equal(await coperto('vai kitemuort va'), 'vai k******** va');
  assert.equal(await coperto('kitemmuort'), 'k*********');
});

test('le parole aggiunte da noi ci sono', async () => {
  assert.equal(await coperto('sei una bastarda'), 'sei una b*******');
});

test('scritta spezzata lettera per lettera: si copre tutto', async () => {
  const fuori = await coperto('d i o p o r c o');
  assert.equal(fuori, '* * * * * * * *');
});

test('coprire due volte non cambia niente', async () => {
  const una = await coperto('sei uno stronzo');
  assert.equal(await coperto(una), una);
});

test('il testo vuoto resta vuoto', async () => {
  assert.equal(await coperto(''), '');
  assert.equal(await coperto(null), null);
});

test('il trigger scrive nella riga il testo gia coperto', async () => {
  await db.query('insert into prova (titolo, testo) values ($1, $2)', [
    'Che stronzo', 'ha giocato da cani, porcodio',
  ]);
  const riga = (await db.query('select titolo, testo from prova')).rows[0];
  assert.equal(riga.titolo, 'Che s******');
  assert.equal(riga.testo, 'ha giocato da cani, p*******');
});

test('le colonne che non c entrano restano intatte', async () => {
  const { rows } = await db.query("select id from prova where testo like '%p*******%'");
  assert.equal(rows.length, 1);
});
