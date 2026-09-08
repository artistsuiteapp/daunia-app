#!/usr/bin/env node
/**
 * Ingest: scarica dalle fonti pubbliche, normalizza, scrive data/*.json.
 * Zero dipendenze npm, gira su Node 20+ e dentro GitHub Actions senza install.
 *
 *   node services/ingest/run.mjs            scrive i file
 *   node services/ingest/run.mjs --dry-run  stampa il riassunto e non scrive
 *   NO_CACHE=1 node ...                     ignora la cache su disco
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as wp from './src/sources/foggia-wp.mjs';
import * as wiki from './src/sources/wikipedia.mjs';
import { fetchEditorial } from './src/sources/blog.mjs';
import * as shopSrc from './src/sources/shop.mjs';
import { fetchPartita, fetchPartitaPerId, fetchRosa, dentroLaFinestra } from './src/sources/apifootball.mjs';
import { fetchIdPartite, fetchProssima, fetchRisultati } from './src/sources/thesportsdb.mjs';
import { arricchisciPartite } from './src/sources/livescore.mjs';
import { fetchFormazioni } from './src/sources/legapro.mjs';
import { fetchDivieti } from './src/sources/divieti.mjs';
import { fetchStampa } from './src/sources/stampa.mjs';
import { buildStadium } from './src/stadium.mjs';
import { normalize, validate } from './src/normalize.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = path.join(ROOT, 'data');

const SEASON = process.env.SEASON || '2026-2027';
const COMPETITION = 'Serie C';
const GROUP = 'Girone C';

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const t0 = Date.now();
  log(`ingest stagione ${SEASON}, ${COMPETITION} ${GROUP}`);

  const [wpTeams, wpPhotos, clubNews, wikiSeason, wikiStandings, editorial, products, shopCats] = await Promise.all([
    step('stemmi squadre (sito club)', () => wp.fetchTeams()),
    step('foto rosa (sito club)', () => wp.fetchPlayerPhotos()),
    step('news (sito club)', () => wp.fetchNews(40)),
    step('rosa e calendario (Wikipedia)', () => wiki.fetchClubSeason(SEASON, COMPETITION)),
    step('classifica (Wikipedia)', () => wiki.fetchStandings(SEASON, GROUP)),
    step('post redazionali (data/blog)', () => fetchEditorial(path.join(OUT, 'blog'))),
    step('prodotti (negozio ufficiale)', () => shopSrc.fetchProducts().catch(() => [])),
    step('categorie negozio', () => shopSrc.fetchCategories().catch(() => [])),
  ]);

  /*
   * Formazioni, eventi e punteggio dal vivo da API-Football.
   *
   * Il piano gratuito basta: le chiamate senza il parametro `season` rispondono
   * con la stagione in corso. Il vincolo vero e la quota, cento al giorno, e il
   * cron gira ogni mezz'ora. Quindi si chiama solo dentro la finestra di una
   * partita e solo finche manca qualcosa: gli altri giorni costa zero.
   */
  const live = await step('partita dal vivo (API-Football)', () => aggiornaPartita({
    chiave: process.env.API_FOOTBALL_KEY,
    matches: wikiSeason.matches,
  }));

  const storico = await step('formazioni gia giocate (TheSportsDB + API-Football)', () => aggiornaArchivio({
    chiave: process.env.API_FOOTBALL_KEY,
    matches: wikiSeason.matches,
    archivio: live.archivio,
  }));

  const rosaApi = await step('rosa di oggi (API-Football)', () => aggiornaRosa({
    chiave: process.env.API_FOOTBALL_KEY,
  }));

  /*
   * L'id TheSportsDB della prossima partita.
   *
   * Serve al telefono: durante la gara interroga lookupevent.php con questo id
   * e riceve punteggio e stato in un chilo e mezzo di JSON, gratis e senza
   * quota giornaliera. Se lo cercasse da solo servirebbe una chiamata in piu a
   * ogni apertura dell'app.
   */
  const prossima = await step('prossima partita (TheSportsDB)', () => fetchProssima());

  /*
   * I risultati appena giocati.
   *
   * Wikipedia arriva tardi: la mattina dopo Foggia-Cerignola la pagina della
   * stagione dava ancora la partita "in programma", quindi nell'app non stava
   * fra le giocate e in home compariva "prossima in casa" su una gara finita
   * da dodici ore. Questo riempie il buco fra il triplice fischio e
   * l'aggiornamento della pagina.
   */
  const esiti = await step('risultati recenti (TheSportsDB)', () => fetchRisultati());
  applicaRisultati(wikiSeason.matches, esiti.risultati);

  /*
   * I marcatori delle partite giocate.
   *
   * Wikipedia i gol li ha, ma con ore o giorni di ritardo, e sulle giornate
   * vecchie a volte non li ha affatto: nella scheda partita la cronaca restava
   * vuota senza che si capisse perche. live-score-api li da col nome e il
   * minuto, piu cartellini e sostituzioni.
   *
   * Tocca solo le partite finite che non hanno gia i gol, quindi una stagione
   * intera costa una manciata di chiamate e solo per le giornate nuove.
   */
  const marcatori = await step('marcatori (live-score-api)', () => arricchisciPartite(wikiSeason.matches));

  /*
   * Le formazioni ufficiali, dal sito della Lega.
   *
   * Nessuna delle API le da per la Serie C: API-Football le ha ma l'account e
   * stato sospeso due volte, live-score-api le tiene dietro il piano da 26
   * euro. seriec.com le pubblica, il suo robots.txt consente tutti i bot, e
   * l'endpoint del calendario risponde con l'undici, il modulo e l'allenatore.
   *
   * Si guardano solo la partita appena giocata e quella in arrivo: le altre o
   * ce l'hanno gia o non le avranno mai.
   */
  /*
   * Tutte le giocate che non hanno ancora la formazione, piu la prossima.
   *
   * Prima erano solo le due piu vicine a oggi, e le giornate vecchie
   * restavano senza. Costa una chiamata a partita, ma solo la prima volta:
   * quelle gia archiviate non si richiedono piu.
   */
  const gia = new Set(Object.keys((await letto('formazioni-ufficiali.json')) ?? {}));
  const adesso = Date.now();
  const diInteresse = wikiSeason.matches
    .filter((m) => m.kickoff && !gia.has(m.id))
    .filter((m) => Date.parse(m.kickoff) < adesso
      || Date.parse(m.kickoff) - adesso < 6 * 60 * 60 * 1000)
    .sort((a, b) => Date.parse(b.kickoff) - Date.parse(a.kickoff));
  const cacheId = (await letto('legapro-ids.json')) ?? {};
  const formazioni = await step('formazioni ufficiali (Lega Pro)',
    () => fetchFormazioni(diInteresse, cacheId));
  // le formazioni gia trovate restano: la Lega non le ripubblica, e
  // richiederle a ogni giro sarebbe una chiamata sprecata per sempre
  const formazioniTutte = {
    ...((await letto('formazioni-ufficiali.json')) ?? {}),
    ...formazioni.formazioni,
  };

  /*
   * Divieti di trasferta, letti dalla stampa locale.
   *
   * Propone, non pubblica: quello che esce qui e una proposta che diventa vera
   * solo dopo che una persona l'ha letta. Un divieto sbagliato fa prendere un
   * treno a vuoto a qualcuno.
   */
  const divieti = await step('divieti di trasferta (stampa locale)', () => fetchDivieti({
    partite: wikiSeason.matches
      .filter((m) => m.status !== 'finished' && !m.foggiaHome && m.kickoff)
      .map((m) => ({ id: m.id, away: m.homeName ?? m.awayName, kickoff: m.kickoff })),
  }));

  /*
   * Rassegna stampa: le testate che hanno dato il permesso.
   *
   * Titolo, link e sommario. Il corpo non entra nemmeno quando il feed lo
   * porta: chi legge finisce sulla loro pagina, ed e la condizione a cui hanno
   * detto di si.
   *
   * Si guarda due volte al giorno, e il freno sta nel dato: il giro precedente
   * porta l'ora, e finche e giovane non parte una richiesta. Il cron di questo
   * workflow batte ogni mezz'ora per le partite, e la cache su disco in CI e
   * spenta, quindi non poteva stare ne li ne li.
   */
  const stampa = await step('rassegna stampa (testate convenzionate)', async () => fetchStampa({
    precedente: await letto('stampa.json'),
  }));
  if (stampa.saltato) log('  stampa: ancora fresca, nessuna richiesta');

  /*
   * La rosa di Wikipedia tiene dentro chi e andato via. Quella di API-Football
   * e la lista buona per la partita, e si aggiorna da sola. Si incrociano sul
   * numero di maglia: chi non ha un numero in entrambe resta, perche togliere
   * un giocatore vero e peggio che tenerne uno di troppo.
   */
  if (rosaApi.rosa.length >= 18) {
    const numeriVeri = new Set(rosaApi.rosa.map((p) => p.number).filter((n) => n !== null));
    const prima = wikiSeason.squad.length;
    wikiSeason.squad = wikiSeason.squad.filter(
      (p) => p.number === null || p.number === undefined || numeriVeri.has(p.number),
    );
    const tolti = prima - wikiSeason.squad.length;
    if (tolti) log(`  rosa: tolti ${tolti} giocatori non piu in distinta`);
  }

  // un unico feed, i post redazionali si mescolano ai comunicati per data
  const news = [...clubNews, ...editorial].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const nextHome = pickNextHome(wikiSeason.matches);
  const stadium = buildStadium(nextHome, wikiSeason.stadiumCapacity);

  const bundle = normalize({
    wpTeams, wpPhotos, news, wikiSeason, wikiStandings, stadium,
    shop: { products, categories: shopCats },
    season: SEASON, competition: COMPETITION,
  });

  // la partita dal vivo e le formazioni vere viaggiano accanto al resto
  bundle.live = live.partita;
  bundle.lineups = storico.archivio;
  bundle.prossima = prossima.prossima;
  bundle.formazioniUfficiali = formazioniTutte;
  bundle.divietiProposti = divieti.proposte;
  bundle.stampa = {
    testate: stampa.testate,
    articoli: stampa.articoli,
    aggiornatoIl: stampa.aggiornatoIl ?? null,
  };
  bundle.meta.warnings.push(...live.warnings, ...storico.warnings, ...rosaApi.warnings, ...prossima.warnings, ...divieti.warnings, ...esiti.warnings, ...marcatori.warnings, ...formazioni.warnings, ...stampa.warnings);

  const errors = validate(bundle);
  summary(bundle, nextHome, Date.now() - t0);

  if (errors.length) {
    console.error('\nVALIDAZIONE FALLITA:');
    for (const e of errors) console.error('  -', e);
    process.exit(1);
  }
  console.log('\nvalidazione: ok');

  if (dryRun) { console.log('dry-run: nessun file scritto'); return; }

  await mkdir(OUT, { recursive: true });
  const files = {
    'meta.json': bundle.meta,
    'teams.json': bundle.teams,
    'matches.json': bundle.matches,
    'standings.json': bundle.standings,
    'squad.json': bundle.squad,
    'staff.json': bundle.staff,
    'news.json': bundle.news,
    'stadium.json': bundle.stadium,
    'shop.json': bundle.shop,
    'tickets.json': bundle.tickets,
    'stats.json': bundle.stats,
    'live.json': bundle.live,
    'prossima.json': bundle.prossima,
    'legapro-ids.json': formazioni.cache,
    'formazioni-ufficiali.json': formazioniTutte,
    'divieti-proposti.json': bundle.divietiProposti,
    'stampa.json': bundle.stampa,
    'lineups.json': bundle.lineups,
    'bundle.json': bundle,
  };
  for (const [name, payload] of Object.entries(files)) {
    await writeFile(path.join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
  }
  console.log(`scritti ${Object.keys(files).length} file in ${path.relative(process.cwd(), OUT)}/`);
}

/** Legge un file gia scritto in data/, o null se non c'e ancora. */
async function letto(nome) {
  try { return JSON.parse(await readFile(path.join(OUT, nome), 'utf8')); }
  catch { return null; }
}

const GIORNI_ROSA = 7 * 24 * 60 * 60 * 1000;

/**
 * Aggiorna la partita in corso, se ce n'e una nella finestra utile.
 *
 * Fuori dalla finestra non spende niente e restituisce quello che c'e gia su
 * disco: e la regola che tiene i consumi sotto le cento chiamate al giorno.
 */
async function aggiornaPartita({ chiave, matches }) {
  const archivio = (await letto('lineups.json')) ?? [];
  const salvata = await letto('live.json');
  const warnings = [];

  if (!chiave) return { partita: salvata, archivio, warnings: ['API-Football: nessuna chiave, formazioni vere non disponibili.'] };

  const adesso = Date.now();
  const inCorso = matches
    .filter((m) => m.kickoff && dentroLaFinestra(m.kickoff, adesso))
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))[0];

  if (!inCorso) {
    log('  nessuna partita nella finestra: zero chiamate');
    return { partita: salvata, archivio, warnings };
  }

  const date = new Date(inCorso.kickoff).toISOString().slice(0, 10);
  const stessa = salvata && salvata.date === date ? salvata : null;

  if (stessa && ['FT', 'AET', 'PEN'].includes(stessa.status) && stessa.lineups.length && stessa.events.length) {
    log('  partita gia completa: zero chiamate');
    return { partita: stessa, archivio, warnings };
  }

  /*
   * Se l'id della partita e gia noto si chiede quella e basta: `fixtures?id=`
   * risponde con due chili di JSON, mentre `fixtures?date=` ne scarica due mega
   * con tutte le partite del mondo per poi buttarne 1169.
   */
  const noto = (await letto('prossima.json'))?.kickoff?.slice(0, 10) === date
    ? (await letto('prossima.json'))?.fixtureId
    : null;

  const r = noto
    ? await fetchPartitaPerId({ chiave, fixtureId: noto, salvata: stessa })
    : await fetchPartita({ chiave, date, salvata: stessa });
  warnings.push(...r.warnings);
  log(`  ${noto ? `partita ${noto}` : `giorno ${date}`}: ${r.chiamate} chiamate`);
  if (!r.partita) return { partita: salvata, archivio, warnings };

  return { partita: r.partita, archivio: inArchivio(archivio, r.partita), warnings };
}

/** Mette una partita finita in archivio, senza duplicarla. */
function inArchivio(archivio, partita) {
  if (!['FT', 'AET', 'PEN'].includes(partita.status) || !partita.lineups.length) return archivio;
  const senza = archivio.filter((x) => x.fixtureId !== partita.fixtureId);
  senza.push(partita);
  senza.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return senza.slice(0, 20);
}

/**
 * Recupera le formazioni delle partite gia giocate.
 *
 * `fixtures?date=` sul piano gratuito vede solo tre giorni, quindi le partite
 * vecchie si prendono per id. Gli id arrivano da TheSportsDB, che pubblica il
 * campo idAPIfootball ed e gratis senza limiti di data.
 *
 * Al massimo due partite per giro: la quota e cento chiamate al giorno e a
 * inizio stagione l'arretrato si smaltisce comunque in pochi giri.
 */
async function aggiornaArchivio({ chiave, matches, archivio }) {
  const warnings = [];
  if (!chiave) return { archivio, warnings };

  const giocate = matches
    .filter((m) => m.status === 'finished' && m.competition === COMPETITION && m.kickoff)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff));
  const mancanti = giocate.filter(
    (m) => !archivio.some((x) => x.date === m.kickoff.slice(0, 10) && x.lineups?.length),
  );
  if (!mancanti.length) {
    log('  archivio formazioni completo: zero chiamate');
    return { archivio, warnings };
  }

  const gia = (await letto('fixture-ids.json')) ?? {};
  const ponte = await fetchIdPartite({ season: SEASON, finoA: giocate.length, gia });
  warnings.push(...ponte.warnings);
  if (!dryRun && Object.keys(ponte.mappa).length > Object.keys(gia).length) {
    await mkdir(OUT, { recursive: true });
    await writeFile(path.join(OUT, 'fixture-ids.json'), `${JSON.stringify(ponte.mappa, null, 2)}\n`);
  }

  let aggiornato = archivio;
  let spese = 0;
  for (const m of mancanti.slice(0, 2)) {
    const voce = ponte.mappa[m.kickoff.slice(0, 10)];
    if (!voce) { warnings.push(`Nessun id API-Football per la partita del ${m.kickoff.slice(0, 10)}.`); continue; }
    const r = await fetchPartitaPerId({ chiave, fixtureId: voce.fixtureId });
    spese += r.chiamate;
    warnings.push(...r.warnings);
    if (r.partita) aggiornato = inArchivio(aggiornato, r.partita);
  }
  log(`  archivio: recuperate ${mancanti.slice(0, 2).length} partite, ${spese} chiamate`);
  return { archivio: aggiornato, warnings };
}

/** La rosa vera si muove di rado: una chiamata alla settimana basta. */
async function aggiornaRosa({ chiave }) {
  const salvata = await letto('rosa-api.json');
  if (!chiave) return { rosa: salvata?.rosa ?? [], warnings: [] };

  const fresca = salvata?.fetchedAt && Date.now() - Date.parse(salvata.fetchedAt) < GIORNI_ROSA;
  if (fresca) {
    log('  rosa ancora fresca: zero chiamate');
    return { rosa: salvata.rosa, warnings: [] };
  }

  const r = await fetchRosa({ chiave });
  if (!r.rosa.length) return { rosa: salvata?.rosa ?? [], warnings: r.warnings };

  if (!dryRun) {
    await mkdir(OUT, { recursive: true });
    await writeFile(
      path.join(OUT, 'rosa-api.json'),
      `${JSON.stringify({ fetchedAt: new Date().toISOString(), rosa: r.rosa }, null, 2)}\n`,
    );
  }
  return { rosa: r.rosa, warnings: r.warnings };
}

function pickNextHome(matches) {
  const now = Date.now();
  return matches
    .filter((m) => m.foggiaHome && m.kickoff && Date.parse(m.kickoff) > now)
    .sort((a, b) => Date.parse(a.kickoff) - Date.parse(b.kickoff))[0] || null;
}

async function step(label, fn) {
  const t = Date.now();
  try {
    const res = await fn();
    log(`  ${label} ... ok (${Date.now() - t}ms)`);
    return res;
  } catch (err) {
    log(`  ${label} ... FALLITO: ${err.message}`);
    throw err;
  }
}

function summary(b, nextHome, ms) {
  const played = b.matches.filter((m) => m.status === 'finished');
  const foggia = b.standings.find((r) => r.isFoggia);
  console.log(`
--- riassunto (${ms}ms) ---
squadre      ${b.teams.length}  (con stemma: ${b.teams.filter((t) => t.crest).length})
partite      ${b.matches.length}  (giocate: ${played.length}, gol registrati: ${played.reduce((a, m) => a + m.goals.length, 0)})
classifica   ${b.standings.length} righe  | Foggia ${foggia ? `${foggia.position}° con ${foggia.points} punti` : 'assente'}
rosa         ${b.squad.length} giocatori  (con foto: ${b.squad.filter((p) => p.photo).length})
staff        ${b.staff.map((s) => `${s.job}: ${s.name}`).join(', ') || '-'}
news         ${b.news.length}  (ultima: ${b.news[0]?.date?.slice(0, 10) || '-'})
stampa       ${b.stampa?.articoli.length ?? 0} articoli da ${b.stampa?.testate.length ?? 0} testate  (ultimo: ${b.stampa?.articoli[0]?.data?.slice(0, 10) || '-'})
stadio       ${b.stadium.name}, capienza ${b.stadium.capacity}, ${b.stadium.sectors.length} settori
negozio      ${b.shop.products.length} prodotti in ${b.shop.categories.length} categorie
biglietti    ${b.tickets.length} settori in vendita
statistiche  ${b.stats.competitions.length} competizioni, ${b.stats.trend.filter((t) => t.result).length} giornate con esito
prossima in casa  ${nextHome ? `${nextHome.homeName} - ${nextHome.awayName} il ${nextHome.kickoff.slice(0, 10)}` : 'nessuna'}`);
  if (b.meta.warnings.length) {
    console.log('\navvisi:');
    for (const w of b.meta.warnings) console.log('  !', w);
  }
}

const log = (m) => console.log(m);

main().catch((err) => { console.error('\nERRORE:', err.message); process.exit(1); });


/** Normalizza un nome squadra per confrontarlo fra fonti diverse. */
const stessaSquadra = (a, b) => {
  const pulisci = (x) => String(x ?? '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z]/g, '');
  const [p, q] = [pulisci(a), pulisci(b)];
  return Boolean(p) && Boolean(q) && (p.includes(q) || q.includes(p));
};

/**
 * Scrive nel calendario i risultati che Wikipedia non ha ancora.
 *
 * Tocca solo le partite ancora "in programma" con il calcio d'inizio passato:
 * dove Wikipedia ha gia scritto vince lei, perche porta anche i marcatori.
 * I gol restano vuoti -- il punteggio si sa, chi ha segnato no -- e la scheda
 * partita lo dice invece di lasciare la cronaca vuota senza spiegazione.
 */
function applicaRisultati(partite, risultati) {
  if (!risultati?.length) return;
  const adesso = Date.now();

  for (const m of partite) {
    if (m.status === 'finished' || !m.kickoff) continue;
    if (Date.parse(m.kickoff) > adesso) continue;

    const giorno = m.kickoff.slice(0, 10);
    // qui il calendario e ancora quello grezzo di Wikipedia: le squadre sono
    // nomi, non oggetti -- gli oggetti arrivano dopo, in normalize
    const r = risultati.find((x) => x.data === giorno
      && stessaSquadra(x.casa, m.homeName)
      && stessaSquadra(x.ospiti, m.awayName));
    if (!r) continue;

    m.status = 'finished';
    m.score = { home: r.golCasa, away: r.golOspiti };
  }
}
