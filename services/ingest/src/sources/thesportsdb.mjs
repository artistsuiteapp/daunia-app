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
        label: e.strEvent,
      };
    }
  }
  return { mappa, warnings: avvisi };
}
