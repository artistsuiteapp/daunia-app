/**
 * Il banner di una testata: il suo marchio, non il nostro.
 *
 * Il logo sta su una piastra chiara quando ha inchiostro scuro, perche su fondo
 * nero sparirebbe. E il marchio di qualcun altro: va reso come l'hanno disegnato,
 * non adattato al nostro tema.
 *
 * Il logo si carica dal loro server, non e copiato qui dentro. Costa una
 * richiesta e li tiene padroni della propria immagine: se lo cambiano, cambia.
 */
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Testata } from '@satanelli/core';

import { colors, radius, space, type } from '../theme/tokens';
import { relative } from '../lib/format';

export function BannerTestata({ testata, quanti, ultimo, onPress }: {
  testata: Testata;
  quanti: number;
  ultimo: string | null;
  onPress: () => void;
}) {
  const chiaro = testata.logoSuChiaro !== false;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${testata.nome}, ${quanti} articoli`}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.plate, chiaro ? styles.plateChiara : styles.plateScura]}>
        {testata.logo ? (
          <Image source={{ uri: testata.logo }} style={styles.logo} contentFit="contain" transition={150} />
        ) : (
          <Text style={[styles.fallback, chiaro && { color: '#111' }]}>{testata.nome}</Text>
        )}
      </View>

      <View style={styles.riga}>
        <Text style={styles.nome}>{testata.nome}</Text>
        <Text style={styles.conta}>
          {quanti} {quanti === 1 ? 'articolo' : 'articoli'}
          {ultimo ? ` · ${relative(ultimo)}` : ''}
        </Text>
      </View>
      {testata.motto ? <Text style={styles.motto}>{testata.motto}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  plate: { height: 84, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  plateChiara: { backgroundColor: '#FFFFFF' },
  plateScura: { backgroundColor: colors.surfaceHi },
  logo: { width: '100%', height: 48 },
  fallback: { ...type.title3, color: colors.text },

  riga: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  nome: { ...type.subheadBold, color: colors.text },
  motto: { ...type.caption, color: colors.textDim, paddingHorizontal: space.lg, paddingBottom: space.md, paddingTop: 2 },
  conta: { ...type.caption, color: colors.textFaint },
});
