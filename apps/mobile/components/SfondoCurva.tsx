import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

/**
 * Lo sfondo dei richiami in home: la curva vista attraverso i fumogeni.
 *
 * Disegnato, non fotografato. Una foto della Curva Nord sarebbe di chi l'ha
 * scattata, e in un'app che chiede iscrizioni non si mette materiale altrui --
 * e la stessa regola per cui in tutta l'app non c'e nessuna fotografia di
 * terzi. Se un giorno arrivano foto nostre, questo componente si sostituisce.
 *
 * L'effetto e quello del fumo: tre aloni rossi di dimensione diversa, sfocati
 * dai gradienti radiali, su un fondo scuro. Sopra passa una velatura che tiene
 * il testo leggibile -- senza, il bianco su rosso acceso non si legge, ed e il
 * motivo per cui i fondi fotografici di solito falliscono.
 *
 * `intensita` alza o abbassa tutto insieme: le schede vive gridano un po' di
 * piu di quelle che stanno li e basta.
 */
export function SfondoCurva({ intensita = 1 }: { intensita?: number }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="fumo1" cx="18%" cy="30%" r="62%">
            <Stop offset="0" stopColor="#E5343E" stopOpacity={0.55 * intensita} />
            <Stop offset="1" stopColor="#E5343E" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="fumo2" cx="78%" cy="72%" r="55%">
            <Stop offset="0" stopColor="#FF5A45" stopOpacity={0.4 * intensita} />
            <Stop offset="1" stopColor="#FF5A45" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="fumo3" cx="52%" cy="6%" r="45%">
            <Stop offset="0" stopColor="#8A1016" stopOpacity={0.5 * intensita} />
            <Stop offset="1" stopColor="#8A1016" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="#140A0B" />
        <Circle cx="18%" cy="30%" r="62%" fill="url(#fumo1)" />
        <Circle cx="78%" cy="72%" r="55%" fill="url(#fumo2)" />
        <Circle cx="52%" cy="6%" r="45%" fill="url(#fumo3)" />
      </Svg>

      {/* la velatura: senza, il testo bianco sul rosso acceso non si legge */}
      <LinearGradient
        colors={['rgba(10,6,7,0.30)', 'rgba(10,6,7,0.72)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}
