import { Linking, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@satanelli/core';

import { Premi } from './anima';
import { colors, radius, space, type } from '../theme/tokens';

/**
 * "Attenzione: si gioca da un'altra parte."
 *
 * Non basta correggere il nome dello stadio nella scheda: chi segue il Foggia
 * sa gia dove gioca il Monopoli e parte senza rileggere. Questo riquadro dice
 * a voce alta che il campo e cambiato, e da dove viene la notizia -- perche su
 * una cosa che costa un viaggio la fonte va vista, non promessa.
 */
/**
 * "allo Stadio San Nicola", non "a Stadio San Nicola".
 *
 * Sembra un dettaglio e non lo e: questa riga la legge chi deve decidere in
 * fretta se partire, e una frase che suona sbagliata la si rilegge due volte.
 */
function allo(nome: string | null): string {
  const n = String(nome ?? '').trim();
  if (!n) return '';
  if (/^[AEIOUaeiou]/.test(n)) return `all'${n}`;
  if (/^[Ss][^aeiouAEIOU]/.test(n)) return `allo ${n}`;
  return `al ${n}`;
}

function dove(match: Match): string {
  const campo = allo(match.venue ?? '');
  return match.city ? `${campo} di ${match.city}` : campo;
}

export function CampoSpostato({ match, chiaro = false }: { match: Match; chiaro?: boolean }) {
  const c = match.campoSpostato;
  if (!c) return null;

  return (
    <View style={[styles.scatola, chiaro && styles.scatolaChiara]}>
      <View style={styles.riga}>
        <Ionicons name="warning" size={18} color={colors.zonePlayout} />
        <Text style={[styles.forte, chiaro && styles.forteChiaro]}>Attenzione: campo cambiato</Text>
      </View>
      <Text style={[styles.testo, chiaro && styles.testoChiaro]}>
        Si gioca {dove(match)}{c.eraPrevisto ? `, non ${allo(c.eraPrevisto)}` : ''}.
        {c.perche ? ` ${c.perche}` : ''}
      </Text>
      {c.fonti.length ? (
        <Premi onPress={() => Linking.openURL(c.fonti[0])} scala={1}>
          <Text style={styles.fonte}>Da dove viene la notizia ›</Text>
        </Premi>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scatola: {
    marginTop: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    backgroundColor: 'rgba(245,166,35,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.45)',
    gap: 4,
  },
  scatolaChiara: { backgroundColor: 'rgba(245,166,35,0.10)' },
  riga: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  forte: { ...type.subheadBold, color: '#FFD79A', flex: 1 },
  forteChiaro: { color: '#8A5A00' },
  testo: { ...type.caption, color: 'rgba(255,255,255,0.78)' },
  testoChiaro: { color: colors.textDim },
  fonte: { ...type.caption, color: colors.accent, marginTop: 2 },
});
