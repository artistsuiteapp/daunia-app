import { useMemo } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Screen, Badge, Empty, GroupNote, ListGroup, ListRow, useGutter } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Crest } from '../components/Crest';
import { Countdown } from '../components/Countdown';
import { MatchCenter } from '../components/MatchCenter';
import { colors, space, type } from '../theme/tokens';
import { matches, nextMatch, playedMatches } from '../lib/data';
import { lineupPerPartita } from '../lib/lineup';
import { useLive, liveDi } from '../lib/live';
import { etichettaFase } from '../lib/live-core';
import { longDate } from '../lib/format';
import { faseDi } from '../lib/match-center-core';
import { useDatiPartita } from '../lib/fanplay';

/**
 * Il Match Center.
 *
 * QUALE PARTITA, SENZA CHIEDERLO
 *
 * Chi apre questa sezione ha in testa una partita sola, e cambia a seconda del
 * giorno: quella che si sta giocando se si gioca, se no la prossima, se no
 * l'ultima. Farla scegliere da un elenco sarebbe un passaggio in piu per
 * arrivare esattamente dove si sarebbe arrivati da soli.
 *
 * L'ultima giocata resta raggiungibile anche quando ce n'e una in arrivo: le
 * pagelle si danno nelle ventiquattr'ore dopo, e capita che in mezzo ci sia
 * gia il calendario della prossima.
 */
export default function MatchCenterSchermata() {
  const gutter = useGutter();
  const live = useLive();

  const inCorso = useMemo(
    () => matches.find((m) => liveDi(m, live) !== null) ?? null,
    [live],
  );
  const prossima = nextMatch();
  const ultima = playedMatches().slice(-1)[0] ?? null;
  const match = inCorso ?? prossima ?? ultima;

  const vivo = liveDi(match, live);
  const lineup = useMemo(
    () => lineupPerPartita(match?.kickoff ? match.kickoff.slice(0, 10) : undefined, match?.id, Boolean(vivo)),
    [match?.kickoff, match?.id, vivo],
  );
  useDatiPartita(match?.id ?? null, true);

  if (!match) {
    return (
      <Screen testaFissa>
        <BackBar label="Home" />
        <Empty text="Nessuna partita in calendario." />
      </Screen>
    );
  }

  const fase = faseDi(match, vivo);
  const altra = inCorso ? null : (prossima && ultima && prossima.id !== match.id ? prossima : (ultima && ultima.id !== match.id ? ultima : null));

  return (
    <Screen>
      <BackBar label="Home" />

      <View style={[styles.testa, gutter]}>
        <Badge label={ETICHETTA[fase]} tone={fase === 'live' || fase === 'intervallo' ? 'live' : 'accent'} />
        <View style={styles.squadre}>
          <View style={styles.lato}>
            <Crest uri={match.home.crest} name={match.home.shortName} size={38} />
            <Text style={styles.nome} numberOfLines={1}>{match.home.shortName}</Text>
          </View>
          <View style={styles.centro}>
            {vivo || match.score
              ? <Text style={styles.punteggio}>{vivo ? `${vivo.casa ?? 0}–${vivo.ospite ?? 0}` : `${match.score!.home}–${match.score!.away}`}</Text>
              : <Text style={styles.vs}>vs</Text>}
          </View>
          <View style={styles.lato}>
            <Crest uri={match.away.crest} name={match.away.shortName} size={38} />
            <Text style={styles.nome} numberOfLines={1}>{match.away.shortName}</Text>
          </View>
        </View>
        <Text style={styles.quando}>
          {vivo && !vivo.finita ? etichettaFase(vivo, match.kickoff) : longDate(match.kickoff)}
        </Text>
      </View>

      {fase === 'prima' && match.kickoff ? (
        <View style={[gutter, { marginTop: space.lg }]}><Countdown kickoff={match.kickoff} /></View>
      ) : null}

      <MatchCenter match={match} fase={fase} lineup={lineup} />

      <View style={[gutter, { marginTop: space.xl }]}>
        <ListGroup>
          <ListRow chevron onPress={() => router.push(`/match/${match.id}` as never)}>
            <Text style={styles.riga}>Cronaca, formazione e dati</Text>
          </ListRow>
          {altra ? (
            <ListRow chevron onPress={() => router.push(`/match/${altra.id}` as never)}>
              <Text style={styles.riga}>
                {altra.status === 'finished' ? 'L’ultima giocata' : 'La prossima'}: {altra.home.shortName}–{altra.away.shortName}
              </Text>
            </ListRow>
          ) : null}
        </ListGroup>
      </View>

      <GroupNote>
        Quello che si può fare cambia con la partita: prima si pronostica, durante si commenta,
        dopo si danno i voti.
      </GroupNote>
    </Screen>
  );
}

const ETICHETTA = {
  prima: 'In arrivo',
  live: 'LIVE',
  intervallo: 'INTERVALLO',
  post: 'Finita',
} as const;

const styles = StyleSheet.create({
  testa: { gap: space.md, marginTop: space.sm, alignItems: 'center' },
  squadre: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
  lato: { flex: 1, alignItems: 'center', gap: 6 },
  centro: { minWidth: 84, alignItems: 'center' },
  nome: { ...type.footnote, color: colors.textDim, textAlign: 'center' },
  punteggio: { ...type.displayTitle, color: colors.text },
  vs: { ...type.headline, color: colors.textFaint },
  quando: { ...type.footnote, color: colors.textDim },
  riga: { ...type.subhead, color: colors.text, flex: 1 },
});
