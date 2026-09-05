import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, type } from '../theme/tokens';
import { useGutter } from './ui';

/** Barra di ritorno in stile iOS: freccia e testo, non un bottone tondo. */
export function BackBar({ label = 'Indietro' }: { label?: string }) {
  const gutter = useGutter();
  return (
    <View style={[styles.wrap, gutter]}>
      <Pressable onPress={() => router.back()} hitSlop={12} style={styles.btn}>
        <Ionicons name="chevron-back" size={22} color={colors.accentBright} />
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: space.sm },
  btn: { flexDirection: 'row', alignItems: 'center', marginLeft: -6 },
  text: { ...type.body, color: colors.accentBright },
});
