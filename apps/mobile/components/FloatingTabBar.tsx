import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';
import { useSafeInsets, useKeyboardOpen } from '../lib/viewport';
import { PallinoLive } from './PallinoLive';
import { salaAperta } from '../lib/sala';
import { prossima } from '../lib/data';

/**
 * Forma minima di cio che expo-router passa a una barra personalizzata.
 * Descritta qui invece di importarla da @react-navigation/bottom-tabs, che non
 * e una dipendenza diretta di questo pacchetto.
 */
type TabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  descriptors: Record<string, { options: { title?: string; href?: string | null } }>;
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: never) => void;
  };
};

/** Altezza occupata dalla barra: serve alle pagine per non finirci sotto. */
export const TAB_BAR_SPACE = 92;

/** Le voci della barra, in ordine. Fuori da qui non compare niente. */
const VISIBILI = ['index', 'matches', 'trasferte', 'curva', 'stadium', 'news'];

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  matches: ['football', 'football-outline'],
  trasferte: ['car-sport', 'car-sport-outline'],
  squad: ['shirt', 'shirt-outline'],
  stadium: ['location', 'location-outline'],
  curva: ['megaphone', 'megaphone-outline'],
  news: ['newspaper', 'newspaper-outline'],
};

/**
 * Barra delle schede galleggiante.
 *
 * PERCHE ORA LE ETICHETTE CI SONO SEMPRE
 *
 * Prima il nome compariva solo sulla voce attiva e le altre restavano icone
 * mute. Sembra pulito e invece e la cosa piu difficile da capire che si possa
 * mettere in un'app: chi apre per la prima volta deve indovinare cosa sono un
 * megafono e una macchinina. Adesso ogni voce ha il suo nome sotto, piccolo, e
 * la pillola rossa dice solo dove sei.
 *
 * Sei voci a circa cinquantacinque punti l'una ci stanno anche su uno schermo
 * da 360. La settima no: e per questo che la Rosa e finita nelle scorciatoie.
 */
export function FloatingTabBar({ state, descriptors, navigation }: TabBarProps) {
  const insets = useSafeInsets();
  // con la tastiera aperta la barra finirebbe sotto i tasti, e comunque nessuno
  // cambia scheda mentre sta scrivendo
  const typing = useKeyboardOpen();

  if (typing) return null;

  return (
    <View
      style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]}
      pointerEvents="box-none"
    >
      {/*
        * La chat compare solo mentre si gioca, e sparisce da sola.
        *
        * Una voce fissa "chat" che porta a una stanza vuota per sei giorni su
        * sette insegna a non premerla piu. Cosi invece, quando compare, vuol
        * dire che sta succedendo qualcosa.
        */}
      {salaAperta(prossima?.kickoff) ? (
        <Pressable
          onPress={() => router.push('/live' as never)}
          style={({ pressed }) => [styles.live, pressed && { opacity: 0.85 }]}
        >
          <PallinoLive />
        </Pressable>
      ) : null}
      <View style={styles.bar}>
        {/*
          * L'elenco delle voci sta qui, esplicito.
          *
          * `href: null` nasconde una scheda dalla barra standard di
          * expo-router, ma non arriva fino a una barra scritta a mano come
          * questa: la Rosa restava dentro con scritto "squad", cioe il nome
          * della cartella. Un elenco si legge e non mente.
          */}
        {state.routes.filter((r) => VISIBILI.includes(r.name)).map((route) => {
          const i = state.routes.indexOf(route);
          const focused = state.index === i;
          const { options } = descriptors[route.key];
          const label = typeof options.title === 'string' ? options.title : route.name;
          const [on, off] = ICONS[route.name] ?? ['ellipse', 'ellipse-outline'];

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name as never);
          };

          return (
            <Tab
              key={route.key}
              focused={focused}
              label={label}
              icon={focused ? on : off}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function Tab({ focused, label, icon, onPress }: {
  focused: boolean; label: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void;
}) {
  const grow = useRef(new Animated.Value(focused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(grow, {
      toValue: focused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      // la pillola cambia larghezza: e una proprieta di layout, non va sul driver nativo
      useNativeDriver: false,
    }).start();
  }, [focused, grow]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={({ pressed }) => [styles.tab, pressed && !focused && { opacity: 0.6 }]}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            backgroundColor: focused ? colors.accent : 'transparent',
            transform: [{ scale: grow.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
          },
        ]}
      >
        <Ionicons name={icon} size={20} color={focused ? colors.onAccent : colors.textDim} />
      </Animated.View>
      <Text
        style={[styles.label, focused && styles.labelOn]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', paddingHorizontal: space.md, gap: space.sm,
  },
  live: {
    backgroundColor: '#141416', borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(50,215,75,0.4)',
    paddingHorizontal: 4, paddingVertical: 4,
  },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#141416',
    borderRadius: radius.pill,
    paddingHorizontal: 4, paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.10)',
    maxWidth: 460, width: '100%',
    ...Platform.select({
      web: { boxShadow: '0 14px 34px rgba(0,0,0,0.55)' } as object,
      default: {
        shadowColor: '#000', shadowOpacity: 0.55, shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 }, elevation: 18,
      },
    }),
  },
  // ogni voce prende la stessa fetta: cosi la barra resta simmetrica e le
  // etichette lunghe non schiacciano quelle corte
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 },
  pill: {
    alignItems: 'center', justifyContent: 'center',
    width: 44, height: 32, borderRadius: radius.pill,
  },
  label: { ...type.caption, color: colors.textDim, fontSize: 9.5, letterSpacing: 0.1 },
  labelOn: { color: colors.text, fontWeight: '700' },
});
