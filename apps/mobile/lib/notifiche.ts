/**
 * Notifiche push, via web push.
 *
 * PERCHE COSI E NON CON LE NOTIFICHE NATIVE
 *
 * Con un Apple ID gratuito l'entitlement APNs non viene concesso: un'app
 * firmata da un "Personal Team" e installata con AltStore non puo ricevere
 * notifiche, e la firma fallisce se l'entitlement resta nel progetto. Servirebbe
 * l'account sviluppatore a 99 euro l'anno.
 *
 * La PWA invece le riceve gratis: iOS le supporta dalla 16.4 per le app
 * aggiunte alla schermata Home. Su Android bastano il permesso e il service
 * worker, senza aggiungerla a niente.
 *
 * IL VINCOLO DI IOS CHE VA SPIEGATO, NON NASCOSTO
 *
 * In Safari, con l'app solo aperta in una scheda, `PushManager` non esiste
 * proprio. Non e un errore da gestire: e la condizione normale finche l'utente
 * non aggiunge l'app alla Home. Per questo `statoNotifiche()` distingue "non si
 * puo" da "va aggiunta alla Home": sono due messaggi diversi e solo uno dei due
 * dice all'utente cosa fare.
 *
 * Il permesso si chiede da un gesto, mai all'avvio. Su iOS un permesso negato
 * non si puo piu richiedere: bruciarlo con un popup automatico chiude la porta
 * per sempre.
 */
import { Platform } from 'react-native';

import { supabase } from './supabase';

const CHIAVE_PUBBLICA = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY?.trim();

export type Preferenze = {
  formazioni: boolean;
  inizio: boolean;
  gol: boolean;
  espulsione: boolean;
  fine: boolean;
};

export const PREFERENZE_INIZIALI: Preferenze = {
  formazioni: true, inizio: true, gol: true, espulsione: true, fine: true,
};

export const ETICHETTE: Record<keyof Preferenze, string> = {
  formazioni: 'Formazioni ufficiali',
  inizio: 'Inizio partita',
  gol: 'Gol',
  espulsione: 'Espulsioni',
  fine: 'Fine partita',
};

export type Stato =
  | { modo: 'attive'; preferenze: Preferenze }
  /** il telefono e pronto ma il server non ha registrato l'iscrizione */
  | { modo: 'attive-non-salvate'; preferenze: Preferenze; motivo: string }
  | { modo: 'spente' }
  | { modo: 'negato' }
  | { modo: 'aggiungi-alla-home' }
  | { modo: 'non-supportate' };

const web = () => Platform.OS === 'web' && typeof window !== 'undefined';

/** Vero se l'app gira come applicazione a se, non dentro una scheda del browser. */
export function autonoma(): boolean {
  if (!web()) return false;
  const iosStandalone = (window.navigator as { standalone?: boolean }).standalone === true;
  return iosStandalone || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

/** Vero se siamo su un iPhone o un iPad. */
function apple(): boolean {
  if (!web()) return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua)
    || (ua.includes('Macintosh') && 'ontouchend' in window);
}

/** La chiave pubblica VAPID in byte, come la vuole il browser. */
function chiaveInByte(base64url: string): Uint8Array {
  const riempita = base64url.replace(/-/g, '+').replace(/_/g, '/')
    + '='.repeat((4 - (base64url.length % 4)) % 4);
  const grezza = window.atob(riempita);
  const out = new Uint8Array(grezza.length);
  for (let i = 0; i < grezza.length; i++) out[i] = grezza.charCodeAt(i);
  return out;
}

function inBase64(buf: ArrayBuffer | null): string {
  if (!buf) return '';
  const b = new Uint8Array(buf);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return window.btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function registrazione(): Promise<ServiceWorkerRegistration | null> {
  if (!web() || !('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js');
  } catch {
    return null;
  }
}

/**
 * Dove siamo messi adesso.
 *
 * L'ordine dei controlli conta: su iPhone in Safari il push non esiste, ma la
 * risposta giusta non e "non supportate", e "aggiungila alla Home". Dirlo al
 * contrario fa rinunciare una persona che invece poteva riceverle.
 */
export async function statoNotifiche(): Promise<Stato> {
  if (!web()) return { modo: 'non-supportate' };

  const push = 'serviceWorker' in navigator && 'PushManager' in window;
  if (!push) {
    return apple() && !autonoma() ? { modo: 'aggiungi-alla-home' } : { modo: 'non-supportate' };
  }
  if (apple() && !autonoma()) return { modo: 'aggiungi-alla-home' };
  if (!CHIAVE_PUBBLICA) return { modo: 'non-supportate' };
  if (Notification.permission === 'denied') return { modo: 'negato' };

  const reg = await registrazione();
  const iscrizione = await reg?.pushManager.getSubscription();
  if (!iscrizione) return { modo: 'spente' };

  return { modo: 'attive', preferenze: await leggiPreferenze(iscrizione.endpoint) };
}

/**
 * Accende le notifiche. Va chiamata da un gesto dell'utente.
 *
 * Restituisce lo stato in cui siamo finiti, cosi la schermata dice cosa e
 * successo invece di restare uguale senza spiegare.
 */
export async function accendi(preferenze: Preferenze = PREFERENZE_INIZIALI): Promise<Stato> {
  const prima = await statoNotifiche();
  if (prima.modo === 'aggiungi-alla-home' || prima.modo === 'non-supportate' || prima.modo === 'negato') {
    return prima;
  }

  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') return { modo: 'negato' };

  const reg = await registrazione();
  if (!reg || !CHIAVE_PUBBLICA) return { modo: 'non-supportate' };

  const iscrizione = await reg.pushManager.getSubscription()
    ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: chiaveInByte(CHIAVE_PUBBLICA) as BufferSource,
    });

  const problema = await salva(iscrizione, preferenze);
  ricorda(iscrizione.endpoint, preferenze);

  /*
   * Se il salvataggio fallisce non si dice "attive".
   *
   * Il browser a quel punto e iscritto davvero, quindi controllare solo lui
   * darebbe una risposta rassicurante e falsa: le notifiche non arriverebbero
   * mai, perche il server non sa a chi mandarle. Questo caso e successo per
   * davvero, con un upsert che la policy rifiutava, e non se ne accorgeva
   * nessuno.
   */
  if (problema) return { modo: 'attive-non-salvate', preferenze, motivo: problema };
  return { modo: 'attive', preferenze };
}

/** Spegne tutto: si disiscrive dal browser e cancella la riga dal database. */
export async function spegni(): Promise<Stato> {
  const reg = await registrazione();
  const iscrizione = await reg?.pushManager.getSubscription();
  if (!iscrizione) return { modo: 'spente' };

  const endpoint = iscrizione.endpoint;
  await iscrizione.unsubscribe();
  if (supabase) await supabase.from('push_iscrizioni').delete().eq('endpoint', endpoint);
  dimentica();
  return { modo: 'spente' };
}

/** Cambia quali notifiche si vogliono ricevere. */
export async function cambiaPreferenze(preferenze: Preferenze): Promise<Preferenze> {
  const reg = await registrazione();
  const iscrizione = await reg?.pushManager.getSubscription();
  if (!iscrizione) return preferenze;

  if (supabase) {
    await supabase.rpc('preferenze_notifiche', {
      p_endpoint: iscrizione.endpoint,
      p_preferenze: preferenze,
    });
  }
  ricorda(iscrizione.endpoint, preferenze);
  return preferenze;
}

/**
 * Registra l'iscrizione sul server. Torna il motivo se non ci riesce.
 *
 * Passa da una funzione e non da un upsert sulla tabella. Un upsert e un
 * INSERT ... ON CONFLICT, e per risolvere il conflitto PostgREST vuole anche il
 * permesso di lettura: sulla tabella la lettura e negata di proposito, perche
 * le chiavi di cifratura di un'iscrizione non devono poter uscire. Con l'upsert
 * l'iscrizione veniva rifiutata dalla policy, e in silenzio.
 */
async function salva(iscrizione: PushSubscription, preferenze: Preferenze): Promise<string | null> {
  if (!supabase) return 'nessun collegamento al server';
  const chiavi = iscrizione.toJSON().keys ?? {};

  const { error } = await supabase.rpc('iscrivi_notifiche', {
    p_endpoint: iscrizione.endpoint,
    p_p256dh: chiavi.p256dh ?? inBase64(iscrizione.getKey('p256dh')),
    p_auth: chiavi.auth ?? inBase64(iscrizione.getKey('auth')),
    p_preferenze: preferenze,
  });
  return error ? error.message : null;
}

/*
 * Le preferenze si tengono anche nel telefono.
 *
 * La riga nel database non si puo rileggere: le chiavi di cifratura di
 * un'iscrizione non devono uscire dal server, quindi la policy di lettura non
 * esiste. Per mostrare gli interruttori nella posizione giusta serve una copia
 * locale, che e l'unico posto dove ha senso tenerla.
 */
const LOCALE = 'daunia.notifiche.v1';

function ricorda(endpoint: string, preferenze: Preferenze) {
  try {
    globalThis.localStorage?.setItem(LOCALE, JSON.stringify({ endpoint, preferenze }));
  } catch { /* niente memoria: si riparte dai valori iniziali */ }
}

function dimentica() {
  try { globalThis.localStorage?.removeItem(LOCALE); } catch { /* pazienza */ }
}

async function leggiPreferenze(endpoint: string): Promise<Preferenze> {
  try {
    const raw = globalThis.localStorage?.getItem(LOCALE);
    if (!raw) return PREFERENZE_INIZIALI;
    const salvato = JSON.parse(raw) as { endpoint: string; preferenze: Preferenze };
    if (salvato.endpoint !== endpoint) return PREFERENZE_INIZIALI;
    return { ...PREFERENZE_INIZIALI, ...salvato.preferenze };
  } catch {
    return PREFERENZE_INIZIALI;
  }
}

/**
 * Notifica di prova, mostrata da questo telefono.
 *
 * Serve a controllare due cose: che il service worker sia vivo e che il
 * telefono non stia silenziando le notifiche di questa app. Non prova che la
 * consegna dal server funzioni: quella parte da fuori e va provata a parte, con
 * una partita vera o con l'invio di prova del guardiano.
 */
export async function provaLocale(): Promise<boolean> {
  const reg = await registrazione();
  if (!reg || Notification.permission !== 'granted') return false;
  await reg.showNotification('Prova riuscita', {
    body: 'Le notifiche su questo telefono funzionano. Domenica saprai del gol da qui.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'prova',
  });
  return true;
}
