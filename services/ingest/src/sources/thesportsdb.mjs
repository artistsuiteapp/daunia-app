/**
 * TheSportsDB, chiave pubblica gratuita.
 *
 * Serve a una cosa sola ma decisiva: fa da ponte fra il calendario e gli id di
 * API-Football. Ogni evento porta il campo idAPIfootball, e con quello si
 * scaricano formazioni ed eventi anche delle partite vecchie, che la finestra
 * di tre giorni del piano gratuito non lascerebbe raggiungere.
 *
 * Verificato il 5 settembre 2026: la stagione in corso c'e, con orari e
 * punteggi. Le formazioni no: per la Serie C il campo lineup torna vuoto
 * mentre per la Serie B e piena, quindi e un buco di copertura, non un
 * paywall. Per quelle si passa da API-Football.
 */
import { getJson } from '../util.mjs';

const BASE = 'https://www.thesportsdb.com/api/v1/json/123';

/** Serie C girone C. Coppa Italia Serie C: 5187. */
export const LEGA_GIRONE_C = 4398;
export const FOGGIA_TEAM_ID = 134682;

const ORE = 60 * 60 * 1000;

/**
 * Gli id API-Football delle partite del Foggia, giornata per giornata.
 *
 * Si guardano solo le giornate non ancora in mappa: a stagione avviata sono
 * una o due, non trentotto.
 */
export async function fetchIdPartite({ season, finoA, gia = {} }) {
  const mappa = { ...gia };
  const avvisi = [];

  for (let r = 1; r <= finoA; r++) {
    if (Object.values(mappa).some((v) => v.round === r)) continue;
    let dati;
    try {
      dati = await getJson(`${BASE}/eventsround.php?id=${LEGA_GIRONE_C}&r=${r}&s=${season}`, { ttl: 12 * ORE });
    } catch (err) {
      avvisi.push(`TheSportsDB giornata ${r}: ${err.message}`);
      continue;
    }
    for (const e of dati?.events ?? []) {
      if (String(e.idHomeTeam) !== String(FOGGIA_TEAM_ID) && String(e.idAwayTeam) !== String(FOGGIA_TEAM_ID)) continue;
      if (!e.idAPIfootball) continue;
      mappa[e.dateEvent] = {
        round: r,
        fixtureId: Number(e.idAPIfootball),
        eventId: e.idEvent ? Number(e.idEvent) : null,
        label: e.strEvent,
      };
    }
  }
  return { mappa, warnings: avvisi };
}

/**
 * La prossima partita del Foggia, con l'id che serve al punteggio dal vivo.
 *
 * `lookupevent.php?id=<idEvent>` pesa un chilo e mezzo e porta punteggio e
 * stato aggiornati mentre si gioca, quindi e quello che l'app interroga durante
 * la partita. Qui si prende l'id una volta e lo si scrive nei dati: cosi il
 * telefono non deve cercarlo da solo.
 */
export async function fetchProssima() {
  let dati;
  try {
    dati = await getJson(`${BASE}/eventsnext.php?id=${FOGGIA_TEAM_ID}`, { ttl: 3 * ORE });
  } catch (err) {
    return { prossima: null, warnings: [`TheSportsDB prossima partita: ${err.message}`] };
  }
  const e = (dati?.events ?? [])[0];
  if (!e?.idEvent || !e?.strTimestamp) return { prossima: null, warnings: [] };

  return {
    prossima: {
      eventId: Number(e.idEvent),
      fixtureId: e.idAPIfootball ? Number(e.idAPIfootball) : null,
      kickoff: `${e.strTimestamp}Z`,
      label: e.strEvent ?? null,
      competition: e.strLeague ?? null,
      home: e.strHomeTeam ?? null,
      away: e.strAwayTeam ?? null,
    },
    warnings: [],
  };
}


/**
 * I risultati delle ultime partite giocate.
 *
 * Serve perche Wikipedia arriva tardi: la mattina dopo Foggia-Cerignola la
 * pagina della stagione dava ancora la partita come "in programma", quindi
 * nell'app non compariva fra le giocate e in home restava scritto "prossima in
 * casa" su una gara finita da dodici ore. TheSportsDB il risultato ce l'aveva
 * gia la sera stessa.
 *
 * Non sostituisce Wikipedia: quella porta i marcatori, e quando arriva vince
 * lei. Questo riempie solo il buco fra il triplice fischio e l'aggiornamento.
 */
export async function fetchRisultati() {
  let dati;
  try {
    dati = await getJson(`${BASE}/eventslast.php?id=${FOGGIA_TEAM_ID}`, { ttl: ORE });
  } catch (err) {
    return { risultati: [], warnings: [`TheSportsDB risultati: ${err.message}`] };
  }

  const righe = (dati?.results ?? [])
    .filter((e) => FINITE.has(String(e.strStatus ?? '').trim()))
    .map((e) => ({
      data: e.dateEvent ?? null,
      casa: e.strHomeTeam ?? null,
      ospiti: e.strAwayTeam ?? null,
      golCasa: e.intHomeScore === null || e.intHomeScore === '' ? null : Number(e.intHomeScore),
      golOspiti: e.intAwayScore === null || e.intAwayScore === '' ? null : Number(e.intAwayScore),
    }))
    .filter((r) => r.data && r.golCasa !== null && r.golOspiti !== null);

  return { risultati: righe, warnings: [] };
}

const FINITE = new Set(['FT', 'AET', 'PEN']);
