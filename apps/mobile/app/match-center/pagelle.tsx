import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen, Empty, GroupLabel, GroupNote, ListGroup, ListRow, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { colors, radius, space, type } from '../../theme/tokens';
import { playedMatches } from '../../lib/data';
import { shortDate } from '../../lib/format';
import { useArchivioPagelle } from '../../lib/archivio';

/**
 * Le pagelle di tutte le partite giocate.
 *
 * QUELLO CHE SI VEDE PRIMA E' SE C'E' QUALCOSA DA VEDERE
 *
 * La maggior parte delle gare passate non ha voti, e non e' un guasto: le
 * pagelle si danno nelle ventiquattr'ore dopo il fischio, e prima che l'app
 * avesse gli account non le dava nessuno. Una riga che dice "nessun voto" e'
 * un'informazione; una riga con uno zero al posto della media sarebbe una bugia.
 *
 * La media della squadra sta in evidenza perche e' il numero che si cerca:
 * "com'e' andata?" prima di "chi e' andato bene?".
 */
export default function ArchivioPagelle() {
  const gutter = useGutter();
  const partite = playedMatches();
  const { per, caricato } = useArchivioPagelle(partite.map((m) => m.id));

  const conVoti = partite.filter((m) => per[m.id]);

  return (
    <Screen>
      <BackBar label="Match Center" />

      <View style={[gutter, { marginTop: space.sm }]}>
        <Text style={styles.titolo}>Le pagelle</Text>
        <Text style={styles.sotto}>
          Il voto della Curva, partita per partita. Si vota nelle ventiquattr&apos;ore dopo il
          fischio finale; dopo resta il verdetto.
        </Text>
      </View>

      {!caricato ? (
        <View style={styles.attesa}><ActivityIndicator color={colors.accent} /></View>
      ) : partite.length === 0 ? (
        <Empty text="Non si è ancora giocato niente." />
      ) : (
        <>
          <GroupLabel>{conVoti.length ? 'Partite votate' : 'Nessuna partita votata'}</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              {partite.map((m) => {
                const r = per[m.id];
                return (
                  <ListRow
                    key={m.id}
                    chevron
                    onPress={() => router.push(`/match/${m.id}?tab=gioco` as never)}
                    right={r ? (
                      <View style={styles.mediaBox}>
                        <Text style={styles.media}>{r.media.toFixed(1)}</Text>
                        <Text style={styles.mediaEtichetta}>media</Text>
                      </View>
                    ) : <Text style={styles.niente}>—</Text>}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={styles.gara} numberOfLines={1}>
                        {m.home.shortName} {m.score?.home}–{m.score?.away} {m.away.shortName}
                      </Text>
                      <Text style={styles.dettaglio} numberOfLines={1}>
                        {r
                          ? `${shortDate(m.kickoff)} · ${r.votanti} ${r.votanti === 1 ? 'voto' : 'votanti'}${r.migliore ? ` · il migliore: ${r.migliore}` : ''}`
                          : `${shortDate(m.kickoff)} · nessun voto`}
                      </Text>
                    </View>
                  </ListRow>
                );
              })}
            </ListGroup>
          </View>
        </>
      )}

      <GroupNote>
        I voti singoli restano privati: escono solo le medie. Il migliore compare
        quando almeno tre persone hanno votato — sotto, il primo che vota deciderebbe da solo.
      </GroupNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  titolo: { ...type.displayTitle, color: colors.text },
  sotto: { ...type.footnote, color: colors.textDim, lineHeight: 19, marginTop: 4 },
  attesa: { paddingVertical: space.xl, alignItems: 'center' },
  gara: { ...type.subhead, color: colors.text },
  dettaglio: { ...type.caption, color: colors.textFaint },
  mediaBox: { alignItems: 'flex-end' },
  media: { ...type.title3, color: '#E8C547' },
  mediaEtichetta: { ...type.caption, color: colors.textFaint, marginTop: -2 },
  niente: { ...type.subhead, color: colors.textFaint },
  vuoto: { borderRadius: radius.lg },
});
