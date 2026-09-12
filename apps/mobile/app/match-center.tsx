import { useMemo } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Premi } from '../components/anima';

import {
  Screen, Badge, Card, Empty, GroupLabel, GroupNote, ListGroup, ListRow, useGutter,
} from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Crest } from '../components/Crest';
import { Countdown } from '../components/Countdown';
import { MatchCenter } from '../components/MatchCenter';
import { colors, radius, space, type } from '../theme/tokens';
import { nextMatch, playedMatches } from '../lib/data';
import { usePartite } from '../lib/partita-corrente';
import { useArchivioPagelle } from '../lib/archivio';
import { useMieiPronostici } from '../lib/pronostici';
import { useSessione } from '../lib/auth';
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

  /*
   * Quale partita, e con che punteggio.
   *
   * `usePartite` mette insieme il calendario dell'archivio e quello che dice il
   * campo: la partita in corso e quella appena finita arrivano gia aggiornate,
   * senza che questa schermata debba sapere da dove viene ogni pezzo.
   */
  const { inCorso, ultima } = usePartite();
  const prossima = nextMatch();
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

      <Porte />

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

/**
 * Le quattro porte del Match Center.
 *
 * OGNUNA PORTA IL SUO NUMERO
 *
 * Un riquadro con dentro solo un titolo non dice se vale la pena aprirlo. Con
 * accanto il numero che conta -- quante partite sono state votate, quanti
 * pronostici hai preso, in che posizione sei -- si decide senza entrare. Dove
 * il numero non c'e' ancora si scrive cosa ci sara', non uno zero.
 */
function Porte() {
  const gutter = useGutter();
  const { utente } = useSessione();
  const giocate = playedMatches();
  const { per } = useArchivioPagelle(giocate.map((m) => m.id));
  const { chiusi, presi, striscia } = useMieiPronostici();

  const votate = giocate.filter((m) => per[m.id]).length;

  const voci = [
    {
      icona: 'star' as const,
      titolo: 'Pagelle',
      sotto: votate
        ? `${votate} ${votate === 1 ? 'partita votata' : 'partite votate'} su ${giocate.length}`
        : 'I voti della Curva, partita per partita',
      href: '/match-center/pagelle',
    },
    {
      icona: 'trophy' as const,
      titolo: 'Premi',
      sotto: 'Il migliore della partita e quello del mese',
      href: '/match-center/premi',
    },
    {
      icona: 'flash' as const,
      titolo: 'Pronostici',
      sotto: !utente
        ? 'Indovina il risultato e prendi punti'
        : chiusi
          ? `${presi} presi su ${chiusi}${striscia >= 2 ? ` · ${striscia} di fila` : ''}`
          : 'Non ne hai ancora giocato uno',
      href: '/match-center/pronostici',
    },
    {
      icona: 'podium' as const,
      titolo: 'Classifica',
      sotto: 'Settimana, mese e stagione',
      href: '/classifica',
    },
  ];

  return (
    <>
      <GroupLabel>Tutto il resto</GroupLabel>
      <View style={[styles.porte, gutter]}>
        {voci.map((v) => (
          <Premi
            key={v.titolo}
            onPress={() => router.push(v.href as never)}
            etichetta={v.titolo}
            style={styles.mezza}
          >
            {/*
              * Tutte e quattro identiche: stessa altezza, icona sempre nello
              * stesso punto, sottotitolo sempre su due righe anche quando ne
              * riempie una. Prima le schede si allungavano ognuna quanto il suo
              * testo e la griglia veniva a scalini.
              */}
            <Card style={styles.porta}>
              <View style={styles.portaIcona}>
                <Ionicons name={v.icona} size={19} color={colors.accentBright} />
              </View>
              <Text style={styles.portaTitolo} numberOfLines={1}>{v.titolo}</Text>
              <Text style={styles.portaSotto} numberOfLines={2}>{v.sotto}</Text>
            </Card>
          </Premi>
        ))}
      </View>
    </>
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

  porte: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  mezza: { flexBasis: '48%', flexGrow: 1, flexShrink: 1 },
  porta: { padding: space.lg, gap: 6, height: 132, justifyContent: 'flex-start' },
  portaIcona: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center',
    marginBottom: 2,
  },
  portaTitolo: { ...type.subheadBold, color: colors.text },
  portaSotto: { ...type.caption, color: colors.textDim, lineHeight: 16 },
});
