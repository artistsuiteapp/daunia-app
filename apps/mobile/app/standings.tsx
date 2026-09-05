import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, ListGroup, ListRow, GroupNote, useGutter } from '../components/ui';
import { Crest } from '../components/Crest';
import { colors, space, type } from '../theme/tokens';
import { FOGGIA, meta, standings } from '../lib/data';

const ZONE: Record<string, string> = {
  promotion: colors.zonePromotion,
  playoff: colors.zonePlayoff,
  playout: colors.zonePlayout,
  relegation: colors.zoneRelegation,
};

export default function Standings() {
  const gutter = useGutter();

  return (
    <Screen>
      <View style={[styles.back, gutter]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.accentBright} />
          <Text style={styles.backText}>Indietro</Text>
        </Pressable>
      </View>

      <LargeTitle crest={FOGGIA?.crest ?? null} title="Classifica" subtitle={`${meta.competition} girone C · ${meta.season.replace('-', '/')}`} />

      <View style={[styles.head, gutter]}>
        <Text style={[styles.h, styles.cPos]}>#</Text>
        <Text style={[styles.h, styles.cName]}>Squadra</Text>
        <Text style={[styles.h, styles.cNum]}>G</Text>
        <Text style={[styles.h, styles.cNum]}>V</Text>
        <Text style={[styles.h, styles.cNum]}>N</Text>
        <Text style={[styles.h, styles.cNum]}>P</Text>
        <Text style={[styles.h, styles.cDiff]}>DR</Text>
        <Text style={[styles.h, styles.cPts]}>Pt</Text>
      </View>

      <View style={gutter}>
        <ListGroup>
          {standings.map((r) => (
            <ListRow key={r.teamId} height={46}>
              <View style={[styles.zone, { backgroundColor: r.zone ? ZONE[r.zone] : 'transparent' }]} />
              <Text style={[styles.cell, styles.cPos, r.isFoggia && styles.own]}>{r.position}</Text>
              <View style={styles.nameCell}>
                <Crest uri={r.crest} name={r.teamName} size={20} />
                <Text style={[styles.name, r.isFoggia && styles.ownName]} numberOfLines={1}>
                  {r.teamName}
                  {r.penalty ? <Text style={styles.penalty}> {r.penalty}</Text> : null}
                </Text>
              </View>
              <Text style={[styles.cell, styles.cNum, styles.dim]}>{r.played}</Text>
              <Text style={[styles.cell, styles.cNum, styles.dim]}>{r.won}</Text>
              <Text style={[styles.cell, styles.cNum, styles.dim]}>{r.drawn}</Text>
              <Text style={[styles.cell, styles.cNum, styles.dim]}>{r.lost}</Text>
              <Text style={[styles.cell, styles.cDiff, styles.dim]}>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</Text>
              <Text style={[styles.ptsCell, r.isFoggia && styles.own]}>{r.points}</Text>
            </ListRow>
          ))}
        </ListGroup>
      </View>

      <View style={[styles.legend, gutter]}>
        {[['promotion', 'Promozione'], ['playoff', 'Playoff'], ['playout', 'Playout'], ['relegation', 'Retrocessione']].map(([k, l]) => (
          <View key={k} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: ZONE[k] }]} />
            <Text style={styles.legendText}>{l}</Text>
          </View>
        ))}
      </View>

      <GroupNote>Classifica da Wikipedia. Le penalizzazioni sono indicate accanto al nome.</GroupNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: space.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: -6 },
  backText: { ...type.body, color: colors.accentBright },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg + 16, paddingBottom: space.sm },
  h: { ...type.caption, color: colors.textFaint },

  cell: { ...type.subhead, color: colors.text },
  dim: { color: colors.textDim },
  cPos: { width: 20, textAlign: 'center' },
  cName: { flex: 1, paddingLeft: 26 },
  nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 },
  name: { ...type.subhead, color: colors.text, flex: 1 },
  ownName: { ...type.subheadBold, color: colors.accentBright },
  penalty: { ...type.caption, color: colors.loss },
  cNum: { width: 18, textAlign: 'center' },
  cDiff: { width: 26, textAlign: 'center' },
  cPts: { width: 26, textAlign: 'right' },
  ptsCell: { ...type.headline, color: colors.text, width: 26, textAlign: 'right' },
  own: { color: colors.accentBright },
  zone: { width: 3, height: 22, borderRadius: 2, marginLeft: -6 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...type.caption, color: colors.textFaint },
});
