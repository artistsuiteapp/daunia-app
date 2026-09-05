import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, useGutter, Empty, FilterChips } from '../../components/ui';
import { Avatar } from '../../components/Avatar';
import { Reveal } from '../../components/Reveal';
import { colors, radius, space, type } from '../../theme/tokens';
import { relative } from '../../lib/format';
import { TOPICS, usePosts, type FanPost, type Topic } from '../../lib/community';

const ALL = 'tutti';

export default function Curva() {
  const gutter = useGutter();
  const posts = usePosts();
  const [topic, setTopic] = useState<string>(ALL);

  const list = useMemo(
    () => (topic === ALL ? posts : posts.filter((p) => p.topic === topic)),
    [posts, topic],
  );
  const mine = posts.filter((p) => !p.sample).length;

  return (
    <Screen>
      <LargeTitle
        title="Curva"
        subtitle="Il blog dei tifosi"
        crest={null}
        action={
          <Pressable
            onPress={() => router.push('/curva/nuovo' as never)}
            style={({ pressed }) => [styles.write, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="create-outline" size={16} color={colors.onAccent} />
            <Text style={styles.writeText}>Scrivi</Text>
          </Pressable>
        }
      />

      {/* Chi guarda deve sapere subito che qui non c'e ancora una comunita.
          Mostrare utenti finti mentre si chiedono donazioni sarebbe far credere
          che esista qualcosa che non esiste. */}
      <View style={[styles.notice, gutter]}>
        <View style={styles.noticeDot} />
        <Text style={styles.noticeText}>
          <Text style={styles.noticeStrong}>Sezione dimostrativa.</Text> I post qui sotto sono
          esempi, scritti per mostrare come funzionerà. Non ci sono ancora account né utenti
          registrati: se scrivi qualcosa resta solo nel tuo browser e non viene inviato da
          nessuna parte.
        </Text>
      </View>

      <FilterChips
        value={topic}
        onChange={setTopic}
        items={[
          { key: ALL, label: 'Tutti', badge: posts.length },
          ...TOPICS.map((t) => ({
            key: t,
            label: t,
            badge: posts.filter((p) => p.topic === t).length,
          })),
        ]}
      />

      {mine > 0 ? (
        <Text style={[styles.mineNote, gutter]}>
          {mine === 1 ? 'Hai scritto 1 post.' : `Hai scritto ${mine} post.`} Resta su questo
          dispositivo.
        </Text>
      ) : null}

      {list.length === 0 ? (
        <Empty text="Nessun post in questa sezione." />
      ) : (
        <View style={[styles.feed, gutter]}>
          {list.map((p, i) => (
            <Reveal key={p.id} delay={40 + i * 40}>
              <PostCard post={p} />
            </Reveal>
          ))}
        </View>
      )}
    </Screen>
  );
}

function PostCard({ post }: { post: FanPost }) {
  return (
    <Pressable
      onPress={() => router.push(`/curva/${post.id}` as never)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.head}>
        <Avatar uri={null} name={post.author} size={38} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author} numberOfLines={1}>{post.author}</Text>
          <Text style={styles.meta}>{relative(post.date)} · {post.topic}</Text>
        </View>
        {post.sample ? (
          <View style={styles.tag}><Text style={styles.tagText}>esempio</Text></View>
        ) : (
          <View style={[styles.tag, styles.tagMine]}><Text style={styles.tagText}>tuo</Text></View>
        )}
      </View>

      <Text style={styles.title} numberOfLines={2}>{post.title}</Text>
      <Text style={styles.excerpt} numberOfLines={3}>{post.excerpt}</Text>

      <View style={styles.foot}>
        <View style={styles.stat}>
          <Ionicons name="heart-outline" size={15} color={colors.textFaint} />
          <Text style={styles.statText}>{post.likes}</Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="chatbubble-outline" size={14} color={colors.textFaint} />
          <Text style={styles.statText}>{post.comments.length}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} style={{ marginLeft: 'auto' }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  write: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 8,
  },
  writeText: { ...type.footnoteBold, color: colors.onAccent },

  notice: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(204,17,17,0.10)', borderRadius: radius.lg,
    padding: space.md, marginTop: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(204,17,17,0.35)',
  },
  noticeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentBright, marginTop: 5 },
  noticeText: { ...type.caption, color: colors.textDim, flex: 1, lineHeight: 17 },
  noticeStrong: { ...type.captionBold, color: colors.text },

  mineNote: { ...type.caption, color: colors.textFaint, marginTop: space.sm },

  feed: { gap: space.md, marginTop: space.lg },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  author: { ...type.subheadBold, color: colors.text },
  meta: { ...type.caption, color: colors.textFaint },
  tag: {
    backgroundColor: colors.surfaceHi, borderRadius: radius.sm,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  tagMine: { backgroundColor: colors.accentSoft },
  tagText: { ...type.captionBold, fontSize: 10, color: colors.textDim },

  title: { ...type.title3, color: colors.text },
  excerpt: { ...type.subhead, color: colors.textDim, lineHeight: 21 },

  foot: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.xs },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...type.caption, color: colors.textFaint },
});
