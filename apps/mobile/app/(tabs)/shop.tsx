import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { Product } from '@satanelli/core';

import { Screen, GroupNote, Empty, useGutter } from '../../components/ui';
import { Rail } from '../../components/Rail';
import { ShopTopBar } from '../../components/ShopTopBar';
import { colors, radius, space, type } from '../../theme/tokens';
import { useLayout } from '../../theme/responsive';
import { euro } from '../../lib/format';
import { FOGGIA, products, shopCategories } from '../../lib/data';

const ALL = 'tutti';
const STORE = 'https://calciofoggia1920.store/';

export default function Shop() {
  const gutter = useGutter();
  const { gutter: g, columns } = useLayout();
  const [cat, setCat] = useState<string>(ALL);

  const list = useMemo(
    () => (cat === ALL ? products : products.filter((p) => p.categorySlug === cat)),
    [cat],
  );
  // i caroselli hanno senso solo con un catalogo largo: con pochi capi
  // mostrerebbero tre volte le stesse tessere
  const wide = products.length >= 6;
  const popular = products.slice(0, 8);
  const tiles = shopCategories.map((c) => ({
    ...c,
    image: products.find((p) => p.categorySlug === c.slug && p.image)?.image ?? null,
  }));
  const cellWidth = `${100 / Math.min(columns, 2) - 2}%` as const satisfies `${number}%`;

  return (
    <Screen>
      <ShopTopBar
        crest={FOGGIA?.crest ?? null}
        count={products.length}
        onGrid={() => setCat(ALL)}
        onCart={() => Linking.openURL(STORE)}
      />

      {/* fila di cerchi per reparto, come i loghi delle squadre nella reference.
          Con un reparto solo non c'e niente da filtrare: sparisce */}
      {shopCategories.length > 1 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.circleRow, { paddingHorizontal: space.lg + g }]}
      >
        <Pressable
          onPress={() => setCat(ALL)}
          style={[styles.filterBtn, cat === ALL && styles.filterBtnOn]}
          accessibilityLabel="Tutti i prodotti"
        >
          <Ionicons name="options-outline" size={19} color={cat === ALL ? colors.onAccent : colors.text} />
        </Pressable>

        {tiles.map((t) => {
          const on = cat === t.slug;
          return (
            <Pressable
              key={t.slug}
              onPress={() => setCat(on ? ALL : t.slug)}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
              accessibilityLabel={t.name}
            >
              <View style={[styles.circle, on && styles.circleOn]}>
                {t.image ? (
                  <Image source={{ uri: t.image }} style={styles.circleImg} contentFit="contain" transition={180} />
                ) : (
                  <Text style={styles.circleText}>{t.name.slice(0, 2).toUpperCase()}</Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
      ) : null}

      {cat === ALL && wide ? (
        <>
          <Rail title="Popolari">
            {popular.map((p) => <ProductCard key={p.id} product={p} width={158} />)}
          </Rail>

          <Rail title="Categorie">
            {tiles.map((t) => (
              <Pressable
                key={t.slug}
                onPress={() => setCat(t.slug)}
                style={({ pressed }) => [styles.catTile, pressed && { opacity: 0.8 }]}
              >
                <View style={styles.catImgWrap}>
                  {t.image ? (
                    <Image source={{ uri: t.image }} style={styles.catImg} contentFit="contain" transition={180} />
                  ) : null}
                </View>
                <Text style={styles.catName} numberOfLines={1}>{t.name}</Text>
                <Text style={styles.catCount}>{t.count} {t.count === 1 ? 'prodotto' : 'prodotti'}</Text>
              </Pressable>
            ))}
          </Rail>
        </>
      ) : null}

      <View style={[styles.gridHead, gutter]}>
        <Text style={styles.gridTitle}>
          {cat === ALL ? (wide ? 'Catalogo' : 'Maglie da gara') : shopCategories.find((c) => c.slug === cat)?.name ?? ''}
        </Text>
        {cat !== ALL ? (
          <Pressable onPress={() => setCat(ALL)} hitSlop={10}>
            <Text style={styles.clear}>Tutti</Text>
          </Pressable>
        ) : null}
      </View>

      {list.length === 0 ? (
        <Empty text="Nessun prodotto in questa categoria." />
      ) : (
        <View style={[styles.grid, gutter]}>
          {list.map((p) => (
            <ProductCard key={p.id} product={p} width={cellWidth} tall={!wide} />
          ))}
        </View>
      )}

      <GroupNote>
        Vetrina ridotta per la demo. Il prezzo mostrato e simbolico, non quello del negozio:
        quello vero sta su calciofoggia1920.store, dove resta anche il carrello.
      </GroupNote>
    </Screen>
  );
}

/**
 * Scheda prodotto nella forma della reference: la foto riempie la tessera e
 * nome, prezzo e comando stanno sopra la foto in basso, non sotto in un
 * riquadro separato. Il cuore in alto a destra, il piu in basso a destra.
 */
function ProductCard({ product, width, tall = false }: {
  product: Product; width: number | `${number}%`; tall?: boolean;
}) {
  const [liked, setLiked] = useState(false);
  return (
    <Pressable
      onPress={() => router.push(`/product/${product.id}` as never)}
      style={({ pressed }) => [{ width }, pressed && { opacity: 0.85 }]}
    >
      <View style={[styles.card, tall && styles.cardTall]}>
        <View style={styles.cardImgWrap}>
          {product.image ? (
            <Image source={{ uri: product.image }} style={styles.cardImg} contentFit="contain" transition={200} />
          ) : (
            <Ionicons name="shirt-outline" size={30} color="#B9B6AE" />
          )}
        </View>

        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.30)', 'rgba(0,0,0,0.88)']}
          locations={[0, 0.4, 1]}
          style={styles.scrim}
        />

        {!product.inStock ? (
          <View style={styles.soldOut}><Text style={styles.soldOutText}>Esaurito</Text></View>
        ) : null}

        <Pressable
          onPress={() => setLiked((v) => !v)}
          hitSlop={8}
          style={styles.like}
          accessibilityLabel={liked ? 'Togli dai preferiti' : 'Aggiungi ai preferiti'}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={15} color={liked ? colors.accent : '#6E6B64'} />
        </Pressable>

        <View style={styles.cardFoot}>
          <View style={styles.cardText}>
            {/* i nomi del negozio sono lunghi ("TUTA RAPPRESENTANZA..."): su una
                riga sola restava una sigla, quindi ne servono due */}
            <Text style={styles.cardName} numberOfLines={2}>{product.name}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.cardPrice}>{euro(product.price)}</Text>
              <View style={styles.add}><Text style={styles.addText}>Vedi</Text></View>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circleRow: { gap: space.md, paddingTop: space.sm, paddingBottom: space.xs, alignItems: 'center' },
  filterBtn: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
  },
  filterBtnOn: { backgroundColor: colors.accent, borderColor: 'transparent' },
  circle: {
    width: 52, height: 52, borderRadius: 26, padding: 7,
    backgroundColor: '#F2F1EF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  circleOn: { borderColor: colors.accentBright },
  circleImg: { width: '100%', height: '100%' },
  circleText: { ...type.captionBold, color: '#4A4843' },

  catTile: { width: 132, gap: 4 },
  catImgWrap: {
    height: 96, borderRadius: radius.xl, backgroundColor: '#F2F1EF',
    alignItems: 'center', justifyContent: 'center', padding: space.md,
  },
  catImg: { width: '100%', height: '100%' },
  catName: { ...type.footnoteBold, color: colors.text, marginTop: 2 },
  catCount: { ...type.caption, color: colors.textFaint },

  gridHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: space.xl, marginBottom: space.md,
  },
  gridTitle: { ...type.title2, color: colors.text },
  clear: { ...type.subheadBold, color: colors.accentBright },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  card: {
    height: 196, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: '#F2F1EF',
  },
  cardTall: { height: 262 },
  cardImgWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.md },
  cardImg: { width: '100%', height: '100%' },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '64%' },
  soldOut: {
    position: 'absolute', top: space.sm, left: space.sm,
    backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm,
  },
  soldOutText: { ...type.captionBold, color: '#fff', fontSize: 10 },
  like: {
    position: 'absolute', top: space.sm, right: space.sm,
    width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.94)',
    alignItems: 'center', justifyContent: 'center',
  },
  cardFoot: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    padding: space.md,
  },
  cardText: { gap: 3 },
  cardName: { ...type.caption, fontSize: 11, lineHeight: 14, color: 'rgba(255,255,255,0.82)' },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  cardPrice: { ...type.title3, color: '#fff' },
  add: {
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 5,
  },
  addText: { ...type.captionBold, color: colors.onAccent },
});
