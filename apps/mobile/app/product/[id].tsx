import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Polygon } from 'react-native-svg';

import {
  Screen, Empty, GroupLabel, GroupNote, ListGroup, ListRow, useGutter,
} from '../../components/ui';
import { colors, radius, space, type } from '../../theme/tokens';
import { useLayout } from '../../theme/responsive';
import { euro } from '../../lib/format';
import { brand } from '../../theme/brand';
import { FOGGIA, productById, products } from '../../lib/data';

const SIZES = ['S', 'M', 'L', 'XL', 'XXL'];

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gutter = useGutter();
  const { content } = useLayout();
  const [size, setSize] = useState('L');
  const [shot, setShot] = useState(0);

  const product = productById(String(id));
  if (!product) return <Screen><Empty text="Prodotto non trovato." /></Screen>;

  const gallery = product.images.length ? product.images : [];
  const similar = products.filter((p) => p.categorySlug === product.categorySlug && p.id !== product.id);

  return (
    <Screen>
      {/* fondo tagliato in diagonale, nero e rosso: e l'impianto della reference,
          dove il prodotto sta sopra la linea che divide i due campi di colore */}
      <View style={styles.hero}>
        <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          <Polygon points="0,0 46,0 30,100 0,100" fill="#151517" />
          <Polygon points="46,0 100,0 100,100 30,100" fill={brand.colors.red} />
        </Svg>

        <View style={[styles.heroBar, gutter]}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.roundBtn} accessibilityLabel="Indietro">
            <Ionicons name="chevron-back" size={19} color="#fff" />
          </Pressable>
          {FOGGIA?.crest ? (
            <Image source={{ uri: FOGGIA.crest }} style={styles.heroCrest} contentFit="contain" />
          ) : <View style={styles.heroCrest} />}
          <Pressable
            onPress={() => Linking.openURL(product.url)}
            hitSlop={10}
            style={styles.roundBtn}
            accessibilityLabel="Apri il negozio"
          >
            <Ionicons name="bag-outline" size={18} color="#fff" />
          </Pressable>
        </View>

        <View style={[styles.showcase, gutter]}>
          <View style={[styles.showcaseCard, { height: Math.min(380, content * 0.86) }]}>
            <View style={styles.tag}><Text style={styles.tagText}>{brand.nickname}</Text></View>
            {FOGGIA?.crest ? (
              <Image source={{ uri: FOGGIA.crest }} style={styles.showcaseCrest} contentFit="contain" />
            ) : null}
            <Text style={styles.showcaseClub}>{'FOGGIA'.split('').join(' ')}</Text>

            {/* le foto del negozio hanno gia il fondo bianco: dentro un riquadro
                chiaro sembra una scelta invece di un ritaglio mal riuscito */}
            <View style={styles.shotWell}>
              {gallery[shot] ? (
                <Image source={{ uri: gallery[shot] }} style={styles.shot} contentFit="contain" transition={220} />
              ) : (
                <Ionicons name="shirt-outline" size={56} color="#B9B7B2" />
              )}
            </View>

            {gallery.length > 1 ? (
              <View style={styles.dots}>
                {gallery.map((src, i) => (
                  <Pressable key={src} onPress={() => setShot(i)} hitSlop={8}>
                    <View style={[styles.dot, i === shot && styles.dotOn]} />
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* prezzo a sinistra e taglie a destra, sulla stessa riga come nella reference */}
        <View style={[styles.buyRow, gutter]}>
          <View>
            <Text style={styles.price}>{euro(product.price)}</Text>
            {product.onSale && product.regularPrice > product.price ? (
              <Text style={styles.strike}>{euro(product.regularPrice)}</Text>
            ) : null}
          </View>
          <View style={styles.sizes}>
            {SIZES.map((s) => (
              <Pressable key={s} onPress={() => setSize(s)} style={[styles.size, size === s && styles.sizeOn]}>
                <Text style={[styles.sizeText, size === s && styles.sizeTextOn]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.ctaRow, gutter]}>
          <Pressable
            onPress={() => Linking.openURL(product.url)}
            style={({ pressed }) => [styles.ctaIcon, pressed && { opacity: 0.7 }]}
            accessibilityLabel="Apri il negozio"
          >
            <Ionicons name="bag-outline" size={20} color="#fff" />
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(product.url)}
            style={({ pressed }) => [styles.ctaMain, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaMainText}>ACQUISTA SUL NEGOZIO</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.head, gutter]}>
        {product.category ? <Text style={styles.kicker}>{product.category}</Text> : null}
        <Text style={styles.name}>{product.name}</Text>
        <Text style={[styles.stock, !product.inStock && styles.stockOut]}>
          {product.inStock ? 'Disponibile' : 'Esaurito'}
        </Text>
      </View>

      <GroupNote>
        Prezzo simbolico, non quello del negozio. Taglia e acquisto si fanno su
        calciofoggia1920.store: qui il passaggio e solo mostrato.
      </GroupNote>

      {product.description ? (
        <>
          <GroupLabel>Descrizione</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              <ListRow>
                <Text style={styles.desc}>{product.description}</Text>
              </ListRow>
            </ListGroup>
          </View>
        </>
      ) : null}

      {similar.length ? (
        <>
          <GroupLabel>Della stessa linea</GroupLabel>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.similar, gutter]}>
            {similar.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/product/${p.id}` as never)}
                style={({ pressed }) => [styles.simCard, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.simImgWrap}>
                  {p.image ? <Image source={{ uri: p.image }} style={styles.simImg} contentFit="contain" /> : null}
                </View>
                <Text style={styles.simName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.simPrice}>{euro(p.price)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      ) : null}

    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { paddingBottom: space.lg, overflow: 'hidden' },
  heroBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: space.md, paddingBottom: space.sm,
  },
  roundBtn: {
    width: 40, height: 40, borderRadius: radius.lg,
    backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.22)',
  },
  heroCrest: { width: 46, height: 46 },

  showcase: { paddingTop: space.sm },
  showcaseCard: {
    borderRadius: radius.xxl, backgroundColor: '#1B1B20',
    alignItems: 'center', paddingTop: space.xl, paddingBottom: space.lg, paddingHorizontal: space.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
  },
  tag: {
    position: 'absolute', top: 0, alignSelf: 'center',
    backgroundColor: colors.accent, paddingHorizontal: space.md, paddingVertical: 5,
    borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
  },
  tagText: { ...type.captionBold, color: colors.onAccent, letterSpacing: 0.6 },
  showcaseCrest: { width: 44, height: 44, marginTop: space.sm },
  showcaseClub: { ...type.captionBold, color: 'rgba(255,255,255,0.66)', letterSpacing: 2, marginTop: 4 },
  shotWell: {
    flex: 1, width: '100%', marginTop: space.md,
    borderRadius: radius.xl, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', padding: space.md, overflow: 'hidden',
  },
  shot: { width: '100%', height: '100%' },
  dots: { flexDirection: 'row', gap: 6, marginTop: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  dotOn: { backgroundColor: '#fff', width: 16 },

  buyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: space.md, marginTop: space.xl,
  },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.lg },
  ctaIcon: {
    width: 54, height: 54, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.45)',
  },
  ctaMain: {
    flex: 1, height: 54, borderRadius: radius.xl,
    alignItems: 'center', justifyContent: 'center', backgroundColor: '#151517',
  },
  ctaMainText: { ...type.subheadBold, color: '#fff', letterSpacing: 1 },

  head: { marginTop: space.xl, gap: 4 },
  kicker: { ...type.footnoteBold, color: colors.accentBright },
  name: { ...type.title1, color: colors.text },
  price: { ...type.score, fontSize: 40, lineHeight: 42, color: '#fff' },
  strike: { ...type.footnote, color: 'rgba(255,255,255,0.6)', textDecorationLine: 'line-through' },
  stock: { ...type.footnote, color: colors.win, marginTop: 2 },
  stockOut: { color: colors.textFaint },

  sizes: {
    flexDirection: 'row', gap: 2, backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.pill, padding: 3,
  },
  size: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sizeOn: { backgroundColor: '#fff' },
  sizeText: { ...type.captionBold, color: 'rgba(255,255,255,0.72)' },
  sizeTextOn: { color: '#151517' },

  desc: { ...type.subhead, color: colors.textDim, flex: 1 },

  similar: { gap: space.sm },
  simCard: { width: 124, gap: 5 },
  simImgWrap: {
    height: 92, borderRadius: radius.md, backgroundColor: '#F2F1EF',
    alignItems: 'center', justifyContent: 'center', padding: 6,
  },
  simImg: { width: '100%', height: '100%' },
  simName: { ...type.caption, color: colors.textDim },
  simPrice: { ...type.subheadBold, color: colors.text },
});
