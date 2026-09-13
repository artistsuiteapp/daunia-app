import { useState } from 'react';
import { apriFuori } from '../../lib/apri';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { StadiumSector } from '@satanelli/core';

import { StadiumCanvas } from '../../features/stadium3d/StadiumCanvas';
import type { SeatMode } from '../../features/stadium3d/seating';
import { Badge, ListGroup, ListRow, GroupLabel, GroupNote, Button, Segmented, useGutter } from '../../components/ui';
import { Crest } from '../../components/Crest';
import { colors, radius, space, type } from '../../theme/tokens';
import { useLayout } from '../../theme/responsive';
import { useOspite } from '../../lib/ospite';
import { SoloConAccount } from '../../components/SoloConAccount';
import { euro, shortDate, thousands } from '../../lib/format';
import { nextHomeMatch, stadium } from '../../lib/data';
import { useSafeInsets } from '../../lib/viewport';
import {
  clearPresence, declarePresence, myPresence, presenceOf, presenzeVere, useDatiPartita, useFanplay,
} from '../../lib/fanplay';

/**
 * Cosa si scrive a destra del settore.
 *
 * Non il prezzo. I prezzi in `stadium.json` sono stime scritte a mano -- il
 * flag `priceIsIndicative` lo dice da sempre -- ma in app uscivano come
 * "28 €–50 €", cioe come un listino. Chi decide se andare allo stadio lo fa
 * anche sul prezzo, e un prezzo sbagliato e peggio di nessun prezzo.
 *
 * Resta se il settore e coperto, che e vero e serve quando piove.
 */
function dettaglioDi(s: StadiumSector): string {
  if (s.soldOut) return 'esaurito';
  return s.covered ? 'coperto' : 'scoperto';
}

export default function StadiumScreen() {
  const insets = useSafeInsets();
  const { gutter, height } = useLayout();
  const [selected, setSelected] = useState<StadiumSector | null>(null);
  // di default gli spalti sono pieni: uno stadio vuoto non racconta la partita
  const [mode, setMode] = useState<SeatMode>('occupancy');
  const match = nextHomeMatch();
  useFanplay();
  const ospite = useOspite();
  useDatiPartita(match?.id ?? null);

  // il modello si riempie in proporzione a chi ha dichiarato di esserci:
  // e l'unico numero vero che questa app puo avere sullo stadio
  const declared = match
    ? Object.fromEntries(stadium.sectors.map((s) => {
        const { total } = presenceOf(match.id, s.id, s.capacity);
        return [s.id, Math.min(1, total / s.capacity)];
      }))
    : undefined;
  const totalDeclared = match
    ? stadium.sectors.reduce((a, s) => a + presenceOf(match.id, s.id, s.capacity).total, 0)
    : 0;
  const mySector = match ? myPresence(match.id) : null;

  const pad = { paddingHorizontal: space.lg + gutter };
  // piu alto di prima: al modello serve spazio sia in cima, dove galleggiano
  // titolo e comandi, sia in fondo, dove comincia il foglio dei settori
  const canvasHeight = Math.max(300, Math.min(height * 0.52, 500));

  return (
    <View style={styles.root}>
      <View style={[styles.canvas, { height: canvasHeight }]}>
        <StadiumCanvas
          stadium={stadium}
          selectedId={selected?.id ?? null}
          onSelect={(s) => setSelected((cur) => (cur?.id === s.id ? null : s))}
          mode={mode}
          fill={declared}
        />

        {/*
          * Velo scuro dietro al titolo.
          *
          * Il modello sale fin dentro l'area del titolo, e bianco su tetto
          * chiaro non si legge piu. Spostare il modello piu in basso avrebbe
          * significato rimpicciolirlo; un velo che sfuma lo lascia intero e
          * rende il testo leggibile in ogni rotazione.
          */}
        <LinearGradient
          colors={['rgba(0,0,0,0.78)', 'rgba(0,0,0,0.35)', 'transparent']}
          locations={[0, 0.55, 1]}
          style={[styles.velo, { height: insets.top + 96 }]}
          pointerEvents="none"
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

        {match ? (
          <View style={[styles.presence, pad]}>
            <View style={styles.presenceHead}>
              <Ionicons name="people" size={17} color={colors.accentBright} />
              <Text style={styles.presenceTitle}>
                {thousands(totalDeclared)} hanno detto che ci sono
              </Text>
            </View>
            <Text style={styles.presenceNote}>
              {mySector
                ? `Ci sei anche tu, in ${stadium.sectors.find((s) => s.id === mySector)?.name}.`
                : 'Scegli il tuo settore qui sotto: gli spalti nel modello si riempiono di conseguenza.'}
            </Text>
            {mySector ? (
              <Pressable onPress={() => clearPresence(match.id)} hitSlop={8}>
                <Text style={styles.presenceUndo}>Non ci vado più</Text>
              </Pressable>
            ) : null}
            {ospite ? (
              <View style={{ marginTop: space.sm }}>
                <SoloConAccount cosa="Per dire che ci sei anche tu serve un account." compatto />
              </View>
            ) : null}
          </View>
        ) : null}

        {selected ? (
          <View style={pad}>
            <SectorCard
              sector={selected}
              matchId={ospite ? null : match?.id ?? null}
              onDeclare={() => match && declarePresence(match.id, selected.id)}
              mine={mySector === selected.id}
            />
          </View>
        ) : null}

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
                  <Text style={[styles.rowPrice, s.soldOut && styles.rowPriceOut]}>{dettaglioDi(s)}</Text>
                  {match ? (
                    <Text style={[styles.rowGoing, mySector === s.id && styles.rowGoingMine]}>
                      {thousands(presenceOf(match.id, s.id, s.capacity).total)} vanno
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.note, pad]}>
          Le capienze per settore sono stime nostre. Il riempimento degli spalti nel modello
          segue solo le presenze dichiarate qui dentro, non i biglietti venduti: quelli li
          conosce la biglietteria, e non li abbiamo.
        </Text>
      </ScrollView>
    </View>
  );
}

function SectorCard({ sector, matchId, onDeclare, mine }: {
  sector: StadiumSector; matchId: string | null; onDeclare: () => void; mine: boolean;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{sector.name}</Text>
          <Text style={styles.cardSub}>
            {thousands(sector.capacity)} posti · {sector.covered ? 'coperto' : 'scoperto'}
          </Text>
        </View>
        <Text style={[styles.cardPrice, sector.soldOut && styles.rowPriceOut]}>{dettaglioDi(sector)}</Text>
      </View>

      {sector.note ? <Text style={styles.cardNota}>{sector.note}</Text> : null}

      {/* niente percentuali di venduto: la disponibilità reale la conosce solo
          la biglietteria, e un numero inventato qui sarebbe fuorviante */}
      <Text style={styles.cardNote}>
        Disponibilità e prezzo aggiornati sul canale ufficiale.
      </Text>

      {matchId && !sector.soldOut ? (
        <Pressable
          onPress={onDeclare}
          disabled={mine}
          style={({ pressed }) => [styles.going, mine && styles.goingOn, pressed && { opacity: 0.85 }]}
        >
          <Ionicons
            name={mine ? 'checkmark-circle' : 'hand-right-outline'}
            size={16}
            color={mine ? colors.win : colors.text}
          />
          <Text style={[styles.goingText, mine && styles.goingTextOn]}>
            {mine ? 'CI SEI, IN QUESTO SETTORE' : "CI SONO ANCH'IO, QUI"}
          </Text>
        </Pressable>
      ) : null}

      {sector.soldOut ? (
        <View style={[styles.cta, styles.ctaSpenta]}>
          <Ionicons name="close-circle-outline" size={16} color={colors.textDim} />
          <Text style={[styles.ctaText, { color: colors.textDim }]}>BIGLIETTI ESAURITI</Text>
        </View>
      ) : (
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          onPress={() => sector.ticketUrl && apriFuori(sector.ticketUrl)}
        >
          <Ionicons name="ticket-outline" size={16} color={colors.onAccent} />
          <Text style={styles.ctaText}>BIGLIETTI PER QUESTO SETTORE</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },

  presence: { gap: 6, marginBottom: space.lg },
  presenceHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  presenceTitle: { ...type.headline, color: colors.text, flex: 1 },
  sampleTag: { backgroundColor: colors.surfaceHi, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2 },
  sampleText: { ...type.captionBold, fontSize: 9, color: colors.textDim },
  presenceNote: { ...type.caption, color: colors.textDim, lineHeight: 17 },
  presenceUndo: { ...type.captionBold, color: colors.accentBright, marginTop: 2 },

  rowGoing: { ...type.caption, color: colors.textFaint },
  rowGoingMine: { color: colors.win },

  going: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: colors.surfaceHi, borderRadius: radius.lg, paddingVertical: 12,
    marginTop: space.md,
  },
  goingOn: { backgroundColor: 'rgba(48,209,88,0.14)' },
  goingText: { ...type.footnoteBold, color: colors.text, letterSpacing: 0.4 },
  goingTextOn: { color: colors.win },
  canvas: { backgroundColor: '#070709' },
  overlay: { position: 'absolute', left: 0, right: 0, top: 0 },
  velo: { position: 'absolute', left: 0, right: 0, top: 0 },
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
  rowPriceOut: { color: colors.textFaint },
  ctaSpenta: { backgroundColor: colors.surfaceHi },
  cardNota: { ...type.caption, color: colors.textDim, lineHeight: 17 },
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
