import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAmbiencePlayer } from './ambience-player';
import { AMBIENCE } from './ambience-source';
import { colors, radius, space, type } from '../theme/tokens';

/**
 * Sottofondo: registrazione dello Zaccheria, in loop.
 *
 * Parte da sola all'apertura. Browser e iPhone pero bloccano l'audio che non
 * nasce da un gesto: quando succede il pulsante resta spento e comincia a
 * pulsare, cosi si vede che basta toccarlo. Al primo tocco parte e la
 * pulsazione finisce.
 */

type Ambience = {
  playing: boolean;
  /** il sistema ha bloccato l'avvio automatico: serve un tocco */
  needsTap: boolean;
  toggle: () => void;
  /** dichiarato dalla schermata che vuole il sottofondo */
  setScreenActive: (active: boolean) => void;
};

const AmbienceContext = createContext<Ambience>({
  playing: false, needsTap: false, toggle: () => {}, setScreenActive: () => {},
});

export function AmbienceProvider({ children }: { children: ReactNode }) {
  const hasTrack = AMBIENCE != null;
  const player = useAmbiencePlayer(AMBIENCE);
  /** preferenza dell'utente: acceso finche non lo spegne lui */
  const [enabled, setEnabled] = useState(true);
  /** la schermata a cui il sottofondo appartiene e in primo piano */
  const [onScreen, setOnScreen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  // il suono e l'ambiente dello Zaccheria: vive solo dentro la schermata dello
  // stadio. Uscendo si ferma, rientrando riparte se l'utente non lo ha spento.
  useEffect(() => {
    let alive = true;
    if (!hasTrack) return;
    if (enabled && onScreen) {
      const id = setTimeout(async () => {
        const ok = await player.play();
        if (!alive) return;
        setPlaying(ok);
        setNeedsTap(!ok);
      }, 350);
      return () => { alive = false; clearTimeout(id); };
    }
    player.pause();
    setPlaying(false);
    if (!onScreen) setNeedsTap(false);
    return () => { alive = false; };
  }, [enabled, onScreen, player, hasTrack]);

  const value = useMemo<Ambience>(() => ({
    playing,
    needsTap,
    setScreenActive: setOnScreen,
    toggle: () => {
      if (playing || (enabled && !needsTap)) {
        setEnabled(false);
        return;
      }
      setEnabled(true);
      // se l'avvio automatico era stato bloccato, questo tocco lo autorizza
      void player.play().then((ok) => {
        setPlaying(ok);
        setNeedsTap(!ok);
      });
    },
  }), [playing, needsTap, enabled, player]);

  return <AmbienceContext.Provider value={value}>{children}</AmbienceContext.Provider>;
}

export function useAmbience() {
  return useContext(AmbienceContext);
}

/** Pulsante altoparlante. Pulsa finche il suono non e stato avviato. */
export function AmbienceButton({ compact = false }: { compact?: boolean }) {
  const { playing, needsTap, toggle } = useAmbience();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!needsTap) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [needsTap, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.16] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  // senza traccia il comando non ha senso: sparisce invece di restare inerte
  if (AMBIENCE == null) return null;

  return (
    <Pressable
      onPress={toggle}
      accessibilityRole="switch"
      accessibilityState={{ checked: playing }}
      accessibilityLabel={playing ? 'Disattiva il sottofondo' : 'Attiva il sottofondo'}
    >
      <Animated.View
        style={[
          styles.btn,
          playing && styles.btnOn,
          needsTap && styles.btnWaiting,
          needsTap && { transform: [{ scale }], opacity },
        ]}
      >
        <Ionicons
          name={playing ? 'volume-high' : 'volume-mute'}
          size={16}
          color={playing || needsTap ? colors.onAccent : colors.textDim}
        />
        {!compact ? (
          <Text style={[styles.label, (playing || needsTap) && styles.labelOn]}>
            {playing ? 'Audio' : needsTap ? 'Tocca' : 'Muto'}
          </Text>
        ) : null}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: space.md, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: 'rgba(44,44,46,0.82)',
  },
  btnOn: { backgroundColor: colors.accent },
  btnWaiting: { backgroundColor: colors.accent },
  label: { ...type.captionBold, color: colors.textDim },
  labelOn: { color: colors.onAccent },
});
