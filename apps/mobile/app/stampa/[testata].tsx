/**
 * Gli articoli di una testata.
 *
 * Ogni riga apre la loro pagina nel browser di sistema montato dentro l'app
 * (vedi `lib/apri.ts`): la pagina e la loro, intera, con la loro pubblicita.
 * Qui non si legge niente per intero, e la riga in fondo lo dice invece di
 * lasciarlo capire.
 *
 * L'anteprima e l'og:image scelta dalla redazione, collegata dal loro server.
 * Chi non ce l'ha resta senza: non si mette un'immagine nostra al posto loro.
 */
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';

import { Screen, Empty, ListGroup, ListRow, GroupNote, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { colors, radius, space, type } from '../../theme/tokens';
import { relative } from '../../lib/format';
import { apriArticolo } from '../../lib/apri';
import { articoliDi, testataPerId } from '../../lib/stampa';

export default function Stampa() {
  const { testata: id } = useLocalSearchParams<{ testata: string }>();
  const gutter = useGutter();
  const testata = testataPerId(String(id));
  const articoli = testata ? articoliDi(testata.id) : [];

  if (!testata) {
    return <Screen testaFissa><Empty text="Testata non trovata." /></Screen>;
  }

  const chiaro = testata.logoSuChiaro !== false;

  return (
    <Screen>
      <BackBar label="Notizie" />

      <View style={[gutter, { marginTop: space.md }]}>
        <View style={[styles.plate, chiaro ? styles.plateChiara : styles.plateScura]}>
          {testata.logo ? (
            <Image source={{ uri: testata.logo }} style={styles.logo} contentFit="contain" transition={150} />
          ) : (
            <Text style={[styles.fallback, chiaro && { color: '#111' }]}>{testata.nome}</Text>
          )}
        </View>
        {testata.motto ? <Text style={styles.motto}>{testata.motto}</Text> : null}
      </View>

      {articoli.length === 0 ? (
        <Empty text="Nessun articolo al momento." />
      ) : (
        <View style={[gutter, { marginTop: space.lg }]}>
          <ListGroup>
            {articoli.map((a) => (
              <ListRow key={a.id} onPress={() => apriArticolo(a.url)} chevron>
                {a.immagine ? (
                  // niente `transition`: dentro una riga di lista, sul web la
                  // dissolvenza non si chiude e l'anteprima resta a opacita zero
                  <Image source={{ uri: a.immagine }} style={styles.thumb} contentFit="cover" />
                ) : null}
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.titolo} numberOfLines={3}>{a.titolo}</Text>
                  {a.sommario ? (
                    <Text style={styles.sommario} numberOfLines={a.immagine ? 2 : 3}>{a.sommario}</Text>
                  ) : null}
                  <Text style={styles.meta}>
                    {relative(a.data)}
                    {a.autore ? ` · ${a.autore}` : ''}
                  </Text>
                </View>
              </ListRow>
            ))}
          </ListGroup>
        </View>
      )}

      <GroupNote>
        Gli articoli sono di {testata.nome}. Qui trovi titolo e sommario, il resto si legge da loro.
      </GroupNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  plate: {
    height: 92,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
  plateChiara: { backgroundColor: '#FFFFFF' },
  plateScura: { backgroundColor: colors.surfaceHi },
  logo: { width: '100%', height: 52 },
  fallback: { ...type.title2, color: colors.text },
  motto: { ...type.footnote, color: colors.textDim, marginTop: space.sm, textAlign: 'center' },

  thumb: {
    width: 76,
    height: 76,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceHi,
    alignSelf: 'flex-start',
  },
  titolo: { ...type.subheadBold, color: colors.text },
  sommario: { ...type.footnote, color: colors.textDim },
  meta: { ...type.caption, color: colors.textFaint },
});
