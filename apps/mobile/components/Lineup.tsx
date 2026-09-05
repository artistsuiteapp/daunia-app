import { StyleSheet, Text, View } from 'react-native';
import { Crest } from './Crest';
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Path, Polygon, Polyline, Stop, Rect } from 'react-native-svg';

import type { Slot } from '../lib/lineup';
import { colors, radius, space, type } from '../theme/tokens';

/* ------------------------------------------------------- proiezione del campo */

/**
 * Il campo e disegnato in prospettiva vera, non con una rotazione applicata a
 * un rettangolo. La sponda lontana e piu stretta di quella vicina e le fasce
 * uguali sul prato si accorciano allontanandosi, che e quello che rende un
 * campo credibile invece di inclinato.
 *
 * t e la coordinata a terra: 0 la porta lontana (attacco), 1 quella vicina
 * (dove sta il portiere, come nella reference). u va da 0 a 1 da sinistra.
 */
const VB = { w: 100, h: 116 };
/** quanto e stretta la sponda lontana rispetto a quella vicina */
const FAR = 0.5;
const TOP = 3;
const H = VB.h - TOP * 2;
const CX = VB.w / 2;
const HALF = 47;

/** y sullo schermo per una coordinata a terra: non lineare, e li la prospettiva */
const yAt = (t: number) => TOP + H * (t / (FAR + t * (1 - FAR)));
/** larghezza relativa alla sponda vicina, alla quota y */
const wAt = (y: number) => FAR + ((y - TOP) / H) * (1 - FAR);
const xAt = (u: number, y: number) => CX + (u - 0.5) * 2 * HALF * wAt(y);
/** punto a terra -> punto sullo schermo */
const pt = (u: number, t: number) => {
  const y = yAt(t);
  return [xAt(u, y), y] as const;
};
const poly = (corners: Array<readonly [number, number]>) =>
  corners.map(([u, t]) => pt(u, t).join(',')).join(' ');

/* ----------------------------------------------------------------- componente */

type Props = {
  slots: Slot[];
  formation: string;
  homeCrest?: string | null;
  awayCrest?: string | null;
  homeName?: string | null;
  awayName?: string | null;
  awayFormation?: string | null;
  foggiaHome?: boolean;
};

export function Lineup({
  slots, formation, homeCrest, awayCrest, homeName, awayName, awayFormation, foggiaHome = true,
}: Props) {
  const stripes = 9;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Side crest={homeCrest} name={homeName} formation={foggiaHome ? formation : awayFormation} active={foggiaHome} />
        <Text style={styles.colon}>:</Text>
        <Side crest={awayCrest} name={awayName} formation={foggiaHome ? awayFormation : formation} active={!foggiaHome} align="right" />
      </View>

      <View style={styles.stage}>
        <Svg width="100%" height="100%" viewBox={`0 0 ${VB.w} ${VB.h}`}>
          <Defs>
            <SvgGradient id="grass" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#1E7038" />
              <Stop offset="1" stopColor="#2FA457" />
            </SvgGradient>
          </Defs>

          <Rect x="0" y="0" width={VB.w} height={VB.h} fill="transparent" />
          <Polygon points={poly([[0, 0], [1, 0], [1, 1], [0, 1]])} fill="url(#grass)" />

          {/* fasce del taglio d'erba: si accorciano verso il fondo come sul prato vero */}
          {Array.from({ length: stripes }).map((_, i) => (
            i % 2 === 0 ? null : (
              <Polygon
                key={i}
                points={poly([
                  [0, i / stripes], [1, i / stripes],
                  [1, (i + 1) / stripes], [0, (i + 1) / stripes],
                ])}
                fill="#ffffff"
                fillOpacity={0.055}
              />
            )
          ))}

          {/* segnature */}
          <Polygon points={poly([[0, 0], [1, 0], [1, 1], [0, 1]])} fill="none" stroke="#fff" strokeOpacity={0.62} strokeWidth={0.7} />
          <Polyline points={poly([[0, 0.5], [1, 0.5]])} fill="none" stroke="#fff" strokeOpacity={0.62} strokeWidth={0.7} />
          <Ellipse
            cx={CX}
            cy={yAt(0.5)}
            rx={HALF * wAt(yAt(0.5)) * 0.3}
            ry={HALF * wAt(yAt(0.5)) * 0.3 * 0.44}
            fill="none" stroke="#fff" strokeOpacity={0.62} strokeWidth={0.7}
          />

          {/* aree: quella vicina più larga sullo schermo, ed e giusto così */}
          <Polygon points={poly([[0.2, 0], [0.8, 0], [0.8, 0.15], [0.2, 0.15]])} fill="none" stroke="#fff" strokeOpacity={0.62} strokeWidth={0.7} />
          <Polygon points={poly([[0.34, 0], [0.66, 0], [0.66, 0.055], [0.34, 0.055]])} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={0.6} />
          <Polygon points={poly([[0.2, 1], [0.8, 1], [0.8, 0.85], [0.2, 0.85]])} fill="none" stroke="#fff" strokeOpacity={0.62} strokeWidth={0.7} />
          <Polygon points={poly([[0.34, 1], [0.66, 1], [0.66, 0.945], [0.34, 0.945]])} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={0.6} />
        </Svg>

        {/* le maglie restano dritte: seguono la prospettiva in posizione e scala,
            ma inclinarle le renderebbe illeggibili */}
        {slots.map((s, i) => {
          const t = 1 - s.y / 100;
          const y = yAt(t);
          const x = xAt(s.x / 100, y);
          const scale = 0.62 + wAt(y) * 0.46;
          const keeper = i === 0;
          return (
            <View
              key={i}
              pointerEvents="none"
              style={[
                styles.slot,
                { left: `${(x / VB.w) * 100}%`, top: `${(y / VB.h) * 100}%`, transform: [{ scale }] },
              ]}
            >
              <Shirt number={s.player?.number ?? null} keeper={keeper} />
              <Text style={styles.name} numberOfLines={1}>{s.player?.shortName ?? '—'}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function Side({ crest, name, formation, active, align = 'left' }: {
  crest?: string | null; name?: string | null; formation?: string | null;
  active: boolean; align?: 'left' | 'right';
}) {
  return (
    <View style={[styles.side, align === 'right' && styles.sideRight]}>
      <View style={!active ? styles.dim : undefined}>
        <Crest uri={crest ?? null} name={name ?? '?'} size={44} />
      </View>
      {/* la formazione avversaria non e pubblicata da nessuna fonte aperta:
          meglio niente che un trattino che sembra un dato mancante */}
      {formation ? (
        <Text style={[styles.headFormation, active && styles.headFormationOn]}>
          {formation.split('-').join(' · ')}
        </Text>
      ) : null}
    </View>
  );
}

/** Maglietta invece di un pallino: e la stessa lettura della reference. */
function Shirt({ number, keeper }: { number: number | null; keeper: boolean }) {
  return (
    <View style={styles.shirtBox}>
      <Svg width="34" height="32" viewBox="0 0 34 32">
        <Path
          d="M7 4 L12.5 1 C14.5 3.6 19.5 3.6 21.5 1 L27 4 L31 10.5 L26 13.5 L26 28 C21 30 13 30 8 28 L8 13.5 L3 10.5 Z"
          fill={keeper ? '#1F1F23' : colors.accent}
          stroke="rgba(255,255,255,0.92)"
          strokeWidth="1.3"
          strokeLinejoin="round"
        />
      </Svg>
      <Text style={styles.shirtNumber}>{number ?? '–'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },

  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg },
  side: { flex: 1, alignItems: 'flex-start', gap: 6 },
  sideRight: { alignItems: 'flex-end' },
  headCrest: { width: 44, height: 44 },
  dim: { opacity: 0.35 },
  headFormation: { ...type.subheadBold, color: colors.textFaint, letterSpacing: 1 },
  headFormationOn: { color: colors.text },
  colon: { ...type.title2, color: colors.textFaint },

  stage: {
    width: '100%', aspectRatio: VB.w / VB.h,
    borderRadius: radius.lg, overflow: 'hidden', backgroundColor: '#15391F',
  },

  slot: { position: 'absolute', width: 72, marginLeft: -36, marginTop: -22, alignItems: 'center', gap: 1 },
  shirtBox: { width: 34, height: 32, alignItems: 'center', justifyContent: 'center' },
  shirtNumber: {
    position: 'absolute', top: 11,
    ...type.captionBold, fontSize: 12, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 2,
  },
  name: {
    ...type.caption, color: '#fff', fontSize: 10,
    textShadowColor: 'rgba(0,0,0,0.95)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 },
  },
});
