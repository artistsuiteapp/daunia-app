#!/usr/bin/env node
/**
 * Ingest: scarica dalle fonti pubbliche, normalizza, scrive data/*.json.
 * Zero dipendenze npm, gira su Node 20+ e dentro GitHub Actions senza install.
 *
 *   node services/ingest/run.mjs            scrive i file
 *   node services/ingest/run.mjs --dry-run  stampa il riassunto e non scrive
 *   NO_CACHE=1 node ...                     ignora la cache su disco
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as wp from './src/sources/foggia-wp.mjs';
import * as wiki from './src/sources/wikipedia.mjs';
import { fetchEditorial } from './src/sources/blog.mjs';
import * as shopSrc from './src/sources/shop.mjs';
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

  // un unico feed, i post redazionali si mescolano ai comunicati per data
  const news = [...clubNews, ...editorial].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));

  const nextHome = pickNextHome(wikiSeason.matches);
  const stadium = buildStadium(nextHome, wikiSeason.stadiumCapacity);

  const bundle = normalize({
    wpTeams, wpPhotos, news, wikiSeason, wikiStandings, stadium,
    shop: { products, categories: shopCats },
    season: SEASON, competition: COMPETITION,
  });

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
    'bundle.json': bundle,
  };
  for (const [name, payload] of Object.entries(files)) {
    await writeFile(path.join(OUT, name), `${JSON.stringify(payload, null, 2)}\n`);
  }
  console.log(`scritti ${Object.keys(files).length} file in ${path.relative(process.cwd(), OUT)}/`);
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
