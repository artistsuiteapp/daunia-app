import { Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';

import { Screen, Empty, Badge, Button, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { colors, space, type } from '../../theme/tokens';
import { longDate } from '../../lib/format';
import { newsBySlug } from '../../lib/data';

export default function Post() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const gutter = useGutter();
  const post = newsBySlug(String(slug));

  if (!post) return <Screen><Empty text="Articolo non trovato." /></Screen>;

  return (
    <Screen>
      <BackBar label="Notizie" />

      {post.image ? (
        <Image source={{ uri: post.image }} style={styles.image} contentFit="cover" transition={220} />
      ) : null}

      <View style={[styles.body, gutter]}>
        <Badge label={post.kind === 'club' ? 'comunicato ufficiale' : 'redazione'} tone="accent" />
        <Text style={styles.title}>{post.title}</Text>
        <Text style={styles.date}>{longDate(post.date)}</Text>
        <Text style={styles.text}>{post.body || post.excerpt}</Text>
      </View>

      {post.url ? (
        <View style={[gutter, { marginTop: space.xl }]}>
          <Button label="Leggi sul sito ufficiale" tone="plain" onPress={() => Linking.openURL(post.url)} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  image: { width: '100%', height: 230, backgroundColor: colors.surfaceHi, marginTop: space.md },
  body: { paddingTop: space.lg, gap: space.md },
  title: { ...type.title1, color: colors.text },
  date: { ...type.footnote, color: colors.textFaint, marginTop: -space.sm },
  text: { ...type.body, color: colors.textDim, marginTop: space.sm },
});
