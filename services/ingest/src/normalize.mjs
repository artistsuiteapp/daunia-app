/**
 * Unisce le due fonti in un solo bundle conforme a packages/core.
 * Regola: Wikipedia manda i FATTI della stagione in corso, il sito del club manda
 * le IMMAGINI e le news. Dove le due si contraddicono vince Wikipedia, perche il
 * sito e fermo alla stagione 2025-2026.
 */
import { slugify } from './util.mjs';
import { makeTeamResolver, fallbackTeam } from './team-resolver.mjs';
import { buildTickets, deriveStats } from './derive.mjs';

const TICKETS = 'https://calciofoggia1920.vivaticket.it/';

function zoneFor(position, total) {
  if (position === 1) return 'promotion';
  if (position >= 2 && position <= 10) return 'playoff';
  if (position === total) return 'relegation';
  if (position >= total - 4 && position < total) return 'playout';
  return null;
}

function toMatchTeam(team) {
  return { id: team.id, name: team.name, shortName: team.shortName, crest: team.crest };
}

export function normalize({
  wpTeams, wpPhotos, news, wikiSeason, wikiStandings, stadium, shop, season, competition,
}) {
  const warnings = [...(wikiSeason.warnings || [])];
  const resolve = makeTeamResolver(wpTeams);
  const seenTeams = new Map();

  const teamFor = (name) => {
    const hit = resolve(name) || fallbackTeam(name);
    if (!hit.crest && !seenTeams.has(hit.id)) {
      warnings.push(`Nessuno stemma per "${name}": il sito del club non ha mai incontrato questa squadra.`);
    }
    seenTeams.set(hit.id, hit);
    return toMatchTeam(hit);
  };

  const matches = wikiSeason.matches.map((m) => {
    const home = teamFor(m.homeName);
    const away = teamFor(m.awayName);
    const isFutureHome = m.foggiaHome && m.status === 'scheduled';
    const { homeName, awayName, ...rest } = m;
    return {
      ...rest,
      home,
      away,
      ticketUrl: isFutureHome ? TICKETS : null,
    };
  }).sort((a, b) => {
    // le partite ancora senza data vanno in fondo, non all'inizio
    if (!a.kickoff && !b.kickoff) return (a.matchday ?? 99) - (b.matchday ?? 99);
    if (!a.kickoff) return 1;
    if (!b.kickoff) return -1;
    return Date.parse(a.kickoff) - Date.parse(b.kickoff);
  });

  const squad = wikiSeason.squad.map((p) => {
    const surname = p.name.split(' ').slice(-1)[0];
    const photo = wpPhotos.get(slugify(p.name)) || wpPhotos.get(slugify(surname)) || null;
    return { ...p, photo };
  });

  const withPhoto = squad.filter((p) => p.photo).length;
  if (withPhoto < squad.length / 2) {
    warnings.push(
      `Solo ${withPhoto} giocatori su ${squad.length} hanno la foto: la rosa sul sito del club e ferma alla stagione precedente.`,
    );
  }

  const total = wikiStandings.length;
  const standings = wikiStandings.map((r) => {
    const t = resolve(r.teamName) || fallbackTeam(r.teamName);
    return {
      position: r.position,
      teamId: t.id,
      teamName: t.shortName || r.teamName,
      crest: t.crest,
      played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
      goalsFor: r.goalsFor, goalsAgainst: r.goalsAgainst, goalDiff: r.goalDiff,
      points: r.points,
      penalty: r.penalty || 0,
      isFoggia: t.id === 'foggia',
      zone: zoneFor(r.position, total),
    };
  });

  const staff = [
    wikiSeason.coach && { id: 'coach', name: wikiSeason.coach, job: 'Allenatore', photo: null },
    wikiSeason.president && { id: 'president', name: wikiSeason.president, job: 'Presidente', photo: null },
  ].filter(Boolean);

  const teams = [...new Map([...seenTeams].map(([id, t]) => [id, {
    id: t.id, name: t.name, shortName: t.shortName, crest: t.crest, isFoggia: t.id === 'foggia',
  }])).values()].sort((a, b) => a.shortName.localeCompare(b.shortName));

  const stats = {
    competitions: wikiSeason.teamStats ?? [],
    trend: wikiSeason.trend ?? [],
    derived: deriveStats(matches, wikiSeason.trend ?? []),
  };
  const tickets = buildTickets(stadium);

  if (!shop.products.length) warnings.push('Il negozio non ha restituito prodotti: la sezione shop resta vuota.');

  return {
    meta: {
      generatedAt: new Date().toISOString(),
      season,
      competition,
      sources: {
        fixtures: 'wikipedia', standings: 'wikipedia', squad: 'wikipedia', stats: 'wikipedia',
        news: 'calciofoggia1920.net', crests: 'calciofoggia1920.net', photos: 'calciofoggia1920.net',
        shop: 'calciofoggia1920.store',
      },
      attribution:
        'Dati stagione in corso da Wikipedia (CC BY-SA 4.0). News, stemmi e foto da calciofoggia1920.net. '
        + 'Prodotti dal negozio ufficiale calciofoggia1920.store.',
      warnings: [...new Set(warnings)],
    },
    teams,
    matches,
    standings,
    squad,
    staff,
    news,
    stadium,
    shop,
    tickets,
    stats,
  };
}

/** Controlli di sanita: meglio fallire nell'ingest che mostrare dati rotti in app. */
export function validate(bundle) {
  const errors = [];
  const { matches, standings, squad, news, teams, tickets, stats } = bundle;

  if (standings.length !== 20) errors.push(`classifica: ${standings.length} righe, attese 20`);
  if (!standings.some((r) => r.isFoggia)) errors.push('classifica: il Foggia non compare');
  if (matches.length < 30) errors.push(`partite: ${matches.length}, attese almeno 30`);
  if (squad.length < 18) errors.push(`rosa: ${squad.length} giocatori, attesi almeno 18`);
  if (news.length < 5) errors.push(`news: ${news.length}, attese almeno 5`);
  if (!teams.some((t) => t.isFoggia)) errors.push('squadre: il Foggia non compare');

  for (const m of matches) {
    if (!m.home?.id || !m.away?.id) errors.push(`partita ${m.id}: squadre incomplete`);
    if (m.status === 'finished' && !m.score) errors.push(`partita ${m.id}: finita ma senza punteggio`);
    if (m.kickoff && Number.isNaN(Date.parse(m.kickoff))) errors.push(`partita ${m.id}: data non valida`);
  }
  for (const r of standings) {
    if (r.won + r.drawn + r.lost !== r.played) errors.push(`classifica ${r.teamName}: G != V+N+P`);
    if (r.points !== r.won * 3 + r.drawn + r.penalty) errors.push(`classifica ${r.teamName}: punti incoerenti`);
  }

  if (tickets.length !== bundle.stadium.sectors.length) errors.push('biglietti: manca un settore');
  for (const t of tickets) {
    if (t.available > t.capacity) errors.push(`biglietti ${t.sectorName}: disponibili oltre la capienza`);
  }

  const d = stats.derived;
  const goalsInWindows = d.byWindow.reduce((a, w) => a + w.scored, 0);
  if (d.goalsFor < goalsInWindows) errors.push('statistiche: gol per fascia oltre il totale segnato');
  if (d.cleanSheets > d.played) errors.push('statistiche: porte inviolate oltre le partite giocate');

  return errors;
}
