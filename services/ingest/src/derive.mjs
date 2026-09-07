/**
 * Statistiche ricavate dalle partite gia in archivio.
 * Non serve un'altra fonte: se il calendario ha risultati e marcatori, medie,
 * porte inviolate e fasce di minuti si calcolano qui.
 */

const WINDOWS = [
  { label: "1-15'", from: 1, to: 15 },
  { label: "16-30'", from: 16, to: 30 },
  { label: "31-45'", from: 31, to: 45 },
  { label: "46-60'", from: 46, to: 60 },
  { label: "61-75'", from: 61, to: 75 },
  { label: "76-90'", from: 76, to: 200 },
];

export function deriveStats(matches, trend) {
  const played = matches.filter((m) => m.status === 'finished' && m.score);

  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let failedToScore = 0;
  let biggest = null;
  let worst = null;

  const byWindow = WINDOWS.map((w) => ({ label: w.label, scored: 0, conceded: 0 }));
  const scorers = new Map();
  const attendances = [];

  for (const m of played) {
    const mine = m.foggiaHome ? m.score.home : m.score.away;
    const theirs = m.foggiaHome ? m.score.away : m.score.home;
    goalsFor += mine;
    goalsAgainst += theirs;
    if (theirs === 0) cleanSheets += 1;
    if (mine === 0) failedToScore += 1;

    const diff = mine - theirs;
    const label = `${m.home.shortName} ${m.score.home}-${m.score.away} ${m.away.shortName}`;
    if (diff > 0 && (!biggest || diff > biggest.diff)) biggest = { diff, label };
    if (diff < 0 && (!worst || diff < worst.diff)) worst = { diff, label };

    if (m.foggiaHome && typeof m.attendance === 'number') attendances.push(m.attendance);

    const mySide = m.foggiaHome ? 'home' : 'away';
    for (const g of m.goals) {
      const minute = (g.minute ?? 0) + (g.extra ?? 0);
      const slot = byWindow[WINDOWS.findIndex((w) => minute >= w.from && minute <= w.to)];
      if (!slot) continue;
      if (g.side === mySide) {
        slot.scored += 1;
        if (!g.ownGoal) scorers.set(g.scorer, (scorers.get(g.scorer) ?? 0) + 1);
      } else {
        slot.conceded += 1;
      }
    }
  }

  const positions = (trend || []).map((t) => t.position).filter((p) => typeof p === 'number');

  return {
    played: played.length,
    cleanSheets,
    failedToScore,
    goalsFor,
    goalsAgainst,
    avgGoalsFor: played.length ? round(goalsFor / played.length) : 0,
    avgGoalsAgainst: played.length ? round(goalsAgainst / played.length) : 0,
    biggestWin: biggest?.label ?? null,
    worstLoss: worst?.label ?? null,
    bestPosition: positions.length ? Math.min(...positions) : null,
    worstPosition: positions.length ? Math.max(...positions) : null,
    byWindow,
    scorers: [...scorers.entries()]
      .map(([name, goals]) => ({ name, goals }))
      .sort((a, b) => b.goals - a.goals),
    homeAttendanceAvg: attendances.length
      ? Math.round(attendances.reduce((a, n) => a + n, 0) / attendances.length)
      : null,
  };
}

const round = (n) => Math.round(n * 100) / 100;

/**
 * I settori dove si entra, e dove si comprano i biglietti.
 *
 * Niente prezzi, niente posti disponibili, niente ridotto.
 *
 * Prima c'erano tutti e tre, e nessuno era vero: la disponibilita usciva da
 * `capacity * (1 - occupancy)` con un'occupazione simulata, il ridotto era il
 * sessanta per cento del prezzo pieno "sulla prassi delle societa di Serie C",
 * e il prezzo pieno era una stima scritta a mano in stadium.json. In app
 * comparivano come "1275 disponibili" e "ridotto 17 EUR", cioe come fatti.
 *
 * Un tifoso che legge "984 disponibili in Curva Nord" e ci va sopra una
 * decisione -- parte da Bologna, porta il figlio -- e stato ingannato da noi,
 * non dalla fonte. Meglio una riga in meno che un numero inventato.
 *
 * Quando il club aprira i dati di biglietteria, questi campi tornano con
 * dentro qualcosa di vero.
 */
export function buildTickets(stadium) {
  return stadium.sectors.map((s) => ({
    id: `ticket-${s.id}`,
    sectorId: s.id,
    sectorName: s.name,
    currency: 'EUR',
    covered: s.covered,
    capacity: s.capacity,
    capacityIsEstimated: s.capacityIsEstimated ?? true,
    ticketUrl: s.ticketUrl ?? stadium.ticketUrl,
  }));
}
