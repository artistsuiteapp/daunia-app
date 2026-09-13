import { useMemo } from 'react';
import { apriFuori } from '../../lib/apri';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, GroupLabel, GroupNote, Empty, useGutter } from '../../components/ui';
import { Crest } from '../../components/Crest';
import { Reveal } from '../../components/Reveal';
import { SoloConAccount } from '../../components/SoloConAccount';
import { Premi } from '../../components/anima';
import { colors, radius, space, type } from '../../theme/tokens';
import { shortDate, time } from '../../lib/format';
import { FOGGIA, matches } from '../../lib/data';
import { useOspite } from '../../lib/ospite';
import {
  useTrasferte, divietoDi, perCitta, postiLiberi, chiVa, SPIEGAZIONI, MEZZI,
} from '../../lib/trasferte';

/**
 * Trasferte.
 *
 * La domanda a cui risponde non e "chi viene", e "ci posso andare". Il divieto
 * colpisce i residenti in provincia, non chiunque: chi vive fuori quasi sempre
 * puo, e non lo sa perche sui giornali legge solo "trasferta vietata".
 *
 * L'elenco di chi va e raggruppato per citta di partenza, che e l'unico modo in
 * cui due foggiani di Bologna si accorgono l'uno dell'altro.
 */
export default function Trasferte() {
  const gutter = useGutter();
  const ospite = useOspite();

  const fuori = useMemo(
    () => matches
      .filter((m) => m.status !== 'finished' && !m.foggiaHome && m.kickoff)
      .sort((a, b) => Date.parse(a.kickoff!) - Date.parse(b.kickoff!))
      .slice(0, 8),
    [],
  );

  useTrasferte(fuori.map((m) => m.id));

  return (
    <Screen>
      <LargeTitle
        crest={FOGGIA?.crest ?? null}
        title="Trasferte"
        subtitle="Ci posso andare, e chi altro ci va"
      />

      {ospite ? (
        <View style={gutter}>
          <SoloConAccount cosa="Per dire che ci vai e comparire nell'elenco serve un account. Vedere chi va, no." />
        </View>
      ) : null}

      {!fuori.length ? (
        <Empty text="Nessuna trasferta in programma." />
      ) : (
        fuori.map((m, i) => <Scheda key={m.id} match={m} indice={i} />)
      )}

      <GroupNote>
        Il divieto lo decide il Prefetto e cambia da partita a partita. Qui arriva dalla stampa
        locale e viene confermato a mano: non è la fonte ufficiale. Prima di partire controlla
        anche i canali del club.
      </GroupNote>
    </Screen>
  );
}

function Scheda({ match, indice }: { match: (typeof matches)[number]; indice: number }) {
  const gutter = useGutter();
  const d = divietoDi(match.id);
  const s = SPIEGAZIONI[d.stato];
  const gruppi = perCitta(match.id);
  const quanti = chiVa(match.id).length;
  const posti = postiLiberi(match.id);

  return (
    <Reveal delay={60 + indice * 50}>
      <View style={[styles.card, gutter]}>
        <Premi onPress={() => router.push(`/trasferta/${match.id}` as never)} scala={0.99}>
          <View style={styles.testa}>
            <Crest uri={match.home.crest} name={match.home.shortName} size={34} />
            <View style={{ flex: 1 }}>
              <Text style={styles.avversario} numberOfLines={1}>{match.home.shortName}</Text>
              <Text style={styles.quando}>
                {shortDate(match.kickoff)} · {time(match.kickoff)}
                {match.venue ? ` · ${match.venue}` : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textFaint} />
          </View>
        </Premi>

        <View style={[styles.stato, s.grave ? styles.statoGrave : styles.statoCalmo]}>
          <Ionicons
            name={d.stato === 'aperta' ? 'checkmark-circle' : d.stato === 'non-confermato' ? 'help-circle' : 'alert-circle'}
            size={16}
            color={s.grave ? colors.accentBright : colors.textDim}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.statoTitolo}>{s.titolo}</Text>
            <Text style={styles.statoTesto}>{s.chiPuo}</Text>
            {d.fonte_nome ? (
              <Premi onPress={() => d.fonte_url && apriFuori(d.fonte_url)} scala={1}>
                <Text style={styles.fonte}>Fonte: {d.fonte_nome} ›</Text>
              </Premi>
            ) : null}
          </View>
        </View>

        <View style={styles.dentro}>
            <Text style={styles.riepilogo}>
              {quanti === 0
                ? 'Nessuno ha ancora detto che ci va.'
                : `${quanti} ${quanti === 1 ? 'tifoso ci va' : 'tifosi ci vanno'}${posti > 0 ? ` · ${posti} ${posti === 1 ? 'posto libero' : 'posti liberi'} in macchina` : ''}`}
            </Text>

          <View style={styles.gente}>
            {gruppi.slice(0, 4).map((g) => (
              <View key={g.citta} style={styles.tag}>
                <Text style={styles.tagTesto}>{g.citta} · {g.gente.length}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: space.md, marginTop: space.sm, gap: space.sm,
  },
  testa: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  avversario: { ...type.headline, color: colors.text },
  quando: { ...type.caption, color: colors.textDim },

  stato: { flexDirection: 'row', gap: space.sm, borderRadius: radius.md, padding: space.sm },
  statoGrave: { backgroundColor: colors.accentSoft },
  statoCalmo: { backgroundColor: colors.surfaceHi },
  statoTitolo: { ...type.footnoteBold, color: colors.text },
  statoTesto: { ...type.caption, color: colors.textDim, marginTop: 2 },
  fonte: { ...type.caption, color: colors.accentBright, marginTop: 4 },

  dentro: { gap: space.sm },
  riepilogo: { ...type.subhead, color: colors.text },
  citta: { gap: 4 },
  cittaNome: { ...type.captionBold, color: colors.textDim, letterSpacing: 0.4 },
  gente: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  tagTesto: { ...type.caption, color: colors.text },
});
