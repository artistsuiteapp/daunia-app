import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Player } from '@satanelli/core';

import { Avatar } from './Avatar';
import { colors, radius, space, type } from '../theme/tokens';
import { medieVere, myRatingCount, rate, ratingOf, useFanplay } from '../lib/fanplay';
import { useOspite } from '../lib/ospite';
import { SoloConAccount } from './SoloConAccount';

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
  const ospite = useOspite();
  const given = myRatingCount(matchId);

  return (
    <View style={styles.wrap}>
      {ospite ? <SoloConAccount cosa="Per dare i voti serve un account. Le medie le vedi lo stesso." /> : null}

      {/* a chi non puo votare non si dice "dai il tuo voto" */}
      {!ospite ? (
        <View style={styles.head}>
          <Text style={styles.headText}>
            {given === 0
              ? 'Tocca un numero da 4 a 10: il tuo voto si aggiunge alla media.'
              : `Hai votato ${given} ${given === 1 ? 'giocatore' : 'giocatori'}.`}
          </Text>
        </View>
      ) : null}

      {players.map((p) => {
        const { avg, votes, mine } = ratingOf(matchId, p.id);
        return (
          <View key={p.id} style={styles.row}>
            <View style={styles.who}>
              <Avatar uri={null} name={p.shortName} number={p.number} size={34} />
              <View style={{ flex: 1 }}>
                <Text style={styles.name} numberOfLines={1}>{p.shortName}</Text>
                <Text style={styles.votes}>
                  {votes === 1 ? '1 voto' : `${votes} voti`}
                  {mine != null ? <Text style={styles.mio}>{`  ·  il tuo voto: ${mine}`}</Text> : null}
                </Text>
              </View>
              <View style={[styles.avg, { borderColor: tint(avg) }]}>
                <Text style={[styles.avgText, { color: tint(avg) }]}>{avg.toFixed(1)}</Text>
              </View>
            </View>

            {!ospite ? (
            <View style={styles.scale}>
              {VOTES.map((v) => {
                const on = mine === v;
                return (
                  <Pressable
                    key={v}
                    onPress={() => rate(matchId, p.id, v)}
                    accessibilityRole="button"
                    accessibilityLabel={`Voto ${v} a ${p.shortName}`}
                    accessibilityState={{ selected: on }}
                    style={[styles.vote, on && styles.voteOn]}
                  >
                    <Text style={[styles.voteText, on && styles.voteTextOn]}>{v}</Text>
                  </Pressable>
                );
              })}
            </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  headText: { ...type.footnote, color: colors.textDim, flex: 1 },
  sampleTag: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  sampleText: { ...type.captionBold, fontSize: 12, lineHeight: 16, color: colors.textDim },

  row: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.06)',
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { ...type.subheadBold, color: colors.text },
  votes: { ...type.footnote, color: colors.textDim },
  mio: { ...type.footnoteBold, color: colors.win },
  avg: {
    minWidth: 46, paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: radius.md, borderWidth: 1.5, alignItems: 'center',
  },
  avgText: { ...type.numberSm, fontSize: 17 },

  // sette numeri su tutta la larghezza, alti 44: erano quadrati da 34 in una fila che scorreva
  scale: { flexDirection: 'row', gap: 5 },
  vote: {
    flex: 1, height: 44, borderRadius: radius.md, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  voteOn: { backgroundColor: colors.accent },
  voteText: { ...type.headline, color: colors.text },
  voteTextOn: { color: colors.onAccent },
});
