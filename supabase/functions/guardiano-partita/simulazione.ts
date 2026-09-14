/**
 * La partita finta su cui gira `partita-simulata.test.ts`.
 *
 * Una partita intera, giocata in pochi secondi.
 *
 * PERCHE ESISTE
 *
 * I ritardi del dal vivo non stavano in una funzione sbagliata: stavano nel
 * modo in cui i giri del guardiano si incastrano col tempo. Una pausa di un
 * minuto che in pratica diventa di due, tre letture vuote che spengono la
 * fonte per tutta la gara, un punteggio trattenuto finche le fonti non vanno
 * d'accordo. Nessun test su una funzione sola poteva vederli.
 *
 * Qui il guardiano gira come in produzione -- chiamato ogni minuto, con la
 * rete che costa tempo -- contro fonti finte che si comportano come quelle
 * vere: TheSportsDB e live-score-api vedono la stessa partita con ritardi
 * diversi, il nome del marcatore arriva dopo il gol, la Lega apre le
 * formazioni dopo il fischio. Poi si guarda quando ogni cosa e comparsa nella
 * riga che l'app legge.
 */
import { creaGuardiano } from './guardiano.ts';
import { fintoDb } from './finto-db.ts';

export const MIN = 60_000;
export const K = Date.parse('2026-09-15T19:00:00Z');
const PARTITA = '2555027';

type Evento = {
  quando: number; event: string; time: number; is_home: boolean; nome: string;
  entra?: string; nomeDopo?: number;
};

/** Quello che succede davvero in campo, contando dal fischio d'inizio. */
export const REALTA = {
  intervallo: 47 * MIN,
  ripresa: 62 * MIN,
  fine: 112 * MIN,
  eventi: [
    { quando: 11.5 * MIN, event: 'YELLOW_CARD', time: 12, is_home: false, nome: 'C. Bianchi' },
    { quando: 22.2 * MIN, event: 'GOAL', time: 23, is_home: true, nome: 'A. Rossi', nomeDopo: 3 * MIN },
    { quando: 76 * MIN, event: 'SUBSTITUTION', time: 60, is_home: true, nome: 'D. Esce', entra: 'E. Entra' },
    { quando: 94.5 * MIN, event: 'GOAL', time: 78, is_home: false, nome: 'B. Verdi' },
    { quando: 101 * MIN, event: 'RED_CARD', time: 85, is_home: true, nome: 'F. Rosso' },
  ] as Evento[],
};

function fase(x: number): 'NS' | '1H' | 'HT' | '2H' | 'FT' {
  if (x < 0) return 'NS';
  if (x < REALTA.intervallo) return '1H';
  if (x < REALTA.ripresa) return 'HT';
  if (x < REALTA.fine) return '2H';
  return 'FT';
}

function minuto(x: number): string | null {
  const f = fase(x);
  if (f === '1H') {
    const m = Math.floor(x / MIN) + 1;
    return m > 45 ? `45+${m - 45}` : String(m);
  }
  if (f === '2H') {
    const m = 45 + Math.floor((x - REALTA.ripresa) / MIN) + 1;
    return m > 90 ? `90+${m - 90}` : String(m);
  }
  return null;
}

function punteggio(x: number) {
  let casa = 0;
  let ospiti = 0;
  for (const e of REALTA.eventi) {
    if (e.quando > x || !e.event.startsWith('GOAL')) continue;
    if (e.is_home) casa += 1; else ospiti += 1;
  }
  return { casa, ospiti };
}

export type { Foto };

export type Scenario = {
  /** quanto TheSportsDB vede in ritardo, in millisecondi */
  ritardoTsdb: number;
  /** quanto live-score-api vede in ritardo */
  ritardoLsa: number;
  /** TheSportsDB non mette mai la partita nella lista del dal vivo */
  tsdbSenzaLista?: boolean;
  /** quando la Lega apre la partita e le formazioni, dal fischio */
  legaApre: number;
  /** il guardiano non ha le chiavi di live-score-api */
  senzaLsa?: boolean;
  /** live-score-api risponde con un errore fino a questo istante, dal fischio */
  lsaGuastaFinoA?: number;
  /** ...a partire da questo istante (senza, dal principio) */
  lsaGuastaDa?: number;
  /** TheSportsDB torna a 0-0 per sbaglio in questo intervallo, dal fischio */
  tsdbAZero?: { da: number; a: number };
  /** il calcio d'inizio vero arriva dopo quello in calendario */
  ritardoInizio?: number;
};

function fonti(s: Scenario, orologio: { t: number }, chiamate: Record<string, number>) {
  const RITARDO_SCHEDA = 6 * MIN;

  const rigaTsdb = (x: number) => ({
    idEvent: PARTITA,
    strHomeTeam: 'Foggia',
    strAwayTeam: 'Savoia',
    strEvent: 'Foggia vs Savoia',
    strStatus: fase(x),
    intHomeScore: fase(x) === 'NS' ? null : String(punteggio(x).casa),
    intAwayScore: fase(x) === 'NS' ? null : String(punteggio(x).ospiti),
    strProgress: minuto(x) ?? '',
  });

  const statoLsa = (f: string) =>
    f === 'HT' ? 'HALF TIME BREAK' : f === 'FT' ? 'FINISHED' : f === 'NS' ? 'NOT STARTED' : 'IN PLAY';

  const partitaLsa = (x: number) => ({
    id: '9001',
    status: statoLsa(fase(x)),
    time: fase(x) === 'HT' ? 'HT' : fase(x) === 'FT' ? 'FT' : (minuto(x) ?? '').replace(/\+\d+$/, '+'),
    home: { name: 'Foggia' },
    away: { name: 'Savoia' },
    scores: { score: `${punteggio(x).casa} - ${punteggio(x).ospiti}` },
  });

  const risposte: Array<[RegExp, (u: URL, init?: RequestInit) => { costo: number; corpo: unknown }]> = [
    [/thesportsdb\.com\/.*livescore\.php/, () => {
      const x = orologio.t - K - s.ritardoTsdb - (s.ritardoInizio ?? 0);
      const dentro = !s.tsdbSenzaLista && fase(x) !== 'NS' && x < REALTA.fine + 3 * MIN;
      const riga = rigaTsdb(x);
      const dopo = orologio.t - K;
      if (s.tsdbAZero && dopo >= s.tsdbAZero.da && dopo < s.tsdbAZero.a) {
        riga.intHomeScore = '0';
        riga.intAwayScore = '0';
      }
      return { costo: 900, corpo: { livescore: dentro ? [riga] : [] } };
    }],
    [/thesportsdb\.com\/.*lookupevent\.php/, () => {
      const x = orologio.t - K - RITARDO_SCHEDA - (s.ritardoInizio ?? 0);
      const r = rigaTsdb(x);
      return { costo: 250, corpo: { events: [{ ...r, strProgress: undefined }] } };
    }],
    [/thesportsdb\.com\/.*eventsnext\.php/, () => ({
      costo: 250,
      corpo: { events: [{ idEvent: PARTITA, strTimestamp: '2026-09-15T19:00:00', strStatus: 'NS', strEvent: 'Foggia vs Savoia' }] },
    })],
    [/raw\.githubusercontent\.com/, () => ({ costo: 200, corpo: [] })],
    [/livescore-api\.com\/api-client\/matches\/live\.json/, (u) => {
      if (s.lsaGuastaFinoA !== undefined && orologio.t - K < s.lsaGuastaFinoA && orologio.t - K >= (s.lsaGuastaDa ?? -Infinity)) {
        return { costo: 350, corpo: { success: false, error: 'guasto' } };
      }
      const x = orologio.t - K - s.ritardoLsa - (s.ritardoInizio ?? 0);
      const nostra = u.searchParams.get('competition_id') === '181' && fase(x) !== 'NS';
      return { costo: 350, corpo: { success: true, data: { match: nostra ? [partitaLsa(x)] : [] } } };
    }],
    [/livescore-api\.com\/api-client\/matches\/events\.json/, () => {
      if (s.lsaGuastaFinoA !== undefined && orologio.t - K < s.lsaGuastaFinoA && orologio.t - K >= (s.lsaGuastaDa ?? -Infinity)) {
        return { costo: 350, corpo: { success: false, error: 'guasto' } };
      }
      const x = orologio.t - K - s.ritardoLsa - (s.ritardoInizio ?? 0);
      const event = REALTA.eventi.filter((e) => e.quando <= x).map((e) => ({
        event: e.event,
        time: e.time,
        is_home: e.is_home,
        player: { name: e.nomeDopo && e.quando + e.nomeDopo > x ? null : e.nome },
        info: e.entra ? { name: e.entra } : null,
      }));
      return { costo: 350, corpo: { success: true, data: { match: partitaLsa(x), event } } };
    }],
    [/seriec\.com\/calendario/, (_u, init) => {
      const aperta = orologio.t - K - (s.ritardoInizio ?? 0) >= s.legaApre;
      if (init?.method === 'POST') {
        const colonna = (squadra: string, cognomi: string[]) =>
          `<div class="lineup-col"><div class="lineup-header"><strong>${squadra}</strong> <span class="formation">(3-5-2)</span></div>`
          + `<div class="lineup-manager">All. Tizio</div><ul>`
          + cognomi.map((c, i) => `<li class="lineup-player"><span class="jersey">${i + 1}</span><span class="player-name">${c}</span><span class="position">C</span></li>`).join('')
          + `</ul></div>`;
        const undici = (p: string) => Array.from({ length: 11 }, (_, i) => `${p}${i + 1}`);
        const html = `<div class="lineups-section">${colonna('Calcio Foggia', undici('Foggiano'))}${colonna('Savoia', undici('Savoiardo'))}</div></div></div>`;
        return { costo: 400, corpo: { '#match-details-modal-content': aperta ? html : '' } };
      }
      const bottone = aperta
        ? '<img alt="Calcio Foggia" class="team-logo"> <img alt="Savoia" class="team-logo"> <button data-match-id="lega42" data-request="onLoadMatchDetails">'
        : '<img alt="Calcio Foggia" class="team-logo"> <img alt="Savoia" class="team-logo">';
      return { costo: 2500, corpo: `<html>${bottone}</html>` };
    }],
  ];

  return async (indirizzo: string | URL | Request, init?: RequestInit) => {
    const u = new URL(String(indirizzo instanceof Request ? indirizzo.url : indirizzo));
    const voce = risposte.find(([re]) => re.test(u.href));
    if (!voce) throw new Error(`fonte non prevista: ${u.host}${u.pathname}`);
    const nome = `${u.host}${u.pathname}`;
    chiamate[nome] = (chiamate[nome] ?? 0) + 1;
    const { costo, corpo } = voce[1](u, init);
    orologio.t += costo;
    const testo = typeof corpo === 'string' ? corpo : JSON.stringify(corpo);
    return new Response(testo, { status: 200 });
  };
}

type Foto = {
  t: number;
  stato: string; casa: number | null; ospiti: number | null; minuto: string | null;
  cartellini: Array<{ minuto: number; rosso: boolean }>;
  cambi: Array<{ minuto: number }>;
  gol: Array<{ chi?: string | null }>;
  formazione: unknown; finita_il: string | null;
};

export async function gioca(s: Scenario) {
  const orologio = { t: K - 100 * MIN };
  const foto: Foto[] = [];
  const fotografa = () => {
    const r = db.tabelle.stato_partita.find((x) => x.partita === PARTITA)!;
    foto.push({
      t: orologio.t,
      stato: String(r.stato), casa: r.casa as number | null, ospiti: r.ospiti as number | null,
      minuto: (r.minuto ?? null) as string | null,
      cartellini: (r.cartellini ?? []) as Foto['cartellini'],
      cambi: (r.cambi ?? []) as Foto['cambi'],
      gol: (r.gol ?? []) as Foto['gol'],
      formazione: r.formazione ?? null,
      finita_il: (r.finita_il ?? null) as string | null,
    });
  };
  const db = fintoDb({
    stato_partita: [{
      partita: PARTITA, event_id: Number(PARTITA), fixture_id: null, kickoff: '2026-09-15T19:00:00Z',
      etichetta: 'Foggia vs Savoia', stato: 'NS', casa: null, ospiti: null, eventi_detti: [],
      gol: [], cartellini: [], cambi: [], af_a_vuoto: 0,
    }],
    calendario: [{ partita: 'wp-2026-2027-005', event_id: PARTITA, kickoff: '2026-09-15T19:00:00Z', aggiornato_il: new Date(K - 100 * MIN).toISOString() }],
    push_iscrizioni: [{
      endpoint: 'https://fcm.googleapis.com/fcm/send/prova', p256dh: 'x', auth: 'y', utente: 'u1',
      preferenze: { formazioni: true, inizio: true, gol: true, espulsione: true, intervallo: true, fine: true, pronostico: true, esito: true },
    }],
    pronostici: [{ utente: 'u1', partita: 'wp-2026-2027-005' }],
  }, {
    chiedi_quota: () => false,
    // come la funzione vera: segna quando ha allineato, cosi il prossimo giro aspetta mezz'ora
    allinea_calendario: () => {
      for (const c of db.tabelle.calendario) c.aggiornato_il = new Date(orologio.t).toISOString();
      return {};
    },
  }, (tabella) => {
    if (tabella === 'stato_partita') fotografa();
  });
  // ogni domanda al database costa un po' di tempo, come in produzione
  const from = db.from;
  db.from = (tabella: string) => { orologio.t += 60; return from(tabella); };

  const suonate: Array<{ t: number; titolo: string; testo: string; tipo: string; muta?: boolean }> = [];
  const pendenti: Array<Promise<unknown>> = [];
  let sovrapposizioni = 0;

  const vecchioFetch = globalThis.fetch;
  const chiamate: Record<string, number> = {};
  globalThis.fetch = fonti(s, orologio, chiamate) as typeof fetch;
  try {
    const gestisci = creaGuardiano({
      db,
      env: (n) => ({
        GUARDIANO_SEGRETO: 'segreto', VAPID_JWK: '{}', GUARDIANO_DIARIO: 'no',
        ...(s.senzaLsa ? {} : { LSA_KEY: 'k', LSA_SECRET: 's' }),
      } as Record<string, string>)[n],
      orologio: () => orologio.t,
      inBackground: (p) => { pendenti.push(p); },
      dormi: async (ms) => { orologio.t += ms; },
      invia: async (_i, contenuto) => {
        const c = contenuto as { titolo: string; testo: string; tipo: string; muta?: boolean };
        suonate.push({ t: orologio.t, ...c });
        return 201;
      },
    });

    for (let m = -95; m <= 200; m += 1) {
      // pg_cron parte al secondo zero; la funzione si sveglia qualche decimo dopo
      const sveglia = K + m * MIN + 300 + ((m * 7919) % 500 + 500) % 500;
      // il giro del minuto prima non deve arrivare fin dentro questo
      if (orologio.t > sveglia) sovrapposizioni += 1;
      orologio.t = Math.max(orologio.t, sveglia);
      await gestisci(new Request('https://guardiano.test', {
        method: 'POST', headers: { 'x-guardiano': 'segreto' }, body: '{}',
      }));
      while (pendenti.length) await pendenti.shift();
    }
  } finally {
    globalThis.fetch = vecchioFetch;
  }

  const primaVolta = (vero: (f: Foto) => boolean) => foto.find(vero)?.t ?? Infinity;
  return { foto, suonate, primaVolta, sovrapposizioni, chiamate };
}

/** Quando una cosa accaduta in campo diventa visibile alla fonte piu svelta. */
export const visibile = (quando: number, s: Scenario, soloLsa = false) =>
  K + quando + (s.ritardoInizio ?? 0) + (soloLsa ? s.ritardoLsa : Math.min(s.ritardoLsa, s.tsdbSenzaLista ? Infinity : s.ritardoTsdb));

export const secondi = (ms: number) => Math.round(ms / 1000);

export const SCENARI: Array<[string, Scenario]> = [
  ['live-score-api piu svelto di TheSportsDB', { ritardoTsdb: 150_000, ritardoLsa: 40_000, legaApre: 0.5 * MIN }],
  ['TheSportsDB piu svelto di live-score-api', { ritardoTsdb: 30_000, ritardoLsa: 150_000, legaApre: 0.5 * MIN }],
  ['TheSportsDB senza la partita nella lista del dal vivo', { ritardoTsdb: 150_000, ritardoLsa: 40_000, tsdbSenzaLista: true, legaApre: 0.5 * MIN }],
];
