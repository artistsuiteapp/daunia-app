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
import {
  contaGol, concorda, titoloGol, golVero, golDalTabellone, minutoStimato,
  type EventoAF, type Punteggio,
} from './punteggio.ts';

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
/** dopo quante risposte inutili di fila si smette di chiedere ad API-Football */
const RESE = 3;
/** quanto tempo si concede ad API-Football per allinearsi al tabellone */
const ATTESA_ACCORDO = 2 * MINUTO;
/** quante volte per partita si paga la terza fonte per rompere una parita */
const TETTO_PARERI = 6;

const FINITE = ['FT', 'AET', 'PEN'];
const IN_GIOCO = ['1H', 'HT', '2H', 'ET', 'BT', 'P'];

type Tipo = 'formazioni' | 'inizio' | 'gol' | 'espulsione' | 'intervallo' | 'fine';
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

  const inCasa = String(e.strHomeTeam ?? '').toLowerCase().includes('foggia');
  const tabellone: Punteggio | null = casa === null || ospiti === null ? null : { casa, ospiti };
  const prima: Punteggio | null = riga.casa === null || riga.casa === undefined
    || riga.ospiti === null || riga.ospiti === undefined
    ? null : { casa: riga.casa, ospiti: riga.ospiti };

  // --------------------------------------------- gol ed espulsioni, dai fatti
  const eventiVecchi = riga.eventi_letti_il ? adesso - Date.parse(riga.eventi_letti_il) : Infinity;
  // Se API-Football ha gia risposto a vuoto tre volte per questa partita, non
  // si insiste: le chiamate del piano gratuito sono cento al giorno e una
  // partita non coperta se le mangia tutte senza dare niente in cambio.
  const vaLetto = chiaveAF && riga.fixture_id && (riga.af_a_vuoto ?? 0) < RESE
    && (cambiato || (IN_GIOCO.includes(stato) && eventiVecchi > PAUSA_EVENTI));

  /** il punteggio contato dagli eventi: la seconda fonte, gratis */
  let daEventi: Punteggio | null = null;
  const nuoviGol: Array<{ minuto: number; chi: string; nostro: boolean; autogol: boolean }> = [];

  if (vaLetto) {
    patch.eventi_letti_il = new Date().toISOString();
    const d = await json(`${AF}/fixtures/events?fixture=${riga.fixture_id}`, { 'x-apisports-key': chiaveAF });
    const lista = (d?.response ?? []) as EventoAF[];
    if (lista.length) daEventi = contaGol(lista, FOGGIA_AF, inCasa);

    // `errors` non vuoto vuol dire quota finita o account sospeso: la risposta
    // arriva con stato 200 e non si distingue da una partita senza eventi se
    // non guardando qui dentro.
    const rifiutata = !d
      || (d.errors && !Array.isArray(d.errors) && Object.keys(d.errors).length > 0);
    const inutile = rifiutata || (IN_GIOCO.includes(stato) && !lista.length);
    patch.af_a_vuoto = inutile ? (riga.af_a_vuoto ?? 0) + 1 : 0;

    for (const x of lista) {
      const minuto = x.time?.elapsed ?? 0;
      const chi = x.player?.name ?? '';
      const suoi = x.team?.id === FOGGIA_AF;

      // `golVero` scarta il rigore sbagliato, che API-Football marca comunque
      // come "Goal": prima diventava una notifica di gol mai segnato.
      if (golVero(x)) {
        const firma = `gol-${minuto}-${chi}`;
        if (!detti.has(firma)) {
          detti.add(firma);
          const autogol = x.detail === 'Own Goal';
          nuoviGol.push({ minuto, chi, nostro: suoi !== autogol, autogol });
        }
      }

      if (x.type === 'Card' && String(x.detail ?? '').includes('Red')) {
        const firma = `rosso-${minuto}-${chi}`;
        if (detti.has(firma)) continue;
        detti.add(firma);
        avvisi.push({
          tipo: 'espulsione',
          titolo: suoi ? 'Espulso un giocatore del Foggia' : 'Espulso un avversario',
          testo: `${minuto}' ${chi}`,
          tag: `rosso-${riga.partita}-${minuto}`,
          rotta: '/',
        });
      }
    }
    patch.eventi_detti = [...detti];
  }

  // -------------------------------------------------- mettere d'accordo le fonti
  const litigano = !!tabellone && !!daEventi
    && (tabellone.casa !== daEventi.casa || tabellone.ospiti !== daEventi.ospiti);

  // Si aggiorna solo nei giri in cui gli eventi si sono davvero letti: negli
  // altri non si sa niente di nuovo, e azzerarlo cancellerebbe l'attesa.
  if (vaLetto) {
    patch.disaccordo_dal = litigano ? (riga.disaccordo_dal ?? new Date().toISOString()) : null;
  }

  // La terza fonte si paga una chiamata, quindi si chiama solo quando le prime
  // due litigano e c'e un gol da annunciare adesso. Il tetto esiste perche una
  // partita senza copertura litigherebbe per novanta minuti di fila.
  let arbitro: Punteggio | null = null;
  const pareri = riga.pareri_chiesti ?? 0;
  if (litigano && nuoviGol.length && chiaveAF && riga.fixture_id && pareri < TETTO_PARERI) {
    patch.pareri_chiesti = pareri + 1;
    const f = await json(`${AF}/fixtures?id=${riga.fixture_id}`, { 'x-apisports-key': chiaveAF });
    const g = f?.response?.[0]?.goals;
    if (g && g.home !== null && g.away !== null) {
      arbitro = { casa: Number(g.home), ospiti: Number(g.away) };
    }
  }

  const accordo = concorda(tabellone, daEventi, arbitro);
  if (daEventi) {
    patch.casa_af = daEventi.casa;
    patch.ospiti_af = daEventi.ospiti;
  }

  // I gol visti da API-Football: col marcatore, e col punteggio solo se
  // confermato da una seconda fonte.
  const giaDetto = daEventi ? detti.has(`tabellone-${daEventi.casa}-${daEventi.ospiti}`) : false;
  for (const g of nuoviGol) {
    // quel punteggio l'ha gia annunciato il tabellone: risuonare sarebbe un bis
    if (giaDetto) continue;
    avvisi.push({
      tipo: 'gol',
      titolo: titoloGol(g.nostro, accordo),
      testo: g.autogol ? `${g.minuto}' autogol di ${g.chi}` : `${g.minuto}' ${g.chi}`,
      tag: `punteggio-${riga.partita}`,
      rotta: '/',
    });
  }

  // Il tabellone come fonte a se stante.
  //
  // La Serie C ha buchi di copertura su API-Football: senza questo, una partita
  // senza eventi non fa partire nessuna notifica di gol, mai. Parte solo dopo
  // che API-Football ha avuto due minuti per dire la sua, altrimenti lo stesso
  // gol arriverebbe due volte.
  const attesaFinita = litigano && riga.disaccordo_dal
    && adesso - Date.parse(riga.disaccordo_dal) > ATTESA_ACCORDO;
  if (!nuoviGol.length && (!daEventi || attesaFinita)) {
    const dal = golDalTabellone(prima, tabellone, inCasa);
    const minuto = minutoStimato(riga.kickoff, stato, adesso);
    const firma = `tabellone-${casa}-${ospiti}`;
    if (dal && !detti.has(firma)) {
      detti.add(firma);
      patch.eventi_detti = [...detti];
      avvisi.push({
        tipo: 'gol',
        // qui il tabellone e la fonte sia del gol sia del numero: e coerente
        titolo: `${dal.nostro ? 'GOL DEL FOGGIA!' : 'Gol subito.'} ${casa}-${ospiti}`,
        // il minuto e stimato dall'orario: senza gli eventi non esiste altrove
        testo: minuto
          ? `Circa ${minuto}'. Il marcatore non risulta ancora.`
          : 'Dal tabellone. Il marcatore non risulta ancora.',
        tag: `punteggio-${riga.partita}`,
        rotta: '/',
      });
    }
  }

  // Finche le due fonti litigano il punteggio del tabellone non si archivia:
  // cosi `cambiato` resta vero e gli eventi si rileggono ogni minuto invece che
  // ogni tre. Sono due o tre chiamate in piu per gol, e comprano due minuti.
  if (litigano && !attesaFinita) {
    delete patch.casa;
    delete patch.ospiti;
  }

  // --------------------------------------------------------- fine primo tempo
  //
  // Il tabellone dice HT e nessuno lo diceva a chi non stava guardando. E il
  // momento in cui si va a prendere da bere: sapere che si e fermato per
  // quindici minuti cambia cosa fai nei prossimi quindici.
  if (stato === 'HT' && !detti.has(`intervallo-${riga.partita}`)) {
    detti.add(`intervallo-${riga.partita}`);
    patch.eventi_detti = [...detti];
    avvisi.push({
      tipo: 'intervallo',
      titolo: `Fine primo tempo. ${casa ?? 0}-${ospiti ?? 0}`,
      testo: etichetta,
      tag: `intervallo-${riga.partita}`,
      rotta: '/',
    });
  }

  // ------------------------------------------------------------ fine partita
  if (finita && !riga.fine_mandata) {
    patch.fine_mandata = true;
    const nostri = inCasa ? casa : ospiti;
    const loro = inCasa ? ospiti : casa;
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
