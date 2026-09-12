import type { Goal, Match, TeamStats } from '@satanelli/core';

/**
 * Far coincidere quello che dice il calendario con quello che e' appena
 * successo in campo.
 *
 * IL PROBLEMA CHE RISOLVE
 *
 * I dati delle partite arrivano dall'ingest, che gira ogni sei ore e ogni dieci
 * minuti nelle fasce delle partite, e finiscono dentro il pacchetto dell'app: si
 * aggiornano solo quando il sito viene ricostruito. Il punteggio dal vivo invece
 * lo scrive il guardiano sul database, e l'app lo legge subito.
 *
 * Nel mezzo c'e' una finestra -- dal triplice fischio a quando il sito viene
 * ripubblicato -- in cui le due cose dicono cose diverse: la home mostra il
 * risultato giusto perche' legge il dal vivo, e le statistiche no perche'
 * leggono l'archivio. Chi apre l'app dopo la partita vede numeri che si
 * contraddicono da una schermata all'altra.
 *
 * Qui si fondono: il calendario resta la base, il dal vivo ha ragione su
 * punteggio, stato e cronaca della partita che sta seguendo. Quando l'ingest
 * passa, le due fonti dicono la stessa cosa e la fusione non cambia piu niente.
 *
 * Senza React e senza rete apposta: e' la parte che puo' sbagliare i conti.
 */

/** Quel poco del dal vivo che serve qui: gia' orientato come la partita. */
export type VivoOrientato = {
  stato: string;
  finita: boolean;
  /** gol della squadra di CASA di quella partita, non della fonte */
  casa: number | null;
  ospite: number | null;
} | null;

export type GolDalVivo = {
  minuto: string | null;
  chi?: string | null;
  nostro: boolean;
};

/** "45+2" -> { minuto: 45, extra: 2 }. Quello che non si capisce torna null. */
export function leggiMinuto(m: string | null | undefined): { minuto: number | null; extra: number | null } {
  const t = String(m ?? '').trim();
  const pezzi = /^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?/.exec(t);
  if (!pezzi) return { minuto: null, extra: null };
  return { minuto: Number(pezzi[1]), extra: pezzi[2] ? Number(pezzi[2]) : null };
}

/** W, D o L dal punto di vista del Foggia. */
export function esitoFoggia(
  casa: number, ospiti: number, foggiaHome: boolean,
): 'W' | 'D' | 'L' {
  const nostri = foggiaHome ? casa : ospiti;
  const loro = foggiaHome ? ospiti : casa;
  if (nostri === loro) return 'D';
  return nostri > loro ? 'W' : 'L';
}

/**
 * La partita, aggiornata con quello che dice il campo.
 *
 * Il punteggio dal vivo vince sempre su quello in archivio, anche a partita in
 * corso: e' l'unico modo perche' due schermate aperte insieme dicano la stessa
 * cosa. La cronaca invece si prende solo se in archivio non c'e' gia': quella
 * dell'ingest ha i nomi dei marcatori, quella dal vivo spesso no, e sostituirne
 * una completa con una parziale sarebbe un passo indietro.
 */
export function fondi(match: Match, vivo: VivoOrientato, golVivo: GolDalVivo[] = []): Match {
  if (!vivo || vivo.casa === null || vivo.ospite === null) return match;

  const score = { home: vivo.casa, away: vivo.ospite };
  const gia = match.score;
  const stessoPunteggio = gia?.home === score.home && gia?.away === score.away;
  const stessoStato = match.status === (vivo.finita ? 'finished' : 'live');
  if (stessoPunteggio && stessoStato && match.goals.length > 0) return match;

  const goals: Goal[] = match.goals.length > 0 ? match.goals : golVivo.map((g) => {
    const { minuto, extra } = leggiMinuto(g.minuto);
    return {
      minute: minuto,
      extra,
      // senza nome non si inventa niente: resta vuoto e la cronaca dice il minuto
      scorer: g.chi ?? '',
      side: (g.nostro === match.foggiaHome ? 'home' : 'away') as 'home' | 'away',
      ownGoal: false,
      penalty: false,
    };
  });

  return {
    ...match,
    status: vivo.finita ? 'finished' : 'live',
    score,
    goals,
    foggiaResult: vivo.finita ? esitoFoggia(score.home, score.away, match.foggiaHome) : null,
  };
}

/**
 * L'elenco delle partite con sopra il dal vivo, e l'ultima giocata che ne esce.
 *
 * `quale` dice a quale partita si riferisce il dal vivo: la riga sul database e'
 * una sola, quella che il guardiano sta seguendo.
 */
export function fondiTutte(
  partite: Match[],
  quale: string | null,
  vivo: VivoOrientato,
  golVivo: GolDalVivo[] = [],
): Match[] {
  if (!quale || !vivo) return partite;
  return partite.map((m) => (m.id === quale ? fondi(m, vivo, golVivo) : m));
}

/** L'ultima partita giocata: la piu recente fra quelle finite. */
export function ultimaGiocata(partite: Match[]): Match | null {
  const finite = partite
    .filter((m) => m.status === 'finished')
    .sort((a, b) => String(b.kickoff ?? '').localeCompare(String(a.kickoff ?? '')));
  return finite[0] ?? null;
}

/* ------------------------------------------------------- le statistiche */

/** "1-15'" -> [1, 15]. Le fasce le decide l'ingest, qui si leggono. */
function fascia(label: string): [number, number] | null {
  const p = /(\d{1,3})\s*-\s*(\d{1,3})/.exec(label);
  return p ? [Number(p[1]), Number(p[2])] : null;
}

/** "Crotone 0-1 Foggia" -> scarto 1. Serve a confrontare con quello che c'e' gia'. */
export function scartoDa(etichetta: string | null): number | null {
  const p = /(\d+)\s*-\s*(\d+)/.exec(String(etichetta ?? ''));
  return p ? Math.abs(Number(p[1]) - Number(p[2])) : null;
}

/**
 * Aggiunge alle statistiche una partita che l'archivio non ha ancora contato.
 *
 * Si tocca solo quello che si sa con certezza dal dal vivo: partite giocate,
 * gol fatti e subiti, porta inviolata, partite senza segnare, e le fasce dei
 * gol quando il minuto c'e'. I marcatori si aggiungono solo se la fonte ha dato
 * il nome -- in Serie C spesso non lo da, e una riga "marcatore: (vuoto)" e'
 * peggio di nessuna riga.
 *
 * Posizioni migliore e peggiore non si toccano: dipendono dalla classifica, che
 * questa funzione non ha e non deve indovinare.
 */
export function conLaPartitaNuova(stats: TeamStats, match: Match): TeamStats {
  if (match.status !== 'finished' || !match.score) return stats;

  const d = stats.derived;
  const nostri = match.foggiaHome ? match.score.home : match.score.away;
  const loro = match.foggiaHome ? match.score.away : match.score.home;

  const played = d.played + 1;
  const goalsFor = d.goalsFor + nostri;
  const goalsAgainst = d.goalsAgainst + loro;

  const arrotonda = (n: number) => Math.round(n * 100) / 100;

  const byWindow = d.byWindow.map((w) => {
    const f = fascia(w.label);
    if (!f) return w;
    const dentro = (g: Goal) => {
      const m = g.minute;
      if (m === null) return false;
      // il recupero del primo tempo sta nella fascia del primo tempo: il
      // minuto resta 45, ed e' quello che conta
      return m >= f[0] && m <= f[1];
    };
    return {
      ...w,
      scored: w.scored + match.goals.filter((g) => dentro(g) && (g.side === 'home') === match.foggiaHome).length,
      conceded: w.conceded + match.goals.filter((g) => dentro(g) && (g.side === 'home') !== match.foggiaHome).length,
    };
  });

  const scorers = [...d.scorers];
  for (const g of match.goals) {
    const nome = String(g.scorer ?? '').trim();
    if (!nome || (g.side === 'home') !== match.foggiaHome) continue;
    const riga = scorers.find((s) => s.name === nome);
    if (riga) riga.goals += 1;
    else scorers.push({ name: nome, goals: 1 });
  }
  scorers.sort((a, b) => b.goals - a.goals);

  /*
   * Anche il conto per competizione, che e' quello che regge l'anello delle
   * vittorie e il riquadro "casa contro trasferta".
   *
   * `trend` invece non si tocca: dice la posizione in classifica giornata per
   * giornata, e la posizione dipende anche dai risultati delle altre. Quella
   * arriva con l'ingest, e inventarla qui vorrebbe dire disegnare un punto
   * sbagliato su un grafico.
   */
  const dove = match.foggiaHome ? 'home' : 'away';
  const esito = esitoFoggia(match.score.home, match.score.away, match.foggiaHome);
  const trovata = stats.competitions.some((c) => c.competition === match.competition);
  const vuoto = { won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0 };

  const aggiornaLato = (lato: typeof vuoto) => ({
    won: lato.won + (esito === 'W' ? 1 : 0),
    drawn: lato.drawn + (esito === 'D' ? 1 : 0),
    lost: lato.lost + (esito === 'L' ? 1 : 0),
    goalsFor: lato.goalsFor + nostri,
    goalsAgainst: lato.goalsAgainst + loro,
  });

  const competitions = trovata
    ? stats.competitions.map((c) => (
      c.competition === match.competition ? { ...c, [dove]: aggiornaLato(c[dove]) } : c
    ))
    : [...stats.competitions, {
      competition: match.competition,
      points: null,
      home: dove === 'home' ? aggiornaLato(vuoto) : { ...vuoto },
      away: dove === 'away' ? aggiornaLato(vuoto) : { ...vuoto },
    }];

  const etichetta = `${match.home.shortName} ${match.score.home}-${match.score.away} ${match.away.shortName}`;
  const scarto = Math.abs(nostri - loro);
  const scartoVittoria = scartoDa(d.biggestWin);
  const scartoSconfitta = scartoDa(d.worstLoss);

  return {
    ...stats,
    competitions,
    derived: {
      ...d,
      played,
      goalsFor,
      goalsAgainst,
      avgGoalsFor: arrotonda(goalsFor / played),
      avgGoalsAgainst: arrotonda(goalsAgainst / played),
      cleanSheets: d.cleanSheets + (loro === 0 ? 1 : 0),
      failedToScore: d.failedToScore + (nostri === 0 ? 1 : 0),
      biggestWin: nostri > loro && (scartoVittoria === null || scarto > scartoVittoria)
        ? etichetta : d.biggestWin,
      worstLoss: nostri < loro && (scartoSconfitta === null || scarto > scartoSconfitta)
        ? etichetta : d.worstLoss,
      byWindow,
      scorers,
    },
  };
}
