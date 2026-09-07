import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@satanelli/core';

import { Crest } from './Crest';
import { colors, gradients, radius, space, type } from '../theme/tokens';
import { shortDate, time } from '../lib/format';
import { useLive, liveDi } from '../lib/live';
import { etichettaFase } from '../lib/live-core';
import { salaAperta } from '../lib/sala';
import { PredictionCallout } from './PredictionCallout';

type Tone = 'accent' | 'dark';

const comp = (m: Match) => (m.competition === 'Serie C' ? 'Serie C · Girone C' : m.competition);
const day = (m: Match) => (m.matchday ? `${m.matchday}ª giornata` : m.competition);

/**
 * Scheda partita nella forma della reference: riga di testata con competizione
 * e stato, poi i due stemmi ai lati con il punteggio (o l'orario) al centro e
 * il dettaglio della giornata sotto, infine i nomi delle squadre agli estremi.
 *
 * La partita di riferimento e rossa piena, le altre restano scure: e il rosso a
 * dire quale conta, non la dimensione.
 */
export function EventCard({ match, tone = 'dark', compatta = false }: {
  match: Match; tone?: Tone; compatta?: boolean;
}) {
  const accent = tone === 'accent';
  const played = match.status === 'finished';
  // il punteggio dal vivo arriva da TheSportsDB durante la partita; fuori dalla
  // finestra della gara vale lo stato scritto nei dati
  const vivo = liveDi(match, useLive());
  const live = match.status === 'live' || Boolean(vivo);
  const casa = vivo ? vivo.casa ?? 0 : match.score?.home ?? 0;
  const ospite = vivo ? vivo.ospite ?? 0 : match.score?.away ?? 0;
  const chatViva = salaAperta(match.kickoff);
  const fg = accent ? '#FFFFFF' : colors.text;
  const dim = accent ? 'rgba(255,255,255,0.72)' : colors.textDim;

  return (
    <Pressable
      onPress={() => router.push(`/match/${match.id}` as never)}
      // anche le compatte si aprono: erano l'unica scheda non toccabile
      disabled={false}
      style={({ pressed }) => [
        styles.card, !accent && styles.cardDark,
        compatta && styles.cardCompatta,
        pressed && !compatta && { opacity: 0.88 },
      ]}
    >
      {accent ? (
        <LinearGradient
          colors={[...gradients.club]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}

      <View style={styles.top}>
        <Text style={[styles.comp, { color: fg }]} numberOfLines={1}>{comp(match)}</Text>
        <View style={[styles.status, accent ? styles.statusOnAccent : styles.statusOnDark]}>
          {live ? <View style={styles.liveDot} /> : null}
          <Text style={[styles.statusText, { color: accent ? '#FFFFFF' : colors.textDim }]}>
            {vivo ? etichettaFase(vivo, match.kickoff) : live ? 'in corso' : played ? 'finita' : 'in arrivo'}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Crest uri={match.home.crest} name={match.home.shortName} size={compatta ? 26 : 46} />
        <View style={styles.centre}>
          <Text style={[styles.score, compatta && styles.scoreCompatto, { color: fg }]}>
            {played || live ? `${casa} : ${ospite}` : time(match.kickoff)}
          </Text>
          <Text style={[styles.sub, { color: dim }]}>{day(match)}</Text>
          <Text style={[styles.sub, { color: dim }]}>{shortDate(match.kickoff)}</Text>
        </View>
        <Crest uri={match.away.crest} name={match.away.shortName} size={compatta ? 26 : 46} />
      </View>

      <View style={styles.names}>
        <Text style={[styles.team, { color: fg }]} numberOfLines={1}>{match.home.shortName}</Text>
        <Text style={[styles.team, styles.teamRight, { color: fg }]} numberOfLines={1}>{match.away.shortName}</Text>
      </View>

      {/* il richiamo al pronostico sta sulla partita di riferimento, prima dei
          bottoni: e la prima cosa da fare quando apri l'app prima della gara */}
      {accent && !played && !live && !compatta ? <PredictionCallout matchId={match.id} onAccent /> : null}

      {accent && !compatta ? (
        <View style={styles.actions}>
          {/*
            * Al posto dei biglietti, la chat.
            *
            * I biglietti si comprano una volta e restano nelle scorciatoie in
            * home; la chat invece va presa nel momento in cui esiste, ed e il
            * motivo per cui uno riapre l'app la domenica sera. Verde e che si
            * puo scrivere, rosso che si legge e basta -- e cosi la voce non
            * sparisce dopo la partita lasciando il dubbio di averla sognata.
            */}
          <Pressable
            style={({ pressed }) => [styles.ctaFilled, pressed && { opacity: 0.75 }]}
            onPress={() => router.push('/live' as never)}
          >
            <Pastiglia acceso={chatViva} />
            <Text style={styles.ctaFilledText}>{chatViva ? 'Live chat' : 'Chat chiusa'}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.ctaPlain, pressed && { opacity: 0.75 }]}
            onPress={() => router.push(`/match/${match.id}` as never)}
          >
            <Text style={styles.ctaPlainText}>Dettagli</Text>
            <Ionicons name="chevron-forward" size={14} color="#fff" />
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * Il pallino dentro il bottone della chat.
 *
 * Sta nel bottone bianco insieme agli altri, non in una pastiglia a parte:
 * doveva somigliare al tasto che ha sostituito, non gridare piu forte.
 * Verde e pulsante quando si puo scrivere, rosso e fermo quando si legge e
 * basta -- un pallino che pulsa promette qualcosa che sta succedendo.
 */
function Pastiglia({ acceso }: { acceso: boolean }) {
  const v = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!acceso) return;
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.25, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [acceso, v]);

  return (
    <Animated.View
      style={[
        styles.pallino,
        { backgroundColor: acceso ? '#1FA845' : '#B10E16' },
        acceso ? { opacity: v } : null,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  pallino: { width: 8, height: 8, borderRadius: 4 },
  card: { borderRadius: radius.xxl, overflow: 'hidden', padding: space.lg, gap: space.md },
  // le partite dopo la prossima: servono a sapere che ci sono, non a essere
  // guardate. Stemmi piu piccoli, meno aria intorno, e ce ne stanno quattro
  // nello spazio che prima ne teneva due
  cardCompatta: { paddingHorizontal: space.md, paddingVertical: 9, gap: 6 },
  cardDark: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.07)',
  },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  comp: { ...type.subheadBold, flex: 1 },
  status: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  statusOnAccent: { backgroundColor: 'rgba(0,0,0,0.26)' },
  statusOnDark: { backgroundColor: colors.surfaceHi },
  statusText: { ...type.captionBold, fontSize: 11 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.live },

  body: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  centre: { flex: 1, alignItems: 'center', gap: 1 },
  score: { ...type.score, fontSize: 38, lineHeight: 40 },
  scoreCompatto: { fontSize: 28, lineHeight: 32 },
  sub: { ...type.caption, fontSize: 11 },

  names: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  team: { ...type.footnoteBold, flex: 1 },
  teamRight: { textAlign: 'right' },

  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
  ctaFilled: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: radius.pill, paddingVertical: 11,
  },
  ctaFilledText: { ...type.subheadBold, color: '#B10E16' },
  ctaPlain: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.26)', borderRadius: radius.pill, paddingVertical: 11,
  },
  ctaPlainText: { ...type.subheadBold, color: '#fff' },
});
