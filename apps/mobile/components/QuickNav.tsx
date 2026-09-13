import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, type } from '../theme/tokens';
import { curva, menoMovimento } from '../theme/motion';
import { Premi } from './anima';
import { useLayout } from '../theme/responsive';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; href: string; pulsa?: boolean };

const ITEMS: Item[] = [
  { icon: 'game-controller', label: 'Match Center', href: '/match-center' },
  { icon: 'ticket', label: 'Biglietti', href: '/tickets' },
  { icon: 'shirt', label: 'Rosa', href: '/squad' },
  { icon: 'car-sport', label: 'Trasferte', href: '/trasferte' },
  // la classifica del girone: quella dei tifosi sta nel Match Center e nel profilo
  { icon: 'podium', label: 'Classifica', href: '/standings' },
  { icon: 'stats-chart', label: 'Statistiche', href: '/stats' },
];

/**
 * Scorciatoie come pastiglie con icona a sinistra ed etichetta accanto, nella
 * forma dei filtri della reference. La prima e in rosso pieno perche i biglietti
 * sono la voce che porta soldi al club.
 *
 * Qui stanno le cose che si guardano ogni tanto: quelle di tutti i giorni sono
 * nella barra in fondo.
 */
/**
 * Le scorciatoie.
 *
 * `pagelle` prende il primo posto -- quello rosso pieno -- appena la partita
 * finisce, e pulsa. E l'unico momento in cui vale piu dei biglietti: i voti si
 * danno a caldo o non si danno piu, mentre un biglietto lo si compra anche
 * domani. Passata la finestra, torna tutto com'era.
 */
/*
 * UNA GRIGLIA, NON UNA FILA CHE SCORRE
 *
 * Erano pastiglie in una fila orizzontale, e sul telefono se ne vedevano tre:
 * le altre stavano fuori dal bordo, e niente diceva che la fila si potesse
 * trascinare di lato. La Rosa, spostata qui dalla barra, era diventata di fatto
 * introvabile. In due colonne si vedono tutte, grandi, senza gesti da scoprire.
 */
export function QuickNav({ pagelle }: { pagelle?: string | null } = {}) {
  const { gutter } = useLayout();
  const voci: Item[] = pagelle
    ? [{ icon: 'star', label: 'Pagelle', href: pagelle, pulsa: true },
       ...ITEMS.filter((x) => x.label !== 'Match Center')]
    : ITEMS;
  return (
    <View style={[styles.griglia, { paddingHorizontal: space.lg + gutter }]}>
      {voci.map((it, i) => (
        <Pastiglia key={it.label} item={it} prima={i === 0} />
      ))}
    </View>
  );
}

/**
 * Una pastiglia. Se `pulsa`, respira piano invece di lampeggiare.
 *
 * Un lampeggio secco su un elemento grande come questo e fastidioso dopo
 * cinque secondi; un respiro lento si nota lo stesso e non stanca.
 */
function Pastiglia({ item, prima }: { item: Item; prima: boolean }) {
  const v = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!item.pulsa || menoMovimento()) return;
    const ciclo = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 0.45, duration: 800, easing: curva.morbida, useNativeDriver: true }),
      Animated.timing(v, { toValue: 1, duration: 800, easing: curva.morbida, useNativeDriver: true }),
    ]));
    ciclo.start();
    return () => ciclo.stop();
  }, [item.pulsa, v]);

  return (
    <Animated.View style={[styles.cella, item.pulsa ? { opacity: v } : null]}>
      <Premi
        onPress={() => router.push(item.href as never)}
        etichetta={item.label}
        style={[styles.chip, prima && styles.chipLead]}
      >
        <Ionicons name={item.icon} size={20} color={prima ? colors.onAccent : colors.accentBright} />
        <Text style={[styles.label, prima && styles.labelLead]} numberOfLines={2}>{item.label}</Text>
      </Premi>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  griglia: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: space.sm },
  // due colonne: meta larghezza meno meta dello spazio fra le due
  cella: { flexBasis: '47%', flexGrow: 1 },
  // basse e con l'icona accanto: alte il giusto per il dito (52 punti), non di piu
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 52,
    paddingHorizontal: 14, paddingVertical: space.sm, borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)',
  },
  chipLead: { backgroundColor: colors.accent, borderColor: 'transparent' },
  // 16 punti: "Match Center" ci sta su una riga accanto all'icona anche a 360
  label: { ...type.subheadBold, fontSize: 16, lineHeight: 21, color: colors.text, flexShrink: 1 },
  labelLead: { color: colors.onAccent },
});
