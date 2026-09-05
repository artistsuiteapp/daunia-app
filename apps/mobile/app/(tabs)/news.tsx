import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen, LargeTitle, ListGroup, ListRow, GroupLabel, useGutter } from '../../components/ui';
import { colors, radius, space, type } from '../../theme/tokens';
import { relative } from '../../lib/format';
import { coverOf } from '../../lib/editorial';
import { ArticleCover } from '../../components/ArticleCover';
import {FOGGIA, news } from '../../lib/data';
import { photo } from '../../lib/media';

export default function News() {
  const gutter = useGutter();
  const leadIndex = Math.max(0, news.findIndex((n) => n.image));
  const lead = news[leadIndex];
  const rest = news.filter((_, i) => i !== leadIndex);

  return (
    <Screen>
      <LargeTitle crest={FOGGIA?.crest ?? null} title="Notizie" subtitle="Scritte dalla nostra redazione" />

      {lead ? (
        <View style={gutter}>
          <Pressable
            onPress={() => router.push(`/post/${lead.slug}` as never)}
            style={({ pressed }) => [styles.lead, pressed && { opacity: 0.85 }]}
          >
            {coverOf(lead.slug) ? <ArticleCover cover={coverOf(lead.slug)!} height={190} /> : null}
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
              {coverOf(n.slug) ? (
                <View style={styles.thumb}><ArticleCover cover={coverOf(n.slug)!} height={44} compact /></View>
              ) : null}
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

  thumb: { width: 64, height: 44, overflow: 'hidden', borderRadius: radius.sm, backgroundColor: colors.surfaceHi },
  rowTitle: { ...type.subhead, color: colors.text },
});
