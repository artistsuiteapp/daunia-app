import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { colors, radius, space, type } from '../../theme/tokens';
import { TOPICS, addPost, type Topic } from '../../lib/community';

/**
 * Scrittura di un post nella demo.
 *
 * Non c'e invio verso nessun server: il testo resta nella memoria del browser di
 * chi prova l'app. E scritto qui sotto in chiaro, perche chi scrive qualcosa di
 * personale deve sapere dove finisce prima di scriverlo, non dopo.
 */
export default function NuovoPost() {
  const gutter = useGutter();
  const [author, setAuthor] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [topic, setTopic] = useState<Topic>('Partita');

  const ready = title.trim().length >= 4 && body.trim().length >= 20;

  const publish = () => {
    if (!ready) return;
    const post = addPost({ author, title, body, topic });
    router.replace(`/curva/${post.id}` as never);
  };

  return (
    <Screen>
      <BackBar label="Curva" />

      <View style={[styles.wrap, gutter]}>
        <Text style={styles.heading}>Scrivi alla Curva</Text>

        <View style={styles.notice}>
          <Ionicons name="phone-portrait-outline" size={16} color={colors.accentBright} />
          <Text style={styles.noticeText}>
            Questo post resta nella memoria di questo browser. Non viene inviato, non lo vede
            nessun altro, e sparisce se cancelli i dati del sito.
          </Text>
        </View>

        <Field label="Come ti firmi">
          <TextInput
            value={author}
            onChangeText={setAuthor}
            placeholder="Il tuo nome, o come vuoi farti chiamare"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={40}
          />
        </Field>

        <Field label="Argomento">
          <View style={styles.topics}>
            {TOPICS.map((t) => {
              const on = t === topic;
              return (
                <Pressable key={t} onPress={() => setTopic(t)} style={[styles.topic, on && styles.topicOn]}>
                  <Text style={[styles.topicText, on && styles.topicTextOn]}>{t}</Text>
                </Pressable>
              );
            })}
          </View>
        </Field>

        <Field label="Titolo">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Di cosa vuoi parlare"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            maxLength={90}
          />
        </Field>

        <Field label={`Il tuo pezzo${body.length ? ` · ${body.trim().length} caratteri` : ''}`}>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Scrivi come parleresti allo stadio."
            placeholderTextColor={colors.textFaint}
            style={[styles.input, styles.area]}
            multiline
            textAlignVertical="top"
          />
        </Field>

        <Pressable
          onPress={publish}
          disabled={!ready}
          style={({ pressed }) => [styles.cta, !ready && styles.ctaOff, pressed && ready && { opacity: 0.85 }]}
        >
          <Text style={[styles.ctaText, !ready && styles.ctaTextOff]}>
            {ready ? 'Pubblica nella demo' : 'Servono un titolo e qualche riga'}
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.lg, marginTop: space.md },
  heading: { ...type.largeTitle, color: colors.text },

  notice: {
    flexDirection: 'row', gap: space.sm, alignItems: 'flex-start',
    backgroundColor: 'rgba(204,17,17,0.10)', borderRadius: radius.lg, padding: space.md,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(204,17,17,0.35)',
  },
  noticeText: { ...type.caption, color: colors.textDim, flex: 1, lineHeight: 17 },

  field: { gap: space.sm },
  label: { ...type.caption, color: colors.textFaint, letterSpacing: 0.5 },
  input: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: space.lg, paddingVertical: 13,
    ...type.body, color: colors.text,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  area: { minHeight: 190, paddingTop: 14, lineHeight: 24 },

  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  topic: {
    paddingHorizontal: space.lg, paddingVertical: 9, borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  topicOn: { backgroundColor: colors.accent },
  topicText: { ...type.subheadBold, color: colors.textDim },
  topicTextOn: { color: colors.onAccent },

  cta: {
    borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center',
    backgroundColor: colors.accent, marginTop: space.sm,
  },
  ctaOff: { backgroundColor: colors.surface },
  ctaText: { ...type.headline, color: colors.onAccent },
  ctaTextOff: { color: colors.textFaint },
});
