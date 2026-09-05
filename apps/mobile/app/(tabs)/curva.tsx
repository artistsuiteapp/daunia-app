import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useGutter, Empty } from '../../components/ui';
import { Avatar } from '../../components/Avatar';
import { BrandMark } from '../../components/BrandMark';
import { Reveal } from '../../components/Reveal';
import { colors, radius, space, type } from '../../theme/tokens';
import { relative } from '../../lib/format';
import { useOspite } from '../../lib/ospite';
import { SoloConAccount } from '../../components/SoloConAccount';
import { useLayout } from '../../theme/responsive';
import {
  TOPICS, TOPIC_ICON, lastActivity, mineCount, useDiscussions, type Discussion, type Topic,
} from '../../lib/community';

const ALL = 'tutti';

/**
 * Un elenco solo, ordinato per ultima attivita: i fili vivi salgono in cima da
 * soli. Gli argomenti filtrano, non separano.
 */
export default function Curva() {
  const gutter = useGutter();
  const { gutter: g } = useLayout();
  const all = useDiscussions();
  const ospite = useOspite();
  const [topic, setTopic] = useState<string>(ALL);

  const list = useMemo(
    () => (topic === ALL ? all : all.filter((d) => d.topic === topic)),
    [all, topic],
  );
  const mine = mineCount();

  return (
    <Screen>
      <View style={[styles.head, gutter]}>
        <BrandMark size={44} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Curva</Text>
          <Text style={styles.sub}>Lo spazio dei tifosi</Text>
        </View>
        {!ospite ? (
          <Pressable
            onPress={() => router.push('/curva/nuovo' as never)}
            style={({ pressed }) => [styles.write, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="create-outline" size={16} color={colors.onAccent} />
            <Text style={styles.writeText}>Apri</Text>
          </Pressable>
        ) : null}
      </View>

      {ospite ? (
        <View style={gutter}>
          <SoloConAccount cosa="Per aprire una discussione o rispondere serve un account." />
        </View>
      ) : null}

      <View style={[styles.notice, gutter]}>
        <View style={styles.noticeDot} />
        <Text style={styles.noticeText}>
          <Text style={styles.noticeStrong}>Dimostrazione.</Text> Non ci sono account né utenti
          registrati. Quello che scrivi resta nel tuo browser e non viene inviato da nessuna parte.
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips, { paddingHorizontal: space.lg + g }]}
      >
        <Chip label="Tutte" count={all.length} on={topic === ALL} onPress={() => setTopic(ALL)} />
        {TOPICS.map((t) => (
          <Chip
            key={t}
            label={t}
            icon={TOPIC_ICON[t]}
            count={all.filter((d) => d.topic === t).length}
            on={topic === t}
            onPress={() => setTopic(topic === t ? ALL : t)}
          />
        ))}
      </ScrollView>

      {mine > 0 ? (
        <Text style={[styles.mineNote, gutter]}>
          Hai scritto {mine === 1 ? '1 contributo' : `${mine} contributi`}. Restano su questo dispositivo.
        </Text>
      ) : null}

      {list.length === 0 ? (
        <Empty text="Nessuna discussione con questa etichetta." />
      ) : (
        <View style={[styles.feed, gutter]}>
          {list.map((d, i) => (
            <Reveal key={d.id} delay={30 + i * 25}>
              <Card discussion={d} />
            </Reveal>
          ))}
        </View>
      )}
    </Screen>
  );
}

function Chip({ label, count, on, onPress, icon }: {
  label: string; count: number; on: boolean; onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]}>
      {icon ? <Ionicons name={icon} size={14} color={on ? colors.onAccent : colors.accentBright} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
      <Text style={[styles.chipCount, on && styles.chipCountOn]}>{count}</Text>
    </Pressable>
  );
}

function Card({ discussion: d }: { discussion: Discussion }) {
  const last = d.replies.length ? d.replies[d.replies.length - 1]! : null;
  return (
    <Pressable
      onPress={() => router.push(`/curva/${d.id}` as never)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.88 }]}
    >
      <View style={styles.cardHead}>
        <Avatar uri={null} name={d.author} size={32} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author} numberOfLines={1}>{d.author}</Text>
          <Text style={styles.meta}>{relative(d.date)}</Text>
        </View>
        <View style={styles.topicTag}>
          <Ionicons name={TOPIC_ICON[d.topic]} size={11} color={colors.accentBright} />
          <Text style={styles.topicText}>{d.topic}</Text>
        </View>
      </View>

      <Text style={styles.cardTitle} numberOfLines={2}>{d.title}</Text>
      <Text style={styles.body} numberOfLines={2}>{d.body}</Text>

      {last ? (
        <View style={styles.lastReply}>
          <Ionicons name="return-down-forward" size={13} color={colors.textFaint} />
          <Text style={styles.lastText} numberOfLines={1}>
            <Text style={styles.lastAuthor}>{last.author}: </Text>{last.body}
          </Text>
        </View>
      ) : null}

      <View style={styles.foot}>
        <Ionicons name="chatbubble-outline" size={13} color={colors.textFaint} />
        <Text style={styles.statText}>
          {d.replies.length === 0 ? 'nessuna risposta'
            : d.replies.length === 1 ? '1 risposta' : `${d.replies.length} risposte`}
        </Text>
        <Ionicons name="heart-outline" size={13} color={colors.textFaint} style={{ marginLeft: space.md }} />
        <Text style={styles.statText}>{d.likes}</Text>
        <Text style={styles.activity}>{relative(lastActivity(d))}</Text>
      </View>

      {!d.sample ? <View style={styles.mineFlag}><Text style={styles.mineFlagText}>tuo</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.lg, paddingBottom: space.sm },
  title: { ...type.displayTitle, color: colors.text },
  sub: { ...type.subhead, color: colors.textDim },
  write: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 8,
  },
  writeText: { ...type.footnoteBold, color: colors.onAccent },

  notice: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(204,17,17,0.10)', borderRadius: radius.lg, padding: space.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(204,17,17,0.35)',
  },
  noticeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accentBright, marginTop: 5 },
  noticeText: { ...type.caption, color: colors.textDim, flex: 1, lineHeight: 17 },
  noticeStrong: { ...type.captionBold, color: colors.text },

  chips: { gap: space.sm, paddingTop: space.lg, paddingBottom: space.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: space.md, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipOn: { backgroundColor: colors.accent, borderColor: 'transparent' },
  chipText: { ...type.footnoteBold, color: colors.text },
  chipTextOn: { color: colors.onAccent },
  chipCount: { ...type.caption, fontSize: 11, color: colors.textFaint },
  chipCountOn: { color: 'rgba(255,255,255,0.75)' },

  mineNote: { ...type.caption, color: colors.textFaint, marginTop: space.md },

  feed: { gap: space.md, marginTop: space.lg },
  card: {
    backgroundColor: colors.surface, borderRadius: radius.xl, padding: space.lg, gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  author: { ...type.subheadBold, color: colors.text },
  meta: { ...type.caption, color: colors.textFaint },
  topicTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accentSoft, borderRadius: radius.sm,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  topicText: { ...type.captionBold, fontSize: 10, color: colors.accentBright },

  cardTitle: { ...type.title3, color: colors.text },
  body: { ...type.subhead, color: colors.textDim, lineHeight: 20 },

  lastReply: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md,
    paddingHorizontal: space.sm, paddingVertical: 7,
  },
  lastText: { ...type.caption, color: colors.textDim, flex: 1 },
  lastAuthor: { ...type.captionBold, color: colors.textDim },

  foot: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statText: { ...type.caption, color: colors.textFaint },
  activity: { ...type.caption, color: colors.textFaint, marginLeft: 'auto' },

  mineFlag: {
    position: 'absolute', top: space.md, right: space.md,
    backgroundColor: colors.accent, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2,
  },
  mineFlagText: { ...type.captionBold, fontSize: 9, color: colors.onAccent },
});
