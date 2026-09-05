/**
 * Fonte 2: Wikipedia in italiano, via MediaWiki API.
 * Copre la stagione corrente, che sul sito del club non c'e: rosa, calendario,
 * risultati con marcatori e minuto, classifica del girone.
 * Niente chiave, niente quota, licenza CC BY-SA (va citata in app).
 */
import { getJson } from '../util.mjs';
import {
  extractTemplates, templateParams, plain, stripRefs,
  buildKickoff, parseMatchday, sectionRanges, sectionAt,
} from './wikitext.mjs';

const API = 'https://it.wikipedia.org/w/api.php';
const TTL = 30 * 60 * 1000;

export const ATTRIBUTION = {
  text: 'Dati stagione in corso da Wikipedia (CC BY-SA 4.0)',
  pages: [],
};

async function wikitext(page, section) {
  const url = new URL(API);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', page);
  url.searchParams.set('prop', 'wikitext|sections');
  url.searchParams.set('format', 'json');
  url.searchParams.set('formatversion', '2');
  if (section !== undefined) url.searchParams.set('section', String(section));
  const data = await getJson(url.toString(), { ttl: TTL });
  if (data.error) throw new Error(`Wikipedia: ${data.error.info} (${page})`);
  return { text: data.parse.wikitext, sections: data.parse.sections || [] };
}

/** Il titolo della pagina stagione del club, es. "Calcio Foggia 1920 2026-2027". */
export function seasonPage(season) { return `Calcio Foggia 1920 ${season}`; }

/** Rosa della stagione corrente: numero, ruolo, nazionalita, prestiti. */
export function parseSquad(wt) {
  const RUOLI = { P: 'Portiere', D: 'Difensore', C: 'Centrocampista', A: 'Attaccante' };
  return extractTemplates(wt, 'Calciatore in rosa')
    .map(({ block }) => {
      const p = templateParams(block);
      if (!p.nome) return null;
      const raw = p.nome.trim();
      const name = plain(raw);
      if (!name) return null;
      const role = (p.ruolo || '').trim().toUpperCase().slice(0, 1);
      const num = Number(String(p.n || '').replace(/\D/g, ''));
      const parts = name.split(' ');
      return {
        id: `wp-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name,
        shortName: parts.length > 1 ? parts.slice(1).join(' ') : name,
        number: Number.isFinite(num) && num > 0 ? num : null,
        role: RUOLI[role] ? role : null,
        roleLabel: RUOLI[role] || null,
        nationality: (p.nazione || '').trim().toUpperCase() || null,
        photo: null,
        onLoan: /''.*''/.test(raw) || String(p.nome).includes("''"),
        source: 'wikipedia',
      };
    })
    .filter(Boolean);
}

/**
 * Marcatori di un lato. Wikipedia mette il nome PRIMA del template per la squadra 1
 * e DOPO per la squadra 2, rispecchiando il layout della tabella.
 */
function parseScorers(field, side) {
  const clean = stripRefs(field || '');
  if (!clean.trim()) return [];
  const re = /\{\{\s*[Gg]oal\s*\|\s*(\d+)\s*(?:\|\s*\+?\s*(\d+)\s*)?([^}]*)\}\}/g;
  const marks = [];
  let m;
  while ((m = re.exec(clean)) !== null) {
    marks.push({ minute: Number(m[1]), extra: m[2] ? Number(m[2]) : null, flags: m[3] || '', start: m.index, end: re.lastIndex });
  }
  const nameOf = (chunk) => plain(chunk).replace(/^[\s,;·+]+|[\s,;·+]+$/g, '').replace(/\((?:rig|aut)\.?\)/gi, '').trim();
  return marks.map((mark, i) => {
    const before = nameOf(clean.slice(i === 0 ? 0 : marks[i - 1].end, mark.start));
    const after = nameOf(clean.slice(mark.end, i + 1 < marks.length ? marks[i + 1].start : clean.length));
    const scorer = side === 'home' ? before || after : after || before;
    const ctx = `${before} ${after} ${mark.flags}`;
    return {
      minute: mark.minute,
      extra: mark.extra,
      scorer: scorer || 'sconosciuto',
      side,
      ownGoal: /\baut\b|autorete/i.test(ctx),
      penalty: /\brig\b|rigore/i.test(ctx),
    };
  }).filter((g) => g.scorer !== 'sconosciuto' || g.minute);
}

/** Calendario e risultati della stagione, dai template {{Incontro di club}}. */
export function parseMatches(wt, { season, competition, warnings = [] }) {
  const sections = sectionRanges(wt, 3);
  const window = seasonWindow(season);
  return extractTemplates(wt, 'Incontro di club').map(({ block, start }, idx) => {
    const p = templateParams(block);
    const homeName = plain(p['squadra 1'] || '');
    const awayName = plain(p['squadra 2'] || '');
    if (!homeName || !awayName) return null;

    const hs = String(p['punteggio 1'] ?? '').trim();
    const as = String(p['punteggio 2'] ?? '').trim();
    const played = hs !== '' && as !== '' && /^\d+$/.test(hs) && /^\d+$/.test(as);
    const section = sectionAt(sections, start);
    const comp = section && /coppa/i.test(section) ? section.trim() : competition;
    const kickoff = fixSeasonYear(buildKickoff(p.giornomese, p.anno, p.ora), p, window, warnings, `${plain(p['squadra 1'])}-${plain(p['squadra 2'])}`);

    const goals = [
      ...parseScorers(p['marcatori 1'], 'home'),
      ...parseScorers(p['marcatori 2'], 'away'),
    ].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

    const foggiaHome = /foggia/i.test(homeName);
    let foggiaResult = null;
    if (played) {
      const mine = foggiaHome ? Number(hs) : Number(as);
      const theirs = foggiaHome ? Number(as) : Number(hs);
      foggiaResult = mine > theirs ? 'W' : mine < theirs ? 'L' : 'D';
    }

    // 0 spettatori e un dato vero (porte chiuse), non un valore mancante:
    // il fallback con || trasformava lo zero in null
    const attRaw = plain(p.spettatori || '').replace(/[.\s]/g, '');
    const attendance = /^\d+$/.test(attRaw) ? Number(attRaw) : null;

    return {
      id: `wp-${season}-${String(p.id || idx + 1).padStart(3, '0')}`,
      kickoff,
      status: played ? 'finished' : postponed(p) ? 'postponed' : 'scheduled',
      matchday: parseMatchday(p.turno),
      competition: comp,
      season,
      homeName,
      awayName,
      score: played ? { home: Number(hs), away: Number(as) } : null,
      venue: plain(p.stadio) || null,
      city: plain(p.citta || p['città']) || null,
      attendance,
      referee: plain(p.arbitro) || null,
      goals,
      foggiaHome,
      foggiaResult,
      reportUrl: (p.referto || '').trim() || null,
      source: 'wikipedia',
    };
  }).filter(Boolean);
}

/** La stagione va dal 1 luglio dell'anno di apertura al 30 giugno di quello di chiusura. */
function seasonWindow(season) {
  const [a, b] = String(season).split('-').map(Number);
  return { from: Date.UTC(a, 6, 1), to: Date.UTC(b, 5, 30, 23, 59) };
}

/**
 * Wikipedia e scritta a mano e capita l'anno sbagliato: la Coppa Italia 2026-2027
 * risultava datata 2025. Se la data cade fuori dalla stagione ma ci rientra
 * spostandola di un anno, si corregge e si registra un avviso.
 */
function fixSeasonYear(iso, p, window, warnings, label) {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (t >= window.from && t <= window.to) return iso;
  for (const delta of [1, -1]) {
    const shifted = buildKickoff(p.giornomese, Number(String(p.anno).replace(/\D/g, '')) + delta, p.ora);
    const st = shifted ? Date.parse(shifted) : NaN;
    if (st >= window.from && st <= window.to) {
      warnings.push(`Anno corretto su Wikipedia per ${label}: ${iso.slice(0, 10)} -> ${shifted.slice(0, 10)}.`);
      return shifted;
    }
  }
  warnings.push(`Data fuori stagione per ${label}: ${iso.slice(0, 10)}, lasciata invariata.`);
  return iso;
}

function postponed(p) {
  return /rinviat|sospes/i.test(`${p.turno || ''} ${p.note || ''}`);
}

/**
 * Statistiche di squadra: il template le tiene per competizione, divise fra casa
 * e trasferta. Le sigle sono c* per casa e t* per trasferta, poi v/n/p per
 * vinte, nulle e perse, gf/gs per gol fatti e subiti.
 */
export function parseTeamStats(wt) {
  const block = extractTemplates(wt, 'Statistiche_squadra')[0] || extractTemplates(wt, 'Statistiche squadra')[0];
  if (!block) return [];
  const p = templateParams(block.block);
  const out = [];

  for (let i = 1; i <= 6; i++) {
    const name = plain(p[`comp${i}`] || '');
    if (!name) continue;
    const num = (key) => {
      const v = String(p[`${key}${i}`] ?? '').trim();
      return /^-?\d+$/.test(v) ? Number(v) : 0;
    };
    const points = String(p[`punti${i}`] ?? '').trim();
    out.push({
      competition: name,
      points: /^-?\d+$/.test(points) ? Number(points) : null,
      home: { won: num('cv'), drawn: num('cn'), lost: num('cp'), goalsFor: num('cgf'), goalsAgainst: num('cgs') },
      away: { won: num('tv'), drawn: num('tn'), lost: num('tp'), goalsFor: num('tgf'), goalsAgainst: num('tgs') },
    });
  }
  return out;
}

/**
 * Andamento giornata per giornata: tre template paralleli con le stesse chiavi
 * m1..mN, uno per il luogo, uno per il risultato e uno per la posizione.
 */
export function parseTrend(wt) {
  const grab = (name) => {
    const b = extractTemplates(wt, name)[0];
    return b ? templateParams(b.block) : {};
  };
  const luogo = grab('Andamento/Luogo');
  const risultato = grab('Andamento/Risultato');
  const posizione = grab('Andamento/Posizione');

  const total = Math.max(
    ...Object.keys({ ...luogo, ...risultato, ...posizione })
      .map((k) => Number((k.match(/^m(\d+)$/) || [])[1] || 0)),
    0,
  );
  if (!total) return [];

  const VENUE = { C: 'home', T: 'away' };
  const RESULT = { V: 'W', N: 'D', P: 'L' };

  return Array.from({ length: total }, (_, i) => {
    const k = `m${i + 1}`;
    const pos = String(posizione[k] ?? '').trim();
    return {
      matchday: i + 1,
      venue: VENUE[String(luogo[k] ?? '').trim().toUpperCase()] ?? null,
      result: RESULT[String(risultato[k] ?? '').trim().toUpperCase()] ?? null,
      position: /^\d+$/.test(pos) ? Number(pos) : null,
    };
  });
}

/** Classifica del girone, dalla wikitable della pagina di campionato. */
export function parseStandings(wt) {
  const rows = wt.split(/\n\|-/).slice(1);
  const out = [];
  for (const row of rows) {
    const body = row.split('\n|}')[0];
    const cells = body
      .replace(/^[^\n]*\n/, '\n')
      .replace(/\n\s*\|/g, '||')
      .split('||')
      .map((c) => c.trim())
      .filter((c) => c !== '');
    if (cells.length < 9) continue;

    const teamCell = cells.find((c) => /\{\{\s*Calcio\s/i.test(c));
    if (!teamCell) continue;
    const teamName = (teamCell.match(/\{\{\s*Calcio\s+([^}|]+?)\s*\}\}/i) || [])[1];
    if (!teamName) continue;

    const teamIdx = cells.indexOf(teamCell);
    const nums = cells.slice(teamIdx + 1).map((c) => Number(plain(c).replace(/[+\s]/g, ''))).filter((n) => Number.isFinite(n));
    if (nums.length < 8) continue;

    const posCell = cells.slice(0, teamIdx).reverse().find((c) => /^\d+\.?$/.test(plain(c)));
    const [points, played, won, drawn, lost, goalsFor, goalsAgainst] = nums;
    out.push({
      position: posCell ? Number(plain(posCell).replace('.', '')) : out.length + 1,
      teamName,
      points, played, won, drawn, lost, goalsFor, goalsAgainst,
      goalDiff: goalsFor - goalsAgainst,
      // differenza fra punti in classifica e punti guadagnati sul campo: penalizzazione
      penalty: points - (won * 3 + drawn),
    });
  }
  return out.sort((a, b) => a.position - b.position);
}

/** Scarica la pagina stagione del club e ne estrae rosa e partite. */
export async function fetchClubSeason(season, competition) {
  const page = seasonPage(season);
  const { text } = await wikitext(page);
  ATTRIBUTION.pages.push(page);
  const warnings = [];
  return {
    page,
    warnings,
    squad: parseSquad(text),
    matches: parseMatches(text, { season, competition, warnings }),
    teamStats: parseTeamStats(text),
    trend: parseTrend(text),
    coach: plain((text.match(/\|allenatore1\s*=\s*([^\n]+)/) || [])[1] || '') || null,
    president: plain((text.match(/\|presidente\s*=\s*([^\n]+)/) || [])[1] || '') || null,
    stadiumCapacity: Number(((text.match(/\|stadio\s*=[^\n]*?formatnum:(\d+)/) || [])[1]) || 0) || null,
  };
}

/** Scarica la classifica del girone C dalla pagina di campionato. */
export async function fetchStandings(season, groupLine = 'Girone C') {
  const page = `Serie C ${season}`;
  const { sections } = await wikitext(page);
  const groupSection = sections.find((s) => s.line.trim() === groupLine);
  if (!groupSection) throw new Error(`Sezione "${groupLine}" non trovata in ${page}`);
  const target = sections.find(
    (s) => s.line.trim().toLowerCase() === 'classifica' && String(s.number).startsWith(`${groupSection.number}.`),
  );
  if (!target) throw new Error(`Classifica del ${groupLine} non trovata in ${page}`);
  const { text } = await wikitext(page, target.index);
  ATTRIBUTION.pages.push(page);
  return parseStandings(text);
}
