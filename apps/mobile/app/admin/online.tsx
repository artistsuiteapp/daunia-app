import { StyleSheet, Text, View } from 'react-native';

import { Screen, LargeTitle, Empty, GroupNote, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Avatar } from '../../components/Avatar';
import { NomeUtente } from '../../components/NomeUtente';
import { colors, radius, space, type } from '../../theme/tokens';
import { puoModerare, useRuolo } from '../../lib/moderazione';
import { usePresenza } from '../../lib/presenza';

/**
 * Chi c'e adesso.
 *
 * Non e una cronologia: non si sa chi c'era ieri e non si sapra chi c'e stato
 * oggi. E una fotografia di adesso, e quando uno chiude l'app sparisce. Una
 * lista di presenze salvata sarebbe un registro delle abitudini di ognuno, e
 * non serve a moderare niente.
 */
export default function Online() {
  const ruolo = useRuolo();
  const gutter = useGutter();
  const { presenti, quanti } = usePresenza(puoModerare(ruolo));

  if (!puoModerare(ruolo)) {
    return (
      <Screen>
        <BackBar label="Pannello" />
        <Empty text="Questa parte è per chi modera." />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackBar label="Pannello" />
      <LargeTitle
        title="Chi c’è"
        subtitle={quanti === 0 ? 'Nessuno collegato' : quanti === 1 ? 'Una persona' : `${quanti} persone`}
      />

      {presenti.length === 0 ? (
        <Empty text="In questo momento non c’è nessuno. Succede fra una partita e l’altra." />
      ) : (
        <View style={[gutter, { gap: space.sm, marginTop: space.md }]}>
          {presenti.map((p) => (
            <View key={p.utente} style={stili.riga}>
              <View>
                <Avatar uri={p.avatar} name={p.nome} size={38} />
                <View style={stili.pallino} />
              </View>
              <View style={{ flex: 1 }}>
                <NomeUtente id={p.utente} nome={p.nome} />
                <Text style={stili.da}>Da {minuti(p.da)}</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <GroupNote>
        Si aggiorna da solo. Chi chiude l’app sparisce da qui dopo pochi secondi, e non resta
        traccia di chi c’era.
      </GroupNote>
    </Screen>
  );
}

function minuti(da: number): string {
  const m = Math.max(0, Math.round((Date.now() - da) / 60000));
  if (m < 1) return 'poco fa';
  if (m === 1) return 'un minuto';
  if (m < 60) return `${m} minuti`;
  const h = Math.round(m / 60);
  return h === 1 ? 'un’ora' : `${h} ore`;
}

const stili = StyleSheet.create({
  riga: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: space.lg, paddingVertical: space.md,
  },
  pallino: {
    position: 'absolute', right: -1, bottom: -1, width: 12, height: 12,
    borderRadius: 6, backgroundColor: colors.win,
    borderWidth: 2, borderColor: colors.surface,
  },
  da: { ...type.caption, color: colors.textFaint, marginTop: 1 },
});
