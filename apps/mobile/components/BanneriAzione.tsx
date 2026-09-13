import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { maiuscolaIniziale, useGutter } from './ui';
import { SfondoCurva } from './SfondoCurva';
import { colors, radius, space, type } from '../theme/tokens';
import { menoMovimento } from '../theme/motion';

export type Azione = {
  chiave: string;
  titolo: string;
  sotto: string;
  icona: keyof typeof Ionicons.glyphMap;
  rotta: string;
  /** il pallino verde che pulsa: usato solo per le cose che stanno accadendo */
  vivo?: boolean;
  /** la riga in alto: dice di cosa si tratta prima che uno legga il titolo */
  occhiello?: string;
  /** il numero grande a destra: un voto, una posizione */
  cifra?: string;
};

/** Quanti richiami si mostrano: quelli dopo il terzo hanno gia un posto altrove. */
const QUANTI = 3;

/**
 * I richiami in cima alla home.
 *
 * PRIMA SCORREVANO DA SOLI
 *
 * Erano un carosello che cambiava scheda ogni cinque secondi. Per chi legge
 * con calma e la cosa peggiore che si possa fare: la scheda se ne va mentre la
 * stai leggendo, e le altre si scoprono solo trascinando di lato. Le regole di
 * accessibilita chiedono che quello che si muove per piu di cinque secondi si
 * possa fermare, e qui l'unico modo era toccarlo.
 *
 * ADESSO STANNO FERMI, UNO SOTTO L'ALTRO
 *
 * Il primo e grande, perche e quello che scade prima (la home li ordina cosi);
 * gli altri due sono righe compatte. Si vedono tutti senza fare niente. Oltre
 * il terzo non si va: l'ultimo e "Scrivi nella Curva", che ha gia la sua voce
 * nella barra in fondo.
 */
export function BanneriAzione({ azioni }: { azioni: Azione[] }) {
  const gutter = useGutter();
  const visibili = azioni.slice(0, QUANTI);
  if (!visibili.length) return null;
  const [primo, ...altri] = visibili;

  return (
    <View style={[styles.blocco, gutter]}>
      <Pressable
        onPress={() => router.push(primo.rotta as never)}
        accessibilityRole="button"
        accessibilityLabel={[primo.occhiello, primo.titolo, primo.sotto].filter(Boolean).join('. ')}
        style={({ pressed }) => [styles.scheda, pressed && { opacity: 0.9 }]}
      >
        <SfondoCurva intensita={primo.vivo ? 1.15 : 0.85} />
        <View style={styles.dentro}>
          <View style={styles.riga}>
            {primo.vivo ? <Pallino /> : <Ionicons name={primo.icona} size={20} color="#FF8A7A" />}
            <Text style={styles.occhiello} numberOfLines={1}>
              {maiuscolaIniziale(primo.occhiello ?? 'da fare')}
            </Text>
          </View>

          <View style={styles.corpo}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titolo}>{primo.titolo}</Text>
              <Text style={styles.sotto}>{primo.sotto}</Text>
            </View>
            {primo.cifra ? <Text style={styles.cifra}>{primo.cifra}</Text> : null}
          </View>

          <View style={styles.piede}>
            <Text style={styles.vai}>Apri</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </View>
        </View>
      </Pressable>

      {altri.map((a) => (
        <Pressable
          key={a.chiave}
          onPress={() => router.push(a.rotta as never)}
          accessibilityRole="button"
          accessibilityLabel={[a.occhiello, a.titolo, a.sotto].filter(Boolean).join('. ')}
          style={({ pressed }) => [styles.rigaCompatta, pressed && { backgroundColor: colors.surfaceHi }]}
        >
          <View style={styles.bolla}>
            {a.vivo ? <Pallino /> : <Ionicons name={a.icona} size={22} color={colors.accentBright} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.titoloCompatto}>{a.titolo}</Text>
            <Text style={styles.sottoCompatto}>{a.sotto}</Text>
          </View>
          {a.cifra ? <Text style={styles.cifraCompatta}>{a.cifra}</Text> : null}
          <Ionicons name="chevron-forward" size={20} color={colors.textFaint} />
        </Pressable>
      ))}
    </View>
  );
}

/** Verde e pulsante: solo per le cose che stanno succedendo adesso. Fermo con "Riduci movimento". */
function Pallino() {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (menoMovimento()) return;
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.3, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [v]);
  return <Animated.View style={[styles.vivo, { opacity: v }]} />;
}

const styles = StyleSheet.create({
  blocco: { gap: space.sm, marginBottom: space.sm },
  scheda: {
    // alta abbastanza da reggere lo sfondo: sotto i centosessanta punti il
    // fumo si schiaccia e sembra una macchia, non un'atmosfera
    minHeight: 172,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.12)',
  },
  dentro: { flex: 1, padding: space.lg, gap: space.md, justifyContent: 'space-between' },
  riga: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  occhiello: { ...type.footnoteBold, color: '#FF8A7A' },
  corpo: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  titolo: { ...type.title2, color: '#fff' },
  sotto: { ...type.subhead, color: 'rgba(255,255,255,0.88)', marginTop: 4 },
  cifra: { ...type.largeTitle, color: '#fff', fontSize: 40, lineHeight: 46 },
  piede: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  vai: { ...type.headline, color: '#fff' },
  vivo: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#32D74B' },

  rigaCompatta: {
    flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 72,
    paddingHorizontal: space.lg, paddingVertical: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
  },
  bolla: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accentSoft,
    alignItems: 'center', justifyContent: 'center',
  },
  titoloCompatto: { ...type.headline, color: colors.text },
  sottoCompatto: { ...type.footnote, color: colors.textDim, marginTop: 2 },
  cifraCompatta: { ...type.numberSm, color: colors.text },
});
