import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import {
  Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View,
  useWindowDimensions, type NativeSyntheticEvent, type NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useGutter } from './ui';
import { colors, radius, space, type } from '../theme/tokens';

export type Azione = {
  chiave: string;
  titolo: string;
  sotto: string;
  icona: keyof typeof Ionicons.glyphMap;
  rotta: string;
  /** il pallino verde che pulsa: usato solo per le cose che stanno accadendo */
  vivo?: boolean;
};

const OGNI = 5000;

/**
 * I richiami in cima alla home, uno alla volta.
 *
 * Prima erano riquadri impilati, e ogni cosa nuova ne aggiungeva uno: la home
 * diventava un elenco di avvisi da scorrere. Qui ne sta uno solo alla volta e
 * scorrono da soli, quindi lo spazio non cresce con le funzioni.
 *
 * Scorrono ogni cinque secondi -- il tempo di leggere due righe -- e si
 * fermano appena tocchi: chi ha preso in mano la barra non vuole che gli
 * scappi. Con un richiamo solo non si muove niente e i pallini spariscono.
 *
 * Portano tutti a fare qualcosa, non a leggere: votare, scrivere, dire se ci
 * sei. E il motivo per cui uno riapre l'app invece di guardarla una volta.
 */
export function BanneriAzione({ azioni }: { azioni: Azione[] }) {
  const gutter = useGutter();
  const { width } = useWindowDimensions();
  const lista = useRef<ScrollView>(null);
  const [i, setI] = useState(0);
  const fermo = useRef(false);

  // la larghezza di una scheda: il gutter e a sinistra e a destra
  const larghezza = Math.max(240, width - space.lg * 2 - 8);

  useEffect(() => {
    if (azioni.length < 2) return;
    const t = setInterval(() => {
      if (fermo.current) return;
      setI((p) => {
        const next = (p + 1) % azioni.length;
        lista.current?.scrollTo({ x: next * larghezza, animated: true });
        return next;
      });
    }, OGNI);
    return () => clearInterval(t);
  }, [azioni.length, larghezza]);

  if (!azioni.length) return null;

  const scorso = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setI(Math.round(e.nativeEvent.contentOffset.x / larghezza));
  };

  return (
    <View style={styles.blocco}>
      <ScrollView
        ref={lista}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={larghezza}
        onScrollBeginDrag={() => { fermo.current = true; }}
        onMomentumScrollEnd={scorso}
        contentContainerStyle={{ paddingHorizontal: space.lg + gutter.paddingHorizontal }}
      >
        {azioni.map((a) => (
          <Pressable
            key={a.chiave}
            onPress={() => router.push(a.rotta as never)}
            style={({ pressed }) => [
              styles.scheda, { width: larghezza - space.sm }, pressed && { opacity: 0.85 },
            ]}
          >
            {a.vivo ? <Pallino /> : (
              <Ionicons name={a.icona} size={19} color={colors.accentBright} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.titolo} numberOfLines={1}>{a.titolo}</Text>
              <Text style={styles.sotto} numberOfLines={1}>{a.sotto}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.textDim} />
          </Pressable>
        ))}
      </ScrollView>

      {azioni.length > 1 ? (
        <View style={styles.pallini}>
          {azioni.map((a, k) => (
            <View key={a.chiave} style={[styles.pallinoNav, k === i && styles.pallinoNavAttivo]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** Verde e pulsante: solo per le cose che stanno succedendo adesso. */
function Pallino() {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.3, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [v]);
  return <Animated.View style={[styles.vivo, { opacity: v }]} />;
}

const styles = StyleSheet.create({
  blocco: { marginBottom: space.sm },
  scheda: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    marginRight: space.sm,
    paddingHorizontal: space.lg, paddingVertical: 14,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
  },
  titolo: { ...type.subheadBold, color: colors.text },
  sotto: { ...type.footnote, color: colors.textDim, marginTop: 2 },
  vivo: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#32D74B' },
  pallini: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  pallinoNav: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  pallinoNavAttivo: { backgroundColor: colors.accentBright, width: 16 },
});
