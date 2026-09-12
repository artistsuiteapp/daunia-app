import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Premi } from './anima';
import { colors, radius, space, type } from '../theme/tokens';
import { useSafeInsets } from '../lib/viewport';
import { ricarica, useVersioneNuova } from '../lib/versione';

/**
 * La riga che avvisa quando c'e una versione nuova.
 *
 * Sta in alto e non in fondo: in fondo c'e gia la barra delle schede, e due
 * cose sovrapposte in fondo allo schermo si coprono a vicenda.
 *
 * Non ricarica da sola. Chi sta scrivendo una risposta nella Curva se la
 * vedrebbe cancellare, e non capirebbe perche.
 */
export function VersioneNuova() {
  const nuova = useVersioneNuova();
  const insets = useSafeInsets();

  if (!nuova) return null;

  return (
    <View style={[stili.fascia, { paddingTop: insets.top + space.sm }]} pointerEvents="box-none">
      <Premi onPress={ricarica} etichetta="Aggiorna l’app" style={stili.riga}>
        <Ionicons name="arrow-down-circle" size={18} color={colors.onAccent} />
        <Text style={stili.testo}>C’è una versione nuova</Text>
        <Text style={stili.azione}>Aggiorna</Text>
      </Premi>
    </View>
  );
}

const stili = StyleSheet.create({
  fascia: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 50,
    alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.sm,
  },
  riga: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.pill,
    paddingHorizontal: space.lg, paddingVertical: 11,
    maxWidth: 420, width: '100%', justifyContent: 'center',
  },
  testo: { ...type.subheadBold, color: colors.onAccent, flexShrink: 1 },
  azione: { ...type.subheadBold, color: colors.onAccent, textDecorationLine: 'underline' },
});
