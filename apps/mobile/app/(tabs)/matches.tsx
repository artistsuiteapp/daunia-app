import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Screen, LargeTitle, ListGroup, GroupLabel, Segmented, Empty, useGutter } from '../../components/ui';
import { MatchListRow } from '../../components/MatchCard';
import { space } from '../../theme/tokens';
import {FOGGIA, matches, meta, playedMatches, upcomingMatches } from '../../lib/data';

type Tab = 'prossime' | 'giocate' | 'tutte';

export default function Matches() {
  const [tab, setTab] = useState<Tab>('prossime');
  const gutter = useGutter();

  const list = useMemo(() => {
    if (tab === 'prossime') return upcomingMatches();
    if (tab === 'giocate') return playedMatches();
    return [...matches].sort((a, b) => (a.matchday ?? 99) - (b.matchday ?? 99));
  }, [tab]);

  // il calendario si legge meglio spezzato per mese che come lista unica di 39 righe
  const groups = useMemo(() => {
    const out = new Map<string, typeof list>();
    for (const m of list) {
      const key = m.kickoff
        ? new Date(m.kickoff).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
        : 'Data da definire';
      if (!out.has(key)) out.set(key, []);
      out.get(key)!.push(m);
    }
    return [...out.entries()];
  }, [list]);

  return (
    <Screen>
      <LargeTitle crest={FOGGIA?.crest ?? null} title="Partite" subtitle={`${meta.competition} · girone C · ${meta.season.replace('-', '/')}`} />

      <View style={[gutter, { marginTop: space.sm }]}>
        <Segmented
          value={tab}
          onChange={setTab}
          items={[
            { key: 'prossime', label: 'Prossime' },
            { key: 'giocate', label: 'Giocate' },
            { key: 'tutte', label: 'Tutte' },
          ]}
        />
      </View>

      {groups.length === 0 ? <Empty text="Nessuna partita in questa vista." /> : null}

      {groups.map(([month, items]) => (
        <View key={month}>
          <GroupLabel>{month}</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              {items.map((m) => <MatchListRow key={m.id} match={m} />)}
            </ListGroup>
          </View>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({});
