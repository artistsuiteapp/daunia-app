/**
 * API-Football: formazioni ed eventi della Serie C.
 *
 * COSA DA' DAVVERO, verificato il 5 settembre 2026 sul girone C (lega 943):
 *
 *   formazioni    SI   titolari con numero e nome, panchina, allenatore
 *   eventi        SI   gol, cartellini, sostituzioni, con il minuto
 *   statistiche   NO   possesso, tiri, falli: la Serie C non li ha, nemmeno a pagamento
 *   modulo        NO   il campo formation torna null per questa lega
 *   ruoli         NO   il campo pos torna null
 *
 * IL VINCOLO CHE DECIDE TUTTO: il piano gratuito arriva alla stagione 2024.
 * Sulla stagione in corso risponde "Free plans do not have access to this
 * season, try from 2022 to 2024". Per i dati veri serve un piano a pagamento,
 * 19 dollari al mese.
 *
 * Senza chiave, o con una chiave che non arriva alla stagione richiesta, questo
 * modulo non fa rumore: restituisce liste vuote e l'ingest continua con
 * Wikipedia. E' voluto, perche l'app deve funzionare comunque.
 */

const BASE = 'https://v3.football.api-sports.io';

/** Girone C della Serie C. Gli altri: A = 138, B = 942. */
export const LEGA_SERIE_C_GIRONE_C = 943;
export const FOGGIA_TEAM_ID = 521;

/** L'anno con cui API-Football indica una stagione: quello di apertura. */
export function stagioneApi(season) {
  return Number(String(season).slice(0, 4));
}

async function chiedi(percorso, chiave) {
  const r = await fetch(`${BASE}/${percorso}`, { headers: { 'x-apisports-key': chiave } });
  if (!r.ok) return { dati: [], problema: `HTTP ${r.status}` };
  const j = await r.json();
  const errori = j.errors && !Array.isArray(j.errors) ? Object.values(j.errors) : [];
  if (errori.length) return { dati: [], problema: String(errori[0]) };
  return { dati: j.response ?? [], problema: null };
}

/**
 * Formazioni e eventi delle ultime partite giocate.
 *
 * Costa una chiamata per l'elenco piu due per ogni partita, quindi si guardano
 * solo le ultime: con cento chiamate al giorno non si spazzola una stagione.
 */
export async function fetchFormazioni({ chiave, season, quante = 3 }) {
  const avvisi = [];
  if (!chiave) return { formazioni: [], eventi: [], warnings: ['API-Football: nessuna chiave, salto.'] };

  const anno = stagioneApi(season);
  const elenco = await chiedi(
    `fixtures?team=${FOGGIA_TEAM_ID}&season=${anno}&league=${LEGA_SERIE_C_GIRONE_C}`,
    chiave,
  );
  if (elenco.problema) {
    avvisi.push(`API-Football: ${elenco.problema}`);
    return { formazioni: [], eventi: [], warnings: avvisi };
  }

  const giocate = elenco.dati
    .filter((x) => x.fixture?.status?.short === 'FT')
    .sort((a, b) => String(a.fixture.date).localeCompare(String(b.fixture.date)))
    .slice(-quante);

  const formazioni = [];
  const eventi = [];

  for (const partita of giocate) {
    const id = partita.fixture.id;
    const data = String(partita.fixture.date).slice(0, 10);

    const f = await chiedi(`fixtures/lineups?fixture=${id}`, chiave);
    for (const squadra of f.dati) {
      formazioni.push({
        matchDate: data,
        teamId: squadra.team?.id ?? null,
        teamName: squadra.team?.name ?? null,
        isFoggia: squadra.team?.id === FOGGIA_TEAM_ID,
        coach: squadra.coach?.name ?? null,
        // il modulo per la Serie C torna null: non lo si inventa
        formation: squadra.formation ?? null,
        startXI: (squadra.startXI ?? []).map((p) => ({
          number: p.player?.number ?? null,
          name: p.player?.name ?? null,
        })),
        bench: (squadra.substitutes ?? []).map((p) => ({
          number: p.player?.number ?? null,
          name: p.player?.name ?? null,
        })),
      });
    }

    const e = await chiedi(`fixtures/events?fixture=${id}`, chiave);
    for (const x of e.dati) {
      eventi.push({
        matchDate: data,
        minute: x.time?.elapsed ?? null,
        extra: x.time?.extra ?? null,
        type: x.type ?? null,
        detail: x.detail ?? null,
        player: x.player?.name ?? null,
        assist: x.assist?.name ?? null,
        teamName: x.team?.name ?? null,
      });
    }
  }

  if (!formazioni.length && !avvisi.length) {
    avvisi.push('API-Football: nessuna formazione trovata per questa stagione.');
  }
  return { formazioni, eventi, warnings: avvisi };
}
