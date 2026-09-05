import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme/tokens';
import { hueFrom, initials } from '../lib/format';

type Props = { uri: string | null; name: string; size?: number };

/**
 * Stemma della squadra. Quattro squadre del girone non hanno stemma sul sito del
 * club: per quelle si disegna un monogramma, che e anche la scelta legalmente
 * pulita visto che i loghi altrui non sono ridistribuibili.
 */
export function Crest({ uri, name, size = 40 }: Props) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={180}
        accessibilityLabel={`Stemma ${name}`}
      />
    );
  }
  return (
    <View
      style={[styles.fallback, { width: size, height: size, borderRadius: size / 4, backgroundColor: hueFrom(name) }]}
      accessibilityLabel={`Stemma ${name} non disponibile`}
    >
      <Text style={[styles.initials, { fontSize: size * 0.36 }]}>{initials(name)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { ...type.captionBold, color: colors.text },
});
