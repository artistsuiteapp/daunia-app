import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  Screen, ListGroup, ListRow, GroupLabel, GroupNote, Empty, Badge, Card, BigStat, useGutter,
} from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Avatar } from '../../components/Avatar';
import { PlayerHero } from '../../components/PlayerHero';
import { colors, radius, space, type } from '../../theme/tokens';
import { shortDate } from '../../lib/format';
import { playedMatches, playerById, squad } from '../../lib/data';
import { anagraficaDi, carrieraDi, minutiAPartita, FONTE } from '../../lib/carriere';

/** Transfermarkt scrive il piede in inglese. */
const PIEDE: Record<string, string> = { right: 'destro', left: 'sinistro', both: 'ambidestro' };

const PLURALE: Record<string, string> = {
  P: 'portieri', D: 'difensori', C: 'centrocampisti', A: 'attaccanti',
};

export default function PlayerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gutter = useGutter();
  const player = playerById(String(id));

  if (!player) return <Screen testaFissa><Empty text="Giocatore non trovato." /></Screen>;

  // i gol si ricavano dalle partite: su Wikipedia i marcatori sono per cognome
  const surname = player.name.split(' ').slice(-1)[0]!.toLowerCase();
  const scored = playedMatches().filter((m) => {
    const mySide = m.foggiaHome ? 'home' : 'away';
    return m.goals.some((g) => g.side === mySide && g.scorer.toLowerCase().includes(surname));
  });
  const goals = scored.reduce((acc, m) => {
    const mySide = m.foggiaHome ? 'home' : 'away';
    return acc + m.goals.filter((g) => g.side === mySide && g.scorer.toLowerCase().includes(surname)).length;
  }, 0);
  const sameRole = squad.filter((p) => p.role === player.role && p.id !== player.id);
  const carriera = carrieraDi(player.name);
  const anagrafica = anagraficaDi(player.name);
  const perPartita = carriera ? minutiAPartita(carriera) : null;

  return (
    <Screen>
      <BackBar label="Rosa" />

      <View style={[gutter, { marginTop: space.sm }]}>
        <PlayerHero player={player} goals={goals} />
      </View>

      <View style={[styles.tiles, gutter, { marginTop: space.lg }]}>
        <Card style={styles.tile}><BigStat label="Numero" value={player.number ?? '–'} align="center" /></Card>
        <Card style={styles.tile}><BigStat label="Gol" value={goals} sub="in stagione" align="center" /></Card>
        <Card style={styles.tile}><BigStat label="Presenze in gol" value={scored.length} align="center" /></Card>
      </View>

      {carriera ? (
        <>
          {/*
            * I numeri delle stagioni passate, con scritto sotto da dove
            * arrivano. Un numero senza fonte in una scheda giocatore diventa
            * "lo dice l'app", e non e vero: lo dice Transfermarkt, letto a
            * mano in una data precisa e fermo li.
            */}
          <GroupLabel>Con il Foggia</GroupLabel>
          <View style={[styles.tiles, gutter]}>
            <Card style={styles.tile}><BigStat label="Presenze" value={carriera.presenze} align="center" /></Card>
            <Card style={styles.tile}><BigStat label="Gol" value={carriera.gol} align="center" /></Card>
            <Card style={styles.tile}>
              <BigStat
                label={carriera.stagioni.length === 1 ? 'Stagione' : 'Stagioni'}
                value={carriera.stagioni.length}
                align="center"
              />
            </Card>
          </View>

          <View style={gutter}>
            <ListGroup>
              {carriera.stagioni.slice(0, 8).map((st) => (
                <ListRow
                  key={st.s}
                  right={<Text style={styles.date}>{st.m ? `${st.m.toLocaleString('it-IT')}′` : '–'}</Text>}
                >
                  <Text style={styles.rowText} numberOfLines={1}>
                    {st.s} · {st.p} {st.p === 1 ? 'presenza' : 'presenze'}
                    {st.g ? ` · ${st.g} ${st.g === 1 ? 'gol' : 'gol'}` : ''}
                  </Text>
                </ListRow>
              ))}
            </ListGroup>
          </View>

          <GroupNote>
            {perPartita ? `In media ${perPartita} minuti a partita. ` : ''}
            Qualche numero può essere impreciso, e non si aggiorna spesso: potrebbe essere vecchio.
          </GroupNote>
        </>
      ) : null}

      {anagrafica && (anagrafica.altezza || anagrafica.piede || anagrafica.arrivatoDa) ? (
        <>
          <GroupLabel>Scheda</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              {anagrafica.altezza ? (
                <ListRow right={<Text style={styles.date}>{anagrafica.altezza}</Text>}>
                  <Text style={styles.rowText}>Altezza</Text>
                </ListRow>
              ) : null}
              {anagrafica.piede ? (
                <ListRow right={<Text style={styles.date}>{PIEDE[anagrafica.piede] ?? anagrafica.piede}</Text>}>
                  <Text style={styles.rowText}>Piede</Text>
                </ListRow>
              ) : null}
              {anagrafica.arrivatoDa ? (
                <ListRow right={<Text style={styles.date} numberOfLines={1}>{anagrafica.arrivatoDa}</Text>}>
                  <Text style={styles.rowText}>Arrivato da</Text>
                </ListRow>
              ) : null}
              {anagrafica.contratto ? (
                <ListRow right={<Text style={styles.date}>{anagrafica.contratto}</Text>}>
                  <Text style={styles.rowText}>Contratto fino al</Text>
                </ListRow>
              ) : null}
            </ListGroup>
          </View>
        </>
      ) : null}

      {scored.length ? (
        <>
          <GroupLabel>Partite in gol</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              {scored.map((m) => (
                <ListRow
                  key={m.id}
                  chevron
                  onPress={() => router.push(`/match/${m.id}` as never)}
                  right={<Text style={styles.date}>{shortDate(m.kickoff)}</Text>}
                >
                  <Text style={styles.rowText} numberOfLines={1}>
                    {m.home.shortName} {m.score?.home}–{m.score?.away} {m.away.shortName}
                  </Text>
                </ListRow>
              ))}
            </ListGroup>
          </View>
        </>
      ) : null}

      <GroupLabel>{`Altri ${(player.role && PLURALE[player.role]) || 'giocatori'}`}</GroupLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, gutter]}>
        {sameRole.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => router.push(`/player/${p.id}` as never)}
            style={({ pressed }) => [styles.mini, pressed && { opacity: 0.6 }]}
          >
            <Avatar uri={p.photo} name={p.name} size={48} />
            <Text style={styles.miniName} numberOfLines={1}>{p.shortName}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({

  tiles: { flexDirection: 'row', gap: space.sm },
  tile: { flex: 1, padding: space.md, alignItems: 'center' },

  rowText: { ...type.subhead, color: colors.text, flex: 1 },
  date: { ...type.footnote, color: colors.textFaint },

  row: { gap: space.lg, paddingVertical: space.xs },
  mini: { alignItems: 'center', gap: 5, width: 60 },
  miniName: { ...type.caption, color: colors.textDim, textAlign: 'center' },
});
