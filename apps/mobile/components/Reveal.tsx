import { ReactNode, useEffect, useRef } from 'react';
import { Animated, type StyleProp, type ViewStyle } from 'react-native';

import { curva, durata, menoMovimento } from '../theme/motion';

/**
 * Entrata a cascata dei blocchi: leggera salita e dissolvenza.
 * Il ritardo crescente fa leggere la pagina dall'alto verso il basso invece di
 * farla comparire tutta insieme.
 *
 * Il ritardo ha un tetto: oltre mezzo secondo di attesa un blocco non "entra
 * dopo", sembra arrivato in ritardo. Su una lista lunga i ritardi crescenti
 * lasciavano l'ultima riga vuota per due secondi buoni.
 */
const RITARDO_MASSIMO = 500;

export function Reveal({ children, delay = 0, distance = 14, style }: {
  children: ReactNode; delay?: number; distance?: number; style?: StyleProp<ViewStyle>;
}) {
  const t = useRef(new Animated.Value(menoMovimento() ? 1 : 0)).current;

  useEffect(() => {
    if (menoMovimento()) { t.setValue(1); return; }
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: durata.lunga,
      delay: Math.min(delay, RITARDO_MASSIMO),
      easing: curva.entra,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
