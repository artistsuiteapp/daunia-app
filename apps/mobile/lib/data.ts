/**
 * Accesso ai dati.
 *
 * I JSON prodotti dall'ingest sono cotti dentro l'app: si apre istantanea e
 * funziona senza rete, che allo stadio conta.
 *
 * PERCHE I VALORI SONO `let` E NON `const`
 *
 * Sul web la copia cotta bastava: ogni giro dell'ingest ripubblica il sito e chi
 * apre l'app scarica il bundle nuovo insieme al codice. In un'app installata sul
 * telefono no: il codice sta nel telefono e non cambia finche non si ricompila.
 * Con i valori fissi, calendario, classifica, rosa e comunicati sarebbero rimasti
 * fermi al giorno della compilazione -- per settimane.
 *
 * Quindi il bundle si puo sostituire a caldo: `applicaBundle()` riscrive questi
 * valori e chi li importa vede i nuovi, perche i moduli ES tengono i legami vivi.
 * Chi scarica e lib/bundle-remoto.ts.
 */
import type {
  DataBundle, Match, NewsItem, Player, StandingRow,
  Team, TeamStats, TicketOffer, Stadium, StaffMember,
} from '@satanelli/core';

import bundled from '../../../data/bundle.json';
import { editorial } from './editorial';
import { DEPARTED } from './squad-overrides';

let base = bundled as unknown as DataBundle;

export let meta = base.meta;
export let teams = base.teams as Team[];
export let matches = base.matches as Match[];
export let standings = base.standings as StandingRow[];
/**
 * Rosa, senza chi ha lasciato la squadra. Le uscite recenti stanno in
 * squad-overrides.ts: Wikipedia resta indietro su quelle.
 */
export let squad = (base.squad as Player[]).filter((p) => !DEPARTED.includes(p.shortName));
export let staff = base.staff as StaffMember[];
/**
 * Le notizie sono solo quelle scritte da noi.
 *
 * I comunicati presi dal sito del club sono usciti dal flusso: erano testi di
 * terzi riprodotti per intero. Restano nel bundle perche l'ingest continua a
 * raccoglierli, ma non finiscono piu davanti a chi apre l'app.
 */
export const news: NewsItem[] = [...editorial]
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));

/**
 * Comunicati del club: si rimanda, non si ricopia.
 *
 * Erano usciti del tutto perche venivano riprodotti per intero, e un testo
 * altrui copiato dentro l'app e un problema a prescindere da quanto sia utile.
 * Tornano nella stessa forma in cui gia si trattano le testate: titolo, due
 * righe di assaggio e il tocco che porta sulla pagina di chi l'ha scritto.
 *
 * E' anche l'unica parte delle notizie che si aggiorna da sola: la scrive
 * l'ingest a ogni giro, mentre i pezzi della redazione stanno nel codice.
 */
export let clubReleases = (base.news as NewsItem[])
  .filter((n) => n.kind === 'club')
  .sort((a, b) => String(b.date).localeCompare(String(a.date)));
export let stadium = base.stadium as Stadium;
export let tickets = base.tickets as TicketOffer[];
export let stats = base.stats as TeamStats;

/**
 * Formazioni vere delle partite gia giocate.
 *
 * Arrivano da API-Football sul piano gratuito: le chiamate senza il parametro
 * `season` rispondono con la stagione in corso, e le partite vecchie si
 * raggiungono per id. Non e una supposizione, e l'undici sceso in campo.
 */
export let lineups = ((base as unknown as { lineups?: MatchLineup[] }).lineups ?? []);

/** La prossima partita con l'id TheSportsDB: serve al punteggio dal vivo. */
export let prossima = ((base as unknown as { prossima?: Prossima | null }).prossima ?? null);

/** Un giocatore nell'undici pubblicato dalla Lega. */
export type GiocatoreLega = { numero: number | null; nome: string; ruolo: string | null };
export type ColonnaLega = {
  squadra: string; modulo: string | null; allenatore: string | null; giocatori: GiocatoreLega[];
};

/**
 * Le formazioni ufficiali, dal sito della Lega, per id di partita.
 *
 * E l'unica fonte trovata che dia l'undici della Serie C senza abbonamento, e
 * l'unica in assoluto che dia anche il modulo e l'allenatore.
 */
export let formazioniUfficiali = (
  (base as unknown as { formazioniUfficiali?: Record<string, { casa: ColonnaLega; ospiti: ColonnaLega }> })
    .formazioniUfficiali ?? {}
);

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

export let FOGGIA = teams.find((t) => t.isFoggia) ?? null;

/**
 * Sostituisce i dati con quelli appena scaricati.
 *
 * Riscrive tutti i valori derivati insieme: se se ne dimentica uno, meta dice
 * una data e la classifica ne mostra un'altra, che e il difetto peggiore --
 * sembra che l'app menta invece che essere indietro.
 *
 * Non fa da sola il ridisegno: chi chiama guarda `versioneDati` per sapere che
 * qualcosa e cambiato.
 */
export function applicaBundle(nuovo: DataBundle): void {
  base = nuovo;
  meta = base.meta;
  teams = base.teams as Team[];
  matches = base.matches as Match[];
  standings = base.standings as StandingRow[];
  squad = (base.squad as Player[]).filter((p) => !DEPARTED.includes(p.shortName));
  staff = base.staff as StaffMember[];
  clubReleases = (base.news as NewsItem[])
    .filter((n) => n.kind === "club")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  stadium = base.stadium as Stadium;
  tickets = base.tickets as TicketOffer[];
  stats = base.stats as TeamStats;
  lineups = (base as unknown as { lineups?: MatchLineup[] }).lineups ?? [];
  prossima = (base as unknown as { prossima?: Prossima | null }).prossima ?? null;
  formazioniUfficiali = (
    base as unknown as { formazioniUfficiali?: Record<string, { casa: ColonnaLega; ospiti: ColonnaLega }> }
  ).formazioniUfficiali ?? {};
  FOGGIA = teams.find((t) => t.isFoggia) ?? null;
  versioneDati += 1;
}

/** Cresce di uno a ogni bundle nuovo applicato. Serve a far ridisegnare le schermate. */
export let versioneDati = 0;

// ---------------------------------------------------------------- selettori

const ts = (m: Match) => (m.kickoff ? Date.parse(m.kickoff) : Number.POSITIVE_INFINITY);

/**
 * Quanto dura una partita nel calendario dell'app: novanta minuti, intervallo,
 * recupero e quel che serve. Dopo, smette di essere "adesso".
 */
export const DURATA_PARTITA = 3 * 60 * 60 * 1000;

/**
 * Le partite ancora da vedere, compresa quella che si sta giocando in questo
 * momento.
 *
 * Prima il filtro era `ts(m) > now`, e alle 21:00:01 la partita in corso
 * spariva dall'app: la home passava alla successiva, la chat dal vivo si
 * apriva su quella sbagliata e il punteggio non si vedeva da nessuna parte.
 * Una partita smette di essere attuale quando finisce, non quando comincia.
 */
export function upcomingMatches(now = Date.now()): Match[] {
  return matches
    .filter((m) => m.status !== 'finished' && ts(m) + DURATA_PARTITA > now)
    .sort((a, b) => ts(a) - ts(b));
}

/** La partita che si sta giocando adesso, se ce n'e una. */
export function matchInCorso(now = Date.now()): Match | null {
  return upcomingMatches(now).find((m) => ts(m) <= now) ?? null;
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
/*
 * `elenco` esiste per il dal vivo.
 *
 * Questi conti partono dall'archivio, che si aggiorna quando il sito viene
 * ricostruito. Nella finestra fra il triplice fischio e la ripubblicazione la
 * partita appena finita non c'e' ancora, e le schermate direbbero cose diverse
 * fra loro. Chi ha l'elenco aggiornato -- lib/partita-corrente.ts -- lo passa.
 */
export function recentForm(limit = 5, elenco?: Match[]): Array<'W' | 'D' | 'L'> {
  return (elenco
    ? elenco.filter((m) => m.status === 'finished' && m.competition === LEAGUE)
      .sort((a, b) => ts(b) - ts(a))
    : leagueMatches())
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
export function topScorers(elenco?: Match[]): Array<{ name: string; goals: number }> {
  const tally = new Map<string, number>();
  for (const m of (elenco ? elenco.filter((x) => x.status === 'finished') : playedMatches())) {
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
export function playedTrend(s: TeamStats = stats) {
  return s.trend.filter((t) => t.result !== null);
}

/** Somma casa e trasferta di tutte le competizioni: il totale stagionale. */
export function seasonRecord(s: TeamStats = stats) {
  const zero = { won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };
  const add = (a: typeof zero, b: typeof zero) => ({
    won: a.won + b.won, drawn: a.drawn + b.drawn, lost: a.lost + b.lost,
    goalsFor: a.goalsFor + b.goalsFor, goalsAgainst: a.goalsAgainst + b.goalsAgainst,
  });
  // solo campionato: la coppa ha il suo conto, piu sotto
  let home = { ...zero };
  let away = { ...zero };
  for (const c of s.competitions.filter((c) => c.competition === LEAGUE)) {
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
