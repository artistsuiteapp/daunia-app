/**
 * Notizie: le testate e i comunicati del club.
 *
 * I pezzi scritti da noi sono usciti da questa schermata. Il motivo non e di
 * gusto: una redazione di una persona sola non tiene il passo, e una sezione
 * ferma a settimana scorsa fa piu danno di una sezione che non c'e. Le testate
 * che seguono il Foggia scrivono ogni giorno, ed e il loro mestiere.
 *
 * Restano nel progetto `lib/editorial.ts` e la scheda `/post/[slug]`: i vecchi
 * pezzi si aprono ancora se qualcuno ha il collegamento, semplicemente non
 * hanno piu una porta da cui entrare.
 *
 * I COMUNICATI DEL CLUB, E PERCHE SONO TORNATI
 *
 * Erano stati tolti perche venivano riprodotti per intero. Qui non succede:
 * titolo, due righe e il tocco che porta sul sito loro, esattamente come per le
 * testate. E' anche la sola parte di questa schermata che si aggiorna da sola,
 * a ogni giro dell'ingest.
 */
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
  Screen, LargeTitle, Empty, GroupLabel, GroupNote, ListGroup, ListRow, useGutter,
} from '../../components/ui';
import { colors, space, type } from '../../theme/tokens';
import { FOGGIA, clubReleases } from '../../lib/data';
import { BannerTestata } from '../../components/BannerTestata';
import { riepilogo, testateConArticoli } from '../../lib/stampa';
import { apriArticolo } from '../../lib/apri';
import { relative } from '../../lib/format';

/** Quanti comunicati si mostrano. Oltre e archivio, e l'archivio sta sul loro sito. */
const QUANTI = 8;

/**
 * Due righe, non l'articolo.
 *
 * L'assaggio si taglia sull'ultima parola intera prima del limite: spezzare a
 * meta parola fa sembrare rotta la pagina, non breve il testo.
 */
function assaggio(testo: string | null | undefined, limite = 130): string {
  const pulito = String(testo ?? '').replace(/\s+/g, ' ').trim();
  if (pulito.length <= limite) return pulito;
  const tagliato = pulito.slice(0, limite);
  const spazio = tagliato.lastIndexOf(' ');
  return `${(spazio > 40 ? tagliato.slice(0, spazio) : tagliato).replace(/[.,;:]$/, '')}…`;
}

export default function News() {
  const gutter = useGutter();
  const testate = testateConArticoli();
  const comunicati = clubReleases.slice(0, QUANTI);

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

      {comunicati.length ? (
        <>
          <GroupLabel>Dal club</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              {comunicati.map((c) => (
                <ListRow key={c.id} chevron onPress={() => c.url && apriArticolo(c.url)}>
                  <View style={styles.riga}>
                    <Text style={styles.titolo} numberOfLines={2}>{c.title}</Text>
                    {c.excerpt ? (
                      <Text style={styles.assaggio} numberOfLines={2}>{assaggio(c.excerpt)}</Text>
                    ) : null}
                    <Text style={styles.quando}>{relative(c.date)}</Text>
                  </View>
                </ListRow>
              ))}
            </ListGroup>
          </View>
          <GroupNote>
            Comunicati ufficiali del Calcio Foggia 1920. Si aprono sul sito del club.
          </GroupNote>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  riga: { flex: 1, gap: 3 },
  titolo: { ...type.subheadBold, color: colors.text, lineHeight: 20 },
  assaggio: { ...type.footnote, color: colors.textDim, lineHeight: 18 },
  quando: { ...type.caption, color: colors.textFaint },
});
