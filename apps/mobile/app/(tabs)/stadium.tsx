import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { StadiumSector } from '@satanelli/core';

import { StadiumCanvas } from '../../features/stadium3d/StadiumCanvas';
import type { SeatMode } from '../../features/stadium3d/seating';
import { Badge, ListGroup, ListRow, GroupLabel, GroupNote, Button, Segmented, useGutter } from '../../components/ui';
import { Crest } from '../../components/Crest';
import { colors, radius, space, type } from '../../theme/tokens';
import { useLayout } from '../../theme/responsive';
import { euro, shortDate, thousands } from '../../lib/format';
import { nextHomeMatch, stadium } from '../../lib/data';

export default function StadiumScreen() {
  const insets = useSafeAreaInsets();
  const { gutter, height } = useLayout();
  const [selected, setSelected] = useState<StadiumSector | null>(null);
  // di default gli spalti sono pieni: uno stadio vuoto non racconta la partita
  const [mode, setMode] = useState<SeatMode>('occupancy');
  const match = nextHomeMatch();

  const pad = { paddingHorizontal: space.lg + gutter };
  const canvasHeight = Math.max(280, Math.min(height * 0.46, 460));

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { height: canvasHeight }]}>
        <StadiumCanvas
          stadium={stadium}
          selectedId={selected?.id ?? null}
          onSelect={(s) => setSelected((cur) => (cur?.id === s.id ? null : s))}
          mode={mode}
        />

        {/* tutto in alto: in basso il modello 3D finisce sotto al foglio dei settori */}
        <View
          style={[styles.overlay, { paddingTop: insets.top + space.sm, paddingHorizontal: space.lg + gutter }]}
          pointerEvents="box-none"
        >
          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Zaccheria</Text>
              <Text style={styles.sub}>{stadium.city} · {thousands(stadium.capacity)} posti</Text>
            </View>
            <View style={styles.controls}>
              <View style={styles.modeSwitch}>
                {([['realistic', 'Seggiolini'], ['occupancy', 'Tifosi']] as Array<[SeatMode, string]>).map(([k, l]) => (
                  <Pressable key={k} onPress={() => setMode(k)} style={[styles.modeBtn, mode === k && styles.modeBtnOn]}>
                    <Text style={[styles.modeText, mode === k && styles.modeTextOn]}>{l.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>

          <View style={styles.hint} pointerEvents="none">
            <Ionicons name="hand-left-outline" size={11} color="rgba(255,255,255,0.4)" />
            <Text style={styles.hintText}>trascina per ruotare · tocca un settore</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.sheet}
        contentContainerStyle={{ paddingBottom: insets.bottom + 100, paddingTop: space.lg }}
        showsVerticalScrollIndicator={false}
      >
        {match ? (
          <View style={[styles.matchStrip, pad]}>
            <Badge label="prossima in casa" tone="accent" />
            <Crest uri={match.away.crest} name={match.away.shortName} size={20} />
            <Text style={styles.matchText} numberOfLines={1}>
              {match.away.shortName} · {shortDate(match.kickoff)}
            </Text>
          </View>
        ) : null}

        {selected ? <View style={pad}><SectorCard sector={selected} /></View> : null}

        <Text style={[styles.listTitle, pad]}>SETTORI</Text>
        <View style={pad}>
          {stadium.sectors.map((s) => {
            const on = selected?.id === s.id;
            return (
              <Pressable
                key={s.id}
                onPress={() => setSelected((cur) => (cur?.id === s.id ? null : s))}
                style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && { opacity: 0.75 }]}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowName, on && styles.rowNameOn]}>{s.name}</Text>
                  <Text style={styles.rowMeta}>
                    {thousands(s.capacity)} posti · {s.covered ? 'coperto' : 'scoperto'}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={styles.rowPrice}>da {euro(s.priceFrom)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.note, pad]}>
          {stadium.priceNote} Le capienze per settore sono stime nostre. Il riempimento degli
          spalti nel modello è una resa grafica, non la disponibilità dei biglietti.
        </Text>
      </ScrollView>
    </View>
  );
}

function SectorCard({ sector }: { sector: StadiumSector }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{sector.name}</Text>
          <Text style={styles.cardSub}>
            {thousands(sector.capacity)} posti · {sector.covered ? 'coperto' : 'scoperto'}
          </Text>
        </View>
        <Text style={styles.cardPrice}>da {euro(sector.priceFrom)}</Text>
      </View>

      {/* niente percentuali di venduto: la disponibilità reale la conosce solo
          la biglietteria, e un numero inventato qui sarebbe fuorviante */}
      <Text style={styles.cardNote}>
        Disponibilità e prezzo aggiornati sul canale ufficiale.
      </Text>

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
        onPress={() => sector.ticketUrl && Linking.openURL(sector.ticketUrl)}
      >
        <Ionicons name="ticket-outline" size={16} color={colors.onAccent} />
        <Text style={styles.ctaText}>BIGLIETTI PER QUESTO SETTORE</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  canvas: { backgroundColor: '#070709' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  controls: { alignItems: 'flex-end', gap: 6 },
  title: { ...type.title1, color: colors.text },
  sub: { ...type.footnote, color: 'rgba(255,255,255,0.62)' },

  modeSwitch: {
    flexDirection: 'row', gap: 2, padding: 2, marginTop: 2,
    backgroundColor: 'rgba(44,44,46,0.82)', borderRadius: 9,
  },
  modeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 7 },
  modeBtnOn: { backgroundColor: colors.accent },
  modeText: { ...type.captionBold, color: 'rgba(255,255,255,0.6)' },
  modeTextOn: { color: colors.onAccent },

  hint: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: space.sm },
  hintText: { ...type.caption, color: 'rgba(255,255,255,0.42)' },

  sheet: {
    flex: 1, backgroundColor: colors.bg,
    borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    borderTopWidth: 1, borderColor: colors.border,
    marginTop: -radius.lg,
  },

  matchStrip: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  matchText: { ...type.subhead, color: colors.text, flex: 1 },

  card: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: space.lg, gap: space.md, marginBottom: space.lg,
  },
  cardHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  cardTitle: { ...type.title3, color: colors.text },
  cardSub: { ...type.footnote, color: colors.textDim },
  cardPrice: { ...type.title3, color: colors.accentBright },

  barWrap: { gap: 6 },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.surfaceHi, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  cardNote: { ...type.caption, color: colors.textFaint, marginTop: space.sm },
  barLabel: { ...type.caption, color: colors.textFaint },

  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm,
    backgroundColor: colors.accent, borderRadius: radius.md, paddingVertical: space.md,
  },
  ctaText: { ...type.headline, color: colors.onAccent },

  listTitle: { ...type.groupLabel, color: colors.textDim, marginBottom: space.sm },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    paddingVertical: space.md, paddingHorizontal: space.md,
    borderRadius: radius.md, marginBottom: space.sm,
    backgroundColor: colors.surface,
  },
  rowOn: { backgroundColor: colors.accentSoft },
  swatch: { width: 5, height: 34, borderRadius: 3 },
  rowText: { flex: 1 },
  rowName: { ...type.subhead, color: colors.text },
  rowNameOn: { ...type.subheadBold, color: colors.accentBright },
  rowMeta: { ...type.caption, color: colors.textFaint },
  rowRight: { alignItems: 'flex-end' },
  rowPrice: { ...type.headline, color: colors.text },
  rowOcc: { ...type.caption, color: colors.textFaint },

  note: { ...type.footnote, color: colors.textFaint, marginTop: space.lg },
});
