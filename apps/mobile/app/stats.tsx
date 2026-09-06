import { StyleSheet, Text, View } from 'react-native';

import {
  Screen, LargeTitle, ListGroup, ListRow, GroupLabel, GroupNote, Card, BigStat, useGutter,
} from '../components/ui';
import { BackBar } from '../components/BackBar';
import { CompareBar, GoalWindows, PositionChart, Ring } from '../components/charts';
import { FormStrip } from '../components/FormStrip';
import { colors, space, type } from '../theme/tokens';
import { thousands } from '../lib/format';
import { FOGGIA, foggiaRow, meta, playedTrend, recentForm, seasonRecord, standings, stats } from '../lib/data';

export default function Stats() {
  const gutter = useGutter();
  const rec = seasonRecord();
  const d = stats.derived;
  const row = foggiaRow();
  const played = playedTrend();

  return (
    <Screen testaFissa>
      <BackBar />
      <LargeTitle crest={FOGGIA?.crest ?? null} title="Statistiche" subtitle={`${meta.competition} e coppa · ${meta.season.replace('-', '/')}`} />

      <View style={gutter}>
        <Card style={styles.hero}>
          <Ring value={rec.winRate} caption="vittorie" size={112} />
          <View style={styles.heroStats}>
            <BigStat label="Giocate" value={rec.games} />
            <BigStat label="Punti" value={row?.points ?? '-'} sub={row ? `${row.position}° posto` : undefined} />
            <View style={{ gap: 5 }}>
              <Text style={styles.miniLabel}>ANDAMENTO</Text>
              <FormStrip form={recentForm()} size={18} />
            </View>
          </View>
        </Card>
      </View>

      <GroupLabel>Casa contro trasferta</GroupLabel>
      <View style={gutter}>
        <Card style={styles.block}>
          <View style={styles.splitHead}>
            <Text style={styles.splitSide}>Allo Zaccheria</Text>
            <Text style={styles.splitSide}>In trasferta</Text>
          </View>
          <CompareBar label="vittorie" left={rec.home.won} right={rec.away.won} />
          <CompareBar label="pareggi" left={rec.home.drawn} right={rec.away.drawn} />
          <CompareBar label="sconfitte" left={rec.home.lost} right={rec.away.lost} />
          <CompareBar label="gol fatti" left={rec.home.goalsFor} right={rec.away.goalsFor} />
          <CompareBar label="gol subiti" left={rec.home.goalsAgainst} right={rec.away.goalsAgainst} />
        </Card>
      </View>

      <GroupLabel>Rendimento</GroupLabel>
      <View style={[styles.grid, gutter]}>
        <Card style={styles.tile}><BigStat label="Gol fatti" value={d.goalsFor} sub={`${d.avgGoalsFor} a partita`} /></Card>
        <Card style={styles.tile}><BigStat label="Gol subiti" value={d.goalsAgainst} sub={`${d.avgGoalsAgainst} a partita`} /></Card>
        <Card style={styles.tile}><BigStat label="Porta inviolata" value={d.cleanSheets} sub={`su ${d.played} partite`} /></Card>
        <Card style={styles.tile}><BigStat label="Senza segnare" value={d.failedToScore} sub={`su ${d.played} partite`} /></Card>
      </View>

      <GroupLabel>Quando si segna</GroupLabel>
      <View style={gutter}>
        <Card style={styles.block}>
          <View style={styles.legend}>
            <Legend color={colors.accent} label="segnati" />
            <Legend color={colors.textFaint} label="subiti" />
          </View>
          <GoalWindows windows={d.byWindow} />
        </Card>
      </View>

      <GroupLabel>Posizione giornata per giornata</GroupLabel>
      <View style={gutter}>
        <Card style={styles.block}>
          <PositionChart points={stats.trend} teams={standings.length || 20} />
          {d.bestPosition ? (
            <View style={styles.posRow}>
              <BigStat label="Migliore" value={`${d.bestPosition}°`} />
              <BigStat label="Peggiore" value={`${d.worstPosition}°`} />
              <BigStat label="Giornate" value={played.length} sub={`su ${stats.trend.length}`} />
            </View>
          ) : null}
        </Card>
      </View>

      {d.scorers.length ? (
        <>
          <GroupLabel>Marcatori</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              {d.scorers.map((s, i) => (
                <ListRow key={s.name} height={44} right={<Text style={styles.goals}>{s.goals}</Text>}>
                  <Text style={styles.pos}>{i + 1}</Text>
                  <Text style={styles.scorer}>{s.name}</Text>
                </ListRow>
              ))}
            </ListGroup>
          </View>
        </>
      ) : null}

      <GroupLabel>Per competizione</GroupLabel>
      <View style={gutter}>
        <ListGroup>
          {stats.competitions.map((c) => {
            const g = c.home.won + c.home.drawn + c.home.lost + c.away.won + c.away.drawn + c.away.lost;
            return (
              <ListRow
                key={c.competition}
                height={56}
                right={
                  <Text style={styles.compValue}>
                    {c.home.won + c.away.won}-{c.home.drawn + c.away.drawn}-{c.home.lost + c.away.lost}
                  </Text>
                }
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.compName}>{c.competition}</Text>
                  <Text style={styles.compSub}>
                    {g} {g === 1 ? 'partita' : 'partite'} · {c.home.goalsFor + c.away.goalsFor}:{c.home.goalsAgainst + c.away.goalsAgainst}
                  </Text>
                </View>
              </ListRow>
            );
          })}
        </ListGroup>
      </View>

      {d.homeAttendanceAvg != null ? (
        <>
          <GroupLabel>Pubblico</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              <ListRow right={
                <Text style={styles.compValue}>
                  {d.homeAttendanceAvg === 0 ? 'porte chiuse' : thousands(d.homeAttendanceAvg)}
                </Text>
              }>
                <Text style={styles.scorer}>Spettatori medi in casa</Text>
              </ListRow>
            </ListGroup>
          </View>
        </>
      ) : null}

      <GroupNote>
        Statistiche di squadra e andamento da Wikipedia. Medie, porte inviolate, fasce di minuti e
        marcatori sono calcolati dalle partite in archivio.
      </GroupNote>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.xl, padding: space.lg },
  heroStats: { flex: 1, gap: space.md },
  miniLabel: { ...type.caption, color: colors.textFaint },

  block: { padding: space.lg },
  splitHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.md },
  splitSide: { ...type.footnote, color: colors.textDim },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { flexGrow: 1, flexBasis: '46%', padding: space.md },

  legend: { flexDirection: 'row', gap: space.lg, marginBottom: space.md },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...type.caption, color: colors.textFaint },

  posRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },

  pos: { ...type.footnote, color: colors.textFaint, width: 18 },
  scorer: { ...type.subhead, color: colors.text, flex: 1 },
  goals: { ...type.headline, color: colors.accentBright },

  compName: { ...type.subhead, color: colors.text },
  compSub: { ...type.caption, color: colors.textFaint },
  compValue: { ...type.subheadBold, color: colors.text },
});
