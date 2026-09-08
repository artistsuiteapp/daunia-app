import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const UA = 'SatanelliApp/0.1 (prototipo app tifosi; contatto: dev@localhost)';
const CACHE_DIR = new URL('../.cache/', import.meta.url).pathname;
const CACHE_TTL_MS = 15 * 60 * 1000;

/**
 * Quanto si aspetta una fonte prima di mollarla.
 *
 * QUESTO NUMERO E COSTATO 1.908 MINUTI DI GITHUB ACTIONS.
 *
 * La fetch di Node non ha una scadenza sua: se un server accetta la connessione
 * e poi smette di rispondere, la richiesta resta appesa per sempre. Il 7 e l'8
 * settembre 2026 e successo davvero, con tre tentativi per ogni fonte, e i giri
 * sono rimasti in piedi fino al tetto di sei ore di GitHub. Due giorni hanno
 * mangiato la quota di un mese intero: 947 e 961 minuti, contro gli 11 al
 * giorno di quando funzionava.
 *
 * Venti secondi bastano a chiunque. Una fonte piu lenta di cosi e una fonte
 * rotta, e il posto dove deve finire e fra gli avvisi dell'ingest.
 */
export const ATTESA_MAX = 20_000;

/** La scadenza da passare a ogni fetch. Nessuna richiesta esce senza. */
export function scadenza(ms = ATTESA_MAX) {
  return AbortSignal.timeout(ms);
}

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
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: scadenza() });
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

/**
 * Come getJson ma per testo: gli RSS sono XML, non JSON.
 *
 * Stessa cache e stessa cortesia verso la fonte: un feed pubblico si legge
 * piano, non a ogni giro del cron.
 */
export async function getTesto(url, { ttl = CACHE_TTL_MS, retries = 3 } = {}) {
  const key = createHash('sha1').update(`testo:${url}`).digest('hex').slice(0, 16);
  const file = path.join(CACHE_DIR, `${key}.json`);
  if (!process.env.NO_CACHE && existsSync(file)) {
    const raw = JSON.parse(await readFile(file, 'utf8'));
    if (Date.now() - raw.at < ttl) return raw.body;
  }
  let lastErr;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml, */*' }, signal: scadenza() });
      if (!res.ok) throw new Error(`HTTP ${res.status} su ${url}`);
      const body = await res.text();
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
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: scadenza() });
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
