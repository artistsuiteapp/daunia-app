import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@satanelli/core';

import { Premi, Numero } from './anima';
import { colors, radius, space, type } from '../theme/tokens';
import { ROSA_XI } from '../lib/curva-core';
import { useCurva, miaFormazione, undiciCurva, striscia } from '../lib/curva';
import { leagueMatches } from '../lib/data';

/**
 * L'invito a schierare, sulla home, subito sotto la prossima partita.
 *
 * Dice una cosa sola e la cambia a seconda di dove sei: se non hai schierato ti
 * chiede chi deve giocare, se hai schierato ti dice quanti tifosi ci sono
 * adesso, e se hai una striscia ti ricorda cosa rischi. Un invito che dice
 * sempre la stessa frase smette di essere letto dopo due domeniche.
 */
export function InvitoCurva({ match }: { match: Match }) {
  useCurva(match.id);

  const mia = miaFormazione(match.id);
  const { votanti } = undiciCurva(match.id);
  const giocate = leagueMatches()
    .filter((m) => m.status === 'finished' && m.kickoff)
    .sort((a, b) => Date.parse(a.kickoff!) - Date.parse(b.kickoff!))
    .map((m) => m.id);
  const giornate = striscia(giocate);
  const fatta = mia.length === ROSA_XI;

  return (
    <Premi onPress={() => router.push('/formazione' as never)} style={styles.card}>
      <View style={styles.icona}>
        <Ionicons name={fatta ? 'checkmark-done' : 'shirt'} size={20} color={colors.accentBright} />
      </View>

      <View style={styles.testo}>
        <Text style={styles.titolo}>
          {fatta ? 'La tua formazione è schierata' : 'Chi deve giocare?'}
        </Text>
        <Text style={styles.riga} numberOfLines={2}>
          {fatta
            ? votanti > 1
              ? `Sei uno di ${votanti} tifosi. L'undici vero arriva un'ora prima del fischio.`
              : 'Ora aspetta quella vera, un\'ora prima del fischio.'
            : giornate >= 2
              ? `Hai ${giornate} giornate di fila. Schiera e non perdere la striscia.`
              : 'Schiera il tuo undici prima che lo faccia il mister.'}
        </Text>
      </View>

      {giornate > 0 ? (
        <View style={styles.striscia}>
          <Text style={styles.fuoco}>🔥</Text>
          <Numero valore={giornate} stile={styles.strisciaNum} />
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textFaint} />
      )}
    </Premi>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: space.md, borderWidth: 1, borderColor: colors.accentSoft,
  },
  icona: {
    width: 40, height: 40, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft,
  },
  testo: { flex: 1, gap: 2 },
  titolo: { ...type.headline, color: colors.text },
  riga: { ...type.caption, color: colors.textDim },
  striscia: { alignItems: 'center' },
  fuoco: { fontSize: 17 },
  strisciaNum: { ...type.captionBold, color: colors.text },
});
