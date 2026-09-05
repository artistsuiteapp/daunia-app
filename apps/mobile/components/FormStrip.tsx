import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme/tokens';

const LOOK = {
  W: { bg: colors.win, fg: '#04150A', label: 'V' },
  D: { bg: colors.draw, fg: '#0A0A0A', label: 'N' },
  L: { bg: colors.loss, fg: '#FFFFFF', label: 'P' },
} as const;

/** Ultimi risultati, dal piu vecchio al piu recente. */
export function FormStrip({ form, size = 20 }: { form: Array<'W' | 'D' | 'L'>; size?: number }) {
  if (!form.length) return null;
  return (
    <View style={styles.row} accessibilityLabel={`Ultimi risultati: ${form.map((f) => LOOK[f].label).join(' ')}`}>
      {form.map((f, i) => (
        <View
          key={`${f}-${i}`}
          style={[styles.pip, { width: size, height: size, borderRadius: size / 2, backgroundColor: LOOK[f].bg }]}
        >
          <Text style={[styles.label, { fontSize: size * 0.52, color: LOOK[f].fg }]}>{LOOK[f].label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4 },
  pip: { alignItems: 'center', justifyContent: 'center' },
  label: { ...type.captionBold },
});
