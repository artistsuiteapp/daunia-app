import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@satanelli/core';

import { Crest } from './Crest';
import { colors, gradients, radius, space, type } from '../theme/tokens';
import { shortDate, time } from '../lib/format';

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
export function EventCard({ match, tone = 'dark' }: { match: Match; tone?: Tone }) {
  const accent = tone === 'accent';
  const played = match.status === 'finished';
  const live = match.status === 'live';
  const fg = accent ? '#FFFFFF' : colors.text;
  const dim = accent ? 'rgba(255,255,255,0.72)' : colors.textDim;

  return (
    <Pressable
      onPress={() => router.push(`/match/${match.id}` as never)}
      style={({ pressed }) => [styles.card, !accent && styles.cardDark, pressed && { opacity: 0.88 }]}
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
            {live ? 'in corso' : played ? 'finita' : 'in arrivo'}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        <Crest uri={match.home.crest} name={match.home.shortName} size={46} />
        <View style={styles.centre}>
          <Text style={[styles.score, { color: fg }]}>
            {played || live ? `${match.score?.home ?? 0} : ${match.score?.away ?? 0}` : time(match.kickoff)}
          </Text>
          <Text style={[styles.sub, { color: dim }]}>{day(match)}</Text>
          <Text style={[styles.sub, { color: dim }]}>{shortDate(match.kickoff)}</Text>
        </View>
        <Crest uri={match.away.crest} name={match.away.shortName} size={46} />
      </View>

      <View style={styles.names}>
        <Text style={[styles.team, { color: fg }]} numberOfLines={1}>{match.home.shortName}</Text>
        <Text style={[styles.team, styles.teamRight, { color: fg }]} numberOfLines={1}>{match.away.shortName}</Text>
      </View>

      {accent ? (
        <View style={styles.actions}>
          {match.ticketUrl ? (
            <Pressable
              style={({ pressed }) => [styles.ctaFilled, pressed && { opacity: 0.75 }]}
              onPress={() => Linking.openURL(match.ticketUrl!)}
            >
              <Ionicons name="ticket" size={15} color="#B10E16" />
              <Text style={styles.ctaFilledText}>Biglietti</Text>
            </Pressable>
          ) : null}
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

const styles = StyleSheet.create({
  card: { borderRadius: radius.xxl, overflow: 'hidden', padding: space.lg, gap: space.md },
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
