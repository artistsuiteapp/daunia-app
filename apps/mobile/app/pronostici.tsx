import { useEffect } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { Screen } from '../components/ui';
import { colors } from '../theme/tokens';

/**
 * Questa schermata non esiste piu: porta al Match Center.
 *
 * PERCHE
 *
 * C'erano due schermate di pronostici. Questa contava tre punti per il
 * risultato esatto e uno per l'esito, leggendo una copia salvata nel telefono;
 * quella del Match Center conta cento e cinquanta e legge il database. Le due
 * dicevano numeri diversi sulla stessa cosa, e chi le apriva tutte e due non
 * poteva che pensare che l'app sbagliasse i conti.
 *
 * L'indirizzo resta vivo perche puo essere nei preferiti di qualcuno o dentro
 * un vecchio collegamento.
 */
export default function VecchiPronostici() {
  useEffect(() => {
    router.replace('/match-center/pronostici' as never);
  }, []);

  return (
    <Screen>
      <View style={{ paddingVertical: 64, alignItems: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    </Screen>
  );
}
