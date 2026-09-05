import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useGutter, Empty, Segmented } from '../../components/ui';
import { Avatar } from '../../components/Avatar';
import { BrandMark } from '../../components/BrandMark';
import { Reveal } from '../../components/Reveal';
import { colors, radius, space, type } from '../../theme/tokens';
import { relative } from '../../lib/format';
import { usePosts, type FanPost } from '../../lib/community';
import { ROOMS, lastOf, messagesOf, useMessages } from '../../lib/rooms';

type View_ = 'discussioni' | 'bacheca';

/**
 * La Curva tiene due cose diverse e prima le mescolava: i messaggi brevi divisi
 * per argomento e i pezzi scritti. Ora si sceglie fra le due con un comando in
 * cima, e ognuna ha la sua forma.
 */
export default function Curva() {
  const gutter = useGutter();
  const [view, setView] = useState<View_>('discussioni');
  useMessages();
  const posts = usePosts();

  return (
    <Screen>
      <View style={[styles.head, gutter]}>
        <BrandMark size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Curva</Text>
          <Text style={styles.sub}>Lo spazio dei tifosi</Text>
        </View>
      </View>

      <View style={[styles.notice, gutter]}>
        <View style={styles.noticeDot} />
        <Text style={styles.noticeText}>
          <Text style={styles.noticeStrong}>Dimostrazione.</Text> Non ci sono account né utenti
          registrati. Quello che scrivi resta nel tuo browser e non viene inviato da nessuna parte.
        </Text>
      </View>

      <View style={[styles.switcher, gutter]}>
        <Segmented
          value={view}
          onChange={setView}
          items={[
            { key: 'discussioni' as View_, label: 'Discussioni' },
            { key: 'bacheca' as View_, label: 'Bacheca' },
          ]}
        />
      </View>

      {view === 'discussioni' ? <Rooms /> : <Board posts={posts} />}
    </Screen>
  );
}

/* ------------------------------------------------------------- discussioni */

function Rooms() {
  const gutter = useGutter();
  return (
    <View style={[styles.rooms, gutter]}>
      {ROOMS.map((r, i) => {
        const last = lastOf(r.id);
        const count = messagesOf(r.id).length;
        return (
          <Reveal key={r.id} delay={30 + i * 30}>
            <Pressable
              onPress={() => router.push(`/curva/stanza/${r.id}` as never)}
              style={({ pressed }) => [styles.room, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.roomIcon}>
                <Ionicons name={r.icon} size={19} color={colors.accentBright} />
              </View>

              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.roomTop}>
                  <Text style={styles.roomName} numberOfLines={1}>{r.name}</Text>
                  {last ? <Text style={styles.roomWhen}>{last.at}</Text> : null}
                </View>
                {last ? (
                  <Text style={styles.roomLast} numberOfLines={1}>
                    <Text style={styles.roomAuthor}>{last.author}: </Text>{last.body}
                  </Text>
                ) : (
                  <Text style={styles.roomLast} numberOfLines={1}>{r.blurb}</Text>
                )}
              </View>

              <View style={styles.count}><Text style={styles.countText}>{count}</Text></View>
            </Pressable>
          </Reveal>
        );
      })}
    </View>
  );
}

/* ----------------------------------------------------------------- bacheca */

function Board({ posts }: { posts: FanPost[] }) {
  const gutter = useGutter();
  const mine = posts.filter((p) => !p.sample).length;

  const list = useMemo(() => posts, [posts]);

  return (
    <View style={[styles.board, gutter]}>
      <Pressable
        onPress={() => router.push('/curva/nuovo' as never)}
        style={({ pressed }) => [styles.write, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="create-outline" size={17} color={colors.onAccent} />
        <Text style={styles.writeText}>Scrivi un pezzo</Text>
      </Pressable>

      {mine > 0 ? (
        <Text style={styles.mineNote}>
          {mine === 1 ? 'Hai scritto 1 pezzo.' : `Hai scritto ${mine} pezzi.`} Restano su questo dispositivo.
        </Text>
      ) : null}

      {list.length === 0 ? <Empty text="Ancora niente in bacheca." /> : list.map((p, i) => (
        <Reveal key={p.id} delay={30 + i * 30}>
          <PostCard post={p} />
        </Reveal>
      ))}
    </View>
  );
}

function PostCard({ post }: { post: FanPost }) {
  return (
    <Pressable
      onPress={() => router.push(`/curva/${post.id}` as never)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.cardHead}>
        <Avatar uri={null} name={post.author} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author} numberOfLines={1}>{post.author}</Text>
          <Text style={styles.meta}>{relative(post.date)} · {post.topic}</Text>
        </View>
        <View style={[styles.tag, !post.sample && styles.tagMine]}>
          <Text style={styles.tagText}>{post.sample ? 'esempio' : 'tuo'}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{post.title}</Text>
      <Text style={styles.excerpt} numberOfLines={2}>{post.excerpt}</Text>

      <View style={styles.foot}>
        <Ionicons name="heart-outline" size={14} color={colors.textFaint} />
        <Text style={styles.statText}>{post.likes}</Text>
        <Ionicons name="chatbubble-outline" size={13} color={colors.textFaint} style={{ marginLeft: space.md }} />
        <Text style={styles.statText}>{post.comments.length}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.textFaint} style={{ marginLeft: 'auto' }} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.lg, paddingBottom: space.sm },
  title: { ...type.displayTitle, color: colors.text },
  sub: { ...type.subhead, color: colors.textDim },

  notice: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(204,17,17,0.10)', borderRadius: radius.lg, padding: space.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(204,17,17,0.35)',
  },
  noticeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentBright, marginTop: 5 },
  noticeText: { ...type.caption, color: colors.textDim, flex: 1, lineHeight: 17 },
  noticeStrong: { ...type.captionBold, color: colors.text },

  switcher: { marginTop: space.lg },

  rooms: { gap: space.sm, marginTop: space.lg },
  room: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
  },
  roomIcon: {
    width: 42, height: 42, borderRadius: radius.lg, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  roomTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  roomName: { ...type.headline, color: colors.text, flex: 1 },
  roomWhen: { ...type.caption, color: colors.textFaint },
  roomLast: { ...type.subhead, color: colors.textDim },
  roomAuthor: { ...type.subheadBold, color: colors.textDim },
  count: {
    minWidth: 26, paddingHorizontal: 7, height: 22, borderRadius: 11,
    backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center',
  },
  countText: { ...type.captionBold, fontSize: 11, color: colors.textDim },

  board: { gap: space.md, marginTop: space.lg },
  write: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.accent, borderRadius: radius.pill, paddingVertical: 13,
  },
  writeText: { ...type.headline, color: colors.onAccent },
  mineNote: { ...type.caption, color: colors.textFaint },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  author: { ...type.subheadBold, color: colors.text },
  meta: { ...type.caption, color: colors.textFaint },
  tag: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  tagMine: { backgroundColor: colors.accentSoft },
  tagText: { ...type.captionBold, fontSize: 10, color: colors.textDim },
  cardTitle: { ...type.title3, color: colors.text },
  excerpt: { ...type.subhead, color: colors.textDim, lineHeight: 20 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  statText: { ...type.caption, color: colors.textFaint },
});
