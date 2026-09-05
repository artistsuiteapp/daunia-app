import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';
import { useGutter } from './ui';

/**
 * Testata dello store, presa dalla reference: comando a griglia a sinistra,
 * stemma grande al centro, carrello a destra con il conteggio.
 * Lo stemma sta qui e non in un titolo scritto: e il marchio a dire di chi e il
 * negozio, come nella reference dove al centro c'e il logo e non il nome.
 */
export function ShopTopBar({ crest, count, onGrid, onCart }: {
  crest: string | null; count: number; onGrid?: () => void; onCart?: () => void;
}) {
  const gutter = useGutter();
  return (
    <View style={[styles.bar, gutter]}>
      <Pressable onPress={onGrid} hitSlop={10} style={styles.icon} accessibilityLabel="Categorie">
        <Ionicons name="grid" size={19} color={colors.text} />
      </Pressable>

      {crest ? (
        <Image source={{ uri: crest }} style={styles.crest} contentFit="contain" transition={220} />
      ) : (
        <View style={styles.crest} />
      )}

      <Pressable onPress={onCart} hitSlop={10} style={styles.icon} accessibilityLabel="Carrello">
        <Ionicons name="bag-outline" size={19} color={colors.text} />
        {count > 0 ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: space.md, paddingBottom: space.sm,
  },
  icon: {
    width: 42, height: 42, borderRadius: radius.lg,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
  },
  crest: { width: 62, height: 62 },
  badge: {
    position: 'absolute', top: 4, right: 4,
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: colors.accentBright, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: colors.surface,
  },
  badgeText: { ...type.captionBold, fontSize: 9, lineHeight: 12, color: '#fff' },
});
