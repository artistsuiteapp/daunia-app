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
import { trovaId, formazioniDi } from './legapro.ts';
import {
  contaGol, concorda, titoloGol, golVero, golDalTabellone, minutoStimato, cronologia,
  type EventoAF, type Punteggio,
} from './punteggio.ts';

const TSDB = 'https://www.thesportsdb.com/api/v1/json/123';
/**
 * Le due porte di API-Football.
 *
 * Lo stesso servizio, due account separati: il portale diretto e RapidAPI. Se
 * uno dei due si blocca, l'altro si apre gratis senza toccare il codice --
 * cento chiamate al giorno e risposte identiche da entrambe le parti. Si
 * sceglie con il secret API_FOOTBALL_VIA: "rapidapi" oppure niente.
 */
const AF_DIRETTO = 'https://v3.football.api-sports.io';
const AF_RAPIDAPI = 'https://api-football-v1.p.rapidapi.com/v3';
const FOGGIA_TSDB = 134682;
const FOGGIA_AF = 521;

const MINUTO = 60_000;
const PRIMA = 90 * MINUTO;
const DOPO = 3 * 60 * MINUTO;
/*
 * Il budget di API-Football, contato.
 *
 * Il piano gratuito e cento chiamate al giorno, e i loro termini dicono che un
 * uso "sproporzionato o eccessivo" fa scattare una sospensione automatica dal
 * firewall. E successo il 6 settembre a meta partita, e il conto tornava: con
 * gli eventi ogni tre minuti e le formazioni ogni dieci, il guardiano da solo
 * arrivava a sessantacinque chiamate in un pomeriggio, e l'ingest ne fa altre
 * quaranta. Sopra il limite.
 *
 * La rilettura periodica non serve a sapere che si e segnato -- quello lo dice
 * il tabellone, gratis e subito -- serve a prendere il nome del marcatore e le
 * espulsioni. Otto minuti di ritardo su un nome sono accettabili; una
 * sospensione no. Con questi numeri il guardiano sta sotto le trenta chiamate.
 */
const PAUSA_EVENTI = 8 * MINUTO;
const PAUSA_FORMAZIONI = 15 * MINUTO;
/**
 * Ogni quanto si guarda il sito della Lega per le formazioni.
 *
 * Escono fra i sessanta e i venti minuti prima del fischio. Tre minuti danno
 * abbastanza tentativi dentro quella finestra senza bussare di continuo a un
 * sito che non ci deve niente.
 */
const PAUSA_LEGA = 3 * MINUTO;
/**
 * Per quanto si cercano, contando dal calcio d'inizio.
 *
 * Compaiono nei primi minuti di gioco, ma se la Lega e in ritardo o la
 * partita slitta, tre ore coprono tutto senza restare a bussare per sempre.
 */
const CERCA_FINO_A = 3 * 60 * MINUTO;
/** dopo quante risposte inutili di fila si smette di chiedere ad API-Football */
const RESE = 3;
/** quanto tempo si concede ad API-Football per allinearsi al tabellone */
const ATTESA_ACCORDO = 2 * MINUTO;
/** quante volte per partita si paga la terza fonte per rompere una parita */
const TETTO_PARERI = 3;

/**
 * Il budget del guardiano, in chiamate ad API-Football al giorno.
 *
 * Il piano gratuito ne da cento e l'ingest ne usa fino a quaranta: quarantacinque
 * qui lasciano quindici di margine. Le pause fra una lettura e l'altra sono una
 * stima di quante ne verranno; questo e il numero vero, e sa dire di no.
 *
 * Il primo account e stato sospeso automaticamente perche quel numero non
 * esisteva.
 */
const BUDGET_AF = 45;

const FINITE = ['FT', 'AET', 'PEN'];
const IN_GIOCO = ['1H', 'HT', '2H', 'ET', 'BT', 'P'];

type Tipo = 'formazioni' | 'inizio' | 'gol' | 'espulsione' | 'intervallo' | 'fine';
type Avviso = {
  tipo: Tipo; titolo: string; testo: string; tag: string; rotta: string;
  /** riscrive una notifica gia mandata senza farla suonare di nuovo */
  muta?: boolean;
};

const db = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const chiaveAF = Deno.env.get('API_FOOTBALL_KEY') ?? '';
const viaRapid = (Deno.env.get('API_FOOTBALL_VIA') ?? '').toLowerCase() === 'rapidapi';
const AF = viaRapid ? AF_RAPIDAPI : AF_DIRETTO;
const testaAF: HeadersInit = viaRapid
  ? { 'x-rapidapi-key': chiaveAF, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
  : { 'x-apisports-key': chiaveAF };
const jwk = JSON.parse(Deno.env.get('VAPID_JWK') ?? '{}') as JsonWebKey;
const pubblica = Deno.env.get('VAPID_PUBLIC') ?? '';
const CONTATTO = 'https://daunia.vercel.app';

async function json(url: string, headers?: HeadersInit) {
  const r = await fetch(url, { headers });
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

/**
 * Chiede al database il permesso di spendere una chiamata di API-Football.
 *
 * Il conto e in Postgres e non in memoria perche la funzione muore a ogni
 * giro: un contatore locale ripartirebbe da zero ogni minuto, che e
 * esattamente il modo in cui si finisce sospesi senza accorgersene.
 *
 * Se il database non risponde si dice di no. Perdere un nome di marcatore
 * costa molto meno che perdere l'account.
 */
async function possoChiamareAF(): Promise<boolean> {
  const { data, error } = await db.rpc('chiedi_quota', { quante: 1, tetto: BUDGET_AF });
  if (error) return false;
  return data === true;
}

/**
 * Il punteggio dal vivo, dall'endpoint fatto apposta per quello.
 *
 * `lookupevent.php` e la scheda dell'evento e si aggiorna con calma: stasera
 * diceva ancora "HT" mentre la partita era al 48esimo, ed e da li che venivano
 * i cinque minuti di ritardo sulle notifiche. `livescore.php` invece e la
 * lista delle partite in corso adesso, aggiornata di continuo, e porta un campo
 * che la scheda non ha: `strProgress`, cioe il minuto vero, recupero compreso
 * ("45+5"). Con quello il minuto non si stima piu.
 *
 * Costa: la risposta sono tutte le partite del mondo, una sessantina di
 * chilobyte. Sul server passa, sul telefono no -- per questo il minuto lo
 * scrive qui il guardiano e l'app se lo legge dal database.
 *
 * Il campo `l=` esiste ma viene ignorato dalla fonte: filtrare tocca a noi.
 */
async function daLivescore(eventId: number) {
  const d = await json(`${TSDB}/livescore.php?s=Soccer`);
  const righe = (d?.livescore ?? []) as Array<Record<string, unknown>>;
  const x = righe.find((y) => Number(y.idEvent) === eventId);
  if (!x) return null;
  // stesse chiavi di lookupevent.php, cosi il resto del codice non cambia
  return {
    strStatus: x.strStatus,
    intHomeScore: x.intHomeScore,
    intAwayScore: x.intAwayScore,
    strHomeTeam: x.strHomeTeam,
    strAwayTeam: x.strAwayTeam,
    strEvent: `${x.strHomeTeam} vs ${x.strAwayTeam}`,
    strProgress: x.strProgress,
  } as Record<string, unknown>;
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
        { titolo: a.titolo, testo: a.testo, tag: a.tag, rotta: a.rotta, tipo: a.tipo, muta: a.muta },
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

  /*
   * Prova delle formazioni, senza notificare e senza toccare il database.
   *
   * Serve a verificare la catena -- calendario, id, pannello, parser -- senza
   * aspettare la partita: fino a sabato non ci sarebbe altro modo di sapere se
   * funziona, e scoprirlo a fischio d'inizio e tardi.
   */
  if (corpo?.prova_formazioni) {
    const [casa, ospiti] = String(corpo.prova_formazioni).split('|');
    const id = await trovaId(casa ?? '', ospiti ?? '');
    if (!id) return Response.json({ prova: 'formazioni', casa, ospiti, id: null, motivo: 'nessun id nel calendario' });
    const f = await formazioniDi(id);
    return Response.json({
      prova: 'formazioni',
      id,
      trovate: Boolean(f),
      casa: f && { squadra: f.casa.squadra, modulo: f.casa.modulo, quanti: f.casa.giocatori.length },
      ospiti: f && { squadra: f.ospiti.squadra, modulo: f.ospiti.modulo, quanti: f.ospiti.giocatori.length },
    });
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

  if (primaDelFischio && !riga.formazioni_mandate && riga.fixture_id && chiaveAF && daRileggere
      && await possoChiamareAF()) {
    patch.formazioni_viste_il = new Date().toISOString();
    const f = await json(`${AF}/fixtures/lineups?fixture=${riga.fixture_id}`, testaAF);
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

  /*
   * Le formazioni ufficiali: si cercano da quando la partita comincia.
   *
   * Provato il 7 settembre su Catania-Cosenza. A venti, dieci e zero minuti
   * dal calcio d'inizio la partita non aveva ancora un id nel calendario
   * della Lega, e senza id non c'e pannello. Alle 21:00, con la gara al
   * decimo, id e formazioni c'erano gia -- complete di modulo e allenatore.
   *
   * Quindi la Lega apre la partita al fischio d'inizio, non prima e non a
   * fine gara. Si cerca da li, ogni tre minuti, e si smette appena trovate:
   * dopo non cambiano piu.
   *
   * Nell'ora prima del fischio l'app continua a mostrare l'ultimo undici
   * sceso in campo, dicendo che e quello.
   */
  const cominciata = adesso >= t;
  const nonTroppoTardi = adesso - t < CERCA_FINO_A;
  const daGuardare = !riga.formazione
    && cominciata && nonTroppoTardi
    && (!riga.formazione_vista_il
      || adesso - Date.parse(riga.formazione_vista_il) > PAUSA_LEGA);

  if (daGuardare) {
    patch.formazione_vista_il = new Date().toISOString();
    let idLega: string | null = riga.legapro_id ?? null;

    if (!idLega) {
      // il calendario pesa quattro megabyte: si scarica una volta sola, e
      // l'id trovato resta. Prima che la Lega apra la partita non c'e.
      const casa = String(riga.etichetta ?? '').split(/\s+vs\s+/i)[0] ?? '';
      const ospiti = String(riga.etichetta ?? '').split(/\s+vs\s+/i)[1] ?? '';
      if (casa && ospiti) {
        idLega = await trovaId(casa, ospiti);
        if (idLega) patch.legapro_id = idLega;
      }
    }

    if (idLega) {
      const f = await formazioniDi(idLega);
      if (f) {
        patch.formazione = f;
        avvisi.push({
          tipo: 'formazioni',
          titolo: 'Formazioni ufficiali',
          testo: [f.casa, f.ospiti]
            .find((c) => /foggia/i.test(c.squadra))
            ?.giocatori.map((g) => g.nome.split(' ')[0]).join(', ')
            ?? etichettaDaFormazione(f),
          tag: `formazioni-${riga.partita}`,
          rotta: '/',
        });
      }
    }
  }

  // ------------------------------------------------- punteggio e stato gara
  // Prima la lista del dal vivo: e quella fresca. Se la partita non c'e --
  // non e ancora cominciata, o e gia finita -- si torna alla scheda.
  const dalVivo = await daLivescore(Number(riga.event_id));
  const ev = dalVivo ? null : await json(`${TSDB}/lookupevent.php?id=${riga.event_id}`);
  const e = dalVivo ?? ev?.events?.[0];
  if (!e) return Response.json({ fatto: 'fonte muta', avvisi: 0 });

  /*
   * Sparita dalla lista del dal vivo vuol dire finita.
   *
   * La lista contiene solo le partite in corso: al triplice fischio quella
   * riga sparisce, e restiamo sulla scheda evento, che si aggiorna con calma.
   * Il 6 settembre l'app ha continuato a dire "in corso" per sei minuti dopo la
   * fine, col cronometro che avanzava.
   *
   * La sparizione da sola non basta -- la fonte puo avere un buco -- ma
   * insieme a "eravamo in gioco" e "sono passati almeno cento minuti dal
   * fischio d'inizio" e una conclusione, non una supposizione.
   */
  const dalFischio = adesso - Date.parse(riga.kickoff);
  const finitaPerSparizione = !dalVivo
    && IN_GIOCO.includes(String(riga.stato ?? ''))
    && dalFischio > 100 * MINUTO;

  const letto = String(e.strStatus ?? '').trim() || 'NS';
  const stato = finitaPerSparizione && !FINITE.includes(letto) ? 'FT' : letto;
  const casa = e.intHomeScore === null || e.intHomeScore === '' ? null : Number(e.intHomeScore);
  const ospiti = e.intAwayScore === null || e.intAwayScore === '' ? null : Number(e.intAwayScore);
  const etichetta = riga.etichetta ?? e.strEvent ?? 'Foggia';

  /** il minuto vero, quando la fonte del dal vivo ce l'ha: "48", "45+5" */
  const minutoVero = e.strProgress ? String(e.strProgress).trim() || null : null;

  patch.stato = stato;
  patch.casa = casa;
  patch.ospiti = ospiti;
  // a partita chiusa il minuto non vuol dire piu niente: lasciarlo scritto
  // faceva restare "90+8" sotto il punteggio per ore
  patch.minuto = FINITE.includes(stato) ? null : minutoVero;
  // l'istante del triplice fischio: lo segna il primo giro che vede FT, e non
  // si riscrive piu, cosi la chat chiude venti minuti dopo quello
  if (FINITE.includes(stato) && !riga.finita_il) patch.finita_il = new Date().toISOString();

  if (!riga.inizio_mandato && IN_GIOCO.includes(stato) && !FINITE.includes(stato)) {
    patch.inizio_mandato = true;
    patch.gol = [];
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

  /*
   * Quando manca un nome si va di corsa.
   *
   * Il tabellone dice che si e segnato prima che API-Football dica chi. In quel
   * buco l'utente ha gia ricevuto "GOL DEL FOGGIA!" e sta aspettando il nome:
   * otto minuti di attesa sono la differenza fra un'app che segue la partita e
   * una che la racconta dopo. Finche il conto dei gol del tabellone e piu alto
   * di quello degli eventi, si rilegge ogni minuto.
   *
   * Costa poco perche dura poco: qualche lettura per gol, non per tutta la
   * partita. E se API-Football per questa gara non ha eventi, `af_a_vuoto` si
   * arrende dopo tre tentativi e il budget in `quota_af` chiude comunque.
   */
  const nomiMancanti = (riga.casa ?? 0) + (riga.ospiti ?? 0)
    > (riga.casa_af ?? 0) + (riga.ospiti_af ?? 0);
  const pausa = nomiMancanti ? MINUTO : PAUSA_EVENTI;

  // Se API-Football ha gia risposto a vuoto tre volte per questa partita, non
  // si insiste: le chiamate del piano gratuito sono cento al giorno e una
  // partita non coperta se le mangia tutte senza dare niente in cambio.
  const vaLetto = chiaveAF && riga.fixture_id && (riga.af_a_vuoto ?? 0) < RESE
    && (cambiato || (IN_GIOCO.includes(stato) && eventiVecchi > pausa));

  /** il punteggio contato dagli eventi: la seconda fonte, gratis */
  let daEventi: Punteggio | null = null;
  const nuoviGol: Array<{ minuto: number; chi: string; nostro: boolean; autogol: boolean }> = [];

  if (vaLetto && await possoChiamareAF()) {
    patch.eventi_letti_il = new Date().toISOString();
    const d = await json(`${AF}/fixtures/events?fixture=${riga.fixture_id}`, testaAF);
    const lista = (d?.response ?? []) as EventoAF[];
    if (lista.length) {
      daEventi = contaGol(lista, FOGGIA_AF, inCasa);
      // La cronaca con i nomi sostituisce quella ricavata dal tabellone: stessi
      // gol, ma si sa chi e quando. La scheda partita legge questa colonna.
      const conNomi = cronologia(lista, FOGGIA_AF, inCasa);
      if (conNomi.length) patch.gol = conNomi;
    }

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
  if (litigano && nuoviGol.length && chiaveAF && riga.fixture_id && pareri < TETTO_PARERI
      && await possoChiamareAF()) {
    patch.pareri_chiesti = pareri + 1;
    const f = await json(`${AF}/fixtures?id=${riga.fixture_id}`, testaAF);
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
    avvisi.push({
      tipo: 'gol',
      titolo: titoloGol(g.nostro, accordo),
      testo: g.autogol ? `${g.minuto}' autogol di ${g.chi}` : `${g.minuto}' ${g.chi}`,
      tag: `punteggio-${riga.partita}`,
      rotta: '/',
      /*
       * Quel gol l'ha gia annunciato il tabellone, senza sapere chi.
       *
       * Prima qui si saltava del tutto, e il nome non arrivava mai: restava
       * "il marcatore non risulta ancora" anche a nome noto. Ora la notifica
       * si riscrive sul posto -- stesso tag, niente squillo -- e il nome
       * compare dove l'utente sta gia guardando.
       */
      muta: giaDetto,
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
    const minuto = minutoVero ?? minutoStimato(riga.kickoff, stato, adesso);
    const firma = `tabellone-${casa}-${ospiti}`;
    if (dal && !detti.has(firma)) {
      detti.add(firma);
      patch.eventi_detti = [...detti];
      // La cronologia che la scheda partita mostra durante la gara. Il nome di
      // chi ha segnato non c'e -- quello lo da solo API-Football -- ma minuto e
      // punteggio si sanno, e sono la meta che serve mentre si gioca.
      patch.gol = [
        ...((riga.gol ?? []) as unknown[]),
        { minuto, casa, ospiti, nostro: dal.nostro, fonte: minutoVero ? 'vero' : 'stimato' },
      ];
      avvisi.push({
        tipo: 'gol',
        // qui il tabellone e la fonte sia del gol sia del numero: e coerente
        titolo: `${dal.nostro ? 'GOL DEL FOGGIA!' : 'Gol subito.'} ${casa}-${ospiti}`,
        // il minuto e stimato dall'orario: senza gli eventi non esiste altrove
        // col minuto vero si scrive secco, con quello stimato si dice "circa"
        testo: minuto
          ? `${minutoVero ? '' : 'Circa '}${minuto}'. Il marcatore non risulta ancora.`
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


/** Quando il Foggia non si riconosce nei nomi delle squadre, si dice il modulo. */
function etichettaDaFormazione(f: { casa: { modulo: string | null }; ospiti: { modulo: string | null } }): string {
  return `${f.casa.modulo ?? '?'} contro ${f.ospiti.modulo ?? '?'}`;
}
