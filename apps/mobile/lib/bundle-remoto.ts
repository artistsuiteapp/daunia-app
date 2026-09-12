/**
 * Dati freschi senza ricompilare l'app.
 *
 * IL PROBLEMA CHE RISOLVE
 *
 * Finche l'app si usava dal browser, i dati dell'ingest arrivavano da soli: ogni
 * giro ripubblicava il sito e chi apriva scaricava tutto insieme, codice e dati.
 * Un'app installata sul telefono non funziona cosi. Il codice sta nel telefono
 * e li resta: calendario, classifica, rosa e comunicati sarebbero rimasti al
 * giorno della compilazione, e per accorgersene ci sarebbe voluta una settimana.
 *
 * PERCHE DA GITHUB E NON DAL SITO
 *
 * Il file lo scrive l'ingest e lo committa nel repo, che e pubblico. Preso da
 * li, i dati non aspettano nessuna pubblicazione: il commit e gia il file. Il
 * sito invece va ricostruito e ripubblicato, e ogni pubblicazione e una cosa in
 * piu che puo non partire o finire il suo tetto giornaliero -- e successo.
 *
 * COSA NON PASSA DA QUI
 *
 * Il punteggio dal vivo no: quello lo scrive il guardiano su Supabase e l'app lo
 * legge da li, al secondo (lib/live.ts). Questo modulo e per le cose che
 * cambiano una volta ogni tanto.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { applicaBundle, meta, versioneDati } from './data';
import { daSostituire, istante, valido } from './bundle-remoto-core.ts';

/**
 * Il bundle nel ramo principale del repo pubblico.
 *
 * `raw.githubusercontent.com` sta dietro una cache di qualche minuto. Per il
 * calendario e la rassegna stampa e piu che sufficiente, e in cambio non c'e'
 * niente da tenere acceso.
 */
const SORGENTE = 'https://raw.githubusercontent.com/artistsuiteapp/daunia-app/main/data/bundle.json';

/** La copia scaricata, tenuta nel telefono per la prossima apertura. */
const CASSETTO = 'daunia.bundle.v1';

/** Oltre questo, si rinuncia: allo stadio la rete o va o non va, e non si aspetta. */
const PAZIENZA = 12_000;

let inCorso: Promise<boolean> | null = null;
const ascoltatori = new Set<() => void>();

function avvisa() {
  for (const f of ascoltatori) f();
}

/**
 * Applica un bundle se e migliore di quello che c'e' adesso.
 *
 * Il confronto e sempre contro `meta` corrente e mai contro quello cotto
 * nell'app: dopo il primo giro il dato buono e quello gia applicato, e
 * riapplicare una copia vecchia riporterebbe indietro l'app sotto gli occhi di
 * chi la sta usando.
 */
function forse(candidato: unknown): boolean {
  if (!daSostituire(istante({ meta }), candidato)) return false;
  applicaBundle(candidato as Parameters<typeof applicaBundle>[0]);
  avvisa();
  return true;
}

/** La copia salvata nel telefono. Si legge all'avvio, prima ancora di provare la rete. */
async function dalCassetto(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CASSETTO);
    if (!raw) return false;
    return forse(JSON.parse(raw) as unknown);
  } catch {
    /* cassetto illeggibile: si va di rete, non e un guasto da mostrare */
    return false;
  }
}

/**
 * Scarica il bundle e lo applica se e piu fresco.
 *
 * Il file si salva nel cassetto solo dopo che e passato per `valido()`: se
 * quello che e arrivato non e un bundle -- il portale di una rete wifi, un 404
 * di GitHub, un file troncato -- salvarlo significherebbe ritrovarselo alla
 * prossima apertura, e il guasto durerebbe piu della rete che l'ha causato.
 */
export async function scarica(): Promise<boolean> {
  if (inCorso) return inCorso;
  inCorso = (async () => {
    const taglia = new AbortController();
    const timer = setTimeout(() => taglia.abort(), PAZIENZA);
    try {
      const r = await fetch(`${SORGENTE}?t=${Date.now()}`, { signal: taglia.signal });
      if (!r.ok) return false;
      const arrivato = (await r.json()) as unknown;
      if (!valido(arrivato)) return false;
      await AsyncStorage.setItem(CASSETTO, JSON.stringify(arrivato)).catch(() => {});
      return forse(arrivato);
    } catch {
      /* senza rete si resta su quello che si ha: e il caso normale allo stadio */
      return false;
    } finally {
      clearTimeout(timer);
      inCorso = null;
    }
  })();
  return inCorso;
}

/**
 * Tiene i dati aggiornati per tutta la vita dell'app. Va chiamata una volta sola,
 * dal layout radice.
 *
 * Ritorna un numero che cresce a ogni bundle nuovo. Serve solo a far ridisegnare
 * l'albero: le schermate continuano a leggere `matches`, `standings` e gli altri
 * come hanno sempre fatto, e li trovano cambiati.
 *
 * Si riscarica anche al ritorno in primo piano. E il momento in cui serve
 * davvero: un'app di tifosi si riapre il giorno della partita, e quello che si
 * era scaricato la settimana prima non basta piu.
 */
export function useDatiFreschi(): number {
  const [v, setV] = useState(versioneDati);

  useEffect(() => {
    let vivo = true;
    const sveglia = () => { if (vivo) setV((n) => n + 1); };
    ascoltatori.add(sveglia);

    void (async () => {
      await dalCassetto();
      await scarica();
    })();

    const sub = AppState.addEventListener('change', (stato) => {
      if (stato === 'active') void scarica();
    });

    return () => {
      vivo = false;
      ascoltatori.delete(sveglia);
      sub.remove();
    };
  }, []);

  return v;
}

/**
 * Fa ridisegnare chi mostra i dati quando arriva un bundle nuovo.
 *
 * PERCHE' NON BASTA IL LAYOUT RADICE
 *
 * `useDatiFreschi()` alza uno stato nel layout radice, e la prima versione si
 * fidava che il ridisegno scendesse fino alle schermate. Non e' garantito: i
 * navigatori memorizzano le scene apposta per non ridisegnare tutto a ogni
 * cambio del genitore. Il risultato sarebbe stato il peggiore da diagnosticare:
 * i dati scaricati e applicati davvero, la schermata davanti agli occhi ferma
 * a prima, e la differenza visibile solo uscendo e rientrando.
 *
 * Con la sottoscrizione diretta non conta piu' cosa fa il navigatore.
 *
 * Sta dentro `Screen`, il contenitore comune di tutte le schermate, quindi
 * nessuna puo dimenticarsene.
 */
export function useDati(): number {
  return useSyncExternalStore(
    (f) => {
      ascoltatori.add(f);
      return () => { ascoltatori.delete(f); };
    },
    () => versioneDati,
    () => versioneDati,
  );
}
