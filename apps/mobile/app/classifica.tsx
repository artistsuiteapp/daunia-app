import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen, Card, Empty, GroupLabel, GroupNote, ListGroup, ListRow, Segmented, useGutter } from '../components/ui';
import { BackBar } from '../components/BackBar';
import { Avatar } from '../components/Avatar';
import { NomeUtente } from '../components/NomeUtente';
import { SoloConAccount } from '../components/SoloConAccount';
import { Apparsa } from '../components/anima';
import { colors, radius, space, type } from '../theme/tokens';
import { useSessione } from '../lib/auth';
import { useClassifica, useMieiPunti, NOME_PERIODO, type Periodo } from '../lib/punti';

/**
 * La classifica dei tifosi.
 *
 * LA SETTIMANA PER PRIMA, E NON PER CASO
 *
 * In una classifica stagionale chi arriva a novembre e gia fuori dai giochi:
 * guarda il primo, vede un numero irraggiungibile e chiude. La settimana si
 * azzera ogni lunedi, quindi chi si iscrive oggi puo vincere qualcosa sabato.
 * E l'unica delle tre che fa tornare.
 *
 * La propria riga si vede sempre, anche da centesimi: una classifica in cui
 * non ci si trova e una classifica che si chiude.
 */
export default function Classifica() {
  const gutter = useGutter();
  const { utente } = useSessione();
  const [periodo, setPeriodo] = useState<Periodo>('settimana');
  const { righe, mia, caricato } = useClassifica(periodo);
  const { punti, livello, prossimo } = useMieiPunti();

  const fraIPrimi = mia ? righe.some((r) => r.posizione === mia.posizione) : false;

  return (
    <Screen>
      <BackBar label="Indietro" />

      <View style={[gutter, { marginTop: space.sm }]}>
        <Segmented
          value={periodo}
          onChange={setPeriodo}
          items={[
            { key: 'settimana' as Periodo, label: 'Settimana' },
            { key: 'mese' as Periodo, label: 'Mese' },
            { key: 'stagione' as Periodo, label: 'Stagione' },
          ]}
        />
      </View>

      {utente ? (
        <View style={[gutter, { marginTop: space.lg }]}>
          <Card style={styles.mio}>
            <View style={styles.mioAlto}>
              <View>
                <Text style={styles.mioPunti}>{punti}</Text>
                <Text style={styles.mioEtichetta}>punti in tutto</Text>
              </View>
              <View style={[styles.livello, { borderColor: livello.colore }]}>
                <Text style={[styles.livelloTesto, { color: livello.colore }]}>{livello.nome}</Text>
              </View>
            </View>
            <Text style={styles.mioSotto}>
              {prossimo
                ? `Altri ${prossimo.mancano} punti e diventi ${prossimo.livello.nome}.`
                : 'Sei in cima: più su non si va.'}
            </Text>
          </Card>
        </View>
      ) : (
        <View style={[gutter, { marginTop: space.lg }]}>
          <SoloConAccount cosa="La classifica si guarda anche da ospiti. Per entrarci serve un account." />
        </View>
      )}

      <GroupLabel>{NOME_PERIODO[periodo]}</GroupLabel>

      {!caricato ? (
        <View style={styles.attesa}><ActivityIndicator color={colors.accent} /></View>
      ) : righe.length === 0 ? (
        <Empty text="Ancora nessun punto in questo periodo. Il primo che gioca è primo." />
      ) : (
        <Apparsa chiave={periodo} style={gutter}>
          <ListGroup>
            {righe.map((r) => (
              <ListRow
                key={r.utente}
                right={<Text style={styles.punti}>{r.punti}</Text>}
              >
                <Text style={[styles.posizione, r.posizione <= 3 && styles.podio]}>{r.posizione}</Text>
                <Avatar uri={r.avatar} name={r.nome} size={28} />
                <NomeUtente
                  id={r.utente}
                  nome={r.nome}
                  stile={[styles.nome, r.utente === utente?.id && styles.nomeMio]}
                  suffisso={r.utente === utente?.id ? '· tu' : undefined}
                />
              </ListRow>
            ))}
          </ListGroup>
        </Apparsa>
      )}

      {mia && !fraIPrimi ? (
        <>
          <GroupLabel>La tua posizione</GroupLabel>
          <View style={gutter}>
            <ListGroup>
              <ListRow right={<Text style={styles.punti}>{mia.punti}</Text>}>
                <Text style={styles.posizione}>{mia.posizione}</Text>
                <Text style={[styles.nome, styles.nomeMio]}>Tu</Text>
              </ListRow>
            </ListGroup>
          </View>
          <GroupNote>{`Su ${mia.quantiInClassifica} in classifica questa ${periodo === 'settimana' ? 'settimana' : periodo === 'mese' ? 'mese' : 'stagione'}.`}</GroupNote>
        </>
      ) : null}

      <GroupNote>
        Pronostico 10 punti, esito indovinato 50, risultato esatto 100.
        Sondaggio 5, migliore in campo 5, pagelle 5.
        {'\n'}Il colore del nome dice il livello.
      </GroupNote>
    </Screen>
  );
}

const styles = StyleSheet.create({
  attesa: { paddingVertical: space.xl, alignItems: 'center' },
  mio: { padding: space.lg, gap: space.sm },
  mioAlto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mioPunti: { ...type.displayTitle, color: colors.text },
  mioEtichetta: { ...type.footnote, color: colors.textDim },
  livello: {
    borderWidth: 1, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: 5,
  },
  livelloTesto: { ...type.captionBold, letterSpacing: 0.3 },
  mioSotto: { ...type.footnote, color: colors.textDim },
  posizione: { ...type.footnoteBold, color: colors.textFaint, width: 24 },
  podio: { color: colors.accentBright },
  nome: { ...type.subhead, color: colors.text, flex: 1 },
  nomeMio: { ...type.subheadBold },
  punti: { ...type.subheadBold, color: colors.text },
});
