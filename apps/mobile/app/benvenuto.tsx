import { useEffect, useRef } from 'react';
import { router } from 'expo-router';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, useGutter } from '../components/ui';
import { BrandMark } from '../components/BrandMark';
import { SfondoCitta } from '../components/SfondoCitta';
import { colors, radius, space, type } from '../theme/tokens';
import { continuaComeOspite } from '../lib/ospite';
import { foggiaRow, nextMatch } from '../lib/data';
import { shortDate } from '../lib/format';

/**
 * Prima schermata.
 *
 * Il gancio non e l'app in generale, e una cosa precisa che sta succedendo:
 * quanti tifosi hanno gia detto che vanno alla prossima, e che tu puoi entrare
 * in quel numero. Una schermata che dice "iscriviti per accedere a tutte le
 * funzioni" non convince nessuno, perche non nomina nulla.
 *
 * "Guarda e basta" e in chiaro, non nascosto in fondo: chi si sente costretto a
 * iscriversi chiude e non torna.
 */
export default function Benvenuto() {
  const gutter = useGutter();
  const next = nextMatch();
  const riga = foggiaRow();
  const entra = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entra, {
      toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, [entra]);

  const salita = entra.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });

  const comeOspite = async () => {
    await continuaComeOspite();
    router.replace('/' as never);
  };

  return (
    <Screen scroll={false}>
      <SfondoCitta />
      <View style={[styles.wrap, gutter]}>
        <Animated.View style={{ opacity: entra, transform: [{ translateY: salita }], alignItems: 'center', gap: space.md }}>
          <BrandMark size={124} />
          <Text style={styles.titolo}>Il Tifo della Daunia</Text>
          <Text style={styles.sotto}>Lo spazio dei tifosi rossoneri</Text>
        </Animated.View>

        {next ? (
          <Animated.View style={[styles.gancio, { opacity: entra }]}>
            <Text style={styles.gancioTesto}>
              <Text style={styles.gancioForte}>{next.home.shortName} – {next.away.shortName}</Text>
              {'  '}{shortDate(next.kickoff)}
            </Text>
            <Text style={styles.gancioNota}>
              Di’ dove ti siedi e guarda lo Zaccheria riempirsi. A fine partita dai i voti
              insieme agli altri, e prova a indovinare il risultato prima del fischio d’inizio.
            </Text>
          </Animated.View>
        ) : null}

        <View style={styles.numeri}>
          <Numero valore={riga ? `${riga.position}°` : '—'} etichetta="in classifica" />
          <View style={styles.sep} />
          <Numero valore={riga ? String(riga.points) : '—'} etichetta="punti" />
          <View style={styles.sep} />
          <Numero valore="5.329" etichetta="abbonati" />
        </View>

        <View style={styles.azioni}>
          <Pressable
            onPress={() => router.push('/accedi?modo=registrazione' as never)}
            style={({ pressed }) => [styles.principale, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.principaleTesto}>Crea il tuo account</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/accedi' as never)}
            style={({ pressed }) => [styles.secondaria, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.secondariaTesto}>Ho già un account</Text>
          </Pressable>

          <Pressable onPress={comeOspite} style={({ pressed }) => [styles.ospite, pressed && { opacity: 0.7 }]}>
            <Ionicons name="eye-outline" size={17} color={colors.textDim} />
            <Text style={styles.ospiteTesto}>Guarda senza account</Text>
          </Pressable>

          <Text style={styles.nota}>
            Senza account vedi tutto: partite, classifica, rosa, stadio e discussioni.
            Per scrivere, votare e pronosticare serve un nome.
          </Text>
        </View>
      </View>
    </Screen>
  );
}

function Numero({ valore, etichetta }: { valore: string; etichetta: string }) {
  return (
    <View style={styles.numero}>
      <Text style={styles.numeroValore}>{valore}</Text>
      <Text style={styles.numeroEtichetta}>{etichetta}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'center', gap: space.xl, paddingBottom: space.xxl },
  titolo: { ...type.displayTitle, color: colors.text, textAlign: 'center' },
  sotto: { ...type.subhead, color: colors.textDim, marginTop: -space.sm },

  gancio: {
    backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: radius.xl, padding: space.lg, gap: 6,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(238,17,17,0.4)',
  },
  gancioTesto: { ...type.subhead, color: colors.textDim },
  gancioForte: { ...type.headline, color: colors.text },
  gancioNota: { ...type.footnote, color: colors.textDim, lineHeight: 19 },

  numeri: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.42)', borderRadius: radius.xl, paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
  numero: { flex: 1, alignItems: 'center', gap: 1 },
  numeroValore: { ...type.number, fontSize: 22, color: colors.text },
  numeroEtichetta: { ...type.caption, fontSize: 11, color: colors.textFaint },
  sep: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: colors.separator },

  azioni: { gap: space.sm },
  principale: { backgroundColor: colors.accent, borderRadius: radius.xl, paddingVertical: 16, alignItems: 'center' },
  principaleTesto: { ...type.headline, color: colors.onAccent },
  secondaria: { backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: radius.xl, paddingVertical: 15, alignItems: 'center' },
  secondariaTesto: { ...type.headline, color: colors.text },
  ospite: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 13 },
  ospiteTesto: { ...type.subheadBold, color: colors.textDim },
  nota: { ...type.caption, color: colors.textFaint, textAlign: 'center', lineHeight: 17 },
});
