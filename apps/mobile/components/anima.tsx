import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { colors, type } from '../theme/tokens';

/**
 * Il repertorio di animazioni dell'app.
 *
 * Tutto con l'Animated di React Native, senza librerie in piu: Reanimated non
 * ha il suo plugin Babel configurato qui e aggiungerlo rischia di rompere
 * l'export web, che e il modo in cui l'app si prova adesso.
 *
 * La regola che tiene insieme queste animazioni: durano poco e reagiscono a
 * qualcosa che ha fatto la persona. Un'animazione che parte da sola e che dura
 * mezzo secondo la seconda volta e gia fastidiosa.
 */

/* -------------------------------------------------------------------- Premi */

/**
 * Bottone che si schiaccia sotto il dito e torna su con una molla.
 *
 * E il gesto piu ripetuto dell'app, quindi e corto: comprimere di piu o piu a
 * lungo fa sembrare l'interfaccia lenta, non viva.
 */
export function Premi({ onPress, children, style, disabled = false, scala = 0.96 }: {
  onPress?: () => void;
  children: ReactNode;
  style?: ViewStyle | ViewStyle[];
  disabled?: boolean;
  scala?: number;
}) {
  const s = useRef(new Animated.Value(1)).current;

  const a = (to: number, tensione: number) => Animated.spring(s, {
    toValue: to, useNativeDriver: true, speed: 40, bounciness: tensione,
  });

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => a(scala, 0).start()}
      onPressOut={() => a(1, 10).start()}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }, disabled && { opacity: 0.45 }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------- Numero */

/**
 * Numero che sale invece di comparire.
 *
 * Serve dove il numero e il premio: i punti, la striscia, quanti tifosi hanno
 * gia schierato. Sotto i cento conta uno alla volta, sopra fa dei salti, cosi
 * la durata resta la stessa.
 */
export function Numero({ valore, stile, durata = 700 }: {
  valore: number; stile?: StyleProp<TextStyle>; durata?: number;
}) {
  const [mostrato, setMostrato] = useState(0);
  const da = useRef(0);

  useEffect(() => {
    const partenza = da.current;
    const delta = valore - partenza;
    if (delta === 0) return;
    const t0 = Date.now();
    const id = setInterval(() => {
      const k = Math.min(1, (Date.now() - t0) / durata);
      // rallenta alla fine: l'ultimo numero si legge, gli altri scorrono
      const morbido = 1 - (1 - k) ** 3;
      setMostrato(Math.round(partenza + delta * morbido));
      if (k >= 1) { clearInterval(id); da.current = valore; }
    }, 32);
    return () => clearInterval(id);
  }, [valore, durata]);

  return <Text style={stile}>{mostrato}</Text>;
}

/* ------------------------------------------------------------------- Fiamma */

/**
 * La striscia, con la fiamma che respira.
 *
 * Il respiro parte solo da due giornate in su: su una striscia di uno non c'e
 * ancora niente da difendere, e farla pulsare sarebbe una promessa vuota.
 */
export function Fiamma({ giornate }: { giornate: number }) {
  const p = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (giornate < 2) return;
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(p, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [p, giornate]);

  const scala = p.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });

  return (
    <View style={stili.fiamma}>
      <Animated.Text style={[stili.fuoco, { transform: [{ scale: scala }] }]}>🔥</Animated.Text>
      <Numero valore={giornate} stile={stili.strisciaNumero} />
      <Text style={stili.strisciaEtichetta}>
        {giornate === 1 ? 'giornata di fila' : 'giornate di fila'}
      </Text>
    </View>
  );
}

/* --------------------------------------------------------------- Coriandoli */

const PEZZI = 18;
const TINTE = [colors.accentBright, '#FFFFFF', '#FFC53D', colors.accent];

/**
 * Festeggiamento breve: pezzi di carta che partono dal centro e cadono.
 *
 * Si mostra una volta sola, quando uno azzecca l'undici intero. Se comparisse
 * anche per sette su undici smetterebbe di voler dire qualcosa.
 */
export function Coriandoli({ attivo }: { attivo: boolean }) {
  const t = useRef(new Animated.Value(0)).current;
  const semi = useRef(
    Array.from({ length: PEZZI }, (_, i) => ({
      x: (i / PEZZI) * 320 - 160 + (i % 3) * 18,
      ritardo: (i % 6) * 40,
      giro: i % 2 ? 1 : -1,
      tinta: TINTE[i % TINTE.length],
    })),
  ).current;

  useEffect(() => {
    if (!attivo) return;
    t.setValue(0);
    const a = Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [attivo, t]);

  if (!attivo) return null;

  return (
    <View pointerEvents="none" style={stili.coriandoli}>
      {semi.map((s, i) => (
        <Animated.View
          key={i}
          style={[
            stili.pezzo,
            { backgroundColor: s.tinta },
            {
              opacity: t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, s.x] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-10, 260] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${s.giro * 540}deg`] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------- Timbro */

/**
 * Comparsa a timbro: entra grande e si assesta.
 *
 * Per una cosa sola per schermata, quella che deve essere letta per prima.
 */
export function Timbro({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const s = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.spring(s, { toValue: 1, delay, useNativeDriver: true, speed: 12, bounciness: 9 });
    a.start();
    return () => a.stop();
  }, [s, delay]);

  return (
    <Animated.View
      style={{
        opacity: s,
        transform: [{ scale: s.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

const stili = StyleSheet.create({
  fiamma: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fuoco: { fontSize: 24 },
  strisciaNumero: { ...type.title2, color: colors.text },
  strisciaEtichetta: { ...type.footnote, color: colors.textDim },
  coriandoli: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 300,
    alignItems: 'center', justifyContent: 'flex-start', zIndex: 10,
  },
  pezzo: { position: 'absolute', width: 8, height: 12, borderRadius: 2 },
});
