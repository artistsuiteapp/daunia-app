import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Player } from '@satanelli/core';

import { colors, gradients, radius, roleTint, space, type } from '../theme/tokens';
import { useLayout } from '../theme/responsive';

/**
 * Ritratto grande del giocatore, costruito come nelle reference: il cognome
 * enorme in filigrana dietro, la figura davanti, il numero di maglia come
 * elemento grafico.
 *
 * La rosa del Foggia non ha ritratti utilizzabili (sei giocatori su trenta
 * hanno una voce su Wikipedia, due un'immagine, nessuna a licenza libera):
 * al posto della foto va una sagoma con il numero, costruita in modo che la
 * scheda regga lo stesso. Quando arriva la fototeca del club basta passare
 * l'immagine e il resto non cambia.
 */
export function PlayerHero({ player, goals }: { player: Player; goals: number }) {
  const { scale } = useLayout();
  const surname = (player.shortName || player.name).toUpperCase();
  const tint = (player.role && roleTint[player.role]) ?? gradients.portrait.slice(0, 2);

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={[tint[0], tint[1]]} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />

      {/* cognome in filigrana: riempie il fondo e da la scala alla scheda */}
      <Text
        style={[styles.ghost, { fontSize: scale(70, 104), lineHeight: scale(70, 104) }]}
        numberOfLines={1}
        pointerEvents="none"
      >
        {surname}
      </Text>

      <View style={styles.figure}>
        {player.photo ? (
          <Image source={{ uri: player.photo }} style={styles.photo} contentFit="contain" transition={260} />
        ) : (
          <View style={styles.shirt}>
            <Text style={[styles.shirtNumber, { fontSize: scale(96, 136) }]}>{player.number ?? '–'}</Text>
          </View>
        )}
      </View>

      <LinearGradient colors={[...gradients.scrim]} style={styles.scrim} pointerEvents="none" />

      <View style={styles.info}>
        <Text style={styles.role}>{player.roleLabel ?? 'Giocatore'}{player.nationality ? ` · ${player.nationality}` : ''}</Text>
        <Text style={[styles.name, { fontSize: scale(30, 40) }]} numberOfLines={2}>{player.name}</Text>
      </View>

      <View style={styles.badge}>
        <Text style={styles.badgeValue}>{player.number ?? '–'}</Text>
        <Text style={styles.badgeLabel}>maglia</Text>
      </View>

      {goals > 0 ? (
        <View style={[styles.badge, styles.badgeRight]}>
          <Text style={styles.badgeValue}>{goals}</Text>
          <Text style={styles.badgeLabel}>{goals === 1 ? 'gol' : 'gol'}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 340, borderRadius: radius.xxl, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  ghost: {
    position: 'absolute', top: 26, left: 0, right: 0,
    fontFamily: type.number.fontFamily,
    color: 'rgba(255,255,255,0.09)',
    textAlign: 'center', letterSpacing: -2,
  },
  figure: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  photo: { width: '78%', height: '88%' },
  shirt: { alignItems: 'center', justifyContent: 'center' },
  shirtNumber: {
    fontFamily: type.number.fontFamily,
    color: 'rgba(255,255,255,0.92)',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 18, textShadowOffset: { width: 0, height: 6 },
  },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 190 },
  info: { padding: space.lg, gap: 2 },
  role: { ...type.footnoteBold, color: 'rgba(255,255,255,0.72)' },
  name: { fontFamily: type.number.fontFamily, color: '#fff', letterSpacing: -0.5 },

  badge: {
    position: 'absolute', top: space.lg, left: space.lg, alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.34)', borderRadius: radius.lg,
    paddingHorizontal: space.md, paddingVertical: space.sm, minWidth: 58,
  },
  badgeRight: { left: undefined, right: space.lg },
  badgeValue: { ...type.title3, color: '#fff' },
  badgeLabel: { ...type.caption, color: 'rgba(255,255,255,0.62)' },
});
