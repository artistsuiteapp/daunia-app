import { useEffect } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from './supabase';

/**
 * Contare quante persone usano l'app, e quante tornano.
 *
 * PERCHE NON UNO STRUMENTO GIA PRONTO
 *
 * Plausible, Umami e simili sono script per il web: dentro l'app installata dal
 * telefono non girano. Con l'app che va sugli store fra una settimana, avremmo
 * avuto due conteggi diversi che non tornano mai. In piu ogni pezzo di terzi va
 * dichiarato nelle etichette privacy di Apple e nel Data Safety di Google.
 *
 * COSA ESCE DA QUESTO FILE
 *
 * Un numero casuale che identifica l'installazione, il nome di quello che e
 * successo, e la piattaforma. Nient'altro: non il nome, non l'email, non
 * l'identificativo dell'account. Nella tabella la colonna per collegarli non
 * esiste, quindi non e una promessa ma un fatto.
 *
 * COME SBAGLIA
 *
 * In silenzio, sempre. Un conteggio che fa comparire un errore a chi usa l'app,
 * o che la rallenta mentre salva un pronostico, e peggio del non avere il
 * conteggio: si segna e si va avanti, senza aspettare la risposta.
 */

export type Evento =
  | 'apertura'
  | 'pronostico'
  | 'pagella'
  | 'migliore'
  | 'curva_scritto'
  | 'iscritto'
  | 'condiviso';

const CHIAVE = 'daunia.installazione.v1';
const web = Platform.OS === 'web';

let installazione: string | null = null;
let inCorso: Promise<string> | null = null;

function nuovoId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // ripiego per i browser vecchi: non serve che sia crittograficamente forte,
  // serve solo che due installazioni non si scambino il posto
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = Math.floor(Math.random() * 16);
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

async function leggiId(): Promise<string> {
  if (installazione) return installazione;
  if (inCorso) return inCorso;

  inCorso = (async () => {
    let v: string | null = null;
    try {
      v = web ? globalThis.localStorage?.getItem(CHIAVE) ?? null : await AsyncStorage.getItem(CHIAVE);
    } catch { /* memoria non disponibile: si conta come installazione nuova */ }

    if (!v) {
      v = nuovoId();
      try {
        if (web) globalThis.localStorage?.setItem(CHIAVE, v);
        else await AsyncStorage.setItem(CHIAVE, v);
      } catch { /* pazienza */ }
    }
    installazione = v;
    return v;
  })();

  return inCorso;
}

const piattaforma = (): 'web' | 'ios' | 'android' =>
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';

/** Segna che e successo qualcosa. Non aspetta e non fallisce mai in faccia a nessuno. */
export function registra(evento: Evento, dettaglio?: string | null): void {
  if (!supabase) return;
  void (async () => {
    try {
      const id = await leggiId();
      await supabase!.from('eventi').insert({
        installazione: id,
        evento,
        dettaglio: dettaglio ? dettaglio.slice(0, 60) : null,
        piattaforma: piattaforma(),
      });
    } catch { /* un conteggio perso non e un problema di chi sta usando l'app */ }
  })();
}

/**
 * L'apertura, una volta per avvio.
 *
 * Sta in AppShell, che c'e in ogni schermata. Il contrassegno e in memoria e
 * non su disco: cambiare schermata non conta come una nuova apertura, chiudere
 * e riaprire l'app si.
 */
let apertaSegnata = false;

export function useApertura(): void {
  useEffect(() => {
    if (apertaSegnata) return;
    apertaSegnata = true;
    registra('apertura');
  }, []);
}

/* ------------------------------------------------------------- i numeri */

export type NumeriApp = {
  attiveOggi: number;
  attive7: number;
  attive30: number;
  nuove7: number;
  pronostici7: number;
  pagelle7: number;
  scritti7: number;
  iscritti30: number;
  /** percentuale di chi, dopo aver aperto, ha messo almeno un pronostico */
  attivazione: number;
  /** null finche non c'e ancora nessuno arrivato da abbastanza tempo */
  ritorno7: number | null;
  ritorno30: number | null;
};

export async function caricaNumeri(): Promise<NumeriApp | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc('numeri_app');
  const r = (data as Array<Record<string, unknown>> | null)?.[0];
  if (error || !r) return null;
  const n = (k: string) => Number(r[k] ?? 0);
  const f = (k: string) => (r[k] == null ? null : Number(r[k]));
  return {
    attiveOggi: n('attive_oggi'),
    attive7: n('attive_7'),
    attive30: n('attive_30'),
    nuove7: n('nuove_7'),
    pronostici7: n('pronostici_7'),
    pagelle7: n('pagelle_7'),
    scritti7: n('scritti_7'),
    iscritti30: n('iscritti_30'),
    attivazione: n('attivazione'),
    ritorno7: f('ritorno_7'),
    ritorno30: f('ritorno_30'),
  };
}
