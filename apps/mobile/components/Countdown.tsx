import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space, type } from '../theme/tokens';
import { countdown } from '../lib/format';

/**
 * Conto alla rovescia al calcio d'inizio.
 *
 * Numeri in condensata separati dai due punti, senza riquadri: la griglia di
 * pastiglie di prima pesava piu del dato che mostrava.
 *
 * NIENTE SECONDI, DI PROPOSITO
 *
 * L'orario del fischio lo sappiamo al minuto, e l'arbitro non lo rispetta
 * comunque: in Monopoli-Foggia si e' cominciato con qualche minuto di ritardo.
 * Un conto che scorre al secondo promette una precisione che non abbiamo, e
 * quando arriva a zero senza che succeda niente sembra che sia rotta l'app.
 *
 * Sotto il minuto non si mostra un numero ma una frase: li' l'unica cosa vera
 * da dire e' che sta per cominciare.
 */
export function Countdown({ kickoff, onColour = false }: { kickoff: string | null; onColour?: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!kickoff || Date.parse(kickoff) <= Date.now()) return;
    // dieci secondi bastano per un conto che si ferma al minuto, e la sera
    // della partita il telefono resta acceso in mano per un'ora
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, [kickoff]);

  const c = countdown(kickoff, now);
  if (c.past) return null;

  if (c.days === 0 && c.hours === 0 && c.minutes === 0) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.imminente, onColour && styles.onColour]}>Si comincia</Text>
      </View>
    );
  }

  const units: Array<[number, string]> = [
    [c.days, c.days === 1 ? 'giorno' : 'giorni'],
    [c.hours, 'ore'],
    [c.minutes, 'min'],
  ];
  const shown = c.days > 0 ? units : units.slice(1);

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
  imminente: { ...type.number, color: colors.text },
  cellWrap: { flexDirection: 'row', alignItems: 'flex-start' },
  sep: { ...type.number, color: colors.textFaint, marginHorizontal: space.sm },
  cell: { alignItems: 'center', minWidth: 48 },
  value: { ...type.number, color: colors.text },
  label: { ...type.caption, color: colors.textFaint, marginTop: -2 },
  onColour: { color: '#fff' },
  labelOnColour: { color: 'rgba(255,255,255,0.72)' },
  sepOnColour: { color: 'rgba(255,255,255,0.5)' },
});
