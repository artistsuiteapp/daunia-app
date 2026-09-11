import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Card, Empty, GroupLabel, GroupNote, ListGroup, ListRow, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { SoloConAccount } from '../../components/SoloConAccount';
import { colors, space, type } from '../../theme/tokens';
import { matchById, nextMatch } from '../../lib/data';
import { shortDate } from '../../lib/format';
import { useSessione } from '../../lib/auth';
import { useMieiPronostici, type MioPronostico } from '../../lib/pronostici';

/**
 * I miei pronostici, e come sono andati.
 *
 * SI MOSTRA QUELLO CHE HAI DETTO ACCANTO A QUELLO CHE E' SUCCESSO
 *
 * Un elenco di punti presi non dice niente: il senso e' vedere "avevo detto
 * 2-0, e' finita 2-1" e capire da soli di quanto si e' sbagliato. Il numero dei
 * punti sta a destra, piccolo, perche' e' la conseguenza e non la storia.
 */
export default function MieiPronostici() {
  const gutter = useGutter();
  const { utente } = useSessione();
  const { righe, striscia, caricato, chiusi, presi, esatti } = useMieiPronostici();

  const prossima = nextMatch();
  const giaFatto = prossima ? righe.some((r) => r.partita === prossima.id) : false;

  const ordinati = [...righe].sort((a, b) => {
    const ka = matchById(a.partita)?.kickoff ?? '';
    const kb = matchById(b.partita)?.kickoff ?? '';
    return kb.localeCompare(ka);
  });

  return (
    <Screen>
      <BackBar label="Match Center" />

      <View style={[gutter, { marginTop: space.sm }]}>
        <Text style={styles.titolo}>I tuoi pronostici</Text>
        <Text style={styles.sotto}>
          Esito indovinato 50 punti, risultato esatto 100. Si chiude al fischio d&apos;inizio.
        </Text>
      </View>

      {!utente ? (
        <View style={[gutter, { marginTop: space.lg }]}>
          <SoloConAccount cosa="I pronostici e la classifica hanno bisogno di un account." />
        </View>
      ) : !caricato ? (
        <View style={styles.attesa}><ActivityIndicator color={colors.accent} /></View>
      ) : (
        <>
          {chiusi > 0 ? (
            <View style={[styles.tiles, gutter, { marginTop: space.lg }]}>
              <Card style={styles.tile}>
                <Text style={styles.grande}>{presi}</Text>
                <Text style={styles.piccolo}>su {chiusi} indovinati</Text>
              </Card>
              <Card style={styles.tile}>
                <Text style={styles.grande}>{esatti}</Text>
                <Text style={styles.piccolo}>{esatti === 1 ? 'risultato esatto' : 'risultati esatti'}</Text>
              </Card>
              <Card style={styles.tile}>
                <Text style={[styles.grande, striscia >= 2 && { color: colors.accentBright }]}>{striscia}</Text>
                <Text style={styles.piccolo}>di fila</Text>
              </Card>
            </View>
          ) : null}

          {prossima && !giaFatto ? (
            <View style={[gutter, { marginTop: space.lg }]}>
              <Card style={styles.invito}>
                <Ionicons name="flash" size={18} color={colors.accentBright} />
                <Text style={styles.invitoTesto}>
                  Non hai ancora pronosticato {prossima.home.shortName}–{prossima.away.shortName}.
                </Text>
                <Text
                  style={styles.invitoLink}
                  onPress={() => router.push('/match-center' as never)}
                >
                  Fallo
                </Text>
              </Card>
            </View>
          ) : null}

          <GroupLabel>{ordinati.length ? 'Storico' : 'Nessun pronostico'}</GroupLabel>

          {ordinati.length === 0 ? (
            <Empty text="Il primo lo metti dal Match Center, prima del fischio d’inizio." />
          ) : (
            <View style={gutter}>
              <ListGroup>
                {ordinati.map((r) => <RigaPronostico key={r.partita} p={r} />)}
              </ListGroup>
            </View>
          )}
        </>
      )}

      <GroupNote>
        I pronostici degli altri si vedono solo a partita finita: prima, guardarli
        sarebbe copiarli.
      </GroupNote>
    </Screen>
  );
}

function RigaPronostico({ p }: { p: MioPronostico }) {
  const m = matchById(p.partita);
  const esatto = p.bonta === 3;
  const preso = (p.bonta ?? 0) > 0;

  return (
    <ListRow
      chevron
      onPress={() => router.push(`/match/${p.partita}` as never)}
      right={
        p.risultato ? (
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={[styles.punti, preso && { color: colors.win }]}>
              {p.punti ? `+${p.punti}` : '—'}
            </Text>
            <Text style={styles.esito}>
              {esatto ? 'esatto' : preso ? 'esito' : 'niente'}
            </Text>
          </View>
        ) : <Text style={styles.attesaRiga}>in attesa</Text>
      }
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.gara} numberOfLines={1}>
          {m ? `${m.home.shortName}–${m.away.shortName}` : p.partita}
        </Text>
        <Text style={styles.confronto}>
          hai detto {p.casa}–{p.ospiti}
          {p.risultato ? ` · è finita ${p.risultato.casa}–${p.risultato.ospiti}` : ''}
          {m ? ` · ${shortDate(m.kickoff)}` : ''}
        </Text>
      </View>
    </ListRow>
  );
}

const styles = StyleSheet.create({
  titolo: { ...type.displayTitle, color: colors.text },
  sotto: { ...type.footnote, color: colors.textDim, lineHeight: 19, marginTop: 4 },
  attesa: { paddingVertical: space.xl, alignItems: 'center' },

  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, padding: space.md, alignItems: 'center', gap: 2 },
  grande: { ...type.title2, color: colors.text },
  piccolo: { ...type.caption, color: colors.textDim, textAlign: 'center' },

  invito: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md },
  invitoTesto: { ...type.footnote, color: colors.text, flex: 1 },
  invitoLink: { ...type.footnoteBold, color: colors.accentBright },

  gara: { ...type.subhead, color: colors.text },
  confronto: { ...type.caption, color: colors.textFaint },
  punti: { ...type.subheadBold, color: colors.textDim },
  esito: { ...type.caption, color: colors.textFaint },
  attesaRiga: { ...type.caption, color: colors.textFaint },
});
