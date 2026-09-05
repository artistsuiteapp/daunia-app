import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme/tokens';

/**
 * Sfondo delle schermate d'ingresso.
 *
 * La citta e disegnata, non fotografata. Una foto di Foggia sarebbe di chi l'ha
 * scattata, e in un'app che chiede iscrizioni non ci si mette materiale altrui:
 * il profilo qui sotto riprende quello dentro il marchio, quindi e nostro e sta
 * insieme al resto senza stonare.
 *
 * Tre strati: il rosso che sale da destra come nella grafica di lancio, la
 * sagoma della citta in basso, e una velatura scura che tiene leggibile il testo.
 */
export function SfondoCitta({ intensita = 1 }: { intensita?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient
        colors={['#12060A', '#1A0709', '#08080A']}
        style={StyleSheet.absoluteFill}
      />

      {/* la lama rossa che taglia da destra, come sul manifesto */}
      <LinearGradient
        colors={[`rgba(214,20,20,${0.62 * intensita})`, `rgba(150,10,14,${0.24 * intensita})`, 'transparent']}
        start={{ x: 1.05, y: -0.1 }}
        end={{ x: 0.1, y: 0.75 }}
        style={StyleSheet.absoluteFill}
      />

      {/* La sagoma sta in fondo e non sale dietro al testo: ancorata al bordo
          inferiore con un'altezza sua, invece di riempire tutto lo schermo. */}
      <View style={styles.citta}>
        <Svg width="100%" height="100%" viewBox="0 0 100 56" preserveAspectRatio="none">
        <Defs>
          <SvgGradient id="sagoma" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#000000" stopOpacity="0.55" />
            <Stop offset="1" stopColor="#000000" stopOpacity="0.92" />
          </SvgGradient>
        </Defs>

        {/*
          Profilo della citta: il campanile alto a sinistra, i palazzi bassi,
          la cupola. Stesse proporzioni della sagoma nel marchio.
        */}
        <Path
          fill="url(#sagoma)"
          d="M0,56 L0,40 L6,40 L6,34 L10,34 L10,18 L12,14 L14,18 L14,34 L18,34 L18,28
             L24,28 L24,36 L30,36 L30,22 L32,18 L34,22 L34,36 L40,36 L40,30 L46,30
             L46,38 L52,38 L52,26 L56,20 L60,26 L60,38 L66,38 L66,32 L72,32 L72,40
             L78,40 L78,28 L82,28 L82,40 L88,40 L88,36 L94,36 L94,42 L100,42 L100,56 Z"
        />
        {/* la guglia del campanile */}
        <Path fill="url(#sagoma)" d="M11,18 L13,6 L15,18 Z" />
        <Rect x="12.4" y="1" width="1.2" height="6" fill="url(#sagoma)" />
        </Svg>
      </View>

      {/* velatura: senza, il testo bianco sul rosso si legge male */}
      <LinearGradient
        colors={['rgba(8,8,10,0.30)', 'rgba(8,8,10,0.14)', 'rgba(8,8,10,0.92)']}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  citta: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '34%' },
});
