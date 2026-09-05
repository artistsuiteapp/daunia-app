import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen, LargeTitle, GroupLabel, useGutter } from '../../components/ui';
import { Avatar } from '../../components/Avatar';
import { colors, radius, space, type } from '../../theme/tokens';
import { useLayout } from '../../theme/responsive';
import {FOGGIA, squad, squadByRole, staff } from '../../lib/data';

export default function Squad() {
  const groups = squadByRole();
  const gutter = useGutter();
  const { columns } = useLayout();
  const cellWidth = `${100 / columns - 2}%` as const satisfies `${number}%`;

  return (
    <Screen>
      <LargeTitle
crest={FOGGIA?.crest ?? null}         title="Rosa"
        subtitle={`${squad.length} giocatori${staff.length ? ` · ${staff[0].name}` : ''}`}
      />

      {groups.map((g) => (
        <View key={g.role}>
          <GroupLabel>{g.label}</GroupLabel>
          <View style={[styles.grid, gutter]}>
            {g.players.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/player/${p.id}` as never)}
                style={({ pressed }) => [styles.cellLink, { width: cellWidth }, pressed && { opacity: 0.6 }]}
              >
                <View style={styles.cell}>
                  <Avatar uri={p.photo} name={p.name} size={64} />
                  <View style={styles.numberRow}>
                    <Text style={styles.number}>{p.number ?? '–'}</Text>
                    {p.nationality ? <Text style={styles.nat}>{p.nationality}</Text> : null}
                  </View>
                  <Text style={styles.name} numberOfLines={1}>{p.shortName}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cellLink: {},
  cell: {
    alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: space.lg, paddingHorizontal: space.sm,
  },
  numberRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  number: { ...type.numberSm, color: colors.accentBright },
  nat: { ...type.caption, color: colors.textFaint },
  name: { ...type.footnote, color: colors.text, textAlign: 'center' },
});
