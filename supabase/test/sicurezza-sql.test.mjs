import { strict as assert } from 'node:assert';
import { test, before } from 'node:test';

import { databaseCompleto, come } from './tutte-le-migrazioni.mjs';

/*
 * Gli attacchi del 13 settembre 2026, ripetuti a ogni giro dei test.
 *
 * Ogni prova qui sotto e riuscita almeno una volta contro le migrazioni di
 * prima. Si fanno da un utente qualsiasi e da un anonimo, cioe con quello che
 * chiunque ha in mano: la chiave pubblica sta dentro l'app.
 */

let db;
const ANNA = '11111111-1111-1111-1111-111111111111';  // admin
const DORA = '44444444-4444-4444-4444-444444444444';  // altra admin
const MARCO = '66666666-6666-6666-6666-666666666666'; // moderatore
const CARLA = '33333333-3333-3333-3333-333333333333'; // utente
const EVA = '55555555-5555-5555-5555-555555555555';   // utente

const D1 = 'd0000000-0000-0000-0000-000000000001';
const D_NASCOSTA = 'd0000000-0000-0000-0000-000000000002';

const uno = async (sql, p) => (await db.query(sql, p)).rows[0];
const rifiuta = async (utente, sql, parola) => {
  await assert.rejects(() => come(db, utente, () => db.query(sql)), parola ? new RegExp(parola) : undefined);
};
const puntiDi = async (u) => Number((await uno(
  `select coalesce(sum(punti), 0) as p from punti_movimenti where utente = $1`, [u])).p);

before(async () => {
  db = await databaseCompleto();
  await db.exec(`
    insert into auth.users (id, email) values
      ('${ANNA}', 'anna@esempio.it'), ('${DORA}', 'dora@esempio.it'), ('${MARCO}', 'marco@esempio.it'),
      ('${CARLA}', 'carla@esempio.it'), ('${EVA}', 'eva@esempio.it');
    update profiles set ruolo = 'admin' where id in ('${ANNA}', '${DORA}');
    update profiles set ruolo = 'moderatore' where id = '${MARCO}';
    insert into discussioni (id, autore, titolo, testo, argomento) values
      ('${D1}', '${CARLA}', 'Titolo uno', 'Testo abbastanza lungo', 'Partita');
    insert into discussioni (id, autore, titolo, testo, argomento, nascosta) values
      ('${D_NASCOSTA}', '${CARLA}', 'Nascosta', 'Testo abbastanza lungo', 'Partita', true);
  `);
});

// ------------------------------------------------------------ contenuti

test('chi ha scritto non rende visibile quello che i moderatori hanno nascosto', async () => {
  await rifiuta(CARLA, `update discussioni set nascosta = false`, 'chi modera');
  await come(db, CARLA, () => db.query(`update discussioni set nascosta = false where id = '${D_NASCOSTA}'`)).catch(() => {});
  assert.equal((await uno(`select nascosta from discussioni where id = $1`, [D_NASCOSTA])).nascosta, true);
});

test('chi ha scritto non si fissa in cima e non cambia la data', async () => {
  await rifiuta(CARLA, `update discussioni set attiva_il = '2099-01-01' where id = '${D1}'`, 'non si modifica');
  await rifiuta(CARLA, `update discussioni set creata_il = '2020-01-01' where id = '${D1}'`, 'non si modifica');
});

test('chi ha scritto corregge il proprio testo', async () => {
  await come(db, CARLA, () => db.query(`update discussioni set testo = 'Testo corretto a mano' where id = '${D1}'`));
  assert.equal((await uno(`select testo from discussioni where id = $1`, [D1])).testo, 'Testo corretto a mano');
});

test('chi modera nasconde, ma non riscrive le parole degli altri', async () => {
  await rifiuta(MARCO, `update discussioni set testo = 'Parole messe in bocca' where id = '${D1}'`, 'solo quello che si e scritto');
  await come(db, MARCO, () => db.query(`update discussioni set nascosta = true where id = '${D1}'`));
  assert.equal((await uno(`select nascosta from discussioni where id = $1`, [D1])).nascosta, true);
  await come(db, MARCO, () => db.query(`update discussioni set nascosta = false where id = '${D1}'`));
});

test('un sospeso non riscrive quello che ha pubblicato', async () => {
  await db.exec(`update profiles set sospeso_fino = now() + interval '1 day' where id = '${CARLA}'`);
  try {
    await rifiuta(CARLA, `update discussioni set testo = 'Riscritto da sospesa' where id = '${D1}'`, 'sospeso');
  } finally {
    await db.exec(`update profiles set sospeso_fino = null where id = '${CARLA}'`);
  }
});

test('le risposte non si spostano in un\'altra discussione', async () => {
  const r = await uno(`insert into risposte (discussione, autore, testo) values ($1, $2, 'ciao') returning id`, [D1, CARLA]);
  await rifiuta(CARLA, `update risposte set discussione = '${D_NASCOSTA}' where id = '${r.id}'`, 'non si modifica');
});

// -------------------------------------------------------------- profilo

test('ruolo e sospensione non si toccano dalla tabella, nemmeno da admin', async () => {
  await rifiuta(CARLA, `update profiles set ruolo = 'admin' where id = '${CARLA}'`, 'pannello');
  await rifiuta(ANNA, `update profiles set ruolo = 'utente' where id = '${DORA}'`, 'pannello');
  await rifiuta(ANNA, `update profiles set sospeso_fino = now() + interval '3 days' where id = '${EVA}'`, 'pannello');
  assert.equal((await uno(`select ruolo from profiles where id = $1`, [DORA])).ruolo, 'admin');
});

test('ruolo e sospensione passano ancora dalle funzioni del pannello', async () => {
  await come(db, ANNA, () => db.query(`select sospendi_utente('${EVA}', 1)`));
  assert.ok((await uno(`select sospeso_fino from profiles where id = $1`, [EVA])).sospeso_fino);
  await come(db, ANNA, () => db.query(`select revoca_sospensione('${EVA}')`));
  assert.equal((await uno(`select sospeso_fino from profiles where id = $1`, [EVA])).sospeso_fino, null);
});

test('un profilo inserito a mano nasce utente', async () => {
  const nuovo = '77777777-7777-7777-7777-777777777777';
  await db.exec(`insert into auth.users (id, email) values ('${nuovo}', 'nuovo@esempio.it'); delete from profiles where id = '${nuovo}';`);
  await come(db, nuovo, () => db.query(`insert into profiles (id, nome, ruolo) values ('${nuovo}', 'Nuovo', 'admin')`));
  assert.equal((await uno(`select ruolo from profiles where id = $1`, [nuovo])).ruolo, 'utente');
});

test('l\'immagine del profilo viene solo dal nostro archivio, dalla propria cartella', async () => {
  await rifiuta(CARLA, `update profiles set avatar = 'https://esempio.org/storage/v1/object/public/avatar/${CARLA}/x.jpg' where id = '${CARLA}'`, 'immagine');
  await rifiuta(CARLA, `update profiles set avatar = 'https://abc.supabase.co/storage/v1/object/public/avatar/${EVA}/x.jpg' where id = '${CARLA}'`, 'immagine');
  const buona = `https://abc.supabase.co/storage/v1/object/public/avatar/${CARLA}/1726000000000.jpg`;
  await come(db, CARLA, () => db.query(`update profiles set avatar = '${buona}' where id = '${CARLA}'`));
  assert.equal((await uno(`select avatar from profiles where id = $1`, [CARLA])).avatar, buona);
  // e un'immagine gia salvata non impedisce di cambiare il resto
  await come(db, CARLA, () => db.query(`update profiles set bio = 'ciao' where id = '${CARLA}'`));
});

test('i caratteri invisibili spariscono dal nome, le emoji composte restano', async () => {
  await come(db, CARLA, () => db.query(`update profiles set nome = E'Carla\\u202E\\u200B' where id = '${CARLA}'`));
  assert.equal((await uno(`select nome from profiles where id = $1`, [CARLA])).nome, 'Carla');
  const famiglia = 'Carla 👨‍👩‍👧';
  await come(db, CARLA, () => db.query(`update profiles set nome = $1 where id = $2`, [famiglia, CARLA]));
  assert.equal((await uno(`select nome from profiles where id = $1`, [CARLA])).nome, famiglia);
});

test('un\'email con una lettera sola prima della chiocciola si registra', async () => {
  await db.exec(`insert into auth.users (id, email) values ('88888888-8888-8888-8888-888888888888', 'a@esempio.it')`);
  const p = await uno(`select nome from profiles where id = '88888888-8888-8888-8888-888888888888'`);
  assert.match(p.nome, /^Tifoso /);
  await db.exec(`insert into auth.users (id, email) values ('99999999-9999-9999-9999-999999999999', '${'x'.repeat(60)}@esempio.it')`);
  const lungo = await uno(`select nome from profiles where id = '99999999-9999-9999-9999-999999999999'`);
  assert.equal(lungo.nome.length, 40);
});

// ------------------------------------------------ calendario e punti

test('i pronostici su partite inventate non valgono punti', async () => {
  const prima = await puntiDi(EVA);
  await come(db, EVA, () => db.query(
    `insert into pronostici (utente, partita, casa, ospiti) select '${EVA}', 'finta-' || g, 1, 0 from generate_series(1, 50) g`));
  await come(db, EVA, () => db.query(
    `insert into voti (utente, partita, giocatore, voto) select '${EVA}', 'finta-' || g, 'x', 6 from generate_series(1, 50) g`));
  assert.equal(await puntiDi(EVA), prima);
});

test('il ponte: pronostico sull\'id dell\'app, partita chiusa dal guardiano, punti pagati', async () => {
  const fra = new Date(Date.now() + 2 * 3600e3).toISOString();
  await db.query(`select allinea_calendario($1)`, [JSON.stringify([
    { partita: 'wp-2026-2027-010', kickoff: fra, casa: null, ospiti: null, finita: false },
  ])]);
  // il guardiano scrive la sua riga con il suo id e lo stesso orario
  await db.query(`insert into stato_partita (partita, event_id, kickoff, etichetta) values ('3000010', 3000010, $1, 'Foggia vs Prova')`, [fra]);
  await db.query(`select allinea_calendario($1)`, [JSON.stringify([
    { partita: 'wp-2026-2027-010', kickoff: fra, casa: null, ospiti: null, finita: false },
  ])]);
  assert.equal((await uno(`select event_id from calendario where partita = 'wp-2026-2027-010'`)).event_id, '3000010');

  const prima = await puntiDi(CARLA);
  await come(db, CARLA, () => db.query(
    `insert into pronostici (utente, partita, casa, ospiti) values ('${CARLA}', 'wp-2026-2027-010', 2, 1)`));
  assert.equal(await puntiDi(CARLA), prima + 10);

  // triplice fischio, scritto dal guardiano sulla sua riga
  await db.query(`update stato_partita set casa = 2, ospiti = 1, finita_il = now() where partita = '3000010'`);
  assert.equal(await puntiDi(CARLA), prima + 10 + 100);
  assert.ok(await uno(`select 1 as c from partite_chiuse where partita = 'wp-2026-2027-010'`));
});

test('il pronostico si chiude al fischio anche con l\'id dell\'app', async () => {
  const passato = new Date(Date.now() - 600e3).toISOString();
  await db.query(`select allinea_calendario($1)`, [JSON.stringify([
    { partita: 'wp-2026-2027-011', kickoff: passato, finita: false },
  ])]);
  await rifiuta(EVA,
    `insert into pronostici (utente, partita, casa, ospiti) values ('${EVA}', 'wp-2026-2027-011', 1, 1)`, 'fischio');
});

test('il punteggio cancellato torna, e la partita mai chiusa si chiude', async () => {
  const ieri = new Date(Date.now() - 24 * 3600e3).toISOString();
  // il caso di Monopoli-Foggia: chiusa dal guardiano sul suo id, poi punteggio azzerato
  await db.query(`insert into stato_partita (partita, event_id, kickoff, etichetta, finita_il) values ('3000012', 3000012, $1, 'Monopoli vs Foggia', now())`, [ieri]);
  await db.exec(`insert into partite_chiuse (partita, casa, ospiti) values ('3000012', 1, 0)`);
  await db.exec(`insert into pronostici (utente, partita, casa, ospiti, creato_il) values ('${EVA}', 'wp-2026-2027-012', 2, 0, now() - interval '2 days')`);

  const prima = await puntiDi(EVA);
  const giro = [{ partita: 'wp-2026-2027-012', kickoff: ieri, casa: null, ospiti: null, finita: false }];
  await db.query(`select allinea_calendario($1)`, [JSON.stringify(giro)]);

  const s = await uno(`select casa, ospiti from stato_partita where partita = '3000012'`);
  assert.deepEqual([s.casa, s.ospiti], [1, 0]);
  // 2-0 contro 1-0: esito indovinato, e i dieci del pronostico che mancavano
  assert.equal(await puntiDi(EVA), prima + 10 + 50);

  // ripetuto non paga due volte
  await db.query(`select allinea_calendario($1)`, [JSON.stringify(giro)]);
  assert.equal(await puntiDi(EVA), prima + 10 + 50);
});

test('allinea_calendario non la chiama l\'app', async () => {
  await rifiuta(CARLA, `select allinea_calendario('[]'::jsonb)`);
  await rifiuta(null, `select allinea_calendario('[]'::jsonb)`);
  await rifiuta(CARLA, `select chiudi_partita('wp-2026-2027-011', 9, 0)`);
});

// ---------------------------------------------------------- segnalazioni

test('una segnalazione nasce aperta, qualunque cosa mandi chi segnala', async () => {
  await come(db, CARLA, () => db.query(
    `insert into segnalazioni (segnalante, tipo, bersaglio, motivo, stato, gestita_da, nota_moderatore)
     values ('${CARLA}', 'profilo', '${EVA}', 'motivo', 'accolta', '${ANNA}', 'finta')`));
  const s = await uno(`select stato, gestita_da, nota_moderatore from segnalazioni where segnalante = $1`, [CARLA]);
  assert.deepEqual([s.stato, s.gestita_da, s.nota_moderatore], ['aperta', null, null]);
  await rifiuta(CARLA,
    `insert into segnalazioni (segnalante, tipo, bersaglio, motivo) values ('${CARLA}', 'discussione', 'non-uuid', 'motivo')`, 'non valida');
});

// ------------------------------------------------------------- notifiche

test('un anonimo non tocca le iscrizioni degli altri', async () => {
  await db.exec(`insert into push_iscrizioni (endpoint, utente, p256dh, auth) values ('https://web.push.apple.com/altrui', null, 'k', 'a')`);
  await come(db, null, () => db.query(`delete from push_iscrizioni`));
  await come(db, null, () => db.query(`update push_iscrizioni set endpoint = 'https://esempio.org/'`));
  assert.ok(await uno(`select 1 as c from push_iscrizioni where endpoint = 'https://web.push.apple.com/altrui'`));
});

test('le iscrizioni accettano solo i servizi di notifica veri', async () => {
  await rifiuta(null, `select iscrivi_notifiche('http://169.254.169.254/latest/meta-data', 'k', 'a', null)`, 'non valida');
  await rifiuta(null, `select iscrivi_notifiche('https://esempio.org/push', 'k', 'a', null)`, 'non valida');
  await come(db, null, () => db.query(`select iscrivi_notifiche('https://fcm.googleapis.com/fcm/send/abc', 'k', 'a', null)`));
  await rifiuta(null, `select preferenze_notifiche('https://fcm.googleapis.com/fcm/send/abc', '{"gol": "si"}'::jsonb)`, 'non valide');
  await come(db, null, () => db.query(`select disiscrivi_notifiche('https://fcm.googleapis.com/fcm/send/abc')`));
  assert.equal(await uno(`select 1 as c from push_iscrizioni where endpoint = 'https://fcm.googleapis.com/fcm/send/abc'`), undefined);
});

// ----------------------------------------------------------------- freno

test('la chat non si allaga', async () => {
  await rifiuta(EVA,
    `insert into messaggi_live (partita, utente, testo) select 'p', '${EVA}', 'spam ' || g from generate_series(1, 20) g`, 'troppo in fretta');
  for (let i = 0; i < 8; i += 1) {
    await come(db, EVA, () => db.query(`insert into messaggi_live (partita, utente, testo) values ('p', '${EVA}', 'uno')`));
  }
  await rifiuta(EVA, `insert into messaggi_live (partita, utente, testo) values ('p', '${EVA}', 'nono')`, 'troppo in fretta');
});

// ------------------------------------------------------------ trasferte

test('chi e bloccato non vede il contatto per la trasferta', async () => {
  await db.exec(`
    insert into trasferte (partita, utente, citta, mezzo) values ('wp-x', '${CARLA}', 'Bari', 'macchina'), ('wp-x', '${EVA}', 'Roma', 'treno');
    insert into trasferte_contatti (partita, utente, canale, riferimento) values ('wp-x', '${CARLA}', 'whatsapp', '+39 333 0000000');
  `);
  const vede = await come(db, EVA, () => db.query(`select riferimento from trasferte_contatti`));
  assert.equal(vede.rows.length, 1);
  await db.exec(`insert into blocchi (utente, bloccato) values ('${CARLA}', '${EVA}')`);
  const dopo = await come(db, EVA, () => db.query(`select riferimento from trasferte_contatti`));
  assert.equal(dopo.rows.length, 0);
});
