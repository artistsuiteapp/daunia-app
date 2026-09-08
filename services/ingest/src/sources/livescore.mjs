

import { scadenza } from '../util.mjs';/**
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
/** La Coppa Italia di Serie C: il Foggia ci gioca ad agosto, ed e un'altra competizione. */
export const COPPA_ITALIA_C = '180';

const ORE = 60 * 60 * 1000;

async function chiedi(percorso, params, conteggio) {
  const key = process.env.LSA_KEY;
  const secret = process.env.LSA_SECRET;
  if (!key || !secret) return { dati: null, problema: 'credenziali assenti' };

  conteggio.n += 1;
  const q = new URLSearchParams({ key, secret, ...params });
  const r = await fetch(`${BASE}/${percorso}.json?${q}`, { signal: scadenza() });
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

  // Anche le partite che hanno gia i gol: Wikipedia da solo quelli, e senza
  // questo cartellini e sostituzioni restavano vuoti su tutte le giornate
  // vecchie -- cioe la cronaca era due righe invece di sedici.
  const daFare = (partite ?? []).filter((m) =>
    m.status === 'finished' && m.kickoff
    && (!(m.goals ?? []).length || !(m.cards ?? []).length));
  if (!daFare.length) return { arricchite: 0, chiamate: 0, warnings: [] };

  if (!process.env.LSA_KEY || !process.env.LSA_SECRET) {
    return {
      arricchite: 0, chiamate: 0,
      warnings: [`live-score-api: nessuna credenziale, ${daFare.length} partite restano senza marcatori`],
    };
  }

  /*
   * Una chiamata per giornata, non una per tutto il periodo.
   *
   * `matches/history` risponde trenta partite alla volta e un girone ne gioca
   * venti a giornata: chiedendo tre settimane in un colpo le giornate vecchie
   * restavano fuori dalla prima pagina, e i cartellini non arrivavano mai.
   * Chiedere il singolo giorno costa una chiamata in piu e non sbaglia.
   */
  const perGiorno = new Map();
  let arricchite = 0;

  for (const m of daFare) {
    const giorno = m.kickoff.slice(0, 10);

    if (!perGiorno.has(giorno)) {
      // il campionato prima, la coppa solo se in quel giorno non si trova
      // niente: ad agosto il Foggia gioca la Coppa Italia di Serie C, che ha
      // un id suo e stava fuori da tutto
      const righe = [];
      for (const comp of [SERIE_C_ITALIA, COPPA_ITALIA_C]) {
        const r = await chiedi('matches/history',
          { competition_id: comp, from: giorno, to: giorno }, conteggio);
        if (r.problema) { warnings.push(`live-score-api ${giorno}: ${r.problema}`); continue; }
        righe.push(...(r.dati?.match ?? []));
        if (righe.some((x) => /foggia/i.test(`${x.home?.name} ${x.away?.name}`))) break;
      }
      perGiorno.set(giorno, righe);
    }

    // il calendario qui e ancora quello grezzo di Wikipedia: le squadre sono
    // nomi, non oggetti -- gli oggetti li costruisce normalize, piu tardi
    const casa = m.homeName ?? m.home?.name ?? m.home?.shortName;
    const ospiti = m.awayName ?? m.away?.name ?? m.away?.shortName;
    const loro = (perGiorno.get(giorno) ?? []).find((x) => stessaSquadra(x.home?.name, casa)
      && stessaSquadra(x.away?.name, ospiti));
    if (!loro) continue;

    const ev = await chiedi('matches/events', { match_id: loro.id }, conteggio);
    if (ev.problema) { warnings.push(`live-score-api eventi ${giorno}: ${ev.problema}`); continue; }

    const { gol, cartellini, cambi } = traduci(ev.dati?.event ?? []);
    // i gol di Wikipedia hanno nomi piu leggibili ("Luciani" invece di
    // "P. Luciani"): se ci sono gia si tengono, e si prende solo il resto
    if (gol.length && !(m.goals ?? []).length) { m.goals = gol; arricchite += 1; }
    if (cartellini.length) m.cards = cartellini;
    if (cambi.length) m.subs = cambi;
  }

  return { arricchite, chiamate: conteggio.n, warnings };
}

export { traduci as traduciEventi, stessaSquadra };
