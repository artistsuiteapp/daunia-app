import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme/tokens';
import { avatarTone, initials } from '../lib/format';

type Props = { uri: string | null; name: string; number?: number | null; size?: number };

/**
 * Ritratto del giocatore. La fototeca del club e ferma alla stagione scorsa,
 * quindi quasi tutta la rosa attuale non ha immagine: il segnaposto mostra le
 * iniziali su una tinta della gamma del club invece di un buco grigio.
 */
export function Avatar({ uri, name, number, size = 64 }: Props) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surfaceHi }}
        contentFit="cover"
        transition={180}
        accessibilityLabel={name}
      />
    );
  }
  return (
    <View
      style={[styles.fallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarTone(name) }]}
      accessibilityLabel={name}
    >
      <Text style={[styles.text, { fontSize: size * (number != null ? 0.36 : 0.3) }]}>
        {number != null ? number : initials(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
  text: { ...type.headline, color: colors.text },
});
