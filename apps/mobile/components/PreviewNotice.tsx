import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { brand } from '../theme/brand';
import { colors, radius, space, type } from '../theme/tokens';

const KEY = 'satanelli.preview-notice.v1';
const IS_PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === '1';

function alreadySeen() {
  if (Platform.OS !== 'web') return false;
  try {
    return window.localStorage.getItem(KEY) === '1';
  } catch {
    return false; // navigazione privata: si rimostra, non si rompe
  }
}

function remember() {
  if (Platform.OS !== 'web') return;
  try {
    window.localStorage.setItem(KEY, '1');
  } catch {
    /* niente da fare, il badge tornera al prossimo caricamento */
  }
}

/**
 * Avviso mostrato solo nella build condivisa fuori (EXPO_PUBLIC_PREVIEW=1).
 *
 * Chi apre il link deve sapere subito tre cose: che e un prototipo, che non ha
 * niente a che vedere con la societa, e che i dati arrivano da fonti pubbliche.
 * La didascalia sotto la cornice del telefono si vede solo da computer, quindi
 * da telefono servirebbe altrimenti niente.
 */
export function PreviewNotice() {
  const [open, setOpen] = useState(() => IS_PREVIEW && !alreadySeen());
  const enter = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) return;
    Animated.timing(enter, {
      toValue: 1,
      duration: 420,
      delay: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, enter]);

  if (!open) return null;

  const close = () => {
    remember();
    Animated.timing(enter, {
      toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => setOpen(false));
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          opacity: enter,
          transform: [
            { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          ],
        },
      ]}
    >
      <View style={styles.card}>
        <View style={styles.dot} />
        <View style={styles.body}>
          <Text style={styles.title}>Anteprima privata</Text>
          <Text style={styles.text}>
            Prototipo non ufficiale, non affiliato al {brand.clubName}. Dati sportivi da
            fonti pubbliche, marchi dei rispettivi titolari.
          </Text>
        </View>
        <Pressable onPress={close} hitSlop={12} style={styles.close}>
          <Text style={styles.closeText}>Ho capito</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    // sopra la barra delle schede, altrimenti la copre e non si raggiungono le voci
    position: 'absolute', left: space.md, right: space.md, bottom: 96,
    zIndex: 90,
  },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: space.sm,
    padding: space.md, borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.16)',
    // tinta piena, non sfocatura: su web il blur resta trasparente e il testo
    // dell'avviso finiva sopra il contenuto della pagina
    backgroundColor: '#17171B',
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 }, elevation: 12,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent, marginTop: 5 },
  body: { flex: 1, gap: 3 },
  title: { ...type.subheadBold, color: colors.text },
  text: { ...type.caption, color: colors.textDim, lineHeight: 16 },
  close: { paddingHorizontal: space.sm, paddingVertical: 4, alignSelf: 'center' },
  closeText: { ...type.captionBold, color: colors.accent },
});
