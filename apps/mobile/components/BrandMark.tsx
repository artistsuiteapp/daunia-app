import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { brand } from '../theme/brand';

/**
 * Marchio del progetto.
 *
 * Deliberatamente lontano dallo stemma del club: quello e un tondo bianco con
 * bordo rosso e una figura al centro, questo e un quadrato con gli anelli di una
 * gradinata vista dall'alto. Stessi colori, perche i colori non si registrano,
 * ma nessuna somiglianza di forma: un segno "simile" a un marchio registrato e
 * proprio il caso che l'art. 20 del Codice della Proprieta Industriale vieta.
 */
export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel={brand.name}>
      <Defs>
        <LinearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brand.colors.redBright} />
          <Stop offset="1" stopColor="#8E0B10" />
        </LinearGradient>
      </Defs>

      <Rect x="0" y="0" width="100" height="100" rx="26" fill="url(#bm)" />

      {/* tre anelli di gradinata, aperti in basso come una curva vera */}
      <Path d="M22 62 A28 28 0 0 1 78 62" fill="none" stroke="#FFFFFF" strokeWidth="7" strokeLinecap="round" />
      <Path d="M31 66 A19 19 0 0 1 69 66" fill="none" stroke="#FFFFFF" strokeOpacity="0.62" strokeWidth="6" strokeLinecap="round" />
      <Path d="M40 70 A10 10 0 0 1 60 70" fill="none" stroke="#FFFFFF" strokeOpacity="0.34" strokeWidth="5" strokeLinecap="round" />

      {/* la linea del campo */}
      <Rect x="22" y="76" width="56" height="7" rx="3.5" fill={brand.colors.black} />
    </Svg>
  );
}
