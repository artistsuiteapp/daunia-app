import { useMemo } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { GroupLabel, useGutter } from './ui';
import { lineupPerPartita } from '../lib/lineup';
import { medieVere, ratingOf, useDatiPartita } from '../lib/fanplay';
import { colors, radius, space, type } from '../theme/tokens';
import type { Match } from '@satanelli/core';

/**
 * Le pagelle della Curva, in home, il giorno dopo.
 *
 * La sera si vota a caldo e il giorno dopo si vuole sapere com'e finita: non
 * il proprio voto, quello che pensa la Curva. Per questo sta in home e non
 * dentro la scheda partita -- dove bisognerebbe andarlo a cercare sapendo
 * gia che esiste.
 *
 * Compare solo con voti veri. Le medie di esempio servono a far vedere come
 * funziona dentro la scheda; in home sarebbero una bugia in prima pagina.
 */
export function PagelleInHome({ match }: { match: Match }) {
  const gutter = useGutter();
  useDatiPartita(match.id, true);

  const formazione = useMemo(
    () => lineupPerPartita(match.kickoff ? match.kickoff.slice(0, 10) : undefined, match.id),
    [match.kickoff, match.id],
  );

  const classifica = useMemo(() => {
    const giocatori = formazione.slots
      .map((s) => s.player)
      .filter((p): p is NonNullable<typeof p> => !!p);
    return giocatori
      .map((p) => ({ p, ...ratingOf(match.id, p.id) }))
      .filter((x) => x.votes > 0)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 3);
  }, [formazione, match.id]);

  if (!medieVere(match.id) || !classifica.length) return null;

  const quanti = Math.max(...classifica.map((x) => x.votes));

  return (
    <>
      <GroupLabel>Le pagelle della Curva</GroupLabel>
      <Pressable
        onPress={() => router.push(`/match/${match.id}?tab=gioco` as never)}
        style={({ pressed }) => [gutter, pressed && { opacity: 0.8 }]}
      >
        <View style={styles.scatola}>
          {classifica.map((x, i) => (
            <View key={x.p.id} style={[styles.riga, i > 0 && styles.rigaSopra]}>
              <Text style={styles.posto}>{i + 1}</Text>
              <Text style={styles.nome} numberOfLines={1}>{x.p.shortName ?? x.p.name}</Text>
              <Text style={styles.voto}>{x.avg.toFixed(1)}</Text>
            </View>
          ))}
          <View style={styles.piede}>
            <Text style={styles.quanti}>
              media su {quanti} {quanti === 1 ? 'voto' : 'voti'} · {match.home.shortName}–{match.away.shortName}
            </Text>
            <Ionicons name="chevron-forward" size={15} color={colors.textDim} />
          </View>
        </View>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  scatola: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: space.lg, paddingVertical: space.sm,
  },
  riga: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 10 },
  rigaSopra: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)' },
  posto: { ...type.captionBold, color: colors.textDim, width: 14 },
  nome: { ...type.subhead, color: colors.text, flex: 1 },
  voto: { ...type.subheadBold, color: colors.accentBright },
  piede: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.06)',
    paddingTop: 10, paddingBottom: 4,
  },
  quanti: { ...type.caption, color: colors.textDim, flex: 1 },
});
