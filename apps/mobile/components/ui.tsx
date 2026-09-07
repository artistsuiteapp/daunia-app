import { Fragment, ReactNode, RefObject, useMemo } from 'react';
import {
  PanResponder, Platform, Pressable, ScrollView, StyleSheet, Text, View, ViewStyle,
} from 'react-native';
import { indietro } from './BackBar';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, ROW_HEIGHT, space, type } from '../theme/tokens';
import { useLayout } from '../theme/responsive';
import { TAB_BAR_SPACE } from './FloatingTabBar';
import { BrandMark } from './BrandMark';
import { useSafeInsets, useKeyboardInset } from '../lib/viewport';

/* -------------------------------------------------------------- contenitore */

export function Screen({
  children, scroll = true, edgeToEdge = false, centrato = false,
  senzaBarra = false, testaFissa = false, riferimento,
}: {
  children: ReactNode;
  scroll?: boolean;
  edgeToEdge?: boolean;
  /** contenuto al centro quando ci sta, che scorre quando non ci sta */
  centrato?: boolean;
  /** schermate fuori dalle schede: senza barra sotto, senza il suo spazio */
  senzaBarra?: boolean;
  /** tiene fermo il primo blocco: si usa dove c'e la barra di ritorno */
  testaFissa?: boolean;
  /**
   * Per chi deve scorrere da fuori -- il tasto "vai all'ultima risposta" in
   * una discussione lunga. Senza, l'unico modo e trascinare a mano.
   */
  riferimento?: RefObject<ScrollView | null>;
}) {
  const insets = useSafeInsets();
  const keyboard = useKeyboardInset();
  // Sotto: la barra delle schede galleggia sopra il contenuto, e con la tastiera
  // aperta serve altro spazio, altrimenti l'ultimo blocco finisce sotto i tasti.
  // Con la tastiera aperta la barra si nasconde, quindi il suo spazio si libera.
  /*
   * Strisciata dal bordo sinistro per tornare indietro.
   *
   * Sul telefono e il gesto che tutti fanno senza pensarci; nella versione web
   * non esiste e la gente resta bloccata a cercare la freccia. Parte solo dai
   * primi trenta punti del bordo, altrimenti ruberebbe il gesto a tutto quello
   * che si scorre in orizzontale, come le pastiglie delle scorciatoie.
   */
  const gesti = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (e, g) => (
      e.nativeEvent.pageX < 30 && g.dx > 12 && Math.abs(g.dy) < 24
    ),
    onPanResponderRelease: (_e, g) => {
      if (g.dx > 60 && Math.abs(g.dy) < 80) indietro();
    },
  }), []);

  const sotto = senzaBarra ? space.xl : TAB_BAR_SPACE;
  const pad = {
    paddingTop: edgeToEdge ? 0 : insets.top,
    paddingBottom: keyboard > 0
      ? keyboard + space.xl
      : sotto + insets.bottom,
  };
  if (!scroll) return <View style={[styles.screen, pad]} {...gesti.panHandlers}>{children}</View>;
  return (
    <ScrollView
      ref={riferimento}
      {...gesti.panHandlers}
      stickyHeaderIndices={testaFissa ? [0] : undefined}
      style={styles.screen}
      contentContainerStyle={[pad, centrato && { flexGrow: 1 }]}
      showsVerticalScrollIndicator={false}
      contentInsetAdjustmentBehavior="never"
    >
      {/*
        * Centrare con `justifyContent` sembra la strada ovvia e invece taglia:
        * quando il contenuto e piu alto del contenitore, flexbox lo fa
        * traboccare da entrambi i lati e la parte sopra diventa irraggiungibile
        * anche scorrendo. Su un iPhone in Safari lo stemma finiva mezzo fuori.
        *
        * I margini automatici fanno la cosa giusta in tutti e due i casi: se
        * c'e spazio centrano, se non ce n'e valgono zero e la pagina scorre.
        */}
      {centrato ? <View style={{ marginTop: 'auto', marginBottom: 'auto' }}>{children}</View> : children}
    </ScrollView>
  );
}

/** Margine di pagina: 16 punti, allargati per centrare il contenuto su schermi larghi. */
export function useGutter() {
  const { gutter } = useLayout();
  return { paddingHorizontal: space.lg + gutter };
}

/* ------------------------------------------------------------------- titoli */

/**
 * Titolo grande in stile iOS: allineato a sinistra, sottotitolo sotto,
 * eventuale azione a destra. Sostituisce le intestazioni centrate di prima.
 */
export function LargeTitle({ title, subtitle, action, crest }: {
  title: string; subtitle?: string; action?: ReactNode; crest?: string | null;
}) {
  const gutter = useGutter();
  return (
    <View style={[styles.largeTitleWrap, gutter]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.largeTitle}>{title}</Text>
        {subtitle ? <Text style={styles.largeSub}>{subtitle}</Text> : null}
      </View>
      {action}
      {/* il marchio del progetto resta in cima a ogni schermata */}
      {crest !== null ? <BrandMark size={40} /> : null}
    </View>
  );
}

/** Etichetta di gruppo sopra una lista: minuscola, maiuscoletto, poco contrasto. */
export function GroupLabel({ children, action }: { children: string; action?: ReactNode }) {
  const gutter = useGutter();
  return (
    <View style={[styles.groupLabelRow, gutter]}>
      <Text style={styles.groupLabel}>{children.toUpperCase()}</Text>
      {action}
    </View>
  );
}

/* --------------------------------------------------------------------- liste */

/**
 * Gruppo di lista raggruppata, la struttura piu riconoscibile di iOS:
 * un unico blocco arrotondato, righe separate da una linea sottile rientrata,
 * niente cornice per ogni riga.
 */
export function ListGroup({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={[styles.group, style]}>
      {items.map((child, i) => (
        <Fragment key={i}>
          {i > 0 ? <View style={styles.separator} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

/** Riga di lista: contenuto a sinistra, valore e freccia a destra. */
export function ListRow({ children, onPress, chevron = false, right, height }: {
  children: ReactNode; onPress?: () => void; chevron?: boolean; right?: ReactNode; height?: number;
}) {
  const body = (
    <View style={[styles.row, height ? { minHeight: height } : null]}>
      <View style={styles.rowMain}>{children}</View>
      {right}
      {chevron ? <Ionicons name="chevron-forward" size={17} color={colors.textFaint} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}>
      {body}
    </Pressable>
  );
}

/** Testo di nota sotto un gruppo, come le spiegazioni delle Impostazioni. */
export function GroupNote({ children }: { children: ReactNode }) {
  const gutter = useGutter();
  return <Text style={[styles.groupNote, gutter]}>{children}</Text>;
}

/* ------------------------------------------------------------------ controlli */

/** Controllo segmentato, con la pastiglia che scorre sotto la voce attiva. */
export function Segmented<T extends string>({ items, value, onChange }: {
  items: Array<{ key: T; label: string }>; value: T; onChange: (k: T) => void;
}) {
  return (
    <View style={styles.segmented}>
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={[styles.segment, on && styles.segmentOn]}>
            <Text style={[styles.segmentText, on && styles.segmentTextOn]} numberOfLines={1}>{it.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Pillole filtro a scorrimento, per quando le voci sono troppe per un segmentato. */
export function FilterChips<T extends string>({ items, value, onChange }: {
  items: Array<{ key: T; label: string; badge?: number }>;
  value: T;
  onChange: (key: T) => void;
}) {
  const { gutter } = useLayout();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.chipRow, { paddingHorizontal: space.lg + gutter }]}
    >
      {items.map((it) => {
        const on = it.key === value;
        return (
          <Pressable key={it.key} onPress={() => onChange(it.key)} style={[styles.chip, on && styles.chipOn]}>
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{it.label}</Text>
            {it.badge != null ? <Text style={[styles.chipBadge, on && styles.chipBadgeOn]}>{it.badge}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Bottone pieno a tutta larghezza. */
export function Button({ label, onPress, icon, tone = 'accent' }: {
  label: string; onPress: () => void; icon?: keyof typeof Ionicons.glyphMap; tone?: 'accent' | 'plain';
}) {
  const accent = tone === 'accent';
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.button, accent ? styles.buttonAccent : styles.buttonPlain, pressed && { opacity: 0.75 }]}
    >
      {icon ? <Ionicons name={icon} size={17} color={accent ? colors.onAccent : colors.accentBright} /> : null}
      <Text style={[styles.buttonText, !accent && { color: colors.accentBright }]}>{label}</Text>
    </Pressable>
  );
}

/* ----------------------------------------------------------------- elementi */

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'accent' | 'live' | 'ok' }) {
  const bg = { neutral: colors.surfaceHi, accent: colors.accentSoft, live: colors.live, ok: colors.win }[tone];
  const fg = { neutral: colors.textDim, accent: colors.accentBright, live: '#fff', ok: '#04150A' }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.badgeText, { color: fg }]}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** Etichetta piccola sopra, numero grande sotto. */
export function BigStat({ label, value, sub, align = 'left' }: {
  label: string; value: string | number; sub?: string; align?: 'left' | 'center';
}) {
  return (
    <View style={{ alignItems: align === 'center' ? 'center' : 'flex-start', gap: 2 }}>
      <Text style={styles.bigLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.bigValue}>{value}</Text>
      {sub ? <Text style={styles.bigSub}>{sub}</Text> : null}
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>
  );
}

export function Divider() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },

  largeTitleWrap: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md, paddingTop: space.lg, paddingBottom: space.sm },
  largeTitle: { ...type.largeTitle, color: colors.text },
  largeSub: { ...type.subhead, color: colors.textDim, marginTop: 2 },
  titleCrest: { width: 44, height: 44 },

  groupLabelRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: space.xl, marginBottom: space.sm,
  },
  groupLabel: { ...type.groupLabel, color: colors.textDim },
  groupNote: { ...type.footnote, color: colors.textFaint, marginTop: space.sm, lineHeight: 17 },

  group: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: space.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    minHeight: ROW_HEIGHT, paddingHorizontal: space.lg, paddingVertical: 11,
  },
  rowPressed: { backgroundColor: colors.surfaceHi },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md },

  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceHi, borderRadius: 9, padding: 2 },
  segment: { flex: 1, paddingVertical: 7, borderRadius: 7, alignItems: 'center' },
  segmentOn: { backgroundColor: colors.accent },
  segmentText: { ...type.footnoteBold, color: colors.textDim },
  segmentTextOn: { color: colors.onAccent },

  chipRow: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: space.lg, paddingVertical: 8, borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.accent },
  chipText: { ...type.subheadBold, color: colors.textDim },
  chipTextOn: { color: colors.onAccent },
  chipBadge: { ...type.caption, color: colors.textFaint },
  chipBadgeOn: { color: 'rgba(255,255,255,0.7)' },

  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    borderRadius: radius.lg, paddingVertical: 15,
  },
  buttonAccent: { backgroundColor: colors.accent },
  buttonPlain: { backgroundColor: colors.surface },
  buttonText: { ...type.headline, color: colors.onAccent },

  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },

  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm, alignSelf: 'flex-start' },
  badgeText: { ...type.captionBold, fontSize: 11, letterSpacing: 0.3 },

  bigLabel: { ...type.caption, color: colors.textDim },
  bigValue: { ...type.number, color: colors.text },
  bigSub: { ...type.footnote, color: colors.textFaint },

  empty: { padding: space.xl, alignItems: 'center' },
  emptyText: { ...type.subhead, color: colors.textFaint, textAlign: 'center' },
});
