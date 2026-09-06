import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, type } from '../theme/tokens';
import { useGutter } from './ui';

/**
 * Barra di ritorno in stile iOS: freccia e testo, non un bottone tondo.
 *
 * DUE COSE CHE PRIMA NON ANDAVANO
 *
 * Scorrendo la pagina spariva, perche viaggiava col contenuto. Ora ha un fondo
 * pieno e le schermate la tengono ferma in cima: un tasto per tornare indietro
 * che si deve andare a cercare non e un tasto per tornare indietro.
 *
 * E `router.back()` da solo non basta: se uno arriva da un collegamento
 * diretto, o da una notifica, non c'e nessun "indietro" e premere non faceva
 * niente. Adesso in quel caso si va a casa, che e sempre meglio di restare
 * bloccati.
 */
export function BackBar({ label = 'Indietro' }: { label?: string }) {
  const gutter = useGutter();
  return (
    <View style={[styles.wrap, gutter]}>
      <Pressable onPress={indietro} hitSlop={12} style={styles.btn}>
        <Ionicons name="chevron-back" size={22} color={colors.accentBright} />
        <Text style={styles.text}>{label}</Text>
      </Pressable>
    </View>
  );
}

/** Torna indietro, e se non c'e un indietro va a casa. */
export function indietro() {
  if (router.canGoBack()) router.back();
  else router.replace('/' as never);
}

const styles = StyleSheet.create({
  // il fondo pieno serve perche la barra resta ferma mentre il contenuto le
  // scorre sotto: senza, il testo passerebbe dietro alla freccia
  wrap: { paddingTop: space.sm, paddingBottom: space.sm, backgroundColor: colors.bg },
  btn: { flexDirection: 'row', alignItems: 'center', marginLeft: -6, alignSelf: 'flex-start' },
  text: { ...type.body, color: colors.accentBright },
});
