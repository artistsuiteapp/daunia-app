import { Link, router } from 'expo-router';
import { apriFuori } from '../lib/apri';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { Match } from '@satanelli/core';

import { Crest } from './Crest';
import { Countdown } from './Countdown';
import { Badge, ListRow } from './ui';
import { colors, gradients, radius, space, type } from '../theme/tokens';
import { shortDate, time } from '../lib/format';

const label = (m: Match) =>
  m.competition === 'Serie C' && m.matchday ? `${m.matchday}ª giornata` : m.competition;

/* ------------------------------------------------------------------- eroe */

/**
 * Scheda della partita di riferimento.
 * Fondo scuro come le schede di sistema: il rosso resta sul bottone e sul minuto,
 * non campisce l'intero blocco. Cosi la scheda convive con il resto della pagina
 * invece di dominarla.
 */
export function MatchHeroCard({ match }: { match: Match }) {
  const played = match.status === 'finished';

  return (
    <View style={styles.hero}>
      <LinearGradient
        colors={[...gradients.club]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroTop}>
        <Text style={styles.heroComp}>{label(match)}</Text>
        {played ? <Badge label="finita" /> : <Text style={styles.heroWhen}>{shortDate(match.kickoff)}</Text>}
      </View>

      <View style={styles.heroBody}>
        <HeroSide team={match.home} />
        <View style={styles.heroCentre}>
          {played ? (
            <Text style={styles.heroScore}>{match.score!.home}–{match.score!.away}</Text>
          ) : (
            <Text style={styles.heroTime}>{time(match.kickoff)}</Text>
          )}
        </View>
        <HeroSide team={match.away} />
      </View>

      {match.venue ? <Text style={styles.heroVenue} numberOfLines={1}>{match.venue}</Text> : null}

      {!played && match.kickoff ? (
        <View style={styles.heroCountdown}><Countdown kickoff={match.kickoff} onColour /></View>
      ) : null}

      <View style={styles.heroActions}>
        {match.ticketUrl ? (
          <Pressable
            style={({ pressed }) => [styles.ctaFilled, pressed && { opacity: 0.75 }]}
            onPress={() => apriFuori(match.ticketUrl)}
          >
            <Ionicons name="ticket" size={16} color="#B10E16" />
            <Text style={styles.ctaFilledText}>Biglietti</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.ctaPlain, pressed && { opacity: 0.75 }]}
          onPress={() => router.push(`/match/${match.id}` as never)}
        >
          <Text style={styles.ctaPlainText}>Dettagli</Text>
          <Ionicons name="chevron-forward" size={15} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

function HeroSide({ team }: { team: Match['home'] }) {
  return (
    <View style={styles.heroSide}>
      <Crest uri={team.crest} name={team.shortName} size={52} />
      <Text style={styles.heroTeam} numberOfLines={2}>{team.shortName}</Text>
    </View>
  );
}

/* --------------------------------------------------------------- compatta */

/** Scheda piccola per il carosello del calendario. */
export function MatchMini({ match }: { match: Match }) {
  const played = match.status === 'finished';
  return (
    <Link href={`/match/${match.id}`} asChild style={styles.miniLink}>
      <Pressable style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
        <View style={styles.mini}>
          <Text style={styles.miniComp} numberOfLines={1}>{label(match)}</Text>
          <View style={styles.miniTeams}>
            <Crest uri={match.home.crest} name={match.home.shortName} size={26} />
            <Text style={styles.miniMid}>{played ? `${match.score!.home}–${match.score!.away}` : 'vs'}</Text>
            <Crest uri={match.away.crest} name={match.away.shortName} size={26} />
          </View>
          <Text style={styles.miniWhen}>
            {shortDate(match.kickoff)}{played ? '' : ` · ${time(match.kickoff)}`}
          </Text>
        </View>
      </Pressable>
    </Link>
  );
}

/* ------------------------------------------------------------------- riga */

/** Riga di calendario dentro un gruppo di lista. */
export function MatchListRow({ match }: { match: Match }) {
  const played = match.status === 'finished';
  const outcome = match.foggiaResult;
  const dot = played
    ? outcome === 'W' ? colors.win : outcome === 'L' ? colors.loss : colors.draw
    : 'transparent';

  return (
    <ListRow onPress={() => router.push(`/match/${match.id}` as never)} chevron height={62}>
      <View style={[styles.outcomeDot, { backgroundColor: dot }]} />
      <View style={styles.rowDate}>
        <Text style={styles.rowDateText}>{shortDate(match.kickoff)}</Text>
        <Text style={styles.rowTimeText}>{played ? 'finita' : time(match.kickoff)}</Text>
      </View>
      <View style={styles.rowTeams}>
        <TeamLine team={match.home} score={match.score?.home} played={played} winner={isWinner(match, 'home')} />
        <TeamLine team={match.away} score={match.score?.away} played={played} winner={isWinner(match, 'away')} />
      </View>
    </ListRow>
  );
}

function isWinner(m: Match, side: 'home' | 'away') {
  if (!m.score) return false;
  return side === 'home' ? m.score.home > m.score.away : m.score.away > m.score.home;
}

function TeamLine({ team, score, played, winner }: {
  team: Match['home']; score?: number; played: boolean; winner: boolean;
}) {
  const dim = played && !winner;
  return (
    <View style={styles.teamLine}>
      <Crest uri={team.crest} name={team.shortName} size={20} />
      <Text numberOfLines={1} style={[styles.teamName, team.id === 'foggia' && styles.teamNameOwn, dim && styles.dim]}>
        {team.shortName}
      </Text>
      {played ? <Text style={[styles.rowScore, dim && styles.dim]}>{score}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.xxl, padding: space.lg, gap: space.lg, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroComp: { ...type.footnoteBold, color: '#fff' },
  heroWhen: { ...type.footnote, color: 'rgba(255,255,255,0.78)' },

  heroBody: { flexDirection: 'row', alignItems: 'flex-start' },
  heroSide: { flex: 1, alignItems: 'center', gap: space.sm },
  heroTeam: { ...type.subheadBold, color: '#fff', textAlign: 'center' },
  heroCentre: { width: 96, alignItems: 'center', paddingTop: space.md },
  heroScore: { ...type.score, color: '#fff', fontSize: 38, lineHeight: 40 },
  heroTime: { ...type.score, color: '#fff', fontSize: 34, lineHeight: 36 },
  heroVenue: { ...type.footnote, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: -space.sm },

  heroCountdown: { marginTop: -space.xs },

  heroActions: { flexDirection: 'row', gap: space.sm },
  ctaFilled: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#fff', borderRadius: radius.md, paddingVertical: 12,
  },
  ctaFilledText: { ...type.headline, color: '#B10E16' },
  ctaPlain: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2,
    backgroundColor: 'rgba(0,0,0,0.24)', borderRadius: radius.md, paddingVertical: 12,
  },
  ctaPlainText: { ...type.headline, color: '#fff' },

  miniLink: { width: 148 },
  mini: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.md, gap: space.sm },
  miniComp: { ...type.caption, color: colors.textDim },
  miniTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  miniMid: { ...type.numberSm, color: colors.text },
  miniWhen: { ...type.caption, color: colors.textFaint },

  outcomeDot: { width: 6, height: 6, borderRadius: 3 },
  rowDate: { width: 76 },
  rowDateText: { ...type.footnoteBold, color: colors.text },
  rowTimeText: { ...type.caption, color: colors.textFaint },
  rowTeams: { flex: 1, gap: 5 },
  teamLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  teamName: { ...type.subhead, color: colors.text, flex: 1 },
  teamNameOwn: { ...type.subheadBold, color: colors.text },
  dim: { color: colors.textDim },
  rowScore: { ...type.numberSm, color: colors.text },
});
