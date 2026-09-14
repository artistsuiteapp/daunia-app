import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { meta } from '../lib/data';
import { esitoDownload } from '../lib/bundle-remoto';
import { freschezza } from '../lib/freschezza-core.ts';
import { colors, radius, space, type } from '../theme/tokens';

/**
 * Da quando sono fermi i dati.
 *
 * Compare solo quando c'e' qualcosa da dire: sotto l'ora resta invisibile.
 * Un avviso che c'e' sempre diventa parte dell'arredamento e smette di essere
 * letto proprio il giorno in cui conta.
 *
 * L'ora si ricalcola da sola ogni minuto: senza, uno che tiene l'app aperta
 * durante la partita continuerebbe a leggere il numero di quando l'ha aperta.
 *
 * Quando i dati sono fermi dice anche perche, se lo sa: "scartato" vuol dire
 * che il file e arrivato e l'app l'ha rifiutato, cioe un guasto nostro. Dal 13
 * al 14 settembre succedeva a ogni apertura e l'unico sintomo erano le notizie
 * vecchie. Sta anche in cima alle Notizie, che e dove ci si accorge del guasto.
 */
export function StatoDati() {
  const [adesso, setAdesso] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAdesso(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const f = freschezza(meta?.generatedAt, adesso);
  if (f.stato === 'fresco') return null;

  const rotto = f.stato === 'fermo' || f.stato === 'ignoto';
  const ultimo = esitoDownload();
  const perche = ultimo?.esito === 'scartato'
    ? ` L'ultimo aggiornamento e arrivato ma e stato scartato: ${ultimo.motivo}.`
    : ultimo?.esito === 'senza rete' ? ' Ultimo tentativo senza rete.' : '';

  return (
    <View style={[styles.riga, rotto && styles.rigaRotta]}>
      <Ionicons
        name={rotto ? 'alert-circle-outline' : 'time-outline'}
        size={16}
        color={rotto ? '#E8C547' : colors.textDim}
      />
      <Text style={[styles.testo, rotto && styles.testoRotto]}>{f.testo}{perche}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  riga: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingVertical: space.sm, paddingHorizontal: space.md,
    borderRadius: radius.md, backgroundColor: colors.bgElevated,
  },
  rigaRotta: { backgroundColor: 'rgba(232,197,71,0.10)' },
  testo: { ...type.caption, color: colors.textDim, flex: 1 },
  testoRotto: { color: colors.text },
});
