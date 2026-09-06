import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, type } from '../theme/tokens';

/**
 * Il pallino verde che lampeggia: dice che sta succedendo adesso.
 *
 * Lampeggia piano, un battito ogni secondo e mezzo. Piu veloce diventa un
 * allarme e stanca; piu lento non si nota. Il verde e l'unico posto dell'app
 * dove non c'e il rosso del Foggia, ed e voluto: qui non e identita, e stato.
 */
export function PallinoLive({ etichetta = 'LIVE CHAT', compatto = false }: {
  etichetta?: string; compatto?: boolean;
}) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(p, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [p]);

  return (
    <View style={[styles.riga, compatto && styles.rigaCompatta]}>
      <View style={styles.pallino}>
        <Animated.View
          style={[
            styles.alone,
            {
              opacity: p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
              transform: [{ scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
            },
          ]}
        />
        <View style={styles.nucleo} />
      </View>
      <Text style={[styles.testo, compatto && styles.testoCompatto]}>{etichetta}</Text>
    </View>
  );
}

const VERDE = '#32D74B';

const styles = StyleSheet.create({
  riga: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    backgroundColor: 'rgba(50,215,75,0.14)',
    borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5,
  },
  rigaCompatta: { paddingHorizontal: 8, paddingVertical: 3, gap: 5 },
  pallino: { width: 8, height: 8, alignItems: 'center', justifyContent: 'center' },
  alone: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: VERDE },
  nucleo: { width: 8, height: 8, borderRadius: 4, backgroundColor: VERDE },
  testo: { ...type.captionBold, color: VERDE, letterSpacing: 0.6 },
  testoCompatto: { fontSize: 10 },
});
