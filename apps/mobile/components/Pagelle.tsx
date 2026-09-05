import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Player } from '@satanelli/core';

import { Avatar } from './Avatar';
import { colors, radius, space, type } from '../theme/tokens';
import { medieVere, myRating, myRatingCount, rate, ratingOf, useFanplay } from '../lib/fanplay';

const VOTES = [4, 5, 6, 7, 8, 9, 10];

const tint = (avg: number) =>
  avg >= 7 ? colors.win : avg >= 6 ? colors.zonePlayoff : avg >= 5 ? colors.zonePlayout : colors.loss;

/**
 * Le pagelle della Curva: voto da 4 a 10 per ciascuno, e accanto la media di
 * tutti. E il rito piu radicato attorno al calcio italiano, e costa poco.
 *
 * Le medie mostrate sono di esempio e lo dicono: con gli account veri restano
 * solo i voti delle persone.
 */
export function Pagelle({ matchId, players }: { matchId: string; players: Player[] }) {
  useFanplay();
  const given = myRatingCount(matchId);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={styles.headText}>
          {given === 0
            ? 'Dai il tuo voto: si aggiunge alla media.'
            : `Hai votato ${given} ${given === 1 ? 'giocatore' : 'giocatori'}.`}
        </Text>
        {!medieVere(matchId) ? (
          <View style={styles.sampleTag}><Text style={styles.sampleText}>medie di esempio</Text></View>
        ) : null}
      </View>

      {players.map((p) => {
        const { avg, votes, mine } = ratingOf(matchId, p.id);
        return (
          <View key={p.id} style={styles.row}>
            <View style={styles.who}>
              <Avatar uri={null} name={p.shortName} number={p.number} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{p.shortName}</Text>
                <Text style={styles.votes}>{votes} voti</Text>
              </View>
              <View style={[styles.avg, { borderColor: tint(avg) }]}>
                <Text style={[styles.avgText, { color: tint(avg) }]}>{avg.toFixed(1)}</Text>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scale}>
              {VOTES.map((v) => {
                const on = mine === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => rate(matchId, p.id, v)}
                    style={[styles.vote, on && styles.voteOn]}
                  >
                    <Text style={[styles.voteText, on && styles.voteTextOn]}>{v}</Text>
                  </Pressable>
                );
              })}
              {myRating(matchId, p.id) != null ? (
                <View style={styles.done}><Ionicons name="checkmark" size={13} color={colors.win} /></View>
              ) : null}
            </ScrollView>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  headText: { ...type.caption, color: colors.textDim, flex: 1 },
  sampleTag: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  sampleText: { ...type.captionBold, fontSize: 9, color: colors.textDim },

  row: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.06)',
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { ...type.subheadBold, color: colors.text },
  votes: { ...type.caption, color: colors.textFaint },
  avg: {
    minWidth: 46, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center',
  },
  avgText: { ...type.numberSm, fontSize: 17 },

  scale: { gap: 6, alignItems: 'center' },
  vote: {
    width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  voteOn: { backgroundColor: colors.accent },
  voteText: { ...type.footnoteBold, color: colors.textDim },
  voteTextOn: { color: colors.onAccent },
  done: { width: 26, alignItems: 'center' },
});
