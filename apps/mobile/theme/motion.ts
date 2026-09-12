import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, LayoutAnimation, Platform, UIManager } from 'react-native';

/**
 * Il movimento dell'app, in un posto solo.
 *
 * PERCHE UN FILE
 *
 * Prima ogni componente si sceglieva la sua durata: 220 nella barra, 420 nelle
 * entrate, 620 nella testata, 900 nel respiro della fiamma. Nessuno di quei
 * numeri era sbagliato da solo, ma messi insieme facevano un'app che si muove
 * a scatti diversi a seconda di dove guardi — ed e esattamente la sensazione di
 * "macchinoso" che si prova usandola.
 *
 * LE TRE REGOLE
 *
 * 1. Chi entra rallenta alla fine (ease-out), chi esce accelera (ease-in). Il
 *    lineare sembra un meccanismo, non un movimento.
 * 2. Piu una cosa e grande, piu ci mette. Un tasto che si schiaccia e un lampo;
 *    una schermata che entra puo prendersi un quarto di secondo.
 * 3. Chi ha chiesto meno movimento nelle impostazioni del telefono lo ottiene.
 *    Non e un vezzo: a chi soffre di vertigini un'interfaccia che scivola da
 *    tutte le parti fa stare male davvero.
 */

export const durata = {
  /** il tasto sotto il dito */
  lampo: 120,
  /** una pastiglia che cambia stato, un colore che passa */
  corta: 180,
  /** una schermata che entra, un blocco che si apre */
  media: 260,
  /** un'entrata a cascata, un numero che sale */
  lunga: 420,
} as const;

export const curva = {
  /** entra: parte veloce e si posa */
  entra: Easing.out(Easing.cubic),
  /** esce: si stacca piano e sparisce in fretta */
  esce: Easing.in(Easing.cubic),
  /** avanti e indietro, come un respiro */
  morbida: Easing.inOut(Easing.quad),
} as const;

/** Le molle: la stessa mano su tutti i tasti dell'app. */
export const molla = {
  tasto: { speed: 40, bounciness: 0 },
  ritorno: { speed: 40, bounciness: 10 },
  timbro: { speed: 14, bounciness: 7 },
} as const;

/* ------------------------------------------------------------ meno movimento */

let ridotto = false;
const ascoltatori = new Set<() => void>();

function imposta(v: boolean) {
  if (v === ridotto) return;
  ridotto = v;
  for (const f of ascoltatori) f();
}

if (Platform.OS === 'web') {
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    imposta(mq.matches);
    // addListener e deprecato ma e l'unico che hanno i Safari vecchi
    if (mq.addEventListener) mq.addEventListener('change', (e) => imposta(e.matches));
    else mq.addListener?.((e) => imposta(e.matches));
  }
} else {
  void AccessibilityInfo.isReduceMotionEnabled().then(imposta);
  AccessibilityInfo.addEventListener('reduceMotionChanged', imposta);
}

/** Fuori da React: per decidere dentro un'animazione gia partita. */
export function menoMovimento(): boolean {
  return ridotto;
}

export function useMenoMovimento(): boolean {
  const [v, setV] = useState(ridotto);
  useEffect(() => {
    const l = () => setV(ridotto);
    ascoltatori.add(l);
    l();
    return () => { ascoltatori.delete(l); };
  }, []);
  return v;
}

/** Durata da usare davvero: zero quando e stato chiesto meno movimento. */
export function quanto(ms: number): number {
  return ridotto ? 0 : ms;
}

/* ------------------------------------------------- cambi di forma automatici */

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * Fa scivolare il prossimo cambio di layout invece di farlo saltare.
 *
 * Si chiama PRIMA di cambiare lo stato: una riga che compare, un blocco che si
 * apre, una lista che si accorcia. Senza, la lista salta da un'altezza
 * all'altra in un fotogramma e sembra che l'app si sia inceppata.
 */
export function transizione(ms = durata.corta) {
  if (ridotto) return;
  LayoutAnimation.configureNext({
    duration: ms,
    create: { type: 'easeInEaseOut', property: 'opacity' },
    update: { type: 'easeInEaseOut' },
    delete: { type: 'easeInEaseOut', property: 'opacity' },
  });
}
