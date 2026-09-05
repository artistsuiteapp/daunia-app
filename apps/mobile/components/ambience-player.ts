import { useEffect, useRef } from 'react';
import { Asset } from 'expo-asset';

/**
 * Riproduttore del sottofondo sul web.
 *
 * expo-audio sul browser non emetteva suono: nessun elemento audio nel DOM e
 * nessun contesto Web Audio creato, verificato intercettando il costruttore.
 * Qui si usa direttamente un elemento Audio del browser, che e prevedibile e
 * si puo controllare. Su iPhone e Android vale la versione .native.
 */
export function useAmbiencePlayer(mod: number | null) {
  const ref = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (mod == null) return;
    const el = new Audio(Asset.fromModule(mod).uri);
    el.loop = true;
    el.volume = 0.55;
    el.preload = 'auto';
    // agganciato al documento: alcuni browser trattano meglio un elemento
    // presente nella pagina, ed e l'unico modo per poterlo ispezionare
    el.setAttribute('data-ambience', 'zaccheria');
    el.style.display = 'none';
    document.body.appendChild(el);
    ref.current = el;
    return () => {
      el.pause();
      el.remove();
      ref.current = null;
    };
  }, [mod]);

  return {
    /** true se il browser ha lasciato partire il suono, false se lo ha bloccato */
    play: async () => {
      try {
        await ref.current?.play();
        return true;
      } catch {
        return false;
      }
    },
    pause: () => { ref.current?.pause(); },
  };
}
