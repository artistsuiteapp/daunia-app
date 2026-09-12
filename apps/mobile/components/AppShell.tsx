import { ReactNode, useMemo } from 'react';
import { Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { ViewportContext } from '../theme/responsive';
import { useTracciaPresenza } from '../lib/presenza';
import { VersioneNuova } from './VersioneNuova';
import { useApertura } from '../lib/misure';
import { colors, radius, space, type } from '../theme/tokens';
import { brand } from '../theme/brand';

/** Sotto questa larghezza il browser mostra l'app a tutto schermo, come un telefono. */
const FRAME_BREAKPOINT = 760;
const FRAME_WIDTH = 414;
const FRAME_MAX_HEIGHT = 896;


/**
 * Su desktop l'app va vista come app, non come sito.
 *
 * A tutta finestra le parti a pieno schermo (foto dell'intestazione, barra delle
 * schede, caroselli) si allargavano mentre il contenuto restava incolonnato al
 * centro, e il risultato sembrava scentrato. Qui l'intera app viene messa dentro
 * una cornice di larghezza fissa, centrata, e le sue dimensioni vengono
 * dichiarate a useLayout tramite ViewportContext.
 *
 * Su iOS e Android non fa nulla: children passano invariati.
 */
export function AppShell({ children }: { children: ReactNode }) {
  // chi ha l'app aperta risulta collegato, da qualsiasi schermata
  useTracciaPresenza();
  // e l'apertura si conta una volta per avvio, senza sapere chi e
  useApertura();
  const { width, height } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width >= FRAME_BREAKPOINT;

  const frame = useMemo(() => {
    // spazio riservato sotto alla cornice per la didascalia, piu un margine sopra
    const h = Math.min(FRAME_MAX_HEIGHT, Math.max(540, height - 132));
    return { width: FRAME_WIDTH, height: h };
  }, [height]);

  if (!framed) {
    return (
      <ViewportContext.Provider value={null}>
        {children}
        <VersioneNuova />
      </ViewportContext.Provider>
    );
  }

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={['#141014', '#0b0b0e', '#000000']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glow} />

      <View style={styles.stage}>
        <View style={[styles.device, { width: frame.width, height: frame.height }]}>
          <View style={styles.screen}>
            <ViewportContext.Provider value={frame}>
              {children}
              <VersioneNuova />
            </ViewportContext.Provider>
          </View>
        </View>

        <View style={styles.caption}>
          <Text style={styles.captionTitle}>{brand.name}</Text>
          <Text style={styles.captionText}>
{brand.about}
          </Text>
          <Text style={styles.captionText}>{brand.disclaimer}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0C' },
  glow: {
    position: 'absolute', width: 720, height: 720, borderRadius: 360,
    backgroundColor: colors.accent, opacity: 0.06,
  },
  stage: { alignItems: 'center', gap: space.lg, paddingVertical: space.xl },
  device: {
    borderRadius: 46,
    backgroundColor: '#000',
    borderWidth: 8,
    borderColor: '#1C1C1E',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.6,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 24 },
  },
  screen: { flex: 1, backgroundColor: colors.bg, borderRadius: 38, overflow: 'hidden' },
  caption: { alignItems: 'center', gap: 2 },
  captionTitle: { ...type.subheadBold, color: colors.textDim, letterSpacing: 0.6 },
  captionText: { ...type.caption, color: colors.textFaint },
});
