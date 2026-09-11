import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';
import { rispondi, type Domanda, type Esito } from '../lib/gioco';
import { SoloConAccount } from './SoloConAccount';
import { GroupLabel, GroupNote } from './ui';

/**
 * Una domanda del quiz.
 *
 * SI RISPONDE UNA VOLTA SOLA, E SI VEDE SUBITO COM'E ANDATA
 *
 * Niente conferma in due passaggi: una domanda a tre opzioni con un tasto
 * "conferma" sotto e un passaggio in piu per niente. Si tocca la risposta e si
 * sa, come quando si risponde a voce.
 *
 * Chi sbaglia vede qual era quella giusta e perche. Un quiz che dice solo
 * "sbagliato" fa ricordare di aver perso; uno che dice com'era fa ricordare la
 * cosa, ed e il motivo per cui esiste.
 */
export function Quiz({ domanda, onRisposto }: { domanda: Domanda; onRisposto?: () => void }) {
  const [esito, setEsito] = useState<Esito | null>(
    domanda.miaScelta !== null
      ? { esatta: domanda.miaGiusta ?? false, corretta: -1, spiegazione: null, punti: 0, giaRisposto: true }
      : null,
  );
  const [scelta, setScelta] = useState<number | null>(domanda.miaScelta);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  const rispostoGia = scelta !== null;

  const tocca = async (i: number) => {
    if (rispostoGia || inCorso || !domanda.aperta) return;
    setInCorso(true);
    setErrore(null);
    setScelta(i);
    const r = await rispondi(domanda.id, i);
    setInCorso(false);
    if ('errore' in r) {
      setScelta(null);
      setErrore(r.errore);
      return;
    }
    setEsito(r);
    onRisposto?.();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.testo}>{domanda.testo}</Text>

      <View style={styles.opzioni}>
        {domanda.opzioni.map((o, i) => {
          const mia = scelta === i;
          const giusta = esito && esito.corretta === i;
          const sbagliata = mia && esito && !esito.esatta;
          return (
            <Pressable
              key={o}
              onPress={() => tocca(i)}
              disabled={rispostoGia || !domanda.aperta}
              style={({ pressed }) => [
                styles.opzione,
                mia && styles.scelta,
                giusta && styles.giusta,
                sbagliata && styles.sbagliata,
                pressed && !rispostoGia && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.opzioneTesto, (mia || giusta) && styles.opzioneTestoForte]}>{o}</Text>
              {giusta ? <Ionicons name="checkmark-circle" size={18} color={colors.win} /> : null}
              {sbagliata ? <Ionicons name="close-circle" size={18} color={colors.loss} /> : null}
            </Pressable>
          );
        })}
      </View>

      {esito && !esito.giaRisposto ? (
        <View style={styles.esito}>
          <Text style={[styles.esitoTesto, { color: esito.esatta ? colors.win : colors.textDim }]}>
            {esito.esatta ? `Giusta${esito.punti ? ` · +${esito.punti} punti` : ''}` : 'Non era quella'}
          </Text>
          {esito.spiegazione ? <Text style={styles.spiegazione}>{esito.spiegazione}</Text> : null}
        </View>
      ) : null}

      {esito?.giaRisposto ? (
        <Text style={styles.gia}>Avevi già risposto{esito.esatta ? ', ed era giusta' : ''}.</Text>
      ) : null}

      {!domanda.aperta && !rispostoGia ? (
        <Text style={styles.gia}>Questa è chiusa: il tempo è scaduto.</Text>
      ) : null}

      {errore ? <Text style={styles.errore}>{errore}</Text> : null}
    </View>
  );
}

/** Il gruppo di domande di una fase, con il suo titolo e gli stati vuoti. */
export function BloccoQuiz({
  domande, titolo, vuoto, ospite, onRisposto,
}: {
  domande: Domanda[];
  titolo: string;
  vuoto: string;
  ospite: boolean;
  onRisposto?: () => void;
}) {
  if (domande.length === 0) return <GroupNote>{vuoto}</GroupNote>;

  return (
    <>
      <GroupLabel>{titolo}</GroupLabel>
      {ospite ? (
        <View style={{ marginBottom: space.sm }}>
          <SoloConAccount cosa="Per rispondere al quiz e prendere punti serve un account." compatto />
        </View>
      ) : null}
      <View style={{ gap: space.sm }}>
        {domande.map((d) => <Quiz key={d.id} domanda={d} onRisposto={onRisposto} />)}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
  },
  testo: { ...type.subheadBold, color: colors.text, lineHeight: 21 },
  opzioni: { gap: 6 },
  opzione: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 11,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent',
  },
  scelta: { borderColor: colors.borderStrong },
  giusta: { backgroundColor: 'rgba(48,209,88,0.14)', borderColor: 'rgba(48,209,88,0.5)' },
  sbagliata: { backgroundColor: 'rgba(255,69,58,0.12)', borderColor: 'rgba(255,69,58,0.45)' },
  opzioneTesto: { ...type.subhead, color: colors.textDim, flex: 1 },
  opzioneTestoForte: { color: colors.text },
  esito: { gap: 3 },
  esitoTesto: { ...type.footnoteBold },
  spiegazione: { ...type.footnote, color: colors.textDim, lineHeight: 18 },
  gia: { ...type.caption, color: colors.textFaint },
  errore: { ...type.caption, color: colors.accentBright },
});
