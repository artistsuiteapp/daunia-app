/**
 * Notizie: solo la stampa.
 *
 * I pezzi scritti da noi sono usciti da questa schermata. Il motivo non e di
 * gusto: una redazione di una persona sola non tiene il passo, e una sezione
 * ferma a settimana scorsa fa piu danno di una sezione che non c'e. Le testate
 * che seguono il Foggia scrivono ogni giorno, ed e il loro mestiere.
 *
 * Restano nel progetto `lib/editorial.ts` e la scheda `/post/[slug]`: i vecchi
 * pezzi si aprono ancora se qualcuno ha il collegamento, semplicemente non
 * hanno piu una porta da cui entrare.
 */
import { router } from 'expo-router';
import { View } from 'react-native';

import { Screen, LargeTitle, Empty, GroupNote, useGutter } from '../../components/ui';
import { space } from '../../theme/tokens';
import { FOGGIA } from '../../lib/data';
import { BannerTestata } from '../../components/BannerTestata';
import { riepilogo, testateConArticoli } from '../../lib/stampa';

export default function News() {
  const gutter = useGutter();
  const testate = testateConArticoli();

  return (
    <Screen>
      <LargeTitle
        crest={FOGGIA?.crest ?? null}
        title="Notizie"
        subtitle="Le testate che seguono il Foggia"
      />

      {testate.length === 0 ? (
        <Empty text="Nessuna testata al momento." />
      ) : (
        <View style={[gutter, { gap: space.md }]}>
          {testate.map((t) => {
            const { quanti, ultimo } = riepilogo(t.id);
            return (
              <BannerTestata
                key={t.id}
                testata={t}
                quanti={quanti}
                ultimo={ultimo}
                onPress={() => router.push(`/stampa/${t.id}` as never)}
              />
            );
          })}
        </View>
      )}

      <GroupNote>
        Titolo e sommario. L&apos;articolo si legge sulla pagina di chi l&apos;ha scritto.
      </GroupNote>
    </Screen>
  );
}
