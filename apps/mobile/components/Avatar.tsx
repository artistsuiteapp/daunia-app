import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '../theme/tokens';
import { avatarTone, initials } from '../lib/format';
import { ritratto } from '../lib/media';

type Props = { uri: string | null; name: string; number?: number | null; size?: number };

/**
 * La faccia di qualcuno: un giocatore o una persona iscritta.
 *
 * Chi non ha immagine prende le iniziali su una tinta ricavata dal nome, invece
 * di un buco grigio. Vale per quasi tutta la rosa, che di foto nostre non ne ha.
 *
 * L'avatar caricato da chi usa l'app passa sempre: sta sul nostro archivio e ce
 * l'ha messo lei. Le foto prese da siti altrui no -- vedi lib/media.ts.
 */
export function Avatar({ uri, name, number, size = 64 }: Props) {
  const src = ritratto(uri);
  if (src) {
    return (
      <Image
        source={{ uri: src }}
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
