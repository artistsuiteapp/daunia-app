/**
 * Fonte 1: il sito ufficiale calciofoggia1920.net (WordPress + plugin SportsPress).
 * La REST API e aperta e robots.txt non pone restrizioni.
 *
 * Cosa e affidabile qui e cosa no, verificato il 2026-09-04:
 *  - news         AGGIORNATE (ultimo post 2026-09-02)
 *  - stemmi       57 squadre con immagine, buoni
 *  - foto rosa    ferme al 2025-09-25, stagione 2025-2026
 *  - calendario   fermo alla stagione 2025-2026, zero eventi dopo agosto 2026
 *  - risultati    mai compilati: results e performance tornano vuoti
 * Per la stagione corrente si usa la fonte Wikipedia.
 */
import { getJson, stripHtml, slugify, teamKey, toInt } from '../util.mjs';

const BASE = 'https://www.calciofoggia1920.net/wp-json';
const SP = `${BASE}/sportspress/v2`;
const WP = `${BASE}/wp/v2`;
const PER_PAGE = 100;

async function fetchAll(url, { max = 1000, ttl } = {}) {
  const out = [];
  for (let page = 1; out.length < max; page++) {
    const sep = url.includes('?') ? '&' : '?';
    const batch = await getJson(`${url}${sep}per_page=${PER_PAGE}&page=${page}`, { ttl });
    if (!Array.isArray(batch) || batch.length === 0) break;
    out.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return out;
}

/** Risolve gli id dei media in URL, in blocchi da 100 per non martellare il sito. */
export async function resolveMedia(ids) {
  const unique = [...new Set(ids.filter((n) => Number.isInteger(n) && n > 0))];
  const map = new Map();
  for (let i = 0; i < unique.length; i += PER_PAGE) {
    const chunk = unique.slice(i, i + PER_PAGE);
    const items = await getJson(
      `${WP}/media?include=${chunk.join(',')}&per_page=${PER_PAGE}&_fields=id,source_url,media_details`,
      { ttl: 24 * 3600 * 1000 },
    );
    for (const m of items || []) {
      const sizes = m.media_details?.sizes || {};
      const best = sizes.medium_large?.source_url || sizes.large?.source_url || sizes.medium?.source_url || m.source_url;
      map.set(m.id, best);
    }
  }
  return map;
}

/** Anagrafica squadre con stemma, indicizzata per teamKey cosi si incrocia con Wikipedia. */
export async function fetchTeams() {
  const raw = await fetchAll(`${SP}/teams?_fields=id,title,slug,featured_media`);
  const media = await resolveMedia(raw.map((t) => t.featured_media));
  const byKey = new Map();
  for (const t of raw) {
    const name = stripHtml(t.title?.rendered);
    if (!name) continue;
    const key = teamKey(name);
    if (byKey.has(key)) continue;
    byKey.set(key, {
      id: key,
      sourceId: t.id,
      name,
      shortName: shortenTeam(name),
      crest: media.get(t.featured_media) || null,
      isFoggia: key === 'foggia',
    });
  }
  return byKey;
}

/** "US SALERNITANA 1919" -> "Salernitana". Titoli tutti maiuscoli, vanno ricapitalizzati. */
function shortenTeam(name) {
  const cleaned = name
    .replace(/\b(A\.?S\.?D?|S\.?S\.?D?|U\.?S\.?D?|F\.?C\.?|A\.?C\.?|S\.?C\.?|B\.?C\.?|S\.?P\.?A)\b/gi, ' ')
    .replace(/\b(CALCIO|FOOTBALL|CLUB)\b/gi, ' ')
    .replace(/\b(1[89]\d{2}|19\d{2}|20\d{2})\b/g, ' ')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const base = cleaned || name;
  return base
    .split(' ')
    .map((w) => (w === w.toUpperCase() && w.length > 2 && !/^U\d/.test(w)
      ? w[0] + w.slice(1).toLowerCase()
      : w))
    .join(' ');
}

/** Comunicati ufficiali. E l'unica cosa davvero fresca su questa fonte. */
export async function fetchNews(limit = 40) {
  const posts = await getJson(
    `${WP}/posts?per_page=${Math.min(limit, PER_PAGE)}&_fields=id,date,slug,link,title,excerpt,featured_media,content`,
    { ttl: 10 * 60 * 1000 },
  );
  const media = await resolveMedia(posts.map((p) => p.featured_media));
  return posts.map((p) => ({
    id: `club-${p.id}`,
    date: new Date(p.date).toISOString(),
    title: stripHtml(p.title?.rendered),
    excerpt: stripHtml(p.excerpt?.rendered).replace(/\s*\[?…\]?\s*$/, '…'),
    url: p.link,
    image: media.get(p.featured_media) || null,
    kind: 'club',
    slug: p.slug,
    body: stripHtml(p.content?.rendered) || undefined,
    source: 'sportspress',
  }));
}

/**
 * Foto dei giocatori dalla rosa SportsPress, indicizzate per slug del nome.
 * La rosa e vecchia di una stagione, ma molti giocatori sono confermati:
 * si usa solo come banca immagini, i dati anagrafici vengono da Wikipedia.
 */
export async function fetchPlayerPhotos() {
  const raw = await fetchAll(`${SP}/players?_fields=id,title,number,featured_media`, { ttl: 24 * 3600 * 1000 });
  const media = await resolveMedia(raw.map((p) => p.featured_media));
  const byName = new Map();
  for (const p of raw) {
    const name = stripHtml(p.title?.rendered);
    const url = media.get(p.featured_media);
    if (!name || !url) continue;
    byName.set(slugify(name), url);
    const surname = name.split(' ').slice(-1)[0];
    if (surname && !byName.has(slugify(surname))) byName.set(slugify(surname), url);
  }
  return byName;
}

/** Archivio storico: classifiche delle stagioni passate, utile alla sezione storia. */
export async function fetchArchivedStandings() {
  const tables = await getJson(`${SP}/tables?per_page=20&_fields=id,title,date,seasons,leagues,data`, {
    ttl: 24 * 3600 * 1000,
  });
  return (tables || []).map((t) => ({
    id: t.id,
    title: stripHtml(t.title?.rendered),
    season: (stripHtml(t.title?.rendered).match(/(\d{2}\/\d{2}|\d{4}\/\d{2,4})/) || [])[1] || null,
    rows: Object.entries(t.data || {})
      .filter(([k, v]) => k !== '0' && v && typeof v === 'object' && v.name)
      .map(([, v]) => ({
        position: toInt(v.pos),
        teamName: stripHtml(v.name),
        teamId: teamKey(stripHtml(v.name)),
        played: toInt(v.p), won: toInt(v.w), drawn: toInt(v.d), lost: toInt(v.l),
        goalsFor: toInt(v.f), goalsAgainst: toInt(v.a), goalDiff: toInt(v.gd), points: toInt(v.pts),
      }))
      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99)),
  }));
}
