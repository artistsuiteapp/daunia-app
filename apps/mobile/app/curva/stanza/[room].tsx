import { useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Avatar } from '../../../components/Avatar';
import { Empty } from '../../../components/ui';
import { TAB_BAR_SPACE } from '../../../components/FloatingTabBar';
import { colors, radius, space, type } from '../../../theme/tokens';
import { useLayout } from '../../../theme/responsive';
import { roomById, sendMessage, useMessages } from '../../../lib/rooms';

/**
 * Una stanza di discussione: messaggi brevi, dal piu vecchio al piu recente,
 * con il campo di scrittura in fondo. I messaggi propri stanno a destra in
 * rosso, quelli di esempio a sinistra: si distingue a colpo d'occhio cosa e
 * seminato e cosa hai scritto tu.
 */
export default function Stanza() {
  const { room } = useLocalSearchParams<{ room: string }>();
  const insets = useSafeAreaInsets();
  const { gutter } = useLayout();
  const scroller = useRef<ScrollView>(null);
  const [draft, setDraft] = useState('');
  const [author, setAuthor] = useState('Tu');
  // un hook non si chiama dentro l'array delle dipendenze: si legge una volta
  // e il risultato entra fra le dipendenze come un valore qualsiasi
  const all = useMessages();

  const info = roomById(String(room));
  const messages = useMemo(() => all.filter((m) => m.room === String(room)), [all, room]);

  if (!info) return <View style={styles.root}><Empty text="Stanza non trovata." /></View>;

  const send = () => {
    if (!draft.trim()) return;
    sendMessage(info.id, author, draft);
    setDraft('');
    setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 60);
  };

  const pad = { paddingHorizontal: space.lg + gutter };

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.bar, pad, { paddingTop: insets.top + space.sm }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={colors.accentBright} />
        </Pressable>
        <View style={styles.barIcon}>
          <Ionicons name={info.icon} size={17} color={colors.accentBright} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.barTitle} numberOfLines={1}>{info.name}</Text>
          <Text style={styles.barSub} numberOfLines={1}>{info.blurb}</Text>
        </View>
      </View>

      <ScrollView
        ref={scroller}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.thread, pad]}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((m) => {
          const own = !m.sample;
          return (
            <View key={m.id} style={[styles.row, own && styles.rowOwn]}>
              {!own ? <Avatar uri={null} name={m.author} size={28} /> : null}
              <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                {!own ? <Text style={styles.msgAuthor}>{m.author}</Text> : null}
                <Text style={[styles.msgBody, own && styles.msgBodyOwn]}>{m.body}</Text>
                <Text style={[styles.msgAt, own && styles.msgAtOwn]}>{m.at}</Text>
              </View>
            </View>
          );
        })}

        <Text style={styles.footNote}>
          Conversazione di esempio. Quello che scrivi resta in questo browser.
        </Text>
      </ScrollView>

      <View style={[styles.composer, pad, { paddingBottom: Math.max(insets.bottom, space.md) + TAB_BAR_SPACE - 40 }]}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={`Messaggio in ${info.name}`}
          placeholderTextColor={colors.textFaint}
          style={styles.input}
          multiline
          onSubmitEditing={send}
        />
        <Pressable
          onPress={send}
          disabled={!draft.trim()}
          style={({ pressed }) => [styles.send, !draft.trim() && styles.sendOff, pressed && { opacity: 0.8 }]}
        >
          <Ionicons name="arrow-up" size={19} color={draft.trim() ? colors.onAccent : colors.textFaint} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  bar: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator,
  },
  back: { marginLeft: -6 },
  barIcon: {
    width: 34, height: 34, borderRadius: radius.md, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  barTitle: { ...type.headline, color: colors.text },
  barSub: { ...type.caption, color: colors.textFaint },

  thread: { gap: space.sm, paddingTop: space.lg, paddingBottom: space.lg },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, maxWidth: '86%' },
  rowOwn: { alignSelf: 'flex-end', justifyContent: 'flex-end' },
  bubble: { borderRadius: radius.xl, paddingHorizontal: space.md, paddingVertical: 9, gap: 1, flexShrink: 1 },
  bubbleOther: { backgroundColor: colors.surface, borderBottomLeftRadius: radius.sm },
  bubbleOwn: { backgroundColor: colors.accent, borderBottomRightRadius: radius.sm },
  msgAuthor: { ...type.captionBold, color: colors.accentBright },
  msgBody: { ...type.subhead, color: colors.text, lineHeight: 20 },
  msgBodyOwn: { color: colors.onAccent },
  msgAt: { ...type.caption, fontSize: 10, color: colors.textFaint, alignSelf: 'flex-end' },
  msgAtOwn: { color: 'rgba(255,255,255,0.7)' },

  footNote: { ...type.caption, color: colors.textFaint, textAlign: 'center', marginTop: space.lg },

  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: space.sm,
    paddingTop: space.md, backgroundColor: colors.bgElevated,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator,
  },
  input: {
    flex: 1, maxHeight: 120,
    backgroundColor: colors.surface, borderRadius: radius.xl,
    paddingHorizontal: space.lg, paddingVertical: 11,
    ...type.subhead, color: colors.text,
  },
  send: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: colors.accent,
    alignItems: 'center', justifyContent: 'center',
  },
  sendOff: { backgroundColor: colors.surface },
});
