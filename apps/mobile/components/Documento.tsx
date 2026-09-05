import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useGutter } from './ui';
import { colors, radius, space, type } from '../theme/tokens';
import type { Blocco } from '../lib/legale';

/** Rende un documento legale. Stessa impaginazione per privacy e condizioni. */
export function Documento({ titolo, blocchi }: { titolo: string; blocchi: Blocco[] }) {
  const gutter = useGutter();
  return (
    <View style={[styles.wrap, gutter]}>
      <Text style={styles.titoloDoc}>{titolo}</Text>
      {blocchi.map((b, i) => {
        if (b.tipo === 'nota') {
          return (
            <View key={i} style={styles.nota}>
              <Ionicons name="information-circle-outline" size={16} color={colors.accentBright} />
              <Text style={styles.notaTesto}>{b.testo}</Text>
            </View>
          );
        }
        if (b.tipo === 'titolo') return <Text key={i} style={styles.titolo}>{b.testo}</Text>;
        if (b.tipo === 'elenco') {
          return (
            <View key={i} style={styles.elenco}>
              {b.voci.map((v, j) => (
                <View key={j} style={styles.voce}>
                  <View style={styles.punto} />
                  <Text style={styles.paragrafo}>{v}</Text>
                </View>
              ))}
            </View>
          );
        }
        return <Text key={i} style={styles.paragrafo}>{b.testo}</Text>;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, marginTop: space.lg, paddingBottom: space.xl },
  titoloDoc: { ...type.displayTitle, color: colors.text, marginBottom: space.sm },
  nota: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(204,17,17,0.10)', borderRadius: radius.lg, padding: space.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(204,17,17,0.35)',
  },
  notaTesto: { ...type.caption, color: colors.textDim, flex: 1, lineHeight: 17 },
  titolo: { ...type.title3, color: colors.text, marginTop: space.lg },
  paragrafo: { ...type.body, color: colors.textDim, lineHeight: 24, flex: 1 },
  elenco: { gap: space.sm },
  voce: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  punto: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accentBright, marginTop: 10 },
});
