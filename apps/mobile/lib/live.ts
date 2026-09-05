/**
 * Punteggio dal vivo.
 *
 * Durante la partita il telefono interroga TheSportsDB ogni quarantacinque
 * secondi: `lookupevent.php?id=<idEvent>` pesa un chilo e mezzo e porta
 * punteggio e stato aggiornati. Gratis, senza quota giornaliera, con CORS
 * aperto, quindi funziona anche dal web.
 *
 * Perche non API-Football: la sua quota e cento chiamate al giorno e serve
 * intera per formazioni ed eventi. E soprattutto la sua chiave e segreta,
 * mentre quella di TheSportsDB e pubblica per definizione, quindi puo stare
 * dentro l'app senza esporre niente.
 *
 * L'id della partita arriva dall'ingest in data/prossima.json: cosi il telefono
 * non deve cercarselo a ogni apertura.
 *
 * Il polling parte da dieci minuti prima del calcio d'inizio, si ferma appena
 * la partita e finita o dopo tre ore, e si sospende quando l'app va in secondo
 * piano. Se una chiamata fallisce si tiene l'ultimo punteggio buono: meglio un
 * dato di un minuto fa che una schermata vuota.
 *
 * I conti stanno in live-core.ts, che e senza React e sotto test.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import type { Match } from '@satanelli/core';

import { prossima } from './data';
import { finestraAperta, leggiEvento, orienta, type Live } from './live-core';

export type { Live } from './live-core';

const BASE = 'https://www.thesportsdb.com/api/v1/json/123';
const OGNI = 45_000;

let stato: Live | null = null;
let ascoltatori: Array<() => void> = [];
let timer: ReturnType<typeof setInterval> | null = null;

function annuncia() {
  for (const f of ascoltatori) f();
}

async function chiedi() {
  const id = prossima?.eventId;
  if (!id) return;
  try {
    const r = await fetch(`${BASE}/lookupevent.php?id=${id}`);
    if (!r.ok) return;
    const j = await r.json();
    const letto = leggiEvento(j?.events?.[0]);
    if (!letto) return;
    stato = letto;
    annuncia();
    if (letto.finita) ferma();
  } catch {
    // rete assente o fonte giu: si tiene l'ultimo punteggio
  }
}

function avvia() {
  if (!finestraAperta(prossima?.kickoff)) return;

  // un colpo si fa comunque: se lo stato dell'app arrivasse sbagliato, meglio
  // un punteggio fermo che nessun punteggio
  void chiedi();

  // il ciclo invece parte solo in primo piano, per non consumare batteria
  if (timer) return;
  if (AppState.currentState === 'background') return;
  timer = setInterval(() => {
    if (!finestraAperta(prossima?.kickoff)) { ferma(); return; }
    void chiedi();
  }, OGNI);
}

function ferma() {
  if (timer) clearInterval(timer);
  timer = null;
}

/**
 * Il punteggio dal vivo, se c'e. Il poller e uno solo per tutta l'app, anche se
 * la scheda partita compare in piu schermate insieme.
 */
export function useLive(): Live | null {
  useEffect(() => {
    avvia();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') avvia(); else ferma();
    });
    return () => { sub.remove(); };
  }, []);

  return useSyncExternalStore(
    (f) => {
      ascoltatori = [...ascoltatori, f];
      return () => { ascoltatori = ascoltatori.filter((x) => x !== f); };
    },
    () => stato,
    () => stato,
  );
}

/** Il punteggio dal vivo riferito a una partita precisa, orientato come la scheda. */
export function liveDi(match: Match | null | undefined, live: Live | null): Live | null {
  if (!match) return null;
  return orienta(
    { kickoff: match.kickoff, status: match.status, casa: match.home.name ?? match.home.shortName },
    prossima ? { kickoff: prossima.kickoff, casa: prossima.home } : null,
    live,
  );
}
