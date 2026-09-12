import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';

import { colors, type } from '../theme/tokens';
import { useIdentita } from '../lib/identita';
import { tintaNome } from '../lib/identita-core.ts';

/**
 * Il nome di una persona, scritto sempre allo stesso modo.
 *
 * PERCHE UN COMPONENTE SOLO
 *
 * Un nome compare in sette posti: la lista della Curva, dentro una discussione,
 * nelle risposte, nella chat, in classifica, nella coda delle segnalazioni e
 * fra i bloccati. Ognuno aveva il suo `<Text>` e il suo stile. Con sette copie,
 * fra due mesi il rosso dell'admin c'e in quattro e negli altri tre no — e chi
 * legge non capisce piu se il colore vuol dire qualcosa.
 *
 * COSA DICE IL COLORE
 *
 * Rosso: risponde di quello che succede qui. Azzurro: modera. Gli altri colori
 * sono il livello, cioe quanto uno gioca. Le regole stanno in identita-core.ts,
 * con i loro test.
 *
 * Il nome si tocca e si apre la scheda della persona. Non quando e il proprio:
 * il proprio profilo sta nel suo posto, e aprirlo da qui confonde.
 */
export function NomeUtente({ id, nome, stile, apribile = true, spilletta = true, suffisso }: {
  id: string | null | undefined;
  /** il nome che si ha gia in mano: si mostra subito, senza aspettare i punti */
  nome: string;
  stile?: StyleProp<TextStyle>;
  apribile?: boolean;
  spilletta?: boolean;
  /** ' · tu', un orario, quello che serve: resta grigio e non prende il colore */
  suffisso?: string;
}) {
  const chi = useIdentita(id);
  const tinta = tintaNome(chi?.ruolo, chi?.punti ?? null);

  const testo = (
    <View style={stili.riga}>
      <Text style={[stili.nome, stile, { color: tinta.colore }]} numberOfLines={1}>
        {chi?.nome ?? nome}
      </Text>
      {spilletta && tinta.spilletta ? (
        <Ionicons
          name={tinta.spilletta}
          size={12}
          color={tinta.colore}
          accessibilityLabel={tinta.etichetta ?? undefined}
        />
      ) : null}
      {suffisso ? <Text style={stili.suffisso}>{suffisso}</Text> : null}
    </View>
  );

  if (!apribile || !id) return testo;
  return (
    <Pressable
      onPress={() => router.push(`/utente/${id}` as never)}
      hitSlop={6}
      style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
    >
      {testo}
    </Pressable>
  );
}

const stili = StyleSheet.create({
  riga: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  nome: { ...type.subheadBold, color: colors.text, flexShrink: 1 },
  suffisso: { ...type.caption, color: colors.textFaint },
});
