/**
 * Accesso ai dati.
 *
 * I JSON prodotti dall'ingest sono inclusi nel bundle dell'app: la demo apre
 * istantanea e funziona senza rete, che in uno stadio o in una sala riunioni conta.
 * Se REMOTE_BASE e valorizzato, all'avvio si tenta un refresh in background e i
 * dati freschi sostituiscono quelli inclusi. In caso di errore si resta sui bundled.
 */
import type {
  DataBundle, Match, NewsItem, Player, Product, ShopCategory, StandingRow,
  Team, TeamStats, TicketOffer, Stadium, StaffMember,
} from '@satanelli/core';

import bundled from '../../../data/bundle.json';

/** Vuoto = solo dati inclusi nel bundle. In produzione: il raw del repo o un CDN. */
export const REMOTE_BASE = '';

const base = bundled as unknown as DataBundle;

export const meta = base.meta;
export const teams = base.teams as Team[];
export const matches = base.matches as Match[];
export const standings = base.standings as StandingRow[];
export const squad = base.squad as Player[];
export const staff = base.staff as StaffMember[];
export const news = base.news as NewsItem[];
export const stadium = base.stadium as Stadium;
/**
 * Vetrina della demo: solo le due maglie da gara, con un prezzo simbolico.
 *
 * Il catalogo vero del negozio resta in data/shop.json, ma qui viene ridotto di
 * proposito. Il prezzo mostrato NON e quello del negozio: e un segnaposto, e i
 * testi dell'app lo dicono, cosi nessuno legge 70 € come il prezzo reale.
 */
const DEMO_SKUS = ['shop-15519', 'shop-15505'];
export const DEMO_PRICE = 70;

const catalogue = base.shop.products as Product[];

export const products: Product[] = catalogue
  .filter((p) => DEMO_SKUS.includes(p.id))
  .map((p) => ({ ...p, price: DEMO_PRICE, regularPrice: DEMO_PRICE, onSale: false }));

export const shopCategories = (base.shop.categories as ShopCategory[])
  .filter((c) => products.some((p) => p.categorySlug === c.slug))
  .map((c) => ({ ...c, count: products.filter((p) => p.categorySlug === c.slug).length }));
export const tickets = base.tickets as TicketOffer[];
export const stats = base.stats as TeamStats;

export const FOGGIA = teams.find((t) => t.isFoggia) ?? null;

// ---------------------------------------------------------------- selettori

const ts = (m: Match) => (m.kickoff ? Date.parse(m.kickoff) : Number.POSITIVE_INFINITY);

export function upcomingMatches(now = Date.now()): Match[] {
  return matches.filter((m) => m.status !== 'finished' && ts(m) > now).sort((a, b) => ts(a) - ts(b));
}

export function playedMatches(): Match[] {
  return matches.filter((m) => m.status === 'finished').sort((a, b) => ts(b) - ts(a));
}

export function nextMatch(now = Date.now()): Match | null {
  return upcomingMatches(now)[0] ?? null;
}

export function lastMatch(): Match | null {
  return playedMatches()[0] ?? null;
}

export function nextHomeMatch(now = Date.now()): Match | null {
  return upcomingMatches(now).find((m) => m.foggiaHome) ?? null;
}

export function matchById(id: string): Match | null {
  return matches.find((m) => m.id === id) ?? null;
}

export function playerById(id: string): Player | null {
  return squad.find((p) => p.id === id) ?? null;
}

export function newsBySlug(slug: string): NewsItem | null {
  return news.find((n) => n.slug === slug) ?? null;
}

export function foggiaRow(): StandingRow | null {
  return standings.find((r) => r.isFoggia) ?? null;
}

/** Finestra di classifica centrata sul Foggia, per il riquadro in home. */
export function standingsWindow(size = 5): StandingRow[] {
  const idx = standings.findIndex((r) => r.isFoggia);
  if (idx === -1) return standings.slice(0, size);
  const half = Math.floor(size / 2);
  const start = Math.max(0, Math.min(idx - half, standings.length - size));
  return standings.slice(start, start + size);
}

/** Ultimi risultati del Foggia, dal piu vecchio al piu recente: serve alla striscia W/N/P. */
export function recentForm(limit = 5): Array<'W' | 'D' | 'L'> {
  return playedMatches()
    .slice(0, limit)
    .map((m) => m.foggiaResult)
    .filter((r): r is 'W' | 'D' | 'L' => r !== null)
    .reverse();
}

export function squadByRole(): Array<{ role: string; label: string; players: Player[] }> {
  const order: Array<[string, string]> = [
    ['P', 'Portieri'], ['D', 'Difensori'], ['C', 'Centrocampisti'], ['A', 'Attaccanti'],
  ];
  const groups = order.map(([role, label]) => ({
    role,
    label,
    players: squad
      .filter((p) => p.role === role)
      .sort((a, b) => (a.number ?? 999) - (b.number ?? 999)),
  }));
  const rest = squad.filter((p) => !p.role);
  if (rest.length) groups.push({ role: '?', label: 'Altri', players: rest });
  return groups.filter((g) => g.players.length > 0);
}

/** Marcatori del Foggia nella stagione, ricavati dalle partite giocate. */
export function topScorers(): Array<{ name: string; goals: number }> {
  const tally = new Map<string, number>();
  for (const m of playedMatches()) {
    const mySide = m.foggiaHome ? 'home' : 'away';
    for (const g of m.goals) {
      if (g.side !== mySide || g.ownGoal) continue;
      tally.set(g.scorer, (tally.get(g.scorer) ?? 0) + 1);
    }
  }
  return [...tally.entries()]
    .map(([name, goals]) => ({ name, goals }))
    .sort((a, b) => b.goals - a.goals);
}

export function productById(id: string): Product | null {
  return products.find((p) => p.id === id) ?? null;
}

export function productsByCategory(slug: string | null): Product[] {
  if (!slug) return products;
  return products.filter((p) => p.categorySlug === slug);
}

/** Le giornate gia giocate, per il grafico dell'andamento. */
export function playedTrend() {
  return stats.trend.filter((t) => t.result !== null);
}

/** Somma casa e trasferta di tutte le competizioni: il totale stagionale. */
export function seasonRecord() {
  const zero = { won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  const add = (a: typeof zero, b: typeof zero) => ({
    won: a.won + b.won, drawn: a.drawn + b.drawn, lost: a.lost + b.lost,
    goalsFor: a.goalsFor + b.goalsFor, goalsAgainst: a.goalsAgainst + b.goalsAgainst,
  });
  let home = { ...zero };
  let away = { ...zero };
  for (const c of stats.competitions) {
    home = add(home, c.home);
    away = add(away, c.away);
  }
  const total = add(home, away);
  const games = total.won + total.drawn + total.lost;
  return { home, away, total, games, winRate: games ? total.won / games : 0 };
}

export function matchesByMatchday(): Array<{ matchday: number | null; matches: Match[] }> {
  const buckets = new Map<string, Match[]>();
  for (const m of matches) {
    const key = m.competition === 'Serie C' ? String(m.matchday ?? '?') : m.competition;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(m);
  }
  return [...buckets.entries()]
    .map(([key, list]) => ({ matchday: /^\d+$/.test(key) ? Number(key) : null, matches: list }))
    .sort((a, b) => (a.matchday ?? 999) - (b.matchday ?? 999));
}
