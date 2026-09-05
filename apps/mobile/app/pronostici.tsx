import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, GroupLabel, GroupNote, Empty, useGutter } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Crest } from '../components/Crest';
import { PredictionCallout } from '../components/PredictionCallout';
import { colors, radius, space, type } from '../theme/tokens';
import { shortDate } from '../lib/format';
import { FOGGIA, leagueMatches, nextMatch } from '../lib/data';
import {
  leaderboard, myPrediction, myPredictionTotals, scorePrediction, useFanplay,
} from '../lib/fanplay';

/**
 * Classifica dei pronostici e storico delle giornate.
 *
 * Sta in una schermata sua e non dentro la scheda partita, perche la classifica
 * di stagione si guarda anche quando non c'e una gara da pronosticare: e quello
 * che riporta le persone nell'app fra una domenica e l'altra.
 */
export default function Pronostici() {
  const gutter = useGutter();
  useFanplay();

  const played = leagueMatches();
  const totals = myPredictionTotals(played);
  const table = leaderboard(totals.points, totals.exact);
  const myRank = table.findIndex((r) => !r.sample) + 1;
  const next = nextMatch();
  const giocati = played.filter((m) => myPrediction(m.id)).length;

  return (
    <Screen>
      <BackBar label="Home" />
      <LargeTitle
        crest={FOGGIA?.crest ?? null}
        title="Pronostici"
        subtitle="Chi ne azzecca di più"
      />

      <View style={[styles.summary, gutter]}>
        <Stat label="Posizione" value={myRank ? `${myRank}°` : '-'} />
        <View style={styles.sep} />
        <Stat label="Punti" value={String(totals.points)} />
        <View style={styles.sep} />
        <Stat label="Esatti" value={String(totals.exact)} />
        <View style={styles.sep} />
        <Stat label="Giocati" value={`${giocati}/${played.length}`} />
      </View>

      {next ? (
        <View style={[gutter, { marginTop: space.lg }]}>
          <View style={styles.nextCard}>
            <View style={styles.nextHead}>
              <Crest uri={next.home.crest} name={next.home.shortName} size={26} />
              <Text style={styles.nextText} numberOfLines={1}>
                {next.home.shortName} – {next.away.shortName}
              </Text>
              <Crest uri={next.away.crest} name={next.away.shortName} size={26} />
            </View>
            <Text style={styles.nextWhen}>{shortDate(next.kickoff)}</Text>
            <PredictionCallout matchId={next.id} />
          </View>
        </View>
      ) : null}

      <GroupLabel action={<Text style={styles.sampleTag}>esempio</Text>}>
        Classifica della stagione
      </GroupLabel>
      <View style={[styles.table, gutter]}>
        {table.map((row, i) => (
          <View key={row.name} style={[styles.row, !row.sample && styles.rowMine, i > 0 && styles.rowLine]}>
            <Text style={[styles.pos, !row.sample && styles.mineText]}>{i + 1}</Text>
            <Text style={[styles.name, !row.sample && styles.mineText]} numberOfLines={1}>{row.name}</Text>
            <Text style={styles.exact}>{row.exact} esatti</Text>
            <Text style={[styles.points, !row.sample && styles.mineText]}>{row.points}</Text>
          </View>
        ))}
      </View>

      <GroupLabel>Le tue giornate</GroupLabel>
      {played.length === 0 ? (
        <Empty text="Nessuna partita di campionato ancora giocata." />
      ) : (
        <View style={[styles.history, gutter]}>
          {played.map((m) => {
            const guess = myPrediction(m.id);
            const pts = guess && m.score ? scorePrediction(guess, m.score) : null;
            return (
              <Pressable
                key={m.id}
                onPress={() => router.push(`/match/${m.id}` as never)}
                style={({ pressed }) => [styles.hRow, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.hDay}>{m.matchday ? `${m.matchday}ª` : '—'}</Text>
                <Text style={styles.hTeams} numberOfLines={1}>
                  {m.home.shortName} – {m.away.shortName}
                </Text>
                <Text style={styles.hReal}>{m.score ? `${m.score.home}–${m.score.away}` : '–'}</Text>
                <Text style={[styles.hGuess, !guess && styles.hMissing]}>
                  {guess ? `${guess[0]}–${guess[1]}` : 'non giocata'}
                </Text>
                <View style={[styles.hPts, pts === 3 && styles.hPts3, pts === 1 && styles.hPts1]}>
                  <Text style={[styles.hPtsText, pts ? styles.hPtsOn : null]}>{pts ?? 0}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}

      <GroupNote>
        Tre punti il risultato esatto, uno se azzecchi solo chi vince. Nessuna quota e nessun
        premio: si gioca per la classifica. I pronostici restano su questo dispositivo finché
        non ci sono gli account, e la classifica qui sopra è di esempio.
      </GroupNote>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingVertical: space.md, paddingHorizontal: space.lg, marginTop: space.sm,
  },
  stat: { alignItems: 'center', gap: 1, flex: 1 },
  statValue: { ...type.number, fontSize: 22, color: colors.text },
  statLabel: { ...type.caption, fontSize: 11, color: colors.textFaint },
  sep: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.separator },

  nextCard: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
  },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  nextText: { ...type.headline, color: colors.text, flex: 1, textAlign: 'center' },
  nextWhen: { ...type.caption, color: colors.textFaint, textAlign: 'center' },

  sampleTag: { ...type.captionBold, fontSize: 10, color: colors.textFaint },

  table: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 11 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  rowMine: { backgroundColor: colors.accentSoft },
  pos: { ...type.footnote, color: colors.textFaint, width: 18 },
  name: { ...type.subhead, color: colors.text, flex: 1 },
  exact: { ...type.caption, color: colors.textFaint },
  points: { ...type.headline, color: colors.text, width: 28, textAlign: 'right' },
  mineText: { color: colors.accentBright },

  history: { gap: 2 },
  hRow: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 10,
  },
  hDay: { ...type.caption, color: colors.textFaint, width: 24 },
  hTeams: { ...type.subhead, color: colors.text, flex: 1 },
  hReal: { ...type.subheadBold, color: colors.text, width: 40, textAlign: 'center' },
  hGuess: { ...type.caption, color: colors.textDim, width: 66, textAlign: 'right' },
  hMissing: { color: colors.textFaint },
  hPts: {
    width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceHi,
    alignItems: 'center', justifyContent: 'center',
  },
  hPts1: { backgroundColor: 'rgba(10,132,255,0.24)' },
  hPts3: { backgroundColor: 'rgba(48,209,88,0.24)' },
  hPtsText: { ...type.captionBold, color: colors.textFaint },
  hPtsOn: { color: colors.text },
});
