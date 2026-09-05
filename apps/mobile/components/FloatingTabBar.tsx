import { useEffect, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, radius, space, type } from '../theme/tokens';
import { useSafeInsets, useKeyboardOpen } from '../lib/viewport';

/**
 * Forma minima di cio che expo-router passa a una barra personalizzata.
 * Descritta qui invece di importarla da @react-navigation/bottom-tabs, che non
 * e una dipendenza diretta di questo pacchetto.
 */
type TabBarProps = {
  state: { index: number; routes: Array<{ key: string; name: string }> };
  descriptors: Record<string, { options: { title?: string } }>;
  navigation: {
    emit: (e: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: never) => void;
  };
};

/** Altezza occupata dalla barra: serve alle pagine per non finirci sotto. */
export const TAB_BAR_SPACE = 92;

const ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  index: ['home', 'home-outline'],
  matches: ['football', 'football-outline'],
  squad: ['shirt', 'shirt-outline'],
  stadium: ['location', 'location-outline'],
  curva: ['megaphone', 'megaphone-outline'],
  news: ['newspaper', 'newspaper-outline'],
};

/**
 * Barra delle schede galleggiante.
 *
 * Non e appoggiata al bordo inferiore: e una pastiglia staccata dai lati e dal
 * fondo, con la voce attiva dentro una pillola rossa che porta anche l'etichetta.
 * Le voci spente restano solo icona, cosi le sei voci ci stanno anche su uno
 * schermo da 360 punti.
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
      <View style={styles.bar}>
        {state.routes.map((route, i) => {
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
            paddingHorizontal: grow.interpolate({ inputRange: [0, 1], outputRange: [10, 14] }),
          },
        ]}
      >
        <Ionicons name={icon} size={21} color={focused ? colors.onAccent : colors.textFaint} />
        {focused ? <Text style={styles.label} numberOfLines={1}>{label}</Text> : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    alignItems: 'center', paddingHorizontal: space.md,
  },
  bar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#141416',
    borderRadius: radius.pill,
    paddingHorizontal: 6, paddingVertical: 6,
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
  tab: { flexShrink: 1 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    height: 40, borderRadius: radius.pill,
  },
  label: { ...type.captionBold, color: colors.onAccent, fontSize: 12.5 },
});
