import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const UA = 'SatanelliApp/0.1 (prototipo app tifosi; contatto: dev@localhost)';
const CACHE_DIR = new URL('../.cache/', import.meta.url).pathname;
const CACHE_TTL_MS = 15 * 60 * 1000;

/** Fetch JSON con cache su disco, retry e backoff. Le fonti pubbliche vanno trattate con garbo. */
export async function getJson(url, { ttl = CACHE_TTL_MS, retries = 3 } = {}) {
  const key = createHash('sha1').update(url).digest('hex').slice(0, 16);
  const file = path.join(CACHE_DIR, `${key}.json`);
  if (!process.env.NO_CACHE && existsSync(file)) {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - raw.at < ttl) return raw.body;
  }
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
      if (!res.ok) throw new Error(`HTTP ${res.status} su ${url}`);
      const body = await res.json();
      await mkdir(CACHE_DIR, { recursive: true });
      await writeFile(file, JSON.stringify({ at: Date.now(), body }));
      return body;
    } catch (err) {
      lastErr = err;
      if (i < retries - 1) await sleep(500 * 2 ** i);
    }
  }
  throw lastErr;
}

/** Come getJson ma restituisce anche gli header, serve per X-WP-Total. */
export async function getJsonWithHeaders(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} su ${url}`);
  return { body: await res.json(), headers: res.headers };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Toglie tag HTML e decodifica le entity che WordPress lascia nei titoli. */
export function stripHtml(input) {
  if (!input) return '';
  return decodeEntities(String(input).replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  '#8211': '–', '#8212': '—', '#8216': '‘', '#8217': '’',
  '#8220': '“', '#8221': '”', '#8230': '…', '#039': "'", '#39': "'",
};
export function decodeEntities(s) {
  return String(s).replace(/&(#?\w+);/g, (m, code) => {
    if (ENTITIES[code] !== undefined) return ENTITIES[code];
    if (code[0] === '#') {
      const n = code[1] === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return m;
  });
}

/** Slug stabile: e la chiave con cui squadre e giocatori si incrociano fra le due fonti. */
export function slugify(s) {
  return String(s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Normalizza il nome di una squadra alla sua forma corta e confrontabile.
 * Serve perche il sito del club scrive "US SALERNITANA 1919" e Wikipedia "Salernitana".
 */
const TEAM_NOISE = /\b(a\.?s\.?d?|s\.?s\.?d?|u\.?s\.?d?|f\.?c\.?|a\.?c\.?|s\.?c\.?|b\.?c\.?|s\.?p\.?a|calcio|football|club|societa|sportiva|1\d{3}|20\d{2})\b/gi;
export function teamKey(name) {
  const cleaned = decodeEntities(String(name))
    .replace(/\bU23\b/gi, ' U23 ')
    .replace(TEAM_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return slugify(cleaned || name);
}

export function toInt(v) {
  if (v === null || v === undefined) return null;
  const n = parseInt(String(v).replace(/[^\d-]/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}
