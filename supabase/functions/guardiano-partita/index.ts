/**
 * Il guardiano della partita.
 *
 * Gira ogni minuto, chiamato da pg_cron. Quasi sempre non fa niente: fuori
 * dalla finestra di una partita esce subito senza chiamare nessuna fonte. E la
 * regola che tiene i consumi a zero nei giorni in cui non si gioca.
 *
 * Dentro la finestra guarda il punteggio su TheSportsDB (1,4 KB, gratis, senza
 * quota giornaliera) e, solo quando qualcosa cambia, chiede ad API-Football chi
 * ha segnato. Cosi le cento chiamate al giorno del piano gratuito bastano.
 *
 * Quello che ha gia detto se lo ricorda in `stato_partita`: senza quella riga
 * manderebbe la notifica dello stesso gol sessanta volte.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { manda, type Iscrizione } from './push.ts';

const TSDB = 'https://www.thesportsdb.com/api/v1/json/123';
const AF = 'https://v3.football.api-sports.io';
const FOGGIA_TSDB = 134682;
const FOGGIA_AF = 521;

const MINUTO = 60_000;
const PRIMA = 90 * MINUTO;
const DOPO = 3 * 60 * MINUTO;
/** ogni quanto si possono rileggere gli eventi: serve a non bruciare la quota */
const PAUSA_EVENTI = 3 * MINUTO;
const PAUSA_FORMAZIONI = 10 * MINUTO;

const FINITE = ['FT', 'AET', 'PEN'];
const IN_GIOCO = ['1H', 'HT', '2H', 'ET', 'BT', 'P'];

type Tipo = 'formazioni' | 'inizio' | 'gol' | 'espulsione' | 'fine';
type Avviso = { tipo: Tipo; titolo: string; testo: string; tag: string; rotta: string };

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const chiaveAF = Deno.env.get('API_FOOTBALL_KEY') ?? '';
const jwk = JSON.parse(Deno.env.get('VAPID_JWK') ?? '{}') as JsonWebKey;
const pubblica = Deno.env.get('VAPID_PUBLIC') ?? '';
const CONTATTO = 'https://daunia.vercel.app';

async function json(url: string, headers?: HeadersInit) {
  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

/** La prossima partita del Foggia, chiesta a TheSportsDB e messa da parte. */
async function trovaProssima() {
  const d = await json(`${TSDB}/eventsnext.php?id=${FOGGIA_TSDB}`);
  const e = d?.events?.[0];
  if (!e?.idEvent || !e?.strTimestamp) return null;

  const riga = {
    partita: String(e.idEvent),
    event_id: Number(e.idEvent),
    fixture_id: e.idAPIfootball ? Number(e.idAPIfootball) : null,
    kickoff: `${e.strTimestamp}Z`,
    etichetta: e.strEvent ?? null,
    casa: null,
    ospiti: null,
    stato: e.strStatus ?? 'NS',
  };
  await db.from('stato_partita').upsert(riga, { onConflict: 'partita' });
  return riga;
}

/** Manda un avviso a tutti quelli che lo vogliono ricevere. */
async function diffondi(a: Avviso) {
  const { data } = await db
    .from('push_iscrizioni')
    .select('endpoint, p256dh, auth, preferenze')
    .eq(`preferenze->>${a.tipo}`, 'true');

  const iscritti = (data ?? []) as Array<Iscrizione & { preferenze: Record<string, boolean> }>;
  const morti: string[] = [];
  let consegnati = 0;
  let falliti = 0;

  await Promise.all(iscritti.map(async (i) => {
    try {
      const stato = await manda(
        { endpoint: i.endpoint, p256dh: i.p256dh, auth: i.auth },
        { titolo: a.titolo, testo: a.testo, tag: a.tag, rotta: a.rotta, tipo: a.tipo },
        jwk, pubblica, CONTATTO,
      );
      // 404 e 410 dicono che quel telefono non esiste piu: la riga va tolta,
      // altrimenti la tabella si riempie di iscrizioni morte. Un errore di rete
      // invece non dimostra niente, e la riga resta.
      if (stato === 404 || stato === 410) morti.push(i.endpoint);
      else if (stato >= 200 && stato < 300) consegnati += 1;
      else falliti += 1;
    } catch {
      // una consegna fallita non deve fermare le altre
      falliti += 1;
    }
  }));

  if (morti.length) await db.from('push_iscrizioni').delete().in('endpoint', morti);
  return { consegnati, falliti, rimossi: morti.length };
}

Deno.serve(async (req) => {
  // solo chi conosce il segreto: la funzione ha il service role in mano
  const segreto = Deno.env.get('GUARDIANO_SEGRETO');
  if (!segreto || req.headers.get('x-guardiano') !== segreto) {
    return new Response(JSON.stringify({ errore: 'non autorizzato' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  /*
   * Invio di prova.
   *
   * Serve a rispondere all'unica domanda che conta prima di una partita vera:
   * la notifica arriva a schermo bloccato, si', o no? Senza questo lo si scopre
   * la domenica alle nove di sera, quando non c'e piu tempo per rimediare.
   */
  const corpo = await req.json().catch(() => ({}));
  if (corpo?.prova) {
    const esito = await diffondi({
      tipo: 'gol',
      titolo: 'Prova. GOL DEL FOGGIA!',
      testo: "Se leggi questo, domenica funziona.",
      tag: 'prova',
      rotta: '/',
    });
    return Response.json({ prova: true, ...esito });
  }

  const adesso = Date.now();

  // la partita di riferimento: quella salvata, se ancora attuale
  const { data: righe } = await db
    .from('stato_partita').select('*').order('kickoff', { ascending: false }).limit(1);
  let riga = righe?.[0] ?? null;

  const scaduta = !riga?.kickoff || Date.parse(riga.kickoff) + DOPO < adesso;
  if (scaduta) riga = await trovaProssima();
  if (!riga?.kickoff) {
    return Response.json({ fatto: 'nessuna partita in vista' });
  }

  const t = Date.parse(riga.kickoff);
  if (adesso < t - PRIMA || adesso > t + DOPO) {
    return Response.json({ fatto: 'fuori dalla finestra', kickoff: riga.kickoff });
  }

  const avvisi: Avviso[] = [];
  const patch: Record<string, unknown> = { aggiornato_il: new Date().toISOString() };
  const detti = new Set<string>((riga.eventi_detti ?? []) as string[]);

  // ---------------------------------------------------------- le formazioni
  const primaDelFischio = adesso < t;
  const daRileggere = !riga.formazioni_viste_il
    || adesso - Date.parse(riga.formazioni_viste_il) > PAUSA_FORMAZIONI;

  if (primaDelFischio && !riga.formazioni_mandate && riga.fixture_id && chiaveAF && daRileggere) {
    patch.formazioni_viste_il = new Date().toISOString();
    const f = await json(`${AF}/fixtures/lineups?fixture=${riga.fixture_id}`, { 'x-apisports-key': chiaveAF });
    const lato = (f?.response ?? []).find((x: { team?: { id?: number } }) => x.team?.id === FOGGIA_AF);
    if (lato?.startXI?.length) {
      patch.formazioni_mandate = true;
      const nomi = lato.startXI
        .map((p: { player?: { name?: string } }) => p.player?.name)
        .filter(Boolean).join(', ');
      avvisi.push({
        tipo: 'formazioni',
        titolo: 'Formazioni ufficiali',
        testo: nomi,
        tag: `formazioni-${riga.partita}`,
        rotta: '/',
      });
    }
  }

  // ------------------------------------------------- punteggio e stato gara
  const ev = await json(`${TSDB}/lookupevent.php?id=${riga.event_id}`);
  const e = ev?.events?.[0];
  if (!e) return Response.json({ fatto: 'fonte muta', avvisi: 0 });

  const stato = String(e.strStatus ?? '').trim() || 'NS';
  const casa = e.intHomeScore === null || e.intHomeScore === '' ? null : Number(e.intHomeScore);
  const ospiti = e.intAwayScore === null || e.intAwayScore === '' ? null : Number(e.intAwayScore);
  const etichetta = riga.etichetta ?? e.strEvent ?? 'Foggia';

  patch.stato = stato;
  patch.casa = casa;
  patch.ospiti = ospiti;

  if (!riga.inizio_mandato && IN_GIOCO.includes(stato) && !FINITE.includes(stato)) {
    patch.inizio_mandato = true;
    avvisi.push({
      tipo: 'inizio', titolo: 'Si comincia', testo: etichetta,
      tag: `inizio-${riga.partita}`, rotta: '/',
    });
  }

  const cambiato = casa !== riga.casa || ospiti !== riga.ospiti;
  const finita = FINITE.includes(stato);

  // --------------------------------------------- gol ed espulsioni, dai fatti
  const eventiVecchi = riga.eventi_letti_il ? adesso - Date.parse(riga.eventi_letti_il) : Infinity;
  const vaLetto = chiaveAF && riga.fixture_id
    && (cambiato || (IN_GIOCO.includes(stato) && eventiVecchi > PAUSA_EVENTI));

  if (vaLetto) {
    patch.eventi_letti_il = new Date().toISOString();
    const d = await json(`${AF}/fixtures/events?fixture=${riga.fixture_id}`, { 'x-apisports-key': chiaveAF });

    for (const x of (d?.response ?? [])) {
      const minuto = x.time?.elapsed ?? 0;
      const chi = x.player?.name ?? '';
      const nostro = x.team?.id === FOGGIA_AF;

      if (x.type === 'Goal') {
        const firma = `gol-${minuto}-${chi}`;
        if (detti.has(firma)) continue;
        detti.add(firma);
        avvisi.push({
          tipo: 'gol',
          titolo: nostro ? `GOL DEL FOGGIA! ${casa ?? 0}-${ospiti ?? 0}` : `Gol subito. ${casa ?? 0}-${ospiti ?? 0}`,
          testo: `${minuto}' ${chi}`,
          tag: `punteggio-${riga.partita}`,
          rotta: '/',
        });
      }

      if (x.type === 'Card' && String(x.detail ?? '').includes('Red')) {
        const firma = `rosso-${minuto}-${chi}`;
        if (detti.has(firma)) continue;
        detti.add(firma);
        avvisi.push({
          tipo: 'espulsione',
          titolo: nostro ? 'Espulso un giocatore del Foggia' : 'Espulso un avversario',
          testo: `${minuto}' ${chi}`,
          tag: `rosso-${riga.partita}-${minuto}`,
          rotta: '/',
        });
      }
    }
    patch.eventi_detti = [...detti];
  }

  // ------------------------------------------------------------ fine partita
  if (finita && !riga.fine_mandata) {
    patch.fine_mandata = true;
    const nostroCasa = String(e.strHomeTeam ?? '').toLowerCase().includes('foggia');
    const nostri = nostroCasa ? casa : ospiti;
    const loro = nostroCasa ? ospiti : casa;
    const esito = nostri === null || loro === null ? 'Finita'
      : nostri > loro ? 'Vittoria' : nostri < loro ? 'Sconfitta' : 'Pareggio';
    avvisi.push({
      tipo: 'fine',
      titolo: `${esito}. ${casa ?? 0}-${ospiti ?? 0}`,
      testo: 'Due minuti per dare i voti ai giocatori.',
      tag: `fine-${riga.partita}`,
      rotta: '/',
    });
  }

  await db.from('stato_partita').update(patch).eq('partita', riga.partita);

  const esiti = [];
  for (const a of avvisi) esiti.push({ tipo: a.tipo, ...(await diffondi(a)) });

  return Response.json({ partita: etichetta, stato, casa, ospiti, avvisi: esiti });
});
