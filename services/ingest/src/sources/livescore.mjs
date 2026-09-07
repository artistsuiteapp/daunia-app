/**
 * live-score-api: i marcatori, i cartellini e i cambi.
 *
 * Wikipedia i marcatori li ha, ma arriva con ore o giorni di ritardo, e per le
 * giornate piu vecchie a volte non li ha affatto. API-Football li aveva, ma
 * l'account e stato sospeso due volte in ventiquattro ore. Questa e la terza
 * strada, e a differenza delle altre due copre la Serie C in modo dichiarato:
 * la competizione ha un id suo, il 181 (l'altra "Serie C" in catalogo e
 * brasiliana).
 *
 * Quello che da, verificato a mano su Foggia-Audace Cerignola del 6 settembre:
 * gol col nome e il minuto, cartellini, e le sostituzioni con chi esce e chi
 * entra. Quello che NON da sono le formazioni iniziali: `matches/lineups`
 * risponde con `players: []` su Serie A, B e C italiane, quindi non e un buco
 * della Serie C ma dell'endpoint.
 *
 * Le credenziali stanno in LSA_KEY e LSA_SECRET. Senza, il modulo non fa
 * niente e lo dice: l'ingest continua a girare con le altre fonti.
 */

const BASE = 'https://livescore-api.com/api-client';

/** Serie C italiana. In catalogo c'e anche una Serie C brasiliana, la 253. */
export const SERIE_C_ITALIA = '181';

const ORE = 60 * 60 * 1000;

async function chiedi(percorso, params, conteggio) {
  const key = process.env.LSA_KEY;
  const secret = process.env.LSA_SECRET;
  if (!key || !secret) return { dati: null, problema: 'credenziali assenti' };

  conteggio.n += 1;
  const q = new URLSearchParams({ key, secret, ...params });
  const r = await fetch(`${BASE}/${percorso}.json?${q}`);
  if (!r.ok) return { dati: null, problema: `HTTP ${r.status}` };
  const j = await r.json().catch(() => null);
  if (!j?.success) return { dati: null, problema: j?.error ?? 'risposta illeggibile' };
  return { dati: j.data, problema: null };
}

const pulisci = (s) => String(s ?? '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

const stessaSquadra = (a, b) => {
  const [p, q] = [pulisci(a), pulisci(b)];
  return Boolean(p) && Boolean(q) && (p.includes(q) || q.includes(p));
};

/**
 * Gli eventi di una partita, tradotti nella forma che usa l'app.
 *
 * `is_home` dice il lato, e per i gol basta: il nome della squadra non serve
 * saperlo. Le sostituzioni portano due nomi -- `player` esce, `info` entra --
 * ed e l'unica fonte che ce li da tutti e due.
 */
function traduci(eventi) {
  const gol = [];
  const cartellini = [];
  const cambi = [];

  for (const e of eventi ?? []) {
    const minuto = Number(e.time);
    const chi = e.player?.name ?? null;
    const lato = e.is_home ? 'home' : 'away';
    if (!Number.isFinite(minuto)) continue;

    if (e.event === 'GOAL' || e.event === 'PENALTY') {
      gol.push({
        minute: minuto,
        extra: null,
        scorer: chi ?? 'sconosciuto',
        side: lato,
        ownGoal: e.event === 'OWN_GOAL',
        penalty: e.event === 'PENALTY',
      });
    } else if (e.event === 'OWN_GOAL') {
      // l'autogol vale per l'altra squadra: qui il lato si gira
      gol.push({
        minute: minuto, extra: null, scorer: chi ?? 'sconosciuto',
        side: lato === 'home' ? 'away' : 'home', ownGoal: true, penalty: false,
      });
    } else if (e.event === 'YELLOW_CARD' || e.event === 'RED_CARD') {
      cartellini.push({ minute: minuto, player: chi, side: lato, rosso: e.event === 'RED_CARD' });
    } else if (e.event === 'SUBSTITUTION') {
      cambi.push({ minute: minuto, esce: chi, entra: e.info?.name ?? null, side: lato });
    }
  }

  gol.sort((a, b) => a.minute - b.minute);
  return { gol, cartellini, cambi };
}

/**
 * Riempie marcatori, cartellini e cambi delle partite gia giocate.
 *
 * Non tocca quello che Wikipedia ha gia scritto: se i gol ci sono, si lascia
 * stare e non si spende una chiamata. Cosi una stagione intera costa una
 * manciata di richieste al giorno, e solo per le giornate nuove.
 */
export async function arricchisciPartite(partite) {
  const conteggio = { n: 0 };
  const warnings = [];

  const daFare = (partite ?? []).filter((m) =>
    m.status === 'finished' && !(m.goals ?? []).length && m.kickoff);
  if (!daFare.length) return { arricchite: 0, chiamate: 0, warnings: [] };

  if (!process.env.LSA_KEY || !process.env.LSA_SECRET) {
    return {
      arricchite: 0, chiamate: 0,
      warnings: [`live-score-api: nessuna credenziale, ${daFare.length} partite restano senza marcatori`],
    };
  }

  // una sola chiamata per tutto il girone, invece di una per partita
  const dal = daFare.map((m) => m.kickoff.slice(0, 10)).sort()[0];
  const storia = await chiedi('matches/history',
    { competition_id: SERIE_C_ITALIA, from: dal, to: new Date().toISOString().slice(0, 10) },
    conteggio);

  if (storia.problema) {
    return { arricchite: 0, chiamate: conteggio.n, warnings: [`live-score-api: ${storia.problema}`] };
  }

  const trovate = storia.dati?.match ?? [];
  let arricchite = 0;

  for (const m of daFare) {
    const giorno = m.kickoff.slice(0, 10);
    // il calendario qui e ancora quello grezzo di Wikipedia: le squadre sono
    // nomi, non oggetti -- gli oggetti li costruisce normalize, piu tardi
    const casa = m.homeName ?? m.home?.name ?? m.home?.shortName;
    const ospiti = m.awayName ?? m.away?.name ?? m.away?.shortName;
    const loro = trovate.find((x) => x.date === giorno
      && stessaSquadra(x.home?.name, casa)
      && stessaSquadra(x.away?.name, ospiti));
    if (!loro) continue;

    const ev = await chiedi('matches/events', { match_id: loro.id }, conteggio);
    if (ev.problema) { warnings.push(`live-score-api eventi ${giorno}: ${ev.problema}`); continue; }

    const { gol, cartellini, cambi } = traduci(ev.dati?.event ?? []);
    if (gol.length) { m.goals = gol; arricchite += 1; }
    if (cartellini.length) m.cards = cartellini;
    if (cambi.length) m.subs = cambi;
  }

  return { arricchite, chiamate: conteggio.n, warnings };
}

export { traduci as traduciEventi, stessaSquadra };
