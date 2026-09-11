import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';
import { Card, GroupLabel, GroupNote, useGutter } from './ui';
import { useMieiPunti } from '../lib/punti';

/**
 * Punti, livello e badge, sul proprio profilo.
 *
 * I BADGE SI VEDONO ANCHE PRIMA DI PRENDERLI
 *
 * Mostrare solo quelli conquistati fa una bacheca vuota il primo giorno, che
 * non dice niente e non fa venire voglia di niente. Quelli che mancano restano
 * in grigio con scritto cosa serve: e la differenza fra un premio e una
 * sorpresa, e qui serve il premio.
 */
export function MioProfiloGioco() {
  const gutter = useGutter();
  const { punti, badge, livello, prossimo, caricato } = useMieiPunti();

  if (!caricato) return null;

  const presi = badge.filter((b) => b.presoIl).length;

  return (
    <>
      <GroupLabel>Il tuo gioco</GroupLabel>
      <View style={gutter}>
        <Pressable onPress={() => router.push('/classifica' as never)}>
          <Card style={styles.testa}>
            <View style={styles.riga}>
              <View>
                <Text style={styles.punti}>{punti}</Text>
                <Text style={styles.etichetta}>punti · {presi} badge su {badge.length}</Text>
              </View>
              <View style={[styles.livello, { borderColor: livello.colore }]}>
                <Text style={[styles.livelloTesto, { color: livello.colore }]}>{livello.nome}</Text>
              </View>
            </View>
            <Text style={styles.sotto}>
              {prossimo
                ? `Altri ${prossimo.mancano} punti e diventi ${prossimo.livello.nome}.`
                : 'Sei in cima: più su non si va.'}
            </Text>
          </Card>
        </Pressable>
      </View>

      {badge.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.badge, gutter]}>
          {badge.map((b) => (
            <View key={b.codice} style={[styles.gettone, !b.presoIl && styles.spento]}>
              <Ionicons
                name={b.icona as never}
                size={20}
                color={b.presoIl ? colors.accentBright : colors.textFaint}
              />
              <Text style={[styles.gettoneNome, !b.presoIl && styles.gettoneNomeSpento]} numberOfLines={2}>
                {b.nome}
              </Text>
            </View>
          ))}
        </ScrollView>
      ) : null}

      <GroupNote>
        I punti arrivano da pronostici, sondaggi e voti. Li conta il database, uno per uno:
        la stessa azione non paga due volte.
      </GroupNote>
    </>
  );
}

const styles = StyleSheet.create({
  testa: { padding: space.lg, gap: space.xs },
  riga: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  punti: { ...type.displayTitle, color: colors.text },
  etichetta: { ...type.footnote, color: colors.textDim },
  livello: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  livelloTesto: { ...type.captionBold, letterSpacing: 0.3 },
  sotto: { ...type.footnote, color: colors.textDim },

  badge: { gap: space.sm, paddingVertical: space.sm },
  gettone: {
    width: 96, gap: 6, alignItems: 'center', padding: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  spento: { opacity: 0.55 },
  gettoneNome: { ...type.caption, color: colors.text, textAlign: 'center' },
  gettoneNomeSpento: { color: colors.textFaint },
});
