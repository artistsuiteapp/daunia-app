import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, ListGroup, ListRow, GroupNote, useGutter } from '../components/ui';
import { Crest } from '../components/Crest';
import { colors, space, type } from '../theme/tokens';
import { FOGGIA, meta, standings } from '../lib/data';
import { useDati } from '../lib/bundle-remoto';

const ZONA_NOME: Record<string, string> = {
  promotion: 'promozione', playoff: 'playoff', playout: 'playout', relegation: 'retrocessione',
};

const ZONE: Record<string, string> = {
  promotion: colors.zonePromotion,
  playoff: colors.zonePlayoff,
  playout: colors.zonePlayout,
  relegation: colors.zoneRelegation,
};

export default function Standings() {
  useDati();
  const gutter = useGutter();
  // le partite giocate valgono per tutte le squadre: stanno nel sottotitolo, non in una colonna
  const giornate = Math.max(0, ...standings.map((r) => r.played));

  return (
    <Screen>
      <View style={[styles.back, gutter]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.accentBright} />
          <Text style={styles.backText}>Indietro</Text>
        </Pressable>
      </View>

      <LargeTitle
        crest={FOGGIA?.crest ?? null}
        title="Classifica"
        subtitle={`${meta.competition} girone C · ${giornate ? `dopo ${giornate} ${giornate === 1 ? 'giornata' : 'giornate'}` : meta.season.replace('-', '/')}`}
      />

      <View style={[styles.head, gutter]}>
        <Text style={[styles.h, styles.cPos]}>#</Text>
        <Text style={[styles.h, styles.cName]}>Squadra</Text>
        <Text style={[styles.h, styles.cDiff]}>Diff.</Text>
        <Text style={[styles.h, styles.cPts]}>Punti</Text>
      </View>

      <View style={gutter}>
        <ListGroup>
          {standings.map((r) => (
            <View
              key={r.teamId}
              accessible
              accessibilityLabel={`${r.position}°, ${r.teamName}, ${r.points} punti, ${r.played} giocate, ${r.won} vinte, ${r.drawn} pareggiate, ${r.lost} perse${r.zone ? `, zona ${ZONA_NOME[r.zone]}` : ''}`}
            >
            <ListRow height={60}>
              <View style={[styles.zone, { backgroundColor: r.zone ? ZONE[r.zone] : 'transparent' }]} />
              <Text style={[styles.cell, styles.cPos, r.isFoggia && styles.own]}>{r.position}</Text>
              <View style={styles.nameCell}>
                <Crest uri={r.crest} name={r.teamName} size={24} />
                <View style={{ flex: 1 }}>
                  {/* il nome va a capo invece di finire in "Sorre..." */}
                  <Text style={[styles.name, r.isFoggia && styles.ownName]} numberOfLines={2}>
                    {r.teamName}
                    {r.penalty ? <Text style={styles.penalty}> {r.penalty}</Text> : null}
                  </Text>
                  <Text style={styles.vnp} numberOfLines={1}>{r.won}V {r.drawn}N {r.lost}P</Text>
                </View>
              </View>
              <Text style={[styles.cell, styles.cDiff, styles.dim]}>{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</Text>
              <Text style={[styles.ptsCell, r.isFoggia && styles.own]}>{r.points}</Text>
            </ListRow>
            </View>
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

      <GroupNote>
        V vinte, N pareggiate, P perse. Diff. e la differenza fra gol fatti e subiti. Le penalizzazioni
        sono indicate accanto al nome. Classifica da Wikipedia.
      </GroupNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingTop: space.sm },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginLeft: -6 },
  backText: { ...type.body, color: colors.accentBright },

  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg + 16, paddingBottom: space.sm },
  h: { ...type.footnote, color: colors.textDim },

  cell: { ...type.subhead, color: colors.text },
  dim: { color: colors.textDim },
  cPos: { width: 26, textAlign: 'center' },
  cName: { flex: 1, paddingLeft: 32 },
  nameCell: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  name: { ...type.subhead, color: colors.text },
  vnp: { ...type.caption, color: colors.textDim },
  ownName: { ...type.subheadBold, color: colors.accentBright },
  penalty: { ...type.footnoteBold, color: colors.loss },
  cDiff: { width: 40, textAlign: 'center' },
  cPts: { width: 48, textAlign: 'right' },
  ptsCell: { ...type.headline, color: colors.text, width: 48, textAlign: 'right' },
  own: { color: colors.accentBright },
  zone: { width: 4, height: 30, borderRadius: 2, marginLeft: -6 },

  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, marginTop: space.lg },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6 },
  legendText: { ...type.footnote, color: colors.textDim },
});
