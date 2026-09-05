/**
 * Accesso ai dati.
 *
 * I JSON prodotti dall'ingest sono inclusi nel bundle dell'app: la demo apre
 * istantanea e funziona senza rete, che in uno stadio o in una sala riunioni conta.
 * Se REMOTE_BASE e valorizzato, all'avvio si tenta un refresh in background e i
 * dati freschi sostituiscono quelli inclusi. In caso di errore si resta sui bundled.
 */
import type {
  DataBundle, Match, NewsItem, Player, StandingRow,
  Team, TeamStats, TicketOffer, Stadium, StaffMember,
} from '@satanelli/core';

import bundled from '../../../data/bundle.json';
import { editorial } from './editorial';
import { DEPARTED } from './squad-overrides';

/** Vuoto = solo dati inclusi nel bundle. In produzione: il raw del repo o un CDN. */
export const REMOTE_BASE = '';

const base = bundled as unknown as DataBundle;

export const meta = base.meta;
export const teams = base.teams as Team[];
export const matches = base.matches as Match[];
export const standings = base.standings as StandingRow[];
/**
 * Rosa, senza chi ha lasciato la squadra. Le uscite recenti stanno in
 * squad-overrides.ts: Wikipedia resta indietro su quelle.
 */
export const squad = (base.squad as Player[]).filter((p) => !DEPARTED.includes(p.shortName));
export const staff = base.staff as StaffMember[];
/**
 * Le notizie sono solo quelle scritte da noi.
 *
 * I comunicati presi dal sito del club sono usciti dal flusso: erano testi di
 * terzi riprodotti per intero. Restano nel bundle perche l'ingest continua a
 * raccoglierli, ma non finiscono piu davanti a chi apre l'app.
 */
export const news: NewsItem[] = [...editorial]
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));

/** Comunicati del club, tenuti da parte: non si pubblicano, si consultano. */
export const clubReleases = (base.news as NewsItem[]).filter((n) => n.kind === 'club');
export const stadium = base.stadium as Stadium;
export const tickets = base.tickets as TicketOffer[];
export const stats = base.stats as TeamStats;

/**
 * Formazioni vere delle partite gia giocate.
 *
 * Arrivano da API-Football sul piano gratuito: le chiamate senza il parametro
 * `season` rispondono con la stagione in corso, e le partite vecchie si
 * raggiungono per id. Non e una supposizione, e l'undici sceso in campo.
 */
export const lineups = ((base as unknown as { lineups?: MatchLineup[] }).lineups ?? []);

/** La prossima partita con l'id TheSportsDB: serve al punteggio dal vivo. */
export const prossima = ((base as unknown as { prossima?: Prossima | null }).prossima ?? null);

export type Prossima = {
  eventId: number;
  fixtureId: number | null;
  kickoff: string;
  label: string | null;
  competition: string | null;
  home: string | null;
  away: string | null;
};

export type LineupPlayer = { number: number | null; name: string | null; pos: string | null };
export type MatchLineup = {
  fixtureId: number;
  date: string;
  kickoff: string;
  status: string | null;
  competition: string | null;
  round: string | null;
  home: { id: number; name: string; goals: number | null };
  away: { id: number; name: string; goals: number | null };
  lineups: Array<{
    teamId: number | null;
    teamName: string | null;
    isFoggia: boolean;
    startXI: LineupPlayer[];
    bench: LineupPlayer[];
  }>;
  events: Array<{
    minute: number | null; extra: number | null; type: string | null; detail: string | null;
    player: string | null; assist: string | null; teamId: number | null; teamName: string | null;
  }>;
};

export const FOGGIA = teams.find((t) => t.isFoggia) ?? null;

// ---------------------------------------------------------------- selettori

const ts = (m: Match) => (m.kickoff ? Date.parse(m.kickoff) : Number.POSITIVE_INFINITY);

export function upcomingMatches(now = Date.now()): Match[] {
  return matches.filter((m) => m.status !== 'finished' && ts(m) > now).sort((a, b) => ts(a) - ts(b));
}

/**
 * Nome della competizione di campionato. Serve a tenere fuori la coppa dai conti
 * di stagione: sommarla falsa tutto, perche una sconfitta in Coppa Italia non
 * toglie punti in classifica e non entra nell'andamento.
 */
export const LEAGUE = 'Serie C';

export function playedMatches(): Match[] {
  return matches.filter((m) => m.status === 'finished').sort((a, b) => ts(b) - ts(a));
}

/** Solo campionato: e questo che va confrontato con la classifica. */
export function leagueMatches(): Match[] {
  return playedMatches().filter((m) => m.competition === LEAGUE);
}

/** Solo coppa, tenuta a parte e mostrata come tale. */
export function cupMatches(): Match[] {
  return playedMatches().filter((m) => m.competition !== LEAGUE);
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
  return leagueMatches()
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
  // solo campionato: la coppa ha il suo conto, piu sotto
  let home = { ...zero };
  let away = { ...zero };
  for (const c of stats.competitions.filter((c) => c.competition === LEAGUE)) {
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
