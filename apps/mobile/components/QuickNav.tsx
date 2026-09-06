import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme/tokens';
import { useLayout } from '../theme/responsive';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; href: string };

const ITEMS: Item[] = [
  { icon: 'car-sport', label: 'Trasferte', href: '/trasferte' },
  { icon: 'ticket', label: 'Biglietti', href: '/tickets' },
  { icon: 'trophy', label: 'Pronostici', href: '/pronostici' },
  { icon: 'stats-chart', label: 'Statistiche', href: '/stats' },
  { icon: 'list', label: 'Classifica', href: '/standings' },
  { icon: 'location', label: 'Stadio', href: '/stadium' },
];

/**
 * Scorciatoie come pastiglie con icona a sinistra ed etichetta accanto, nella
 * forma dei filtri della reference. La prima e in rosso pieno.
 *
 * Al primo posto ci sono le trasferte e non i biglietti. Il motivo: i biglietti
 * sono un link che manda fuori dall'app, le trasferte rispondono a una domanda
 * che i tifosi si fanno davvero e a cui nessun altro risponde.
 */
export function QuickNav() {
  const { gutter } = useLayout();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingHorizontal: space.lg + gutter }]}
    >
      {ITEMS.map((it, i) => (
        <Pressable
          key={it.label}
          onPress={() => router.push(it.href as never)}
          style={({ pressed }) => [styles.chip, i === 0 && styles.chipLead, pressed && { opacity: 0.7 }]}
        >
          <Ionicons
            name={it.icon}
            size={17}
            color={i === 0 ? colors.onAccent : colors.accentBright}
          />
          <Text style={[styles.label, i === 0 && styles.labelLead]} numberOfLines={1}>{it.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
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
