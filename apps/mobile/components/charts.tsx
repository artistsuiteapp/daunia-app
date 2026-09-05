import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Line as SvgLine, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';

import { colors, radius, space, type } from '../theme/tokens';

/* ------------------------------------------------------- barra di confronto */

/**
 * Riga di confronto fra due valori: etichetta al centro, barre che crescono
 * verso l'esterno. E il modo piu compatto per leggere casa contro trasferta
 * o Foggia contro avversario senza doverci mettere una legenda.
 */
export function CompareBar({ label, left, right, leftColor = colors.accent, rightColor = colors.textDim, unit = '' }: {
  label: string; left: number; right: number; leftColor?: string; rightColor?: string; unit?: string;
}) {
  const total = Math.max(1, left + right);
  const lp = (left / total) * 100;
  const rp = (right / total) * 100;

  return (
    <View style={styles.cmpWrap}>
      <View style={styles.cmpHead}>
        <Text style={styles.cmpValue}>{left}{unit}</Text>
        <Text style={styles.cmpLabel}>{label.toUpperCase()}</Text>
        <Text style={styles.cmpValue}>{right}{unit}</Text>
      </View>
      <View style={styles.cmpTrack}>
        <View style={styles.cmpHalfLeft}>
          <View style={[styles.cmpFill, { width: `${lp}%`, backgroundColor: leftColor }]} />
        </View>
        <View style={styles.cmpHalfRight}>
          <View style={[styles.cmpFill, { width: `${rp}%`, backgroundColor: rightColor }]} />
        </View>
      </View>
    </View>
  );
}

/* --------------------------------------------------------------- anello % */

/** Anello di percentuale con il valore al centro. */
export function Ring({ value, size = 116, stroke = 10, label, caption, color = colors.accent }: {
  value: number; size?: number; stroke?: number; label?: string; caption?: string; color?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceHi} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${c * clamped} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={[styles.ringValue, { fontSize: size * 0.26 }]}>{label ?? `${Math.round(clamped * 100)}%`}</Text>
      {caption ? <Text style={styles.ringCaption}>{caption.toUpperCase()}</Text> : null}
    </View>
  );
}

/* ------------------------------------------------------------- andamento */

/**
 * Andamento della posizione in classifica.
 * L'asse verticale e rovesciato: il primo posto sta in alto, come ci si aspetta
 * leggendo una classifica, non come lo disegnerebbe un grafico di numeri crescenti.
 */
export function PositionChart({ points, teams = 20, height = 120 }: {
  points: Array<{ matchday: number; position: number | null }>;
  teams?: number;
  height?: number;
}) {
  const data = points.filter((p) => p.position != null) as Array<{ matchday: number; position: number }>;
  if (data.length < 2) {
    return (
      <View style={[styles.chartEmpty, { height }]}>
        <Text style={styles.chartEmptyText}>
          {data.length === 1
            ? `Una sola giornata giocata: il Foggia e ${data[0]!.position}°.`
            : 'Ancora nessuna giornata in archivio.'}
        </Text>
      </View>
    );
  }

  const w = 320;
  const pad = 8;
  const stepX = (w - pad * 2) / Math.max(1, data.length - 1);
  const y = (pos: number) => pad + ((pos - 1) / (teams - 1)) * (height - pad * 2);
  const path = data
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${pad + i * stepX} ${y(p.position)}`)
    .join(' ');
  const area = `${path} L ${pad + (data.length - 1) * stepX} ${height - pad} L ${pad} ${height - pad} Z`;

  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        <Defs>
          <SvgGradient id="posFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.accent} stopOpacity="0.35" />
            <Stop offset="1" stopColor={colors.accent} stopOpacity="0" />
          </SvgGradient>
        </Defs>
        {[1, 10, 20].map((p) => (
          <SvgLine key={p} x1={pad} y1={y(p)} x2={w - pad} y2={y(p)} stroke={colors.border} strokeWidth="1" />
        ))}
        <Path d={area} fill="url(#posFill)" />
        <Path d={path} stroke={colors.accentBright} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        {data.map((p, i) => (
          <Circle key={p.matchday} cx={pad + i * stepX} cy={y(p.position)} r="3.5" fill={colors.accentBright} />
        ))}
      </Svg>
      <View style={styles.chartAxis}>
        <Text style={styles.chartAxisText}>g{data[0]!.matchday}</Text>
        <Text style={styles.chartAxisText}>g{data[data.length - 1]!.matchday}</Text>
      </View>
    </View>
  );
}

/* ------------------------------------------------------- fasce di minuti */

/** Istogramma verticale dei gol per fascia di minuti, segnati sopra e subiti sotto. */
export function GoalWindows({ windows }: {
  windows: Array<{ label: string; scored: number; conceded: number }>;
}) {
  const max = Math.max(1, ...windows.map((w) => Math.max(w.scored, w.conceded)));
  return (
    <View style={styles.winWrap}>
      {windows.map((w) => (
        <View key={w.label} style={styles.winCol}>
          <View style={styles.winTop}>
            <View style={[styles.winBar, { height: `${(w.scored / max) * 100}%`, backgroundColor: colors.accent }]} />
          </View>
          <Text style={styles.winLabel}>{w.label}</Text>
          <View style={styles.winBottom}>
            <View style={[styles.winBar, { height: `${(w.conceded / max) * 100}%`, backgroundColor: colors.textFaint }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cmpWrap: { gap: 6, marginBottom: space.md },
  cmpHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cmpValue: { ...type.headline, color: colors.text, width: 52 },
  cmpLabel: { ...type.caption, color: colors.textDim, flex: 1, textAlign: 'center' },
  cmpTrack: { flexDirection: 'row', gap: 3 },
  cmpHalfLeft: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  cmpHalfRight: { flex: 1, flexDirection: 'row' },
  cmpFill: { height: 6, borderRadius: 3, minWidth: 3 },

  ringValue: { fontFamily: type.number.fontFamily, color: colors.text },
  ringCaption: { ...type.caption, color: colors.textFaint, marginTop: 2 },

  chartEmpty: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg },
  chartEmptyText: { ...type.footnote, color: colors.textFaint, textAlign: 'center' },
  chartAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  chartAxisText: { ...type.caption, color: colors.textFaint },

  winWrap: { flexDirection: 'row', gap: space.sm, height: 132 },
  winCol: { flex: 1, alignItems: 'center' },
  winTop: { flex: 1, width: '100%', justifyContent: 'flex-end' },
  winBottom: { flex: 1, width: '100%' },
  winBar: { width: '100%', borderRadius: radius.sm, minHeight: 2 },
  winLabel: { ...type.caption, color: colors.textFaint, fontSize: 10, marginVertical: 4 },
});
