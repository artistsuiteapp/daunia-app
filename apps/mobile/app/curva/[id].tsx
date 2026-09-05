import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Empty, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Avatar } from '../../components/Avatar';
import { colors, radius, space, type } from '../../theme/tokens';
import { relative, shortDate } from '../../lib/format';
import { postById, removePost, toggleLike, usePosts } from '../../lib/community';

export default function FanPostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gutter = useGutter();
  usePosts(); // ridisegna quando il post cambia (cuore, cancellazione)
  const [liked, setLiked] = useState(false);

  const post = postById(String(id));
  if (!post) return <Screen><Empty text="Post non trovato." /></Screen>;

  return (
    <Screen>
      <BackBar label="Curva" />

      <View style={[styles.head, gutter]}>
        <Avatar uri={null} name={post.author} size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{post.author}</Text>
          <Text style={styles.meta}>{shortDate(post.date)} · {post.topic}</Text>
        </View>
        {post.sample ? (
          <View style={styles.tag}><Text style={styles.tagText}>esempio</Text></View>
        ) : null}
      </View>

      <View style={[styles.body, gutter]}>
        <Text style={styles.title}>{post.title}</Text>
        {post.body.split('\n\n').map((para, i) => (
          <Text key={i} style={styles.para}>{para}</Text>
        ))}
      </View>

      <View style={[styles.actions, gutter]}>
        <Pressable
          onPress={() => { if (!liked) { toggleLike(post.id); setLiked(true); } }}
          style={({ pressed }) => [styles.action, liked && styles.actionOn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={17} color={liked ? colors.onAccent : colors.text} />
          <Text style={[styles.actionText, liked && styles.actionTextOn]}>{post.likes}</Text>
        </Pressable>

        {!post.sample ? (
          <Pressable
            onPress={() => { removePost(post.id); router.back(); }}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="trash-outline" size={16} color={colors.textDim} />
            <Text style={styles.actionText}>Elimina</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.section, gutter]}>
        {post.comments.length === 0 ? 'NESSUN COMMENTO' : `COMMENTI · ${post.comments.length}`}
      </Text>

      <View style={[styles.comments, gutter]}>
        {post.comments.map((c) => (
          <View key={c.id} style={styles.comment}>
            <Avatar uri={null} name={c.author} size={30} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.commentAuthor}>{c.author} <Text style={styles.commentDate}>· {relative(c.date)}</Text></Text>
              <Text style={styles.commentBody}>{c.body}</Text>
            </View>
          </View>
        ))}

        {/* Commentare richiede account, quindi un server e obblighi verso chi si
            registra. Qui si dice cosa manca invece di simulare un campo che non
            scrive da nessuna parte. */}
        <View style={styles.locked}>
          <Ionicons name="lock-closed-outline" size={15} color={colors.textFaint} />
          <Text style={styles.lockedText}>
            I commenti arrivano con la versione completa: servono account veri, e gli account
            richiedono un server e le tutele per chi si iscrive.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  author: { ...type.headline, color: colors.text },
  meta: { ...type.caption, color: colors.textFaint },
  tag: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  tagText: { ...type.captionBold, fontSize: 10, color: colors.textDim },

  body: { marginTop: space.lg, gap: space.md },
  title: { ...type.title1, color: colors.text },
  para: { ...type.body, color: colors.textDim, lineHeight: 25 },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  action: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: space.lg, paddingVertical: 9,
  },
  actionOn: { backgroundColor: colors.accent },
  actionText: { ...type.subheadBold, color: colors.textDim },
  actionTextOn: { color: colors.onAccent },

  section: { ...type.groupLabel, color: colors.textDim, marginTop: space.xl, marginBottom: space.sm },
  comments: { gap: space.md },
  comment: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  commentAuthor: { ...type.footnoteBold, color: colors.text },
  commentDate: { ...type.caption, color: colors.textFaint },
  commentBody: { ...type.subhead, color: colors.textDim, lineHeight: 20 },

  locked: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, marginTop: space.sm,
  },
  lockedText: { ...type.caption, color: colors.textFaint, flex: 1, lineHeight: 17 },
});
