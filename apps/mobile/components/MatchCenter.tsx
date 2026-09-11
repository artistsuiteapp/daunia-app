import { useCallback, useEffect, useState } from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';
import { Button, Card, GroupLabel, GroupNote, ListGroup, ListRow, useGutter } from './ui';
import { Pronostico } from './Pronostico';
import { Pagelle } from './Pagelle';
import { VotaMvp } from './VotaMvp';
import { BloccoSondaggi } from './Sondaggio';
import { SoloConAccount } from './SoloConAccount';
import { useSessione } from '../lib/auth';
import { useSondaggi } from '../lib/gioco';
import { puntiDellaPartita, segnalaCondivisione } from '../lib/punti';
import { statoMigliore } from '../lib/premi-core';
import { fineVera } from '../lib/live';
import type { Fase } from '../lib/match-center-core';
import type { Formazione } from '../lib/lineup';
import type { Match } from '@satanelli/core';

/**
 * Il Match Center: quello che si puo fare adesso, in questa partita.
 *
 * UNA SEZIONE SOLA CHE CAMBIA, NON QUATTRO SCHERMATE
 *
 * Prima della partita si pronostica, durante si commenta, all'intervallo si
 * dice come sta andando, dopo si danno i voti. Sono momenti diversi della
 * stessa cosa, e chi apre l'app vuole trovare davanti quello che serve adesso,
 * non un elenco di sezioni fra cui scegliere.
 *
 * I sondaggi seguono la stessa fase: nel database ognuno ha scritto a quale
 * momento appartiene, e qui si chiedono solo quelli.
 *
 * Se per una partita non c'e ancora niente, non si inventa e non si mostra
 * niente: una sezione vuota con scritto "presto" e peggio di una sezione che
 * non c'e.
 */
export function MatchCenter({
  match, fase, lineup,
}: {
  match: Match;
  fase: Fase;
  lineup: Formazione;
}) {
  const gutter = useGutter();
  const { utente } = useSessione();
  const ospite = !utente;

  const { sondaggi } = useSondaggi(match.id, fase);

  const [puntiQui, setPuntiQui] = useState(0);
  const [quante, setQuante] = useState(0);
  const [condiviso, setCondiviso] = useState<string | null>(null);

  const aggiornaRiepilogo = useCallback(async () => {
    const p = await puntiDellaPartita(match.id);
    setPuntiQui(p.totale);
    setQuante(p.per.length);
  }, [match.id]);

  useEffect(() => { void aggiornaRiepilogo(); }, [aggiornaRiepilogo, utente?.id]);

  const dopoUnaGiocata = () => { void aggiornaRiepilogo(); };

  const giocatori = lineup.slots
    .map((sl) => sl.player)
    .filter((pl): pl is NonNullable<typeof pl> => !!pl);

  const condividi = async () => {
    const titolo = `${match.home.shortName}–${match.away.shortName}`;
    try {
      const r = await Share.share({
        message: `Sto seguendo ${titolo} su Il Tifo della Daunia. https://daunia.vercel.app/match/${match.id}`,
      });
      if (r.action === Share.dismissedAction) return;
    } catch {
      return;
    }
    const punti = await segnalaCondivisione();
    setCondiviso(punti > 0 ? `Grazie: +${punti} punti.` : 'Grazie.');
    void aggiornaRiepilogo();
  };

  return (
    <>
      {fase === 'prima' ? (
        <>
          <GroupLabel>Il pronostico</GroupLabel>
          <View style={gutter}><Pronostico match={match} /></View>
          <GroupNote>
            Si chiude al fischio d’inizio. Esito indovinato 50 punti, risultato esatto 100.
          </GroupNote>
        </>
      ) : null}

      {fase === 'post' ? (
        <>
          {/*
            * Prima il migliore, poi le pagelle.
            *
            * Sono due domande diverse e la prima e piu facile: "chi ti e
            * piaciuto di piu" si risponde d'istinto, mettere undici voti da 4 a
            * 10 e un lavoro. Chi arriva a caldo fa la prima e magari si ferma
            * li, ed e gia un voto in piu.
            */}
          <GroupLabel>Il migliore in campo</GroupLabel>
          <View style={[gutter, { marginBottom: space.lg }]}>
            <VotaMvp
              matchId={match.id}
              giocatori={giocatori}
              chiuso={statoMigliore(fineVera() ?? match.kickoff, undefined).fase !== 'votazione'}
            />
          </View>

          <GroupLabel>Le pagelle della Curva</GroupLabel>
          <View style={gutter}><Pagelle matchId={match.id} players={giocatori} /></View>
          {lineup.fonte !== 'ufficiale' ? (
            <GroupNote>
              La formazione ufficiale di questa partita non è ancora arrivata, quindi qui c’è
              {lineup.fonte === 'ultima' ? ' l’undici della partita precedente' : ' una formazione costruita dalla rosa'}.
              I voti valgono lo stesso, ma controlla i nomi.
            </GroupNote>
          ) : null}
        </>
      ) : null}


      <BloccoSondaggi
        sondaggi={sondaggi}
        ospite={ospite}
        titolo={TITOLO_SONDAGGI[fase]}
        onVotato={dopoUnaGiocata}
      />

      {fase === 'live' || fase === 'intervallo' ? (
        <View style={[gutter, { marginTop: space.lg }]}>
          <Button label="Vai alla chat della partita" icon="chatbubbles" onPress={() => router.push('/live' as never)} />
        </View>
      ) : null}

      {/* ------------------------------------------------------- il riepilogo */}

      <GroupLabel>I tuoi punti in questa partita</GroupLabel>
      {ospite ? (
        <View style={gutter}>
          <SoloConAccount cosa="I punti e la classifica hanno bisogno di un account. Il resto si guarda lo stesso." />
        </View>
      ) : (
        <View style={gutter}>
          <Card style={styles.riepilogo}>
            <View style={styles.numero}>
              <Text style={styles.punti}>{puntiQui}</Text>
              <Text style={styles.puntiEtichetta}>{puntiQui === 1 ? 'punto' : 'punti'}</Text>
            </View>
            <Text style={styles.dettaglio}>
              {quante === 0
                ? 'Qui non hai ancora fatto niente.'
                : `Da ${quante} ${quante === 1 ? 'cosa fatta' : 'cose fatte'} in questa partita.`}
            </Text>
          </Card>
          <View style={{ marginTop: space.sm }}>
            <ListGroup>
              <ListRow chevron onPress={() => router.push('/classifica' as never)}>
                <Ionicons name="podium" size={17} color={colors.accentBright} />
                <Text style={styles.riga}>La classifica</Text>
              </ListRow>
            </ListGroup>
          </View>
        </View>
      )}

      <View style={[gutter, { marginTop: space.lg }]}>
        <Button label="Condividi la partita" icon="share-outline" onPress={condividi} />
        {condiviso ? <Text style={styles.nota}>{condiviso}</Text> : null}
      </View>
    </>
  );
}

const TITOLO_SONDAGGI: Record<Fase, string> = {
  prima: 'Dicci la tua',
  live: 'Sondaggio lampo',
  intervallo: 'Come sta andando',
  post: 'Il giudizio della Curva',
};

const styles = StyleSheet.create({
  riepilogo: { padding: space.lg, gap: space.xs },
  numero: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  punti: { ...type.displayTitle, color: colors.text },
  puntiEtichetta: { ...type.subhead, color: colors.textDim, paddingBottom: 3 },
  dettaglio: { ...type.footnote, color: colors.textDim },
  riga: { ...type.subhead, color: colors.text, flex: 1 },
  nota: { ...type.caption, color: colors.textDim, marginTop: space.sm },
});
