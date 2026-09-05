import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';
import { myPrediction, useFanplay } from '../lib/fanplay';

/**
 * Richiamo al pronostico dentro la scheda della prossima partita.
 *
 * Finche non hai giocato pulsa piano, perche e la cosa che deve saltare
 * all'occhio quando apri l'app prima della partita. Appena il pronostico c'e la
 * pulsazione si ferma: un elemento che lampeggia per sempre diventa rumore, e
 * dopo due giorni non lo vede piu nessuno.
 */
export function PredictionCallout({ matchId, onAccent = false }: {
  matchId: string; onAccent?: boolean;
}) {
  useFanplay();
  const guess = myPrediction(matchId);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (guess) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [guess, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] });
  const glow = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  const go = () => router.push(`/match/${matchId}` as never);

  if (guess) {
    return (
      <Pressable onPress={go} style={({ pressed }) => [styles.done, onAccent && styles.doneOnAccent, pressed && { opacity: 0.85 }]}>
        <Ionicons name="checkmark-circle" size={15} color={onAccent ? '#fff' : colors.win} />
        <Text style={[styles.doneText, onAccent && styles.textOnAccent]}>
          Hai pronosticato {guess[0]}–{guess[1]}
        </Text>
        <Text style={[styles.change, onAccent && styles.textOnAccent]}>cambia</Text>
      </Pressable>
    );
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable onPress={go} style={({ pressed }) => [styles.call, onAccent && styles.callOnAccent, pressed && { opacity: 0.85 }]}>
        <Animated.View style={[styles.dot, onAccent && styles.dotOnAccent, { opacity: glow }]} />
        <Text style={[styles.callText, onAccent && styles.textOnAccent]}>
          Fai il tuo pronostico
        </Text>
        <Ionicons name="chevron-forward" size={15} color={onAccent ? '#fff' : colors.accentBright} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  call: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.accentSoft, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 10,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(238,17,17,0.45)',
  },
  callOnAccent: { backgroundColor: 'rgba(0,0,0,0.26)', borderColor: 'rgba(255,255,255,0.3)' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentBright },
  dotOnAccent: { backgroundColor: '#fff' },
  callText: { ...type.subheadBold, color: colors.accentBright, flex: 1 },
  textOnAccent: { color: '#fff' },

  done: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surfaceHi, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 10,
  },
  doneOnAccent: { backgroundColor: 'rgba(0,0,0,0.26)' },
  doneText: { ...type.subheadBold, color: colors.text, flex: 1 },
  change: { ...type.caption, color: colors.textFaint },
});
