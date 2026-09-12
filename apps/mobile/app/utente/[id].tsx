import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { Screen, Card, Empty, GroupLabel, GroupNote, useGutter } from '../../components/ui';
import { BackBar } from '../../components/BackBar';
import { Avatar } from '../../components/Avatar';
import { AzioniContenuto } from '../../components/AzioniContenuto';
import { Timbro } from '../../components/anima';
import { colors, radius, space, type } from '../../theme/tokens';
import { longDate } from '../../lib/format';
import { useProfiloPubblico } from '../../lib/identita';
import { tintaNome } from '../../lib/identita-core.ts';
import { livelloDi, alProssimoLivello } from '../../lib/match-center-core.ts';
import { useSessione } from '../../lib/auth';

/**
 * La scheda di una persona.
 *
 * COSA C'E, E COSA NON C'E
 *
 * Nome, foto, ruolo, livello, punti, da quando c'e e i badge presi. Basta.
 * Niente elenco di quello che ha scritto: una pagina che raccoglie tutti i
 * messaggi di qualcuno e uno strumento comodissimo per chi vuole accanirsi, e
 * non serve a nient'altro. Chi vuole rileggere una discussione la riapre.
 *
 * I badge mancanti non si mostrano: sul proprio profilo servono a far venire
 * voglia di prenderli, su quello di un altro sarebbero solo un elenco di cose
 * che non ha fatto.
 */
export default function SchedaUtente() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const gutter = useGutter();
  const { utente } = useSessione();
  const { scheda, caricato } = useProfiloPubblico(id);

  if (!caricato) {
    return (
      <Screen>
        <BackBar label="Indietro" />
        <View style={stili.attesa}><ActivityIndicator color={colors.accent} /></View>
      </Screen>
    );
  }

  if (!scheda) {
    return (
      <Screen>
        <BackBar label="Indietro" />
        <Empty text="Questa persona non c’è più." />
      </Screen>
    );
  }

  const tinta = tintaNome(scheda.ruolo, scheda.punti);
  const livello = livelloDi(scheda.punti);
  const prossimo = alProssimoLivello(scheda.punti);
  const sonoIo = utente?.id === scheda.utente;

  return (
    <Screen>
      <BackBar label="Indietro" />

      <View style={[gutter, { gap: space.lg, marginTop: space.sm }]}>
        <Timbro>
          <Card style={stili.testa}>
            <Avatar uri={scheda.avatar} name={scheda.nome} size={76} />

            <View style={stili.nomeRiga}>
              <Text style={[stili.nome, { color: tinta.colore }]} numberOfLines={1}>{scheda.nome}</Text>
              {tinta.spilletta ? <Ionicons name={tinta.spilletta} size={17} color={tinta.colore} /> : null}
            </View>

            <View style={[stili.livello, { borderColor: tinta.colore }]}>
              <Text style={[stili.livelloTesto, { color: tinta.colore }]}>
                {tinta.etichetta ?? livello.nome}
              </Text>
            </View>

            {scheda.bio ? <Text style={stili.bio}>{scheda.bio}</Text> : null}

            <View style={stili.numeri}>
              <Numero valore={String(scheda.punti)} etichetta="punti" />
              <View style={stili.sep} />
              <Numero valore={String(scheda.badge.length)} etichetta={scheda.badge.length === 1 ? 'badge' : 'badge'} />
            </View>

            <Text style={stili.da}>Nella Curva da {longDate(scheda.iscrittoIl)}</Text>
          </Card>
        </Timbro>

        {!sonoIo ? (
          <View style={stili.azioni}>
            <AzioniContenuto tipo="profilo" id={scheda.utente} autore={scheda.utente} autoreNome={scheda.nome} />
            <Text style={stili.azioniNota}>Segnala o blocca</Text>
          </View>
        ) : null}
      </View>

      {scheda.badge.length ? (
        <>
          <GroupLabel>Quello che ha preso</GroupLabel>
          <View style={[gutter, stili.griglia]}>
            {scheda.badge.map((b) => (
              <View key={b.codice} style={stili.badge}>
                <Ionicons name={b.icona as never} size={20} color={colors.accentBright} />
                <Text style={stili.badgeNome} numberOfLines={2}>{b.nome}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <GroupNote>
        {prossimo
          ? `Con altri ${prossimo.mancano} punti diventa ${prossimo.livello.nome}.`
          : 'Più in alto di così non si va.'}
        {' '}Il colore del nome dice il livello; rosso e azzurro dicono chi tiene in ordine la Curva.
      </GroupNote>
    </Screen>
  );
}

function Numero({ valore, etichetta }: { valore: string; etichetta: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 1 }}>
      <Text style={stili.numero}>{valore}</Text>
      <Text style={stili.numeroEtichetta}>{etichetta}</Text>
    </View>
  );
}

const stili = StyleSheet.create({
  attesa: { paddingVertical: space.xxl, alignItems: 'center' },

  testa: { padding: space.xl, alignItems: 'center', gap: space.md },
  nomeRiga: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nome: { ...type.title2, color: colors.text },
  livello: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  livelloTesto: { ...type.captionBold, letterSpacing: 0.3 },
  bio: { ...type.subhead, color: colors.textDim, textAlign: 'center' },

  numeri: { flexDirection: 'row', alignItems: 'center', gap: space.xl, marginTop: space.sm },
  numero: { ...type.number, color: colors.text },
  numeroEtichetta: { ...type.caption, color: colors.textFaint },
  sep: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.separator },

  da: { ...type.footnote, color: colors.textFaint },

  azioni: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  azioniNota: { ...type.footnote, color: colors.textFaint },

  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.surface, borderRadius: radius.lg,
    paddingHorizontal: space.md, paddingVertical: space.md,
    minWidth: 150, flexGrow: 1, flexShrink: 1,
  },
  badgeNome: { ...type.footnoteBold, color: colors.text, flex: 1 },
});
