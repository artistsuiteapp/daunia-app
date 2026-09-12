import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, LargeTitle, Empty, GroupLabel, GroupNote, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Avatar } from '../../components/Avatar';
import { Premi } from '../../components/anima';
import { colors, radius, space, type } from '../../theme/tokens';
import { puoModerare, useRuolo } from '../../lib/moderazione';
import { quanteSegnalazioniAperte } from '../../lib/pannello';
import { usePresenza } from '../../lib/presenza';

/**
 * Il pannello.
 *
 * PERCHE ESISTE
 *
 * I ruoli stanno nel database da giorni e dall'app non servivano a niente: un
 * admin poteva cancellare qualsiasi messaggio secondo le politiche, ma il tasto
 * per farlo compariva solo sui suoi. Chi modera finiva sul pannello di Supabase,
 * cioe fuori dall'app, a scrivere SQL per togliere una parolaccia.
 *
 * COME E FATTO
 *
 * Tre porte e una riga di gente collegata. Le tre porte sono le tre cose che si
 * fanno davvero: leggere le segnalazioni, guardare le persone, vedere chi c'e.
 * Moderare i contenuti non ha una porta perche si fa dove i contenuti stanno:
 * il tasto e sotto ogni messaggio.
 */
export default function Pannello() {
  const ruolo = useRuolo();
  const gutter = useGutter();
  const { presenti, quanti } = usePresenza();
  const [aperte, setAperte] = useState<number | null>(null);

  useEffect(() => {
    if (!puoModerare(ruolo)) return;
    let vivo = true;
    void quanteSegnalazioniAperte().then((n) => { if (vivo) setAperte(n); });
    return () => { vivo = false; };
  }, [ruolo]);

  if (!puoModerare(ruolo)) {
    return (
      <Screen>
        <BackBar label="Indietro" />
        <Empty text="Questa parte è per chi modera." />
      </Screen>
    );
  }

  return (
    <Screen>
      <BackBar label="Indietro" />
      <LargeTitle
        title="Pannello"
        subtitle={ruolo === 'admin' ? 'Sei admin: puoi fare tutto.' : 'Sei moderatore.'}
      />

      <View style={[gutter, { gap: space.md, marginTop: space.sm }]}>
        <Porta
          icona="flag"
          titolo="Segnalazioni"
          sotto={aperte == null ? 'Sto guardando…' : aperte === 0 ? 'Niente da leggere' : `${aperte} da leggere`}
          numero={aperte ?? null}
          urgente={(aperte ?? 0) > 0}
          onPress={() => router.push('/segnalazioni' as never)}
        />
        <Porta
          icona="people"
          titolo="Persone"
          sotto="Ruoli, sospensioni, bandi"
          onPress={() => router.push('/admin/utenti' as never)}
        />
        <Porta
          icona="bar-chart"
          titolo="I numeri"
          sotto="Quanti la usano, e quanti tornano"
          onPress={() => router.push('/admin/numeri' as never)}
        />
        <Porta
          icona="radio"
          titolo="Chi c’è adesso"
          sotto={quanti === 0 ? 'Nessuno collegato' : quanti === 1 ? 'Una persona collegata' : `${quanti} persone collegate`}
          numero={quanti || null}
          onPress={() => router.push('/admin/online' as never)}
        />
      </View>

      {presenti.length ? (
        <>
          <GroupLabel>Collegati ora</GroupLabel>
          <View style={[gutter, stili.facce]}>
            {presenti.slice(0, 12).map((p) => (
              <View key={p.utente} style={stili.faccia}>
                <Avatar uri={p.avatar} name={p.nome} size={34} />
                <View style={stili.pallino} />
              </View>
            ))}
            {presenti.length > 12 ? (
              <Text style={stili.altri}>+{presenti.length - 12}</Text>
            ) : null}
          </View>
        </>
      ) : null}

      <GroupNote>
        Per nascondere o cancellare un messaggio, usa i tre puntini accanto al messaggio stesso:
        stai guardando quello che stai giudicando.
      </GroupNote>
    </Screen>
  );
}

function Porta({ icona, titolo, sotto, numero, urgente, onPress }: {
  icona: keyof typeof Ionicons.glyphMap;
  titolo: string;
  sotto: string;
  numero?: number | null;
  urgente?: boolean;
  onPress: () => void;
}) {
  return (
    <Premi onPress={onPress} style={stili.porta}>
      <View style={[stili.icona, urgente && { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icona} size={20} color={urgente ? colors.accentBright : colors.textDim} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={stili.portaTitolo}>{titolo}</Text>
        <Text style={stili.portaSotto}>{sotto}</Text>
      </View>
      {numero ? (
        <View style={[stili.conta, urgente && { backgroundColor: colors.accent }]}>
          <Text style={stili.contaTesto}>{numero}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={17} color={colors.textFaint} />
    </Premi>
  );
}

const stili = StyleSheet.create({
  porta: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: space.lg, paddingVertical: space.lg,
  },
  icona: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.surfaceHi, alignItems: 'center', justifyContent: 'center',
  },
  portaTitolo: { ...type.headline, color: colors.text },
  portaSotto: { ...type.footnote, color: colors.textDim, marginTop: 2 },
  conta: {
    minWidth: 26, paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: radius.pill, backgroundColor: colors.surfaceHi, alignItems: 'center',
  },
  contaTesto: { ...type.captionBold, color: colors.text },

  facce: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  faccia: { position: 'relative' },
  pallino: {
    position: 'absolute', right: -1, bottom: -1, width: 11, height: 11,
    borderRadius: 6, backgroundColor: colors.win,
    borderWidth: 2, borderColor: colors.bg,
  },
  altri: { ...type.footnoteBold, color: colors.textDim },
});
