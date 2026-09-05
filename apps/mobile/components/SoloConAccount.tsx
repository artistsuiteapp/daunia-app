import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';

/**
 * Invito all'iscrizione mostrato dove un ospite non puo agire.
 *
 * Dice sempre cosa si sblocca in quel punto preciso, non "accedi per continuare":
 * un messaggio generico si legge come un ostacolo, uno che nomina la cosa che
 * stavi per fare si legge come un'offerta.
 */
export function SoloConAccount({ cosa, compatto = false }: { cosa: string; compatto?: boolean }) {
  return (
    <View style={[styles.wrap, compatto && styles.compatto]}>
      <Ionicons name="lock-closed-outline" size={compatto ? 15 : 18} color={colors.accentBright} />
      <Text style={[styles.testo, compatto && styles.testoCompatto]}>{cosa}</Text>
      <Pressable
        onPress={() => router.push('/accedi?modo=registrazione' as never)}
        style={({ pressed }) => [styles.bottone, pressed && { opacity: 0.85 }]}
      >
        <Text style={styles.bottoneTesto}>Iscriviti</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.accentSoft, borderRadius: radius.lg, padding: space.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(238,17,17,0.35)',
  },
  compatto: { padding: space.sm },
  testo: { ...type.footnote, color: colors.text, flex: 1, lineHeight: 18 },
  testoCompatto: { ...type.caption },
  bottone: { backgroundColor: colors.accent, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 7 },
  bottoneTesto: { ...type.captionBold, color: colors.onAccent },
});
