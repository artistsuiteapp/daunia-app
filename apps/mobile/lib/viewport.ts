import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';

/**
 * Misure che su iPhone non arrivano da sole.
 *
 * Le zone sicure e l'altezza della tastiera vivono nel CSS del browser, non
 * nell'albero di React: qui si leggono le variabili impostate in +html.tsx e si
 * restituiscono come numeri, cosi le schermate le usano come qualsiasi altra
 * misura. Su iOS e Android nativi non serve niente di tutto questo e i valori
 * arrivano dalle interfacce di sistema.
 */

const isWeb = Platform.OS === 'web';

function cssPx(name: string): number {
  if (!isWeb || typeof window === 'undefined') return 0;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name);
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Zone sicure affidabili.
 *
 * Sul web react-native-safe-area-context puo restituire zero prima di aver
 * misurato, e in quel momento la testata finisce sotto l'orologio. Si prende il
 * valore piu alto fra quello della libreria e quello letto da env().
 */
export function useSafeInsets(): EdgeInsets {
  const lib = useSafeAreaInsets();
  const [css, setCss] = useState({ top: 0, bottom: 0, left: 0, right: 0 });

  useEffect(() => {
    if (!isWeb) return;
    const read = () => setCss({
      top: cssPx('--sat'),
      bottom: cssPx('--sab'),
      left: cssPx('--sal'),
      right: cssPx('--sar'),
    });
    read();
    window.addEventListener('appviewport', read);
    window.addEventListener('orientationchange', read);
    return () => {
      window.removeEventListener('appviewport', read);
      window.removeEventListener('orientationchange', read);
    };
  }, []);

  if (!isWeb) return lib;
  return {
    top: Math.max(lib.top, css.top),
    bottom: Math.max(lib.bottom, css.bottom),
    left: Math.max(lib.left, css.left),
    right: Math.max(lib.right, css.right),
  };
}

/**
 * Altezza coperta dalla tastiera, in punti. Zero quando e chiusa.
 *
 * Su iOS la finestra non si accorcia all'apertura della tastiera: si accorcia la
 * parte visibile. Senza questo numero la barra delle schede e il campo di
 * scrittura restano sotto i tasti.
 */
export function useKeyboardInset(): number {
  const [kb, setKb] = useState(0);

  useEffect(() => {
    if (!isWeb) return;
    const read = () => setKb(cssPx('--kb'));
    read();
    window.addEventListener('appviewport', read);
    return () => window.removeEventListener('appviewport', read);
  }, []);

  return isWeb ? kb : 0;
}

/** true quando la tastiera copre una fetta consistente dello schermo. */
export function useKeyboardOpen(): boolean {
  return useKeyboardInset() > 80;
}
