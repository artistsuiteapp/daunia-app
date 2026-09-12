import { ReactNode, useEffect, useRef, useState } from 'react';
import {
  Animated, Easing, Pressable, StyleSheet, Text, View,
  type StyleProp, type TextStyle, type ViewStyle,
} from 'react-native';

import { colors, type } from '../theme/tokens';
import { curva, durata, menoMovimento, molla, quanto } from '../theme/motion';

/**
 * Il repertorio di animazioni dell'app.
 *
 * Tutto con l'Animated di React Native, senza librerie in piu: Reanimated non
 * ha il suo plugin Babel configurato qui e aggiungerlo rischia di rompere
 * l'export web, che e il modo in cui l'app si prova adesso.
 *
 * Durate e curve non stanno piu qui: stanno in theme/motion.ts, una volta sola,
 * cosi l'app si muove con la stessa mano dappertutto. Chi ha chiesto meno
 * movimento nelle impostazioni del telefono le trova tutte a zero.
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
 *
 * Oltre alla scala c'e un velo che scurisce. Sul telefono la scala basta; con
 * il mouse no, perche il dito non copre niente e senza il cambio di colore non
 * si capisce se il clic e arrivato.
 */
export function Premi({
  onPress, onLongPress, children, style, contenitore, disabled = false, scala = 0.96, etichetta,
}: {
  onPress?: () => void;
  onLongPress?: () => void;
  children: ReactNode;
  /** l'aspetto: fondo, bordi, spaziature. Sta sul pezzo che si schiaccia. */
  style?: StyleProp<ViewStyle>;
  /**
   * La posizione dentro il genitore: larghezza, flex, quanto spazio prende.
   *
   * Va tenuta separata perche il pezzo che si schiaccia sta DENTRO il tasto,
   * e in una griglia e il tasto quello che deve sapere quanto e largo. Messa
   * insieme all'aspetto, le quattro schede del Match Center si mettevano in
   * colonna, ognuna larga quanto il suo testo.
   */
  contenitore?: StyleProp<ViewStyle>;
  disabled?: boolean;
  scala?: number;
  etichetta?: string;
}) {
  const s = useRef(new Animated.Value(1)).current;
  const [giu, setGiu] = useState(false);

  const a = (to: number, config: { speed: number; bounciness: number }) => Animated.spring(s, {
    toValue: menoMovimento() ? 1 : to, useNativeDriver: true, ...config,
  });

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={etichetta}
      // otto punti in piu tutto intorno: la regola dei bersagli vicini vuole
      // spazio fra una cosa toccabile e l'altra, e questo lo aggiunge senza
      // allargare il disegno
      hitSlop={8}
      onPressIn={() => { setGiu(true); a(scala, molla.tasto).start(); }}
      onPressOut={() => { setGiu(false); a(1, molla.ritorno).start(); }}
      style={contenitore}
    >
      <Animated.View
        style={[
          style,
          { transform: [{ scale: s }] },
          giu && !disabled && { opacity: 0.72 },
          disabled && { opacity: 0.45 },
        ]}
      >
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
 *
 * PERCHE requestAnimationFrame E NON UN INTERVALLO
 *
 * Con un setInterval ogni 32 millisecondi il numero si riscriveva ventidue
 * volte anche quando il valore mostrato non cambiava — e ogni riscrittura
 * ridisegna tutto il blocco intorno. Con piu numeri sulla stessa schermata era
 * una delle cose che facevano impuntare lo scorrimento. Adesso si aggiorna
 * quando il browser sta gia per disegnare, e solo se la cifra e cambiata
 * davvero.
 */
export function Numero({ valore, stile, durata: ms = durata.lunga }: {
  valore: number; stile?: StyleProp<TextStyle>; durata?: number;
}) {
  const [mostrato, setMostrato] = useState(valore);
  const da = useRef(valore);

  useEffect(() => {
    const partenza = da.current;
    const delta = valore - partenza;
    if (delta === 0) return;

    const corsa = quanto(ms);
    if (corsa === 0) { da.current = valore; setMostrato(valore); return; }

    const t0 = Date.now();
    let ultimo = partenza;
    let frame = 0;

    const passo = () => {
      const k = Math.min(1, (Date.now() - t0) / corsa);
      // rallenta alla fine: l'ultimo numero si legge, gli altri scorrono
      const morbido = 1 - (1 - k) ** 3;
      const adesso = Math.round(partenza + delta * morbido);
      if (adesso !== ultimo) { ultimo = adesso; setMostrato(adesso); }
      if (k < 1) frame = requestAnimationFrame(passo);
      else da.current = valore;
    };

    frame = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(frame);
  }, [valore, ms]);

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
    if (giornate < 2 || menoMovimento()) return;
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(p, { toValue: 1, duration: 900, easing: curva.morbida, useNativeDriver: true }),
      Animated.timing(p, { toValue: 0, duration: 900, easing: curva.morbida, useNativeDriver: true }),
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
    if (!attivo || menoMovimento()) return;
    t.setValue(0);
    const a = Animated.timing(t, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: true });
    a.start();
    return () => a.stop();
  }, [attivo, t]);

  if (!attivo || menoMovimento()) return null;

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
  const s = useRef(new Animated.Value(menoMovimento() ? 1 : 0)).current;

  useEffect(() => {
    if (menoMovimento()) { s.setValue(1); return; }
    const a = Animated.spring(s, { toValue: 1, delay, useNativeDriver: true, ...molla.timbro });
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

/* ------------------------------------------------------------------ Apparsa */

/**
 * Dissolvenza quando il contenuto cambia sotto lo stesso titolo.
 *
 * Serve dove si preme un filtro e la lista sotto diventa un'altra: settimana,
 * mese, stagione. Senza, il contenuto si sostituisce in un fotogramma e
 * l'occhio non capisce se ha premuto o se e cambiato qualcosa da solo. Con una
 * dissolvenza di un decimo di secondo si capisce senza doverci pensare.
 *
 * `chiave` e quello che, cambiando, fa ripartire la dissolvenza.
 */
export function Apparsa({ chiave, children, style }: {
  chiave: string | number;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const o = useRef(new Animated.Value(1)).current;
  const primo = useRef(true);

  useEffect(() => {
    if (primo.current) { primo.current = false; return; }
    if (menoMovimento()) { o.setValue(1); return; }
    o.setValue(0);
    const a = Animated.timing(o, {
      toValue: 1, duration: durata.corta, easing: curva.entra, useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [chiave, o]);

  return <Animated.View style={[style, { opacity: o }]}>{children}</Animated.View>;
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
