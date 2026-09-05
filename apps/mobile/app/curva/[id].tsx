import { useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Empty, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Avatar } from '../../components/Avatar';
import { colors, radius, space, type } from '../../theme/tokens';
import { relative, shortDate } from '../../lib/format';
import {
  TOPIC_ICON, addReply, discussionById, like, removeDiscussion, useDiscussions,
} from '../../lib/community';

/**
 * Una discussione: il testo di apertura, poi le risposte in ordine di arrivo e
 * il campo per rispondere. Un pezzo lungo e un "chi c'e domenica?" usano la
 * stessa pagina, cambia solo quanto e lungo il primo blocco.
 */
export default function DiscussionPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gutter = useGutter();
  useDiscussions();
  const [draft, setDraft] = useState('');
  const [liked, setLiked] = useState(false);

  const d = discussionById(String(id));
  if (!d) return <Screen><Empty text="Discussione non trovata." /></Screen>;

  const send = () => {
    if (!draft.trim()) return;
    addReply(d.id, 'Tu', draft);
    setDraft('');
  };

  return (
    <Screen>
      <BackBar label="Curva" />

      <View style={[styles.head, gutter]}>
        <Avatar uri={null} name={d.author} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{d.author}</Text>
          <Text style={styles.meta}>{shortDate(d.date)}</Text>
        </View>
        <View style={styles.topicTag}>
          <Ionicons name={TOPIC_ICON[d.topic]} size={12} color={colors.accentBright} />
          <Text style={styles.topicText}>{d.topic}</Text>
        </View>
      </View>

      <View style={[styles.body, gutter]}>
        <Text style={styles.title}>{d.title}</Text>
        {d.body.split('\n\n').map((para: string, i: number) => (
          <Text key={i} style={styles.para}>{para}</Text>
        ))}
      </View>

      <View style={[styles.actions, gutter]}>
        <Pressable
          onPress={() => { if (!liked) { like(d.id); setLiked(true); } }}
          style={({ pressed }) => [styles.action, liked && styles.actionOn, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? colors.onAccent : colors.text} />
          <Text style={[styles.actionText, liked && styles.actionTextOn]}>{d.likes}</Text>
        </Pressable>

        {!d.sample ? (
          <Pressable
            onPress={() => { removeDiscussion(d.id); router.back(); }}
            style={({ pressed }) => [styles.action, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="trash-outline" size={15} color={colors.textDim} />
            <Text style={styles.actionText}>Elimina</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.section, gutter]}>
        {d.replies.length === 0 ? 'NESSUNA RISPOSTA' : `RISPOSTE · ${d.replies.length}`}
      </Text>

      <View style={[styles.replies, gutter]}>
        {d.replies.map((rep) => (
          <View key={rep.id} style={[styles.reply, !rep.sample && styles.replyMine]}>
            <Avatar uri={null} name={rep.author} size={28} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.replyAuthor}>
                {rep.author} <Text style={styles.replyDate}>· {relative(rep.date)}</Text>
              </Text>
              <Text style={styles.replyBody}>{rep.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.composer}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Scrivi una risposta"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            multiline
          />
          <Pressable
            onPress={send}
            disabled={!draft.trim()}
            style={({ pressed }) => [styles.send, !draft.trim() && styles.sendOff, pressed && { opacity: 0.8 }]}
          >
            <Ionicons name="arrow-up" size={18} color={draft.trim() ? colors.onAccent : colors.textFaint} />
          </Pressable>
        </View>

        <Text style={styles.footNote}>
          La risposta resta in questo browser. Con gli account veri finisce sul filo per tutti.
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  author: { ...type.headline, color: colors.text },
  meta: { ...type.caption, color: colors.textFaint },
  topicTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accentSoft, borderRadius: radius.sm,
    paddingHorizontal: 8, paddingVertical: 4,
  },
  topicText: { ...type.captionBold, fontSize: 11, color: colors.accentBright },

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
  replies: { gap: space.md },
  reply: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  replyMine: {
    backgroundColor: 'rgba(204,17,17,0.10)', borderRadius: radius.lg,
    padding: space.sm, marginLeft: -space.sm, marginRight: -space.sm,
  },
  replyAuthor: { ...type.footnoteBold, color: colors.text },
  replyDate: { ...type.caption, color: colors.textFaint },
  replyBody: { ...type.subhead, color: colors.textDim, lineHeight: 20 },

  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.sm },
  input: {
    flex: 1, maxHeight: 120, minHeight: 44,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingHorizontal: space.lg, paddingVertical: 11,
    ...type.subhead, color: colors.text,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  send: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendOff: { backgroundColor: colors.surface },
  footNote: { ...type.caption, color: colors.textFaint, textAlign: 'center', marginTop: space.sm },
});
