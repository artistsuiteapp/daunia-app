import { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import {
  Screen, ListGroup, ListRow, GroupLabel, GroupNote, Empty, Badge, Button, Segmented, useGutter,
} from '../../components/ui';
import { Lineup } from '../../components/Lineup';
import { Avatar } from '../../components/Avatar';
import { lineupPerPartita } from '../../lib/lineup';
import { BackBar } from '../../components/BackBar';
import { Crest } from '../../components/Crest';
import { Countdown } from '../../components/Countdown';
import { colors, radius, space, type } from '../../theme/tokens';
import { longDate, shortDate, thousands } from '../../lib/format';
import { matchById, matches } from '../../lib/data';
import { Pagelle } from '../../components/Pagelle';
import { Pronostico } from '../../components/Pronostico';
import { useDatiPartita } from '../../lib/fanplay';
import { useLive, liveDi, useGolVivo } from '../../lib/live';
import { etichettaFase } from '../../lib/live-core';

type Tab = 'formazione' | 'gioco' | 'eventi' | 'dati';

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gutter = useGutter();
  const [view, setView] = useState<Tab>('formazione');
  const match = matchById(String(id));
  const vivo = liveDi(match, useLive());
  // la cronologia che il guardiano registra mentre si gioca: minuto e punteggio,
  // senza il nome di chi ha segnato
  const golVivo = useGolVivo();
  const lineup = useMemo(
    () => lineupPerPartita(match?.kickoff ? match.kickoff.slice(0, 10) : undefined),
    [match?.kickoff],
  );
  useDatiPartita(match?.id ?? null, true);

  if (!match) return <Screen testaFissa><Empty text="Partita non trovata." /></Screen>;

  const played = match.status === 'finished';
  const h2h = matches.filter(
    (m) => m.id !== match.id && m.status === 'finished'
      && ((m.home.id === match.home.id && m.away.id === match.away.id)
        || (m.home.id === match.away.id && m.away.id === match.home.id)),
  );
  const label = match.competition === 'Serie C' && match.matchday
    ? `${match.matchday}ª giornata` : match.competition;

  return (
    <Screen>
      <BackBar label="Partite" />

      <View style={[styles.scoreboard, gutter]}>
        <Badge label={label} tone="accent" />
        <View style={styles.teams}>
          <Side team={match.home} />
          <View style={styles.centre}>
            {vivo
              ? <Text style={styles.score}>{vivo.casa ?? 0}–{vivo.ospite ?? 0}</Text>
              : played
                ? <Text style={styles.score}>{match.score!.home}–{match.score!.away}</Text>
                : <Text style={styles.vs}>vs</Text>}
          </View>
          <Side team={match.away} />
        </View>
        <Text style={styles.when}>
          {vivo ? `In corso · ${etichettaFase(vivo, match.kickoff)}` : longDate(match.kickoff)}
        </Text>
      </View>

      {!played && !vivo && match.kickoff ? (
        <View style={[gutter, { marginTop: space.lg }]}><Countdown kickoff={match.kickoff} /></View>
      ) : null}

      {match.ticketUrl ? (
        <View style={[gutter, { marginTop: space.xl }]}>
          <Button label="Acquista i biglietti" icon="ticket" onPress={() => Linking.openURL(match.ticketUrl!)} />
        </View>
      ) : null}

      <View style={[gutter, { marginTop: space.xl }]}>
        <Segmented
          value={view}
          onChange={setView}
          items={[
            { key: 'formazione' as Tab, label: 'Formazione' },
            // prima della partita si pronostica, dopo si danno i voti:
            // la stessa casella cambia mestiere al fischio finale
            { key: 'gioco' as Tab, label: played ? 'Pagelle' : 'Pronostico' },
            { key: 'eventi' as Tab, label: 'Eventi' },
            { key: 'dati' as Tab, label: 'Dati' },
          ]}
        />
      </View>

      {view === 'gioco' ? (
        <>
          <GroupLabel>{played ? 'Le pagelle della Curva' : 'Il pronostico'}</GroupLabel>
          <View style={gutter}>
            {played ? (
              <Pagelle
                matchId={match.id}
                players={lineup.slots.map((sl) => sl.player).filter((pl): pl is NonNullable<typeof pl> => !!pl)}
              />
            ) : (
              <Pronostico match={match} />
            )}
          </View>
          <GroupNote>
            {played
              ? 'I voti restano su questo dispositivo. Con gli account veri fanno una media sola per tutti.'
              : 'Il pronostico resta su questo dispositivo. Con gli account veri entra in una classifica vera.'}
          </GroupNote>
        </>
      ) : null}

      {view === 'formazione' ? (
        <>
          <GroupLabel>
            {lineup.fonte === 'ufficiale' ? 'Formazione ufficiale'
              : lineup.fonte === 'ultima' ? 'Così ha giocato l\'ultima volta'
              : 'Formazione probabile'}
          </GroupLabel>
          <View style={gutter}>
            <Lineup
              slots={lineup.slots}
              formation={lineup.formation}
              homeCrest={match.home.crest}
              awayCrest={match.away.crest}
              homeName={match.home.shortName}
              awayName={match.away.shortName}
              foggiaHome={match.foggiaHome}
            />
          </View>
          <GroupLabel>Panchina</GroupLabel>
          <View style={[styles.bench, gutter]}>
            {lineup.bench.map((p) => (
              <View key={p.id} style={styles.benchItem}>
                <Avatar uri={p.photo} name={p.name} size={40} />
                <Text style={styles.benchNum}>{p.number ?? '–'}</Text>
                <Text style={styles.benchName} numberOfLines={1}>{p.shortName}</Text>
              </View>
            ))}
          </View>
          <GroupNote>
            {lineup.fonte === 'ufficiale'
              ? 'Undici sceso in campo, da API-Football. La disposizione è la nostra: il modulo per la Serie C non lo pubblica nessuno.'
              : lineup.fonte === 'ultima'
                ? `Questo è l'undici sceso in campo il ${lineup.dataUltima ? shortDate(lineup.dataUltima) : 'match precedente'}. Le formazioni ufficiali escono circa un'ora prima del fischio: quando esce, questa si aggiorna da sola.`
                : 'Nessuna partita in archivio: questa formazione è costruita dalla rosa e va letta come una supposizione.'}
          </GroupNote>
        </>
      ) : null}

      {view === 'eventi' ? (
        match.goals.length ? (
          <>
            <GroupLabel>Cronaca</GroupLabel>
            <View style={gutter}>
              {match.goals.map((g, i) => {
                const home = g.side === 'home';
                return (
                  <View key={`${g.scorer}-${g.minute}-${i}`} style={styles.event}>
                    <View style={[styles.eventSide, !home && styles.eventSideRight]}>
                      <View style={styles.eventBubble}>
                        <Ionicons name="football" size={13} color={colors.text} />
                        <Text style={styles.eventName} numberOfLines={1}>
                          {g.scorer}{g.penalty ? ' (rig.)' : ''}{g.ownGoal ? ' (aut.)' : ''}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.eventLine}>
                      <View style={styles.eventDot} />
                      <Text style={styles.eventMinute}>{g.minute}{g.extra ? `+${g.extra}` : ''}'</Text>
                    </View>
                    <View style={styles.eventSide} />
                  </View>
                );
              })}
            </View>
          </>
        ) : golVivo.length ? (
          <>
            <GroupLabel>Cronaca</GroupLabel>
            <View style={gutter}>
              {golVivo.map((g, i) => (
                <View key={`${g.minuto}-${i}`} style={styles.event}>
                  <View style={[styles.eventSide, !g.nostro && styles.eventSideRight]}>
                    <View style={styles.eventBubble}>
                      <Ionicons name="football" size={13} color={colors.text} />
                      <Text style={styles.eventName} numberOfLines={1}>
                        {g.casa ?? 0}–{g.ospiti ?? 0}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.eventLine}>
                    <View style={styles.eventDot} />
                    <Text style={styles.eventMinute}>
                      {g.minuto ? `${g.fonte === 'stimato' ? '~' : ''}${g.minuto}'` : '–'}
                    </Text>
                  </View>
                  <View style={styles.eventSide} />
                </View>
              ))}
            </View>
            <GroupNote>
              Minuto e punteggio arrivano dal tabellone. Il nome di chi ha segnato compare a
              fine partita, quando i dati ufficiali sono completi.
            </GroupNote>
          </>
        ) : (
          <Empty text={vivo
            ? 'Ancora nessun gol in questa partita.'
            : 'Nessun evento registrato per questa partita.'} />
        )
      ) : null}

      {view === 'dati' ? (
      <>
      <GroupLabel>Dati partita</GroupLabel>
      <View style={gutter}>
        <ListGroup>
          <ListRow right={<Text style={styles.value} numberOfLines={1}>{match.venue ?? '–'}</Text>}>
            <Text style={styles.key}>Stadio</Text>
          </ListRow>
          <ListRow right={
            <Text style={styles.value}>
              {match.attendance == null ? '–' : match.attendance === 0 ? 'a porte chiuse' : thousands(match.attendance)}
            </Text>
          }>
            <Text style={styles.key}>Spettatori</Text>
          </ListRow>
          <ListRow right={<Text style={styles.value}>{match.referee ?? '–'}</Text>}>
            <Text style={styles.key}>Arbitro</Text>
          </ListRow>
          <ListRow right={<Text style={styles.value}>{match.competition}</Text>}>
            <Text style={styles.key}>Competizione</Text>
          </ListRow>
        </ListGroup>
      </View>
      </>
      ) : null}

      {h2h.length ? (
        <>
          <GroupLabel>Precedenti in stagione</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              {h2h.map((m) => (
                <ListRow key={m.id} height={44}>
                  <Text style={styles.key} numberOfLines={1}>
                    {m.home.shortName} {m.score?.home}–{m.score?.away} {m.away.shortName}
                  </Text>
                </ListRow>
              ))}
            </ListGroup>
          </View>
        </>
      ) : null}

      {match.reportUrl ? (
        <View style={[gutter, { marginTop: space.xl }]}>
          <Button label="Referto della partita" tone="plain" onPress={() => Linking.openURL(match.reportUrl!)} />
        </View>
      ) : null}
    </Screen>
  );
}

function Side({ team }: { team: { crest: string | null; shortName: string } }) {
  return (
    <View style={styles.side_}>
      <Crest uri={team.crest} name={team.shortName} size={62} />
      <Text style={styles.teamName} numberOfLines={2}>{team.shortName}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scoreboard: { alignItems: 'center', gap: space.lg, marginTop: space.lg },
  teams: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch' },
  side_: { flex: 1, alignItems: 'center', gap: space.sm },
  teamName: { ...type.headline, color: colors.text, textAlign: 'center' },
  centre: { width: 110, alignItems: 'center', paddingTop: space.md },
  score: { ...type.score, color: colors.text },
  vs: { ...type.title1, color: colors.textFaint },
  when: { ...type.subhead, color: colors.textDim },

  minute: { ...type.footnoteBold, color: colors.accentBright, width: 36 },
  scorer: { ...type.subhead, color: colors.text, flex: 1 },
  side: { ...type.caption, color: colors.textFaint },

  bench: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  benchItem: { alignItems: 'center', gap: 2, width: 58 },
  benchNum: { ...type.captionBold, color: colors.accentBright },
  benchName: { ...type.caption, color: colors.textDim, textAlign: 'center' },

  event: { flexDirection: 'row', alignItems: 'center', minHeight: 46 },
  eventSide: { flex: 1, alignItems: 'flex-end' },
  eventSideRight: { alignItems: 'flex-start' },
  eventBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.surface, borderRadius: radius.md,
    paddingHorizontal: space.md, paddingVertical: 8, maxWidth: 170,
  },
  eventName: { ...type.footnote, color: colors.text, flexShrink: 1 },
  eventLine: { width: 58, alignItems: 'center', gap: 2 },
  eventDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  eventMinute: { ...type.caption, color: colors.textFaint },

  key: { ...type.subhead, color: colors.text },
  value: { ...type.subhead, color: colors.textDim, maxWidth: 190, textAlign: 'right' },
});
