import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { brand } from '../theme/brand';
import { BrandMark } from './BrandMark';
import { colors, radius, space, type } from '../theme/tokens';
import { useLayout } from '../theme/responsive';
import { FormStrip } from './FormStrip';

type Props = {
  crest: string | null;
  competition: string;
  season: string;
  form: Array<'W' | 'D' | 'L'>;
  position?: number | null;
  points?: number | null;
};

/**
 * Testata della home.
 *
 * Impianto preso dalla reference: stemma grande a sinistra, titolo su due righe
 * con la seconda molto piu pesante della prima, dati di stagione sotto. Lo
 * stemma entra scalando e resta la cosa piu grande della schermata.
 */
export function BrandHeader({ crest, competition, season, form, position, points }: Props) {
  const { gutter } = useLayout();
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1, duration: 620, delay: 120,
      easing: Easing.out(Easing.back(1.4)), useNativeDriver: true,
    }).start();
  }, [enter]);

  const scale = enter.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] });

  return (
    <View style={[styles.wrap, { paddingHorizontal: space.lg + gutter }]}>
      <LinearGradient
        colors={['rgba(204,17,17,0.30)', 'rgba(204,17,17,0.06)', 'transparent']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.row}>
        <Animated.View style={{ transform: [{ scale }], opacity: enter }}>
          <BrandMark size={104} />
        </Animated.View>

        <View style={styles.titleCol}>
          <Text style={styles.line1}>Il tifo della</Text>
          <Text style={styles.line2}>{brand.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {competition} · Girone C · {season.replace('-', '/')}
          </Text>
        </View>
      </View>

      <View style={styles.stats}>
        {position != null ? (
          <>
            <Stat value={`${position}°`} label="classifica" />
            <View style={styles.sep} />
            <Stat value={String(points ?? '-')} label="punti" />
          </>
        ) : null}
        {form.length ? (
          <>
            <View style={styles.sep} />
            <View style={styles.formCol}>
              <FormStrip form={form} size={18} />
              <Text style={styles.statLabel}>andamento</Text>
            </View>
          </>
        ) : null}
      </View>

      {!brand.official ? <Text style={styles.disclaimer}>{brand.disclaimer}</Text> : null}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCol}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: space.sm, paddingBottom: space.lg, overflow: 'hidden' },

  row: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  crest: { width: 104, height: 104 },
  titleCol: { flex: 1 },
  line1: { ...type.title3, fontWeight: '400', color: colors.textDim },
  line2: {
    fontFamily: type.score.fontFamily, fontSize: 46, lineHeight: 48,
    color: colors.text, letterSpacing: -0.5,
  },
  meta: { ...type.footnote, color: colors.textFaint, marginTop: 4 },

  stats: {
    flexDirection: 'row', alignItems: 'center', gap: space.lg,
    marginTop: space.lg, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.xl, paddingVertical: space.md, paddingHorizontal: space.lg,
  },
  statCol: { gap: 1 },
  formCol: { gap: 4 },
  statValue: { ...type.title3, color: colors.text },
  statLabel: { ...type.caption, color: colors.textFaint },
  sep: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.separator },

  disclaimer: { ...type.caption, color: colors.textFaint, marginTop: space.md },
});
