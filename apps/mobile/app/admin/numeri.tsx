import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Screen, LargeTitle, Empty, GroupLabel, GroupNote, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { colors, radius, space, type } from '../../theme/tokens';
import { puoModerare, useRuolo } from '../../lib/moderazione';
import { caricaNumeri, type NumeriApp } from '../../lib/misure';

/**
 * I numeri dell'app.
 *
 * SONO POCHI APPOSTA
 *
 * Un cruscotto con quaranta numeri non si guarda mai. Qui ce ne sono due che
 * contano davvero -- l'attivazione e il ritorno -- e qualche conteggio di
 * contorno per capire cosa stanno facendo le persone.
 *
 * PERCHE PROPRIO QUESTI DUE
 *
 * Sono stati scelti prima di poterli guardare, che e l'unico modo di sceglierli
 * onestamente: dopo, si finisce sempre per tenere quelli che fanno bella figura.
 *
 * Attivazione: quanti, dopo aver aperto, hanno messo almeno un pronostico. Chi
 * pronostica ha un motivo per tornare sabato; chi guarda e basta no.
 *
 * Ritorno: quanti sono tornati dopo una settimana e dopo un mese. E l'unica
 * misura che distingue un'app che serve da una che e stata provata una volta.
 * Il numero compare solo quando c'e qualcuno arrivato da abbastanza tempo:
 * contare fra i "mancati ritorni" chi si e iscritto ieri farebbe sembrare
 * l'app peggiore di com'e.
 */
export default function Numeri() {
  const ruolo = useRuolo();
  const gutter = useGutter();
  const [n, setN] = useState<NumeriApp | null>(null);
  const [caricato, setCaricato] = useState(false);

  useEffect(() => {
    if (!puoModerare(ruolo)) return;
    let vivo = true;
    void caricaNumeri().then((r) => { if (vivo) { setN(r); setCaricato(true); } });
    return () => { vivo = false; };
  }, [ruolo]);

  if (!puoModerare(ruolo)) {
    return (
      <Screen>
        <BackBar label="Pannello" />
        <Empty text="Questa parte è per chi modera." />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackBar label="Pannello" />
      <LargeTitle title="I numeri" subtitle="Quanti la usano, e quanti tornano" />

      {!caricato ? (
        <View style={stili.attesa}><ActivityIndicator color={colors.accent} /></View>
      ) : !n ? (
        <Empty text="I numeri non sono arrivati. Riprova fra poco." />
      ) : (
        <>
          <GroupLabel>Le due che contano</GroupLabel>
          <View style={[gutter, stili.riga]}>
            <Grande
              valore={`${n.attivazione}%`}
              titolo="Attivazione"
              sotto="ha messo almeno un pronostico"
            />
            <Grande
              valore={n.ritorno7 == null ? '—' : `${n.ritorno7}%`}
              titolo="Torna dopo 7 giorni"
              sotto={n.ritorno7 == null ? 'ancora troppo presto' : 'di chi è arrivato da almeno una settimana'}
            />
          </View>
          <View style={[gutter, stili.riga, { marginTop: space.md }]}>
            <Grande
              valore={n.ritorno30 == null ? '—' : `${n.ritorno30}%`}
              titolo="Torna dopo 30 giorni"
              sotto={n.ritorno30 == null ? 'ancora troppo presto' : 'di chi è arrivato da almeno un mese'}
            />
            <Grande
              valore={String(n.nuove7)}
              titolo="Arrivati questa settimana"
              sotto="installazioni mai viste prima"
            />
          </View>

          <GroupLabel>Quante persone</GroupLabel>
          <View style={gutter}>
            <View style={stili.blocco}>
              <Piccola etichetta="Oggi" valore={n.attiveOggi} />
              <View style={stili.divisorio} />
              <Piccola etichetta="Ultimi 7 giorni" valore={n.attive7} />
              <View style={stili.divisorio} />
              <Piccola etichetta="Ultimi 30 giorni" valore={n.attive30} />
            </View>
          </View>

          <GroupLabel>Cosa hanno fatto in sette giorni</GroupLabel>
          <View style={gutter}>
            <View style={stili.blocco}>
              <Piccola etichetta="Pronostici" valore={n.pronostici7} />
              <View style={stili.divisorio} />
              <Piccola etichetta="Pagelle" valore={n.pagelle7} />
              <View style={stili.divisorio} />
              <Piccola etichetta="Nella Curva" valore={n.scritti7} />
            </View>
          </View>

          <GroupNote>
            {`Iscritti nell’ultimo mese: ${n.iscritti30}.`}
          </GroupNote>
        </>
      )}

      <GroupNote>
        Si conta un numero casuale per installazione, cosa è successo e quando. Nessun nome,
        nessuna email, nessun collegamento con l’account: nella tabella la colonna per farlo non
        esiste. Dopo tredici mesi si cancellano.
      </GroupNote>
    </Screen>
  );
}

function Grande({ valore, titolo, sotto }: { valore: string; titolo: string; sotto: string }) {
  return (
    <View style={stili.grande}>
      <Text style={stili.grandeValore}>{valore}</Text>
      <Text style={stili.grandeTitolo}>{titolo}</Text>
      <Text style={stili.grandeSotto}>{sotto}</Text>
    </View>
  );
}

function Piccola({ etichetta, valore }: { etichetta: string; valore: number }) {
  return (
    <View style={stili.piccola}>
      <Text style={stili.piccolaValore}>{valore}</Text>
      <Text style={stili.piccolaEtichetta}>{etichetta}</Text>
    </View>
  );
}

const stili = StyleSheet.create({
  attesa: { paddingVertical: space.xxl, alignItems: 'center' },
  riga: { flexDirection: 'row', gap: space.md },

  grande: {
    flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: space.lg, gap: 2, minHeight: 132,
  },
  grandeValore: { ...type.score, fontSize: 38, lineHeight: 44, color: colors.accentBright },
  grandeTitolo: { ...type.subheadBold, color: colors.text, marginTop: 2 },
  grandeSotto: { ...type.caption, color: colors.textFaint, lineHeight: 16 },

  blocco: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingVertical: space.lg, paddingHorizontal: space.md,
  },
  piccola: { flex: 1, alignItems: 'center', gap: 2 },
  piccolaValore: { ...type.number, color: colors.text },
  piccolaEtichetta: { ...type.caption, color: colors.textFaint, textAlign: 'center' },
  divisorio: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.separator },
});
