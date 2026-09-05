import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme/tokens';
import { countdown } from '../lib/format';

/**
 * Conto alla rovescia al calcio d'inizio.
 * Numeri in condensata separati dai due punti, senza riquadri: la griglia di
 * pastiglie di prima pesava piu del dato che mostrava.
 */
export function Countdown({ kickoff, onColour = false }: { kickoff: string | null; onColour?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!kickoff || Date.parse(kickoff) <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [kickoff]);

  const c = countdown(kickoff, now);
  if (c.past) return null;

  const units: Array<[number, string]> = [
    [c.days, c.days === 1 ? 'giorno' : 'giorni'],
    [c.hours, 'ore'],
    [c.minutes, 'min'],
    [c.seconds, 'sec'],
  ];
  const shown = c.days > 0 ? units.slice(0, 3) : units.slice(1);

  return (
    <View style={styles.wrap}>
      {shown.map(([value, label], i) => (
        <View key={label} style={styles.cellWrap}>
          {i > 0 ? <Text style={[styles.sep, onColour && styles.sepOnColour]}>:</Text> : null}
          <View style={styles.cell}>
            <Text style={[styles.value, onColour && styles.onColour]}>{String(value).padStart(2, '0')}</Text>
            <Text style={[styles.label, onColour && styles.labelOnColour]}>{label}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  cellWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  sep: { ...type.number, color: colors.textFaint, marginHorizontal: space.sm },
  cell: { alignItems: 'center', minWidth: 48 },
  value: { ...type.number, color: colors.text },
  label: { ...type.caption, color: colors.textFaint, marginTop: -2 },
  onColour: { color: '#fff' },
  labelOnColour: { color: 'rgba(255,255,255,0.72)' },
  sepOnColour: { color: 'rgba(255,255,255,0.5)' },
});
