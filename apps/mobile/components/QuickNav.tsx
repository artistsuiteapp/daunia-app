import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme/tokens';
import { useLayout } from '../theme/responsive';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; href: string; pulsa?: boolean };

const ITEMS: Item[] = [
  { icon: 'game-controller', label: 'Match Center', href: '/match-center' },
  { icon: 'shirt', label: 'Rosa', href: '/squad' },
  { icon: 'ticket', label: 'Biglietti', href: '/tickets' },
  { icon: 'podium', label: 'Classifiche', href: '/classifica' },
  { icon: 'stats-chart', label: 'Statistiche', href: '/stats' },
];

/**
 * Scorciatoie come pastiglie con icona a sinistra ed etichetta accanto, nella
 * forma dei filtri della reference. La prima e in rosso pieno perche i biglietti
 * sono la voce che porta soldi al club.
 *
 * Qui stanno le cose che si guardano ogni tanto: quelle di tutti i giorni sono
 * nella barra in fondo.
 */
/**
 * Le scorciatoie.
 *
 * `pagelle` prende il primo posto -- quello rosso pieno -- appena la partita
 * finisce, e pulsa. E l'unico momento in cui vale piu dei biglietti: i voti si
 * danno a caldo o non si danno piu, mentre un biglietto lo si compra anche
 * domani. Passata la finestra, torna tutto com'era.
 */
export function QuickNav({ pagelle }: { pagelle?: string | null } = {}) {
  const { gutter } = useLayout();
  const voci: Item[] = pagelle
    ? [{ icon: 'star', label: 'Pagelle', href: pagelle, pulsa: true },
       ...ITEMS.filter((x) => x.label !== 'Match Center')]
    : ITEMS;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingHorizontal: space.lg + gutter }]}
    >
      {voci.map((it, i) => (
        <Pastiglia key={it.label} item={it} prima={i === 0} />
      ))}
    </ScrollView>
  );
}

/**
 * Una pastiglia. Se `pulsa`, respira piano invece di lampeggiare.
 *
 * Un lampeggio secco su un elemento grande come questo e fastidioso dopo
 * cinque secondi; un respiro lento si nota lo stesso e non stanca.
 */
function Pastiglia({ item, prima }: { item: Item; prima: boolean }) {
  const v = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!item.pulsa) return;
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.45, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [item.pulsa, v]);

  return (
    <Animated.View style={item.pulsa ? { opacity: v } : undefined}>
      <Pressable
        onPress={() => router.push(item.href as never)}
        style={({ pressed }) => [styles.chip, prima && styles.chipLead, pressed && { opacity: 0.7 }]}
      >
        <Ionicons name={item.icon} size={17} color={prima ? colors.onAccent : colors.accentBright} />
        <Text style={[styles.label, prima && styles.labelLead]} numberOfLines={1}>{item.label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: { gap: space.sm, paddingVertical: space.sm },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 7,
    paddingHorizontal: space.lg, paddingVertical: 10, borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipLead: { backgroundColor: colors.accent, borderColor: 'transparent' },
  label: { ...type.subheadBold, color: colors.text },
  labelLead: { color: colors.onAccent },
});
