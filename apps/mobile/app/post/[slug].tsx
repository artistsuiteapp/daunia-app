import { StyleSheet, Text, View } from 'react-native';
import { apriFuori } from '../../lib/apri';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';

import { Screen, Empty, Badge, Button, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { colors, space, type } from '../../theme/tokens';
import { longDate } from '../../lib/format';
import { newsBySlug } from '../../lib/data';
import { coverOf } from '../../lib/editorial';
import { ArticleCover } from '../../components/ArticleCover';
import { photo } from '../../lib/media';

export default function Post() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const gutter = useGutter();
  const post = newsBySlug(String(slug));

  if (!post) return <Screen testaFissa><Empty text="Articolo non trovato." /></Screen>;

  const fromClub = post.kind === 'club';
  const link = post.url;
  const cover = coverOf(post.slug);

  return (
    <Screen>
      <BackBar label="Notizie" />

      {cover ? (
        <View style={[styles.coverWrap, gutter]}><ArticleCover cover={cover} height={200} /></View>
      ) : null}

      <View style={[styles.body, gutter]}>
        <Badge label={fromClub ? 'dal sito ufficiale' : 'redazione'} tone="accent" />
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.date}>{longDate(post.date)}</Text>

        {/* Di un comunicato del club si riportano titolo ed estratto breve, mai il
            testo intero: i collegamenti e gli estratti molto brevi sono esclusi dal
            diritto degli editori (art. 43-bis L. 633/1941), la riproduzione no.
            Il testo pieno si mostra solo quando l'articolo e nostro. */}
        <Text style={styles.text}>{fromClub ? post.excerpt : post.body || post.excerpt}</Text>
      </View>

      {link ? (
        <View style={[gutter, { marginTop: space.xl, gap: space.sm }]}>
          <Button label="Leggi l'articolo sul sito ufficiale" onPress={() => apriFuori(link)} />
          <Text style={styles.source}>
            Fonte: {new URL(link).hostname.replace(/^www\./, '')} · {longDate(post.date)}
          </Text>
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  coverWrap: { marginTop: space.md },
  body: { paddingTop: space.lg, gap: space.md },
  title: { ...type.title1, color: colors.text },
  date: { ...type.footnote, color: colors.textFaint, marginTop: -space.sm },
  text: { ...type.body, color: colors.textDim, marginTop: space.sm },
  source: { ...type.caption, color: colors.textFaint, paddingHorizontal: 0, textAlign: 'center' },
});
