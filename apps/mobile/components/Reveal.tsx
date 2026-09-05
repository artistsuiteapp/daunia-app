import { ReactNode, useEffect, useRef } from 'react';
import { Animated, Easing, ViewStyle } from 'react-native';

/**
 * Entrata a cascata dei blocchi: leggera salita e dissolvenza.
 * Il ritardo crescente fa leggere la pagina dall'alto verso il basso invece di
 * farla comparire tutta insieme.
 */
export function Reveal({ children, delay = 0, distance = 14, style }: {
  children: ReactNode; delay?: number; distance?: number; style?: ViewStyle;
}) {
  const t = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, delay]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: t,
          transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
