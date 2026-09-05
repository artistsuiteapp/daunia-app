import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';
import { initials } from '../lib/format';

/**
 * Riga di benvenuto in cima alla home: chi sta usando l'app a sinistra,
 * stemma del club e campanello a destra. Lo stemma fa una piccola pulsazione
 * all'apertura, giusto per dare vita alla pagina senza distrarre.
 */
export function Greeting({ name, crest, onBell }: {
  name: string; crest: string | null; onBell?: () => void;
}) {
  const beat = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(280),
      Animated.timing(beat, { toValue: 1, duration: 320, easing: Easing.out(Easing.back(2)), useNativeDriver: true }),
      Animated.timing(beat, { toValue: 0, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [beat]);

  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const hour = new Date().getHours();
  const salute = hour < 12 ? 'Buongiorno' : hour < 18 ? 'Buon pomeriggio' : 'Buonasera';

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials(name)}</Text>
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.salute}>{salute}</Text>
        <Text style={styles.name} numberOfLines={1}>{name}</Text>
      </View>



      <Pressable onPress={onBell} hitSlop={10} style={styles.bell}>
        <Ionicons name="notifications-outline" size={20} color={colors.text} />
        <View style={styles.dot} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatar: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { ...type.subheadBold, color: colors.text },
  salute: { ...type.footnote, color: colors.textDim },
  name: { ...type.title3, color: colors.text },
  crest: { width: 36, height: 36 },
  bell: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  dot: {
    position: 'absolute', top: 9, right: 10,
    width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentBright,
    borderWidth: 1.5, borderColor: colors.surfaceHi,
  },
});
