import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@satanelli/core';

import { Crest } from './Crest';
import { colors, radius, space, type } from '../theme/tokens';
import {
  clearPrediction, leaderboard, myPrediction, myPredictionTotals, predict, useFanplay,
} from '../lib/fanplay';
import { playedMatches } from '../lib/data';
import { useOspite } from '../lib/ospite';
import { SoloConAccount } from './SoloConAccount';

const RANGE = [0, 1, 2, 3, 4];

/**
 * Pronostico di giornata.
 *
 * Tre punti il risultato esatto, uno l'esito. Nessuna quota, nessun premio in
 * denaro: e una classifica fra tifosi. Con premi o quote sarebbe gioco a
 * distanza e servirebbe una concessione ADM, che e tutto un altro mestiere.
 */
export function Pronostico({ match }: { match: Match }) {
  useFanplay();
  const ospite = useOspite();
  const guess = myPrediction(match.id);
  const totals = myPredictionTotals(playedMatches());
  const table = leaderboard(totals.points, totals.exact);

  const set = (home: number, away: number) => predict(match.id, home, away);

  return (
    <View style={styles.wrap}>
      {ospite ? <SoloConAccount cosa="Per giocare il pronostico ed entrare in classifica serve un account." /> : null}

      <View style={styles.card}>
        <Text style={styles.label}>IL TUO PRONOSTICO</Text>

        <View style={styles.board}>
          <Side team={match.home} value={guess?.[0] ?? null} onPick={(v) => !ospite && set(v, guess?.[1] ?? 0)} />
          <Text style={styles.colon}>:</Text>
          <Side team={match.away} value={guess?.[1] ?? null} onPick={(v) => !ospite && set(guess?.[0] ?? 0, v)} />
        </View>

        {guess ? (
          <View style={styles.confirmed}>
            <Ionicons name="checkmark-circle" size={15} color={colors.win} />
            <Text style={styles.confirmedText}>
              Hai detto {guess[0]}–{guess[1]}. Tre punti se prendi il risultato esatto, uno se
              indovini solo come finisce: vittoria, pareggio o sconfitta.
            </Text>
            <Pressable onPress={() => clearPrediction(match.id)} hitSlop={8}>
              <Text style={styles.undo}>Cambia</Text>
            </Pressable>
          </View>
        ) : (
          <Text style={styles.hint}>Tocca i numeri per scegliere il risultato.</Text>
        )}
      </View>

      <View style={styles.tableHead}>
        <Text style={styles.tableTitle}>CLASSIFICA DELLA STAGIONE</Text>
        <View style={styles.sampleTag}><Text style={styles.sampleText}>esempio</Text></View>
      </View>

      <View style={styles.table}>
        {table.map((row, i) => (
          <View key={row.name} style={[styles.tableRow, !row.sample && styles.tableRowMine]}>
            <Text style={[styles.pos, !row.sample && styles.mineText]}>{i + 1}</Text>
            <Text style={[styles.player, !row.sample && styles.mineText]} numberOfLines={1}>{row.name}</Text>
            <Text style={styles.exact}>{row.exact} esatti</Text>
            <Text style={[styles.points, !row.sample && styles.mineText]}>{row.points}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.note}>
        Nessuna quota e nessun premio: si gioca solo per la classifica.
      </Text>
    </View>
  );
}

function Side({ team, value, onPick }: {
  team: Match['home']; value: number | null; onPick: (v: number) => void;
}) {
  return (
    <View style={styles.side}>
      <Crest uri={team.crest} name={team.shortName} size={34} />
      <Text style={styles.team} numberOfLines={1}>{team.shortName}</Text>
      <View style={styles.picker}>
        {RANGE.map((v) => {
          const on = value === v;
          return (
            <Pressable key={v} onPress={() => onPick(v)} style={[styles.pick, on && styles.pickOn]}>
              <Text style={[styles.pickText, on && styles.pickTextOn]}>{v}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
  },
  label: { ...type.groupLabel, color: colors.textDim },
  board: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  side: { flex: 1, alignItems: 'center', gap: 6 },
  team: { ...type.footnoteBold, color: colors.text },
  colon: { ...type.title2, color: colors.textFaint, marginTop: 12 },
  picker: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
  pick: {
    width: 30, height: 30, borderRadius: radius.md, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  pickOn: { backgroundColor: colors.accent },
  pickText: { ...type.footnoteBold, color: colors.textDim },
  pickTextOn: { color: colors.onAccent },

  hint: { ...type.caption, color: colors.textFaint, textAlign: 'center' },
  confirmed: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  confirmedText: { ...type.caption, color: colors.textDim, flex: 1, lineHeight: 17 },
  undo: { ...type.captionBold, color: colors.accentBright },

  tableHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tableTitle: { ...type.groupLabel, color: colors.textDim, flex: 1 },
  sampleTag: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  sampleText: { ...type.captionBold, fontSize: 9, color: colors.textDim },

  table: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingHorizontal: space.md, paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator,
  },
  tableRowMine: { backgroundColor: colors.accentSoft },
  pos: { ...type.footnote, color: colors.textFaint, width: 18 },
  player: { ...type.subhead, color: colors.text, flex: 1 },
  exact: { ...type.caption, color: colors.textFaint },
  points: { ...type.headline, color: colors.text, width: 28, textAlign: 'right' },
  mineText: { color: colors.accentBright },

  note: { ...type.caption, color: colors.textFaint },
});
