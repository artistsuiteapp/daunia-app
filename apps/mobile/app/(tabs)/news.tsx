import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen, LargeTitle, ListGroup, ListRow, GroupLabel, useGutter } from '../../components/ui';
import { colors, radius, space, type } from '../../theme/tokens';
import { relative } from '../../lib/format';
import {FOGGIA, news } from '../../lib/data';
import { remote } from '../../lib/media';

export default function News() {
  const gutter = useGutter();
  const leadIndex = Math.max(0, news.findIndex((n) => n.image));
  const lead = news[leadIndex];
  const rest = news.filter((_, i) => i !== leadIndex);

  return (
    <Screen>
      <LargeTitle crest={FOGGIA?.crest ?? null} title="Notizie" subtitle="Comunicati ufficiali e approfondimenti" />

      {lead ? (
        <View style={gutter}>
          <Pressable
            onPress={() => router.push(`/post/${lead.slug}` as never)}
            style={({ pressed }) => [styles.lead, pressed && { opacity: 0.85 }]}
          >
            {lead.image ? <Image source={{ uri: remote(lead.image)! }} style={styles.leadImg} contentFit="cover" transition={220} /> : null}
            <View style={styles.leadBody}>
              <Text style={styles.kicker}>{lead.kind === 'club' ? 'Ufficiale' : 'Redazione'}</Text>
              <Text style={styles.leadTitle} numberOfLines={3}>{lead.title}</Text>
              <Text style={styles.excerpt} numberOfLines={2}>{lead.excerpt}</Text>
              <Text style={styles.meta}>{relative(lead.date)}</Text>
            </View>
          </Pressable>
        </View>
      ) : null}

      <GroupLabel>Archivio</GroupLabel>
      <View style={gutter}>
        <ListGroup>
          {rest.map((n) => (
            <ListRow key={n.id} onPress={() => router.push(`/post/${n.slug}` as never)} chevron height={68}>
              {remote(n.image) ? (
                <Image source={{ uri: remote(n.image)! }} style={styles.thumb} contentFit="cover" transition={160} />
              ) : (
                <View style={[styles.thumb, styles.thumbEmpty]} />
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle} numberOfLines={2}>{n.title}</Text>
                <Text style={styles.meta}>{relative(n.date)}</Text>
              </View>
            </ListRow>
          ))}
        </ListGroup>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  leadImg: { width: '100%', height: 200, backgroundColor: colors.surfaceHi },
  leadBody: { padding: space.lg, gap: 5 },
  kicker: { ...type.footnoteBold, color: colors.accentBright },
  leadTitle: { ...type.title2, color: colors.text },
  excerpt: { ...type.subhead, color: colors.textDim },
  meta: { ...type.caption, color: colors.textFaint },

  thumb: { width: 60, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceHi },
  thumbEmpty: {},
  rowTitle: { ...type.subhead, color: colors.text },
});
