import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors, radius, space, type } from '../theme/tokens';

/**
 * Copertina di un articolo.
 *
 * Non e una fotografia, ed e una scelta. Le immagini delle partite sono opere
 * dei fotografi che le hanno scattate: usarle qui vorrebbe dire prendersi il
 * lavoro di qualcuno. Al posto della foto c'e il numero che regge il pezzo,
 * grande, sul rosso: si legge a colpo d'occhio e non e di nessun altro.
 */
export type Cover = { big: string; label: string; tone?: 'red' | 'dark' };

export function ArticleCover({ cover, height = 180, compact = false }: {
  cover: Cover; height?: number; compact?: boolean;
}) {
  const dark = cover.tone === 'dark';
  return (
    <View style={[styles.wrap, { height }]}>
      <LinearGradient
        colors={dark ? ['#2A2A30', '#141416'] : ['#E01B24', '#8E0B10']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* archi di gradinata, gli stessi del marchio: legano la copertina all'app */}
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 60" preserveAspectRatio="xMidYMax slice">
        <Path d="M-10 58 A50 50 0 0 1 110 58" fill="none" stroke="#fff" strokeOpacity={0.10} strokeWidth="7" />
        <Path d="M6 58 A36 36 0 0 1 94 58" fill="none" stroke="#fff" strokeOpacity={0.08} strokeWidth="6" />
        <Path d="M22 58 A22 22 0 0 1 78 58" fill="none" stroke="#fff" strokeOpacity={0.06} strokeWidth="5" />
        <Circle cx="86" cy="14" r="26" fill="#fff" fillOpacity={0.05} />
      </Svg>

      <View style={[styles.body, compact && styles.bodyCompact]}>
        <Text
          style={[styles.big, compact && styles.bigCompact]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {cover.big}
        </Text>
        {!compact ? (
          <Text style={styles.label} numberOfLines={1}>{cover.label.toUpperCase()}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', borderRadius: radius.xl, overflow: 'hidden', justifyContent: 'flex-end' },
  bodyCompact: { padding: space.sm, alignItems: 'center', justifyContent: 'center', flex: 1 },
  // su web adjustsFontSizeToFit non fa niente: la misura va decisa qui,
  // altrimenti "5.329" diventa "5.3..."
  bigCompact: { fontSize: 13, lineHeight: 16, letterSpacing: 0 },
  body: { padding: space.lg, gap: 2 },
  big: { ...type.score, fontSize: 54, lineHeight: 58, color: '#fff' },
  label: { ...type.captionBold, color: 'rgba(255,255,255,0.75)', letterSpacing: 1.4 },
});
