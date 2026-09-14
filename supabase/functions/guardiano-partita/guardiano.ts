/**
 * Il guardiano della partita.
 *
 * Chiamato ogni minuto da pg_cron. Quasi sempre non fa niente: fuori dalla
 * finestra di una partita esce subito senza chiamare nessuna fonte. E la
 * regola che tiene i consumi a zero nei giorni in cui non si gioca.
 *
 * Durante la partita fa tre giri al minuto e ogni volta legge due tabelloni
 * indipendenti: TheSportsDB (gratis, senza quota) e live-score-api, che nella
 * stessa risposta porta anche gol col nome, cartellini e cambi. Nell'app va
 * quello che arriva prima.
 *
 * Quello che ha gia detto se lo ricorda in `stato_partita`: senza quella riga
 * manderebbe la notifica dello stesso gol sessanta volte.
 */
import { manda, type Iscrizione } from './push.ts';
import { trovaId, formazioniDi } from './legapro.ts';
import {
  trovaPartita, leggiPartita, CASA as LSA_CASA, OSPITI as LSA_OSPITI, type LetturaLSA,
} from './livescore.ts';
import { ancoraDaGiocare, calendarioDa, daAllineare } from './calendario.ts';
import {
  contaGol, concorda, titoloGol, golVero, golDalTabellone, minutoStimato, cronologia,
  cartelliniECambi, oraItaliana, proteggi, unisciCronaca, piuAvanti, minutoMigliore,
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
/** Quanto prima del fischio si ricorda il pronostico a chi non l'ha messo. */
const PROMEMORIA_PRONOSTICO = 60 * MINUTO;
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
/**
 * Ogni quanto si rilegge durante la partita: tre volte nello stesso minuto.
 *
 * Gli otto minuti erano tarati su API-Football: cento chiamate al giorno, e il
 * 6 settembre una raffica ci e' costata la sospensione a meta partita. Poi e'
 * diventato un minuto, che sulla carta era un minuto e in pratica erano due
 * (vedi TOLLERANZA). Ora live-score-api si legge a ogni giro.
 *
 * Il conto delle chiamate: una lettura ogni venti secondi, da due minuti prima
 * del fischio a un quarto d'ora dopo la chiusura, sono circa quattrocento
 * chiamate a partita. La prova ne concede millecinquecento al giorno, lo
 * Starter quattordicimilacinquecento. Il ripiego API-Football resta largo,
 * perche' li il limite e' vero.
 */
const PASSO = 20_000;
/**
 * Dopo quanti secondi dall'inizio del minuto non si comincia un altro giro.
 *
 * Al minuto dopo arriva un'altra chiamata di pg_cron: due giri sovrapposti
 * leggerebbero la stessa riga e annuncerebbero lo stesso gol due volte.
 */
const ULTIMO_GIRO_ENTRO = 42_000;
/**
 * Il margine sui ritmi.
 *
 * pg_cron chiama al secondo zero, ma la funzione si sveglia con qualche decimo
 * di ritardo che cambia ogni volta, e l'istante scritto nella riga si prende
 * dopo le prime letture. "Passato almeno un minuto", confrontato con questi
 * orari, risultava quasi sempre cinquantanove secondi: il giro saltava il
 * turno e ogni minuto diventava due, ogni tre minuti quattro. Con il margine
 * un giro in anticipo di qualche secondo vale come puntuale.
 */
const TOLLERANZA = 15_000;
/** Da quanto prima del fischio si comincia a leggere live-score-api. */
const LSA_PRIMA = 2 * MINUTO;
/** Per quanto si continua a leggere dopo la chiusura: correzioni e nomi dell'ultimo minuto. */
const DOPO_LA_CHIUSURA = 15 * MINUTO;
/** Il ritmo quando live-score-api non trova la partita da un pezzo: si rallenta, non si smette. */
const PAUSA_SENZA_COPERTURA = 3 * MINUTO;
/** Dopo il triplice fischio: quanto aspettare prima di chiudere, a seconda di chi conferma. */
const CONFERMA_CONCORDI = 2 * MINUTO;
const CONFERMA_UNA_FONTE = 5 * MINUTO;
const CONFERMA_MASSIMA = 10 * MINUTO;
/** Senza la partita nella lista del dal vivo, dopo quanto dal fischio d'inizio vale come finita. */
const SPARITA_DOPO = 120 * MINUTO;
const PAUSA_EVENTI_AF = 8 * MINUTO;
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
/**
 * Dopo quante letture inutili di fila una fonte si considera senza la partita.
 *
 * Inutile vuol dire fallita o senza la nostra partita, non "senza eventi":
 * nei primi minuti una partita senza eventi e il caso normale.
 */
const RESE = 3;
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

type Tipo = 'formazioni' | 'inizio' | 'gol' | 'espulsione' | 'intervallo' | 'fine'
  | 'pronostico' | 'esito';
type Avviso = {
  tipo: Tipo; titolo: string; testo: string; tag: string; rotta: string;
  /** riscrive una notifica gia mandata senza farla suonare di nuovo */
  muta?: boolean;
};

/**
 * Quello che il guardiano prende dal mondo, passato da fuori.
 *
 * In produzione sono il client Supabase, le variabili d'ambiente e l'orologio
 * vero (`index.ts`). Nei test sono finti: e l'unico modo di giocare una
 * partita intera in pochi secondi e di vedere, minuto per minuto, cosa il
 * guardiano scrive e cosa annuncia.
 */
export type Dipendenze = {
  // deno-lint-ignore no-explicit-any
  db: any;
  env: (nome: string) => string | undefined;
  orologio?: () => number;
  invia?: typeof manda;
  /** tiene viva la funzione dopo la risposta: `EdgeRuntime.waitUntil` */
  inBackground?: (p: Promise<unknown>) => void;
  dormi?: (ms: number) => Promise<void>;
};

// deno-lint-ignore no-explicit-any
let db: any;
let leggiEnv: Dipendenze['env'] = () => undefined;
let orologio: () => number = Date.now;
let invia: typeof manda = manda;
let inBackground: Dipendenze['inBackground'];
let dormi = (ms: number) => new Promise<void>((fatto) => setTimeout(fatto, ms));
/** l'istante dell'orologio del guardiano, nel formato che vuole il database */
const ora = () => new Date(orologio()).toISOString();

let chiaveAF = '';
/*
 * live-score-api: da qui in poi la fonte dei nomi.
 *
 * API-Football e' stato sospeso due volte, e il 12 settembre risultava
 * sospeso ancora: cento chiamate al giorno non bastano quando l'ingest ne fa
 * quaranta e il guardiano trenta. Questi ne danno millecinquecento al giorno
 * gia' in prova, e l'ingest li usa gia' per i tabellini delle partite finite,
 * quindi la copertura della Serie C e' verificata e non sperata.
 *
 * Resta tutto facoltativo: senza queste due chiavi il guardiano fa
 * esattamente quello che faceva prima.
 */
let chiaviLSA: { key: string; secret: string } | null = null;
let AF = AF_DIRETTO;
let testaAF: HeadersInit = {};
let jwk = {} as JsonWebKey;
let pubblica = '';
const CONTATTO = 'https://daunia.vercel.app';

/**
 * Prepara il guardiano e restituisce il gestore delle richieste.
 *
 * Le variabili si leggono qui e non al caricamento del modulo, cosi un test
 * puo dare le sue senza toccare l'ambiente vero.
 */
export function creaGuardiano(dip: Dipendenze): (req: Request) => Promise<Response> {
  db = dip.db;
  leggiEnv = dip.env;
  orologio = dip.orologio ?? Date.now;
  invia = dip.invia ?? manda;
  inBackground = dip.inBackground;
  if (dip.dormi) dormi = dip.dormi;

  chiaveAF = leggiEnv('API_FOOTBALL_KEY') ?? '';
  const key = leggiEnv('LSA_KEY') ?? '';
  const secret = leggiEnv('LSA_SECRET') ?? '';
  chiaviLSA = key && secret ? { key, secret } : null;
  const viaRapid = (leggiEnv('API_FOOTBALL_VIA') ?? '').toLowerCase() === 'rapidapi';
  AF = viaRapid ? AF_RAPIDAPI : AF_DIRETTO;
  testaAF = viaRapid
    ? { 'x-rapidapi-key': chiaveAF, 'x-rapidapi-host': 'api-football-v1.p.rapidapi.com' }
    : { 'x-apisports-key': chiaveAF };
  jwk = JSON.parse(leggiEnv('VAPID_JWK') ?? '{}') as JsonWebKey;
  pubblica = leggiEnv('VAPID_PUBLIC') ?? '';
  return gestisci;
}

/**
 * Una chiamata che non puo fermare il giro.
 *
 * Prima non aveva ne scadenza ne rete di protezione: una fonte appesa teneva
 * fermo il giro, e un errore di rete lo faceva finire senza scrivere niente.
 */
async function json(url: string, headers?: HeadersInit) {
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return null;
    return await r.json().catch(() => null);
  } catch {
    return null;
  }
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

/**
 * La prossima partita del Foggia, chiesta a TheSportsDB e messa da parte.
 *
 * Una partita gia salvata non si riscrive. Prima c'era un upsert con il
 * punteggio vuoto, e nelle ore dopo il fischio TheSportsDB restituisce ancora
 * come "prossima" la partita appena giocata: Monopoli-Foggia, chiusa 1-0, e
 * rimasta senza risultato. E la riga restituita non era quella del database,
 * quindi il guardiano dimenticava anche cosa aveva gia notificato.
 */
async function trovaProssima() {
  const d = await json(`${TSDB}/eventsnext.php?id=${FOGGIA_TSDB}`);
  const e = d?.events?.[0];
  if (!e?.idEvent || !e?.strTimestamp) return null;

  const kickoff = `${e.strTimestamp}Z`;
  if (!ancoraDaGiocare(kickoff, orologio(), DOPO)) return null;

  const partita = String(e.idEvent);
  const { data: esistente } = await db.from('stato_partita').select('*').eq('partita', partita).maybeSingle();
  if (esistente) {
    // un rinvio sposta l'orario; il resto di quello che si sa resta com'e
    if (!esistente.finita_il && Date.parse(esistente.kickoff) !== Date.parse(kickoff)) {
      await db.from('stato_partita').update({ kickoff }).eq('partita', partita);
      return { ...esistente, kickoff };
    }
    return esistente;
  }

  const riga = {
    partita,
    event_id: Number(e.idEvent),
    fixture_id: e.idAPIfootball ? Number(e.idAPIfootball) : null,
    kickoff,
    etichetta: e.strEvent ?? null,
    casa: null,
    ospiti: null,
    stato: e.strStatus ?? 'NS',
  };
  const { error } = await db.from('stato_partita').insert(riga);
  if (error) return null;
  return riga;
}

const CALENDARIO = 'https://raw.githubusercontent.com/artistsuiteapp/daunia-app/main/data/matches.json';
const PAUSA_CALENDARIO = 30 * MINUTO;

/**
 * Passa il calendario al database, al massimo ogni mezz'ora.
 *
 * Sta prima del controllo sulla finestra della partita, quindi gira anche nei
 * giorni in cui non si gioca: il ponte fra gli id deve esserci prima del
 * fischio, non dopo. Un giro andato male non ferma il guardiano; si riprova al
 * minuto dopo.
 */
async function allineaCalendario(adesso: number, subito = false) {
  try {
    const { data } = await db.from('calendario').select('aggiornato_il')
      .order('aggiornato_il', { ascending: false }).limit(1);
    if (!subito && !daAllineare(data?.[0]?.aggiornato_il ?? null, adesso, PAUSA_CALENDARIO)) return;

    const r = await fetch(CALENDARIO, { signal: AbortSignal.timeout(8_000) });
    if (!r.ok) return;
    const righe = calendarioDa(await r.json());
    if (righe.length) await db.rpc('allinea_calendario', { p_partite: righe });
  } catch {
    // il calendario puo aspettare il giro dopo; la partita no
  }
}

/** Gli id sotto cui un pronostico puo stare: quello del guardiano e quello dell'app. */
async function idPronostici(partita: string): Promise<string[]> {
  const { data } = await db.from('calendario').select('partita').eq('event_id', partita).maybeSingle();
  return data?.partita ? [partita, data.partita as string] : [partita];
}

/**
 * Manda un avviso.
 *
 * Con `soloA` va alle iscrizioni di quelle persone e basta. Serve ai due
 * avvisi che riguardano quello che uno ha fatto: il promemoria del pronostico
 * non deve arrivare a chi l'ha gia messo, e il risultato non deve arrivare a
 * chi non aveva giocato. Un avviso che non riguarda chi lo riceve e il modo
 * piu rapido di far togliere il permesso alle notifiche.
 *
 * Un elenco vuoto non manda niente: non e un errore, e il caso normale di una
 * partita in cui non ha pronosticato nessuno.
 */
async function diffondi(a: Avviso, soloA?: string[]) {
  if (soloA && soloA.length === 0) return { consegnati: 0, falliti: 0, rimossi: 0 };

  let q = db
    .from('push_iscrizioni')
    .select('endpoint, p256dh, auth, preferenze')
    .eq(`preferenze->>${a.tipo}`, 'true');
  if (soloA) q = q.in('utente', soloA);
  const { data } = await q;

  const iscritti = (data ?? []) as Array<Iscrizione & { preferenze: Record<string, boolean> }>;
  const morti: string[] = [];
  let consegnati = 0;
  let falliti = 0;

  await Promise.all(iscritti.map(async (i) => {
    try {
      const stato = await invia(
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

/** Chi ha un account, vuole il promemoria, e per questa partita non ha ancora giocato. */
async function chiNonHaPronosticato(partita: string): Promise<string[]> {
  const [iscritti, gia] = await Promise.all([
    db.from('push_iscrizioni').select('utente')
      .not('utente', 'is', null)
      .eq('preferenze->>pronostico', 'true'),
    db.from('pronostici').select('utente').in('partita', await idPronostici(partita)),
  ]);

  const hannoGiocato = new Set(((gia.data ?? []) as Array<{ utente: string }>).map((r) => r.utente));
  const tutti = new Set(((iscritti.data ?? []) as Array<{ utente: string }>).map((r) => r.utente));
  return [...tutti].filter((u) => !hannoGiocato.has(u));
}

/** Chi aveva pronosticato questa partita. */
async function chiHaPronosticato(partita: string): Promise<string[]> {
  const { data } = await db.from('pronostici').select('utente').in('partita', await idPronostici(partita));
  return [...new Set(((data ?? []) as Array<{ utente: string }>).map((r) => r.utente))];
}

async function gestisci(req: Request): Promise<Response> {
  // solo chi conosce il segreto: la funzione ha il service role in mano
  const segreto = leggiEnv('GUARDIANO_SEGRETO');
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

  /*
   * Prova del dal vivo su una partita qualsiasi, senza scrivere e senza avvisare.
   *
   * La domanda a cui risponde: le due fonti vedono una partita di Serie C che
   * si sta giocando adesso, e con quanto ritardo? Il giorno di Foggia-Savoia
   * alle 18:30 si giocano altre partite del girone: e l'occasione di saperlo
   * prima delle 21, invece che durante.
   */
  if (corpo?.prova_dal_vivo) {
    return Response.json(await provaDalVivo(String(corpo.prova_dal_vivo)));
  }

  /*
   * Prova dei giri dopo la risposta.
   *
   * La partita simulata dimostra la logica, non il runtime: che Supabase tenga
   * viva la funzione dopo la risposta si vede solo li. I due giri di prova
   * riallineano il calendario, che e ripetibile senza danni e lascia l'istante
   * in `calendario.aggiornato_il`: se dopo quaranta secondi quell'istante e
   * andato avanti due volte, i giri veloci della partita partiranno anche loro.
   */
  if (corpo?.prova_giri) {
    const partenza = orologio();
    if (inBackground) {
      inBackground((async () => {
        for (const quando of [PASSO, 2 * PASSO]) {
          const attesa = partenza + quando - orologio();
          if (attesa > 0) await dormi(attesa);
          await allineaCalendario(orologio(), true);
        }
      })());
    }
    return Response.json({ prova: 'giri', partenza: ora(), inBackground: Boolean(inBackground) });
  }

  /*
   * Tre giri al minuto durante la partita.
   *
   * pg_cron non scende sotto il minuto, e il minuto era il ritardo minimo di
   * qualsiasi cosa: un gol visto dalla fonte al secondo uno arrivava nell'app
   * al giro dopo. Il primo giro risponde a pg_cron; gli altri due restano vivi
   * dopo la risposta (`inBackground`), a venti e a quaranta secondi. Fuori
   * dalla partita il primo giro basta e gli altri non partono.
   */
  const partenza = orologio();
  const primo = await giro(true);
  if (primo.caldo && inBackground) {
    inBackground((async () => {
      for (const quando of [PASSO, 2 * PASSO]) {
        const attesa = partenza + quando - orologio();
        if (attesa > 0) await dormi(attesa);
        if (orologio() - partenza > ULTIMO_GIRO_ENTRO) break;
        try {
          await giro(false);
        } catch {
          // il minuto dopo si riparte da capo
        }
      }
    })());
  }
  return Response.json(primo.risposta);
}

/**
 * Un giro del guardiano: legge le fonti, decide, scrive, avvisa.
 *
 * `primo` e il giro chiamato da pg_cron. Le cose che bastano una volta al
 * minuto -- il calendario, la prossima partita, il promemoria, le formazioni
 * dal sito della Lega, che pesano quattro megabyte -- si fanno solo li.
 */
async function giro(primo: boolean): Promise<{ risposta: Record<string, unknown>; caldo: boolean }> {
  const adesso = orologio();
  if (primo) await allineaCalendario(adesso);

  // la partita di riferimento: quella salvata, se ancora attuale
  const { data: righe } = await db
    .from('stato_partita').select('*').order('kickoff', { ascending: false }).limit(1);
  let riga = righe?.[0] ?? null;

  const scaduta = !riga?.kickoff || Date.parse(riga.kickoff) + DOPO < adesso;
  if (scaduta && primo) riga = await trovaProssima();
  if (!riga?.kickoff) {
    return { risposta: { fatto: 'nessuna partita in vista' }, caldo: false };
  }

  const t = Date.parse(riga.kickoff);
  if (adesso < t - PRIMA || adesso > t + DOPO) {
    return { risposta: { fatto: 'fuori dalla finestra', kickoff: riga.kickoff }, caldo: false };
  }

  const avvisi: Avviso[] = [];
  /** Avvisi che vanno solo ad alcuni: [avviso, elenco di utenti]. */
  const mirati: Array<[Avviso, string[]]> = [];
  const patch: Record<string, unknown> = { aggiornato_il: ora() };
  const detti = new Set<string>((riga.eventi_detti ?? []) as string[]);
  const chiusaIl = riga.finita_il ? Date.parse(riga.finita_il) : NaN;

  /** da poco prima del fischio a un quarto d'ora dopo la chiusura: si legge di continuo */
  const caldo = adesso >= t - LSA_PRIMA
    && !(Number.isFinite(chiusaIl) && adesso - chiusaIl > DOPO_LA_CHIUSURA);

  if (primo) {
    // ----------------------------------------------- il promemoria pronostico
    //
    // Un'ora prima e il momento in cui uno e ancora in tempo e non e ancora in
    // mezzo ad altro. Prima e troppo presto per ricordarsene, dopo e tardi.
    const promemoriaDaMandare = !riga.promemoria_mandato
      && adesso >= t - PROMEMORIA_PRONOSTICO && adesso < t;

    if (promemoriaDaMandare) {
      patch.promemoria_mandato = true;
      const orario = oraItaliana(riga.kickoff);
      const daAvvisare = await chiNonHaPronosticato(riga.partita);
      if (daAvvisare.length) {
        mirati.push([{
          tipo: 'pronostico',
          titolo: 'Il pronostico sta per chiudere',
          /*
           * L'orario, non quanto manca.
           *
           * Il promemoria puo' partire in qualsiasi punto dell'ora che precede il
           * fischio, e alla consegna si somma altro ritardo. In Monopoli-Foggia e'
           * arrivato con tre minuti da giocare dicendo ancora "manca un'ora": una
           * notifica che si smentisce da sola toglie fiducia anche a quelle giuste.
           * Un orario assoluto resta vero comunque vada la consegna.
           */
          testo: orario
            ? `Si chiude alle ${orario}, al fischio d'inizio.`
            : 'Si chiude al fischio d\'inizio.',
          tag: `pronostico-${riga.partita}`,
          rotta: '/match-center',
        }, daAvvisare]);
      }
    }

    // ---------------------------------------------------------- le formazioni
    const primaDelFischio = adesso < t;
    const daRileggere = !riga.formazioni_viste_il
      || adesso - Date.parse(riga.formazioni_viste_il) >= PAUSA_FORMAZIONI - TOLLERANZA;

    if (primaDelFischio && !riga.formazioni_mandate && riga.fixture_id && chiaveAF && daRileggere
        && await possoChiamareAF()) {
      patch.formazioni_viste_il = ora();
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
        || adesso - Date.parse(riga.formazione_vista_il) >= PAUSA_LEGA - TOLLERANZA);

    if (daGuardare) {
      patch.formazione_vista_il = ora();
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
  }

  // ------------------------------------------------ il tabellone di TheSportsDB
  // Prima la lista del dal vivo: e quella fresca. Se la partita non c'e --
  // non e ancora cominciata, o e gia finita -- si torna alla scheda.
  const dalVivo = await daLivescore(Number(riga.event_id));
  const ev = dalVivo ? null : await json(`${TSDB}/lookupevent.php?id=${riga.event_id}`);
  /*
   * TheSportsDB muto non ferma piu il giro.
   *
   * Prima qui si usciva: senza il tabellone di TheSportsDB non si leggeva
   * nemmeno live-score-api, e un buco di una fonte spegneva anche l'altra.
   */
  const e = (dalVivo ?? ev?.events?.[0] ?? null) as Record<string, unknown> | null;

  // ------------------------------------------- il tabellone di live-score-api
  /*
   * Si legge a ogni giro, anche quando non ci sono eventi.
   *
   * Prima tre letture senza eventi di fila spegnevano la fonte per tutta la
   * partita: la regola era nata per API-Football, dove ogni chiamata costava,
   * ed era rimasta. Ma nei primi minuti una partita senza eventi e il caso
   * normale. Rigiocata la partita in `partita-simulata.test.ts`, il primo
   * giallo al dodicesimo non arrivava mai, e con lui niente cambi, niente
   * rossi, niente nomi dei marcatori fino al giorno dopo.
   *
   * Conta come lettura inutile solo quella fallita o senza la nostra partita.
   * E anche allora non si smette: si rallenta a una lettura ogni tre minuti.
   */
  let lettura: LetturaLSA | null = null;
  const vecchiaLettura = riga.eventi_letti_il ? adesso - Date.parse(riga.eventi_letti_il) : Infinity;
  // se TheSportsDB dice che si gioca, non si rallenta: una partita iniziata in
  // ritardo non e una partita scoperta
  const tsdbInGioco = Boolean(dalVivo) && IN_GIOCO.includes(String(e?.strStatus ?? ''));
  const senzaCopertura = (riga.af_a_vuoto ?? 0) >= RESE && adesso - t > 10 * MINUTO && !tsdbInGioco;
  const leggoLsa = Boolean(chiaviLSA) && caldo
    && (!senzaCopertura || vecchiaLettura >= PAUSA_SENZA_COPERTURA - TOLLERANZA);

  if (leggoLsa && chiaviLSA) {
    patch.eventi_letti_il = ora();
    /*
     * L'id della partita su live-score-api si ricorda fra un giro e l'altro.
     *
     * Sta in `eventi_detti`, la memoria del guardiano, perche una colonna nuova
     * vorrebbe dire una migrazione il giorno prima di una partita. Risparmia
     * una chiamata su due.
     */
    const ricordato = [...detti].filter((f) => f.startsWith('lsa-')).pop()?.slice(4) ?? null;
    if (ricordato) lettura = await leggiPartita(ricordato, chiaviLSA);
    if (!lettura) {
      const loro = await trovaPartita(chiaviLSA);
      if (loro && loro.id !== ricordato) {
        detti.add(`lsa-${loro.id}`);
        lettura = await leggiPartita(loro.id, chiaviLSA);
      }
    }
    patch.af_a_vuoto = lettura ? 0 : (riga.af_a_vuoto ?? 0) + 1;
  }

  /** chi ha risposto: serve a sapere quale id di squadra usare a valle */
  let lista: EventoAF[] = lettura?.eventi ?? [];
  const inCasa = e?.strHomeTeam
    ? String(e.strHomeTeam).toLowerCase().includes('foggia')
    : lettura?.foggiaInCasa
      ?? String(riga.etichetta ?? '').split(/\s+vs\s+/i)[0].toLowerCase().includes('foggia');
  // Le squadre finte del travestimento: noi siamo il lato giusto.
  const lsaInCasa = lettura?.foggiaInCasa ?? inCasa;
  let nostroId = lsaInCasa ? LSA_CASA : LSA_OSPITI;

  // Il ripiego API-Football: solo senza live-score-api, e con i suoi freni di sempre.
  const statoPrima = String(riga.stato ?? '');
  if (!chiaviLSA && primo && chiaveAF && riga.fixture_id && IN_GIOCO.includes(statoPrima)
      && (riga.af_a_vuoto ?? 0) < RESE
      && vecchiaLettura >= PAUSA_EVENTI_AF - TOLLERANZA && await possoChiamareAF()) {
    patch.eventi_letti_il = ora();
    const d = await json(`${AF}/fixtures/events?fixture=${riga.fixture_id}`, testaAF);
    const daAF = (d?.response ?? []) as EventoAF[];
    if (daAF.length) {
      lista = daAF;
      nostroId = FOGGIA_AF;
    }
    // `errors` non vuoto vuol dire quota finita o account sospeso: la
    // risposta arriva con stato 200 e non si distingue da una partita senza
    // eventi se non guardando qui dentro.
    const rifiutata = !d
      || (d.errors && !Array.isArray(d.errors) && Object.keys(d.errors).length > 0);
    patch.af_a_vuoto = rifiutata || !daAF.length ? (riga.af_a_vuoto ?? 0) + 1 : 0;
  }

  // ------------------------------------------------ stato, punteggio e minuto
  const letto = e ? String(e.strStatus ?? '').trim() || 'NS' : null;
  const numero = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v));
  const casaT = e ? numero(e.intHomeScore) : null;
  const ospitiT = e ? numero(e.intAwayScore) : null;
  const tabellone: Punteggio | null = casaT === null || ospitiT === null ? null : { casa: casaT, ospiti: ospitiT };

  const p = lettura?.punteggio ?? null;
  const punteggioLsa: Punteggio | null = !p ? null
    : lsaInCasa === inCasa ? p : { casa: p.ospiti, ospiti: p.casa };
  /** il punteggio contato dagli eventi: nella stessa risposta, gratis */
  const daEventi: Punteggio | null = lista.length ? contaGol(lista, nostroId, inCasa) : null;

  /*
   * Sparita dalla lista del dal vivo vuol dire finita -- ma non da sola.
   *
   * La lista contiene solo le partite in corso: al triplice fischio quella
   * riga sparisce, e restiamo sulla scheda evento, che si aggiorna con calma.
   * Il 6 settembre l'app ha continuato a dire "in corso" per sei minuti dopo la
   * fine, col cronometro che avanzava.
   *
   * Prima bastavano cento minuti dal fischio d'inizio. Cento minuti sono
   * l'ottantacinquesimo di gioco: se TheSportsDB perdeva la partita dalla
   * lista, il guardiano la chiudeva con dieci minuti da giocare, e con lei i
   * pronostici, pagati sul risultato sbagliato. Ora servono due ore, e
   * live-score-api non deve dire che si sta ancora giocando.
   */
  const statoLsa = lettura?.stato ?? null;
  const lsaInGioco = statoLsa !== null && IN_GIOCO.includes(statoLsa);
  const dalFischio = adesso - t;
  const sparita = !dalVivo && IN_GIOCO.includes(statoPrima) && dalFischio > SPARITA_DOPO && !lsaInGioco;

  let stato = piuAvanti(piuAvanti(letto, statoLsa), FINITE.includes(statoPrima) ? null : statoPrima) ?? 'NS';
  if (sparita && !FINITE.includes(stato)) stato = 'FT';
  // una fine gia vista non torna "in corso" per una lettura lenta: solo se una fonte lo dice dal vivo
  if (FINITE.includes(statoPrima) && !FINITE.includes(stato) && !lsaInGioco
      && !(dalVivo && IN_GIOCO.includes(String(letto)))) {
    stato = 'FT';
  }
  const etichetta = riga.etichetta ?? e?.strEvent ?? 'Foggia';

  /** il minuto vero, dalla fonte che ne sa di piu: "48", "45+5" */
  const minutoVero = minutoMigliore(stato, e?.strProgress as string | undefined, lettura?.minuto);

  patch.stato = stato;
  // a partita chiusa il minuto non vuol dire piu niente: lasciarlo scritto
  // faceva restare "90+8" sotto il punteggio per ore
  patch.minuto = FINITE.includes(stato) ? null : minutoVero;

  /*
   * IL PUNTEGGIO CHE SI MOSTRA E QUELLO DELLA FONTE PIU SVELTA.
   *
   * Prima il tabellone dell'app era solo quello di TheSportsDB, e quando le
   * due fonti non erano d'accordo il numero si tratteneva fino a tre minuti.
   * Cioe' esattamente nel momento del gol, l'app era l'ultima a saperlo.
   *
   * Per ogni lato vale il numero piu alto fra le letture di questo giro: un
   * gol lo vede prima una fonte e poi l'altra, mai il contrario. Il numero nel
   * titolo delle notifiche resta com'era, stampato solo se due fonti concordano.
   *
   * UNA LETTURA VUOTA NON CANCELLA QUELLO CHE SAPEVAMO: senza nessuna lettura
   * il punteggio scritto resta com'e. Un `null` da una fonte dal vivo non vuol
   * dire "zero a zero", vuol dire "adesso non lo so".
   */
  /*
   * Un giro senza live-score-api non dimentica quello che aveva contato.
   *
   * Con la fonte degli eventi giu, restava il solo TheSportsDB: una sua
   * lettura sbagliata a 0-0 cancellava il gol dal tabellone, e al giro dopo lo
   * stesso gol sembrava nuovo e suonava di nuovo. L'ultimo conteggio resta
   * valido finche la fonte non torna a parlare: i gol annullati sono rari, le
   * letture sbagliate no.
   */
  const ultimoConteggio: Punteggio | null = !lettura && riga.casa_af !== null && riga.casa_af !== undefined
    && riga.ospiti_af !== null && riga.ospiti_af !== undefined
    ? { casa: Number(riga.casa_af), ospiti: Number(riga.ospiti_af) } : null;
  const letture = [tabellone, punteggioLsa, daEventi, ultimoConteggio].filter((x): x is Punteggio => x !== null);
  const mostrato: Punteggio | null = letture.length
    ? { casa: Math.max(...letture.map((x) => x.casa)), ospiti: Math.max(...letture.map((x) => x.ospiti)) }
    : null;
  if (mostrato) {
    patch.casa = mostrato.casa;
    patch.ospiti = mostrato.ospiti;
  }

  if (!riga.inizio_mandato && IN_GIOCO.includes(stato) && !FINITE.includes(stato)) {
    patch.inizio_mandato = true;
    patch.gol = [];
    avvisi.push({
      tipo: 'inizio', titolo: 'Si comincia', testo: etichetta,
      tag: `inizio-${riga.partita}`, rotta: '/',
    });
  }

  const prima: Punteggio | null = riga.casa === null || riga.casa === undefined
    || riga.ospiti === null || riga.ospiti === undefined
    ? null : { casa: riga.casa, ospiti: riga.ospiti };

  // --------------------------------------------- gol ed espulsioni, dai fatti
  const nuoviGol: Array<{ minuto: number; chi: string; nostro: boolean; autogol: boolean }> = [];

  if (lista.length) {
    // La cronaca con i nomi sostituisce quella ricavata dal tabellone: stessi
    // gol, ma si sa chi e quando. I gol visti solo dal tabellone restano.
    const conNomi = cronologia(lista, nostroId, inCasa);
    if (conNomi.length) patch.gol = unisciCronaca(conNomi, (riga.gol ?? []) as Array<Record<string, unknown>>);

    /*
     * Cartellini e cambi, che prima si buttavano via.
     *
     * Arrivano nella stessa risposta dei gol -- non costano una chiamata in
     * piu -- e finora finivano nel nulla perche non c'era dove metterli.
     * Nell'app comparivano il giorno dopo, con l'aggiornamento dati.
     *
     * Si riscrive tutta la lista invece di aggiungere: la fonte manda sempre
     * tutto, e rimpiazzare non puo lasciare orfani ne duplicati.
     */
    const { cartellini, cambi } = cartelliniECambi(lista, nostroId);
    patch.cartellini = cartellini;
    patch.cambi = cambi;
  }

  for (const x of lista) {
    const minuto = x.time?.elapsed ?? 0;
    const chi = x.player?.name ?? '';
    const suoi = x.team?.id === nostroId;

    // `golVero` scarta il rigore sbagliato, che API-Football marca comunque
    // come "Goal": prima diventava una notifica di gol mai segnato.
    if (golVero(x)) {
      /*
       * LA FIRMA NON PUO CONTENERE IL NOME.
       *
       * live-score-api pubblica il gol subito e il marcatore qualche minuto
       * dopo. La firma era `gol-36-` senza nome e diventava `gol-36-A.
       * Capone` quando il nome arrivava: due firme diverse per lo stesso
       * gol, quindi due notifiche. Succedeva a OGNI gol.
       *
       * Minuto e lato bastano a distinguere: due gol allo stesso minuto e
       * dalla stessa parte non esistono. Il nome resta nel testo della
       * notifica, che e' dove serve, e non nella sua identita'.
       */
      const firma = `gol-${minuto}-${suoi ? 'noi' : 'loro'}`;
      // le firme vecchie col nome dentro restano valide per questa partita
      const giaVisto = detti.has(firma)
        || [...detti].some((f) => f.startsWith(`gol-${minuto}-`));
      if (!giaVisto) {
        detti.add(firma);
        const autogol = x.detail === 'Own Goal';
        nuoviGol.push({ minuto, chi, nostro: suoi !== autogol, autogol });
      }
    }

    if (x.type === 'Card' && String(x.detail ?? '').includes('Red')) {
      // Stessa regola dei gol: il nome del giocatore arriva dopo il cartellino,
      // e con il nome nella firma lo stesso rosso suonava due volte.
      const firma = `rosso-${minuto}-${suoi ? 'noi' : 'loro'}`;
      if (detti.has(firma) || [...detti].some((f) => f.startsWith(`rosso-${minuto}-`))) continue;
      detti.add(firma);
      avvisi.push({
        tipo: 'espulsione',
        titolo: suoi ? 'Espulso un giocatore del Foggia' : 'Espulso un avversario',
        testo: chi ? `${minuto}' ${chi}` : `${minuto}'`,
        tag: `rosso-${riga.partita}-${minuto}`,
        rotta: '/',
      });
    }
  }

  // -------------------------------------------------- mettere d'accordo le fonti
  const litigano = !!tabellone && !!daEventi
    && (tabellone.casa !== daEventi.casa || tabellone.ospiti !== daEventi.ospiti);

  // Si aggiorna solo nei giri in cui gli eventi si sono davvero letti: negli
  // altri non si sa niente di nuovo, e azzerarlo cancellerebbe l'attesa.
  if (lettura) {
    patch.disaccordo_dal = litigano ? (riga.disaccordo_dal ?? ora()) : null;
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

  // I gol visti dagli eventi: col marcatore, e col punteggio solo se
  // confermato da una seconda fonte.
  const giaDetto = daEventi ? detti.has(`tabellone-${daEventi.casa}-${daEventi.ospiti}`) : false;
  for (const g of nuoviGol) {
    avvisi.push({
      tipo: 'gol',
      titolo: titoloGol(g.nostro, accordo),
      testo: g.autogol ? `${g.minuto}' autogol di ${g.chi}` : g.chi ? `${g.minuto}' ${g.chi}` : `${g.minuto}'`,
      tag: `punteggio-${riga.partita}`,
      rotta: '/',
      /*
       * Quel gol l'ha gia annunciato il tabellone, senza sapere chi.
       *
       * Prima qui si saltava del tutto, e il nome non arrivava mai: restava
       * "il marcatore non risulta ancora" anche a nome noto. Ora la notifica
       * si riscrive sul posto -- stesso tag, niente squillo -- e il nome
       * compare dove l'utente sta gia guardando.
       *
       * A partita chiusa un gol arrivato tardi aggiorna la cronaca, ma non
       * suona: il triplice fischio e gia stato annunciato.
       */
      muta: giaDetto || Boolean(riga.finita_il),
    });
  }

  /*
   * Il tabellone come fonte a se stante.
   *
   * Un gol che nessun evento spiega -- la fonte degli eventi e piu lenta, o
   * per questa gara non ne ha -- si annuncia lo stesso, dal punteggio. Prima
   * aspettava due minuti che gli eventi lo confermassero, e in quei due minuti
   * nell'app non c'era. Adesso parte al giro in cui compare; se poi arrivano
   * gli eventi, la loro notifica si riscrive muta sopra questa (`giaDetto`).
   */
  if (!nuoviGol.length && prima && mostrato && !riga.finita_il) {
    const dal = golDalTabellone(prima, mostrato, inCasa);
    const firma = `tabellone-${mostrato.casa}-${mostrato.ospiti}`;
    if (dal && !detti.has(firma)) {
      detti.add(firma);
      const minuto = minutoVero ?? minutoStimato(riga.kickoff, stato, adesso);
      // La cronologia che la scheda partita mostra durante la gara. Il nome di
      // chi ha segnato non c'e -- quello lo danno solo gli eventi -- ma minuto
      // e punteggio si sanno, e sono la meta che serve mentre si gioca.
      patch.gol = [
        ...(((patch.gol ?? riga.gol) ?? []) as unknown[]),
        { minuto, casa: mostrato.casa, ospiti: mostrato.ospiti, nostro: dal.nostro, fonte: minutoVero ? 'vero' : 'stimato' },
      ];
      avvisi.push({
        tipo: 'gol',
        titolo: `${dal.nostro ? 'GOL DEL FOGGIA!' : 'Gol subito.'} ${mostrato.casa}-${mostrato.ospiti}`,
        // col minuto vero si scrive secco, con quello stimato si dice "circa"
        testo: minuto
          ? `${minutoVero ? '' : 'Circa '}${minuto}'. Il marcatore non risulta ancora.`
          : 'Dal tabellone. Il marcatore non risulta ancora.',
        tag: `punteggio-${riga.partita}`,
        rotta: '/',
      });
    }
  }

  // --------------------------------------------------------- fine primo tempo
  //
  // Il tabellone dice HT e nessuno lo diceva a chi non stava guardando. E il
  // momento in cui si va a prendere da bere: sapere che si e fermato per
  // quindici minuti cambia cosa fai nei prossimi quindici.
  const sulTabellone = mostrato ?? prima;
  if (stato === 'HT' && !detti.has(`intervallo-${riga.partita}`)) {
    detti.add(`intervallo-${riga.partita}`);
    avvisi.push({
      tipo: 'intervallo',
      titolo: `Fine primo tempo. ${sulTabellone?.casa ?? 0}-${sulTabellone?.ospiti ?? 0}`,
      testo: etichetta,
      tag: `intervallo-${riga.partita}`,
      rotta: '/',
    });
  }

  // ------------------------------------------------------------ la chiusura
  /*
   * Il triplice fischio si mostra subito, la partita si chiude quando il
   * risultato e sicuro.
   *
   * Chiudere vuol dire scrivere `finita_il`: il trigger del database registra
   * il risultato in `partite_chiuse` e paga i pronostici, UNA VOLTA SOLA. Un
   * gol al novantaquattresimo che una fonte non ha ancora preso, chiuso cosi,
   * diventa punti sbagliati per sempre.
   *
   * Quindi: al primo "finita" di una fonte l'app lo dice, e il guardiano si
   * annota l'istante. Chiude quando le due fonti concordano sul risultato da
   * almeno due minuti, oppure dopo cinque se ne parla una sola, oppure dopo
   * dieci comunque. `finita_il` resta l'istante del fischio, non quello della
   * chiusura: la chat chiude venti minuti dopo la partita, non dopo il conto.
   */
  const fineVista = FINITE.includes(stato);
  // l'ultimo fischio visto: se una fonte aveva detto "finita" per sbaglio e la
  // partita e ripresa, il conto riparte dal fischio nuovo
  const fischi = [...detti].filter((f) => f.startsWith('fischio-')).map((f) => Number(f.slice('fischio-'.length)));
  let fischioIl = fischi.length ? Math.max(...fischi) : NaN;
  if (fineVista && (!Number.isFinite(fischioIl) || !FINITE.includes(statoPrima))) {
    fischioIl = adesso;
    detti.add(`fischio-${adesso}`);
  }

  let chiusa = false;
  let finale: Punteggio | null = null;
  if (fineVista && !riga.finita_il) {
    const passati = adesso - fischioIl;
    const concordi = !!tabellone && !!punteggioLsa
      && tabellone.casa === punteggioLsa.casa && tabellone.ospiti === punteggioLsa.ospiti;
    const unaSola = !tabellone !== !punteggioLsa;
    finale = concordi ? tabellone : (punteggioLsa ?? tabellone ?? mostrato ?? prima);
    if (finale && ((concordi && passati >= CONFERMA_CONCORDI)
        || (unaSola && passati >= CONFERMA_UNA_FONTE)
        || passati >= CONFERMA_MASSIMA)) {
      chiusa = true;
      patch.finita_il = new Date(fischioIl).toISOString();
      patch.casa = finale.casa;
      patch.ospiti = finale.ospiti;
    }
  }

  // A partita chiusa il risultato e quello pagato ai pronostici: non si sposta piu.
  if (riga.finita_il) {
    delete patch.casa;
    delete patch.ospiti;
  }

  if (chiusa && finale && !riga.fine_mandata) {
    patch.fine_mandata = true;
    const nostri = inCasa ? finale.casa : finale.ospiti;
    const loro = inCasa ? finale.ospiti : finale.casa;
    const esito = nostri > loro ? 'Vittoria' : nostri < loro ? 'Sconfitta' : 'Pareggio';
    avvisi.push({
      tipo: 'fine',
      titolo: `${esito}. ${finale.casa}-${finale.ospiti}`,
      testo: 'Due minuti per dare i voti ai giocatori.',
      tag: `fine-${riga.partita}`,
      rotta: '/',
    });
  }

  // ---------------------------------------------------- l'esito del pronostico
  //
  // Dopo che il punteggio e stato scritto: il trigger su finita_il chiude la
  // partita e assegna i punti, quindi quando l'avviso parte i punti ci sono
  // gia e chi apre li trova. Un solo testo per tutti, non uno personalizzato:
  // dire "hai preso cento punti" vorrebbe dire mandare una notifica diversa a
  // ognuno, e la differenza per chi legge e nessuna.
  if (chiusa && finale && !riga.esito_mandato) {
    patch.esito_mandato = true;
    const chiHaGiocato = await chiHaPronosticato(riga.partita);
    if (chiHaGiocato.length) {
      mirati.push([{
        tipo: 'esito',
        titolo: 'Com\'e andato il tuo pronostico',
        testo: `${finale.casa}-${finale.ospiti}. Guarda quanti punti hai preso.`,
        tag: `esito-${riga.partita}`,
        rotta: '/classifica',
      }, chiHaGiocato]);
    }
  }

  patch.eventi_detti = [...detti];

  /*
   * Prima di scrivere: quello che si sa non si perde.
   *
   * La regola sta in proteggi(), dentro punteggio.ts, sotto test. Era qui in
   * linea e copriva solo i gol -- cartellini e cambi potevano sparire dopo una
   * lettura a vuoto, e per un rosso sarebbe tornata anche la notifica.
   */
  await db.from('stato_partita').update(proteggi(patch, riga as unknown as Record<string, unknown>))
    .eq('partita', riga.partita);

  /*
   * Il diario del dal vivo, nei log della funzione.
   *
   * Una riga solo quando qualcosa cambia. Serve a rispondere dopo la partita,
   * con i numeri, alla domanda "quanto arrivavamo in ritardo e per colpa di
   * chi": ogni riga dice cosa vedeva ciascuna fonte in quell'istante.
   */
  const cambiato = stato !== statoPrima
    || (mostrato && (mostrato.casa !== riga.casa || mostrato.ospiti !== riga.ospiti))
    || nuoviGol.length > 0 || avvisi.length > 0 || chiusa
    || (Array.isArray(patch.cartellini) && patch.cartellini.length !== (riga.cartellini ?? []).length)
    || (Array.isArray(patch.cambi) && patch.cambi.length !== (riga.cambi ?? []).length);
  if (cambiato && leggiEnv('GUARDIANO_DIARIO') !== 'no') {
    console.log(JSON.stringify({
      diario: 'guardiano',
      ora: ora(),
      giro: primo ? 'primo' : 'veloce',
      tsdb: e ? `${letto} ${casaT ?? '-'}-${ospitiT ?? '-'} ${e.strProgress ?? ''}`.trim() : null,
      lsa: lettura
        ? `${statoLsa ?? '?'} ${p ? `${p.casa}-${p.ospiti}` : '-'} ${lettura.minuto ?? ''} eventi:${lettura.eventi.length}`
        : (leggoLsa ? 'fallita' : 'non letta'),
      mostrato: mostrato ? `${mostrato.casa}-${mostrato.ospiti}` : null,
      stato,
      cartellini: Array.isArray(patch.cartellini) ? patch.cartellini.length : undefined,
      cambi: Array.isArray(patch.cambi) ? patch.cambi.length : undefined,
      chiusa: chiusa || undefined,
    }));
  }

  const esiti = [];
  for (const a of avvisi) esiti.push({ tipo: a.tipo, titolo: a.titolo, ...(await diffondi(a)) });
  for (const [a, chi] of mirati) esiti.push({ tipo: a.tipo, titolo: a.titolo, ...(await diffondi(a, chi)) });

  return {
    risposta: {
      partita: etichetta, stato,
      casa: (riga.finita_il ? riga.casa : patch.casa) ?? riga.casa,
      ospiti: (riga.finita_il ? riga.ospiti : patch.ospiti) ?? riga.ospiti,
      avvisi: esiti,
    },
    caldo,
  };
}

/**
 * Cosa vedono le fonti di una partita qualsiasi, adesso. Non scrive e non avvisa.
 *
 * Cerca per nome di squadra, nella lista del dal vivo di TheSportsDB e in
 * quella della Serie C di live-score-api.
 */
async function provaDalVivo(squadra: string) {
  const cerca = squadra.toLowerCase().replace(/[^a-z]/g, '');
  const d = await json(`${TSDB}/livescore.php?s=Soccer`);
  const tsdb = ((d?.livescore ?? []) as Array<Record<string, unknown>>).find((x) =>
    `${x.strHomeTeam} ${x.strAwayTeam}`.toLowerCase().replace(/[^a-z]/g, '').includes(cerca)) ?? null;

  let lsa: Record<string, unknown> | null = null;
  if (chiaviLSA) {
    const loro = await trovaPartita(chiaviLSA, squadra);
    const l = loro ? await leggiPartita(loro.id, chiaviLSA) : null;
    lsa = l && {
      id: loro?.id, stato: l.stato, punteggio: l.punteggio, minuto: l.minuto, eventi: l.eventi.length,
      ultimi: l.eventi.slice(-3).map((x) => `${x.time?.elapsed}' ${x.type} ${x.player?.name ?? ''}`),
    };
  }

  return {
    prova: 'dal vivo',
    ora: ora(),
    tsdb: tsdb && {
      partita: `${tsdb.strHomeTeam} - ${tsdb.strAwayTeam}`,
      stato: tsdb.strStatus, punteggio: `${tsdb.intHomeScore}-${tsdb.intAwayScore}`, minuto: tsdb.strProgress,
    },
    lsa,
  };
}

/** Quando il Foggia non si riconosce nei nomi delle squadre, si dice il modulo. */
function etichettaDaFormazione(f: { casa: { modulo: string | null }; ospiti: { modulo: string | null } }): string {
  return `${f.casa.modulo ?? '?'} contro ${f.ospiti.modulo ?? '?'}`;
}
