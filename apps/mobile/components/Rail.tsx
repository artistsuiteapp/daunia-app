import { ReactNode, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';

import { colors, radius, space, type } from '../theme/tokens';
import { useLayout } from '../theme/responsive';

/**
 * Fila orizzontale con titolo e indicatore di scorrimento, come nella reference.
 *
 * L'indicatore non e la barra di sistema: e una traccia corta a destra del
 * titolo, con un cursore largo quanto la porzione visibile. Dice quanto catalogo
 * resta senza occupare spazio sotto le schede.
 */
export function Rail({ title, action, children }: {
  title: string; action?: ReactNode; children: ReactNode;
}) {
  const { gutter } = useLayout();
  const [ratio, setRatio] = useState(1);
  const progress = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.wrap}>
      <View style={[styles.head, { paddingHorizontal: space.lg + gutter }]}>
        <Text style={styles.title}>{title}</Text>
        {action ?? (
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.thumb,
                {
                  width: `${Math.min(100, ratio * 100)}%`,
                  left: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0%', `${Math.max(0, 100 - ratio * 100)}%`],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.row, { paddingHorizontal: space.lg + gutter }]}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const scrollable = contentSize.width - layoutMeasurement.width;
          setRatio(contentSize.width > 0 ? layoutMeasurement.width / contentSize.width : 1);
          progress.setValue(scrollable > 0 ? contentOffset.x / scrollable : 0);
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xl },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: space.md, marginBottom: space.md,
  },
  title: { ...type.title2, color: colors.text },
  track: {
    width: 58, height: 5, borderRadius: 3,
    backgroundColor: colors.surfaceHi, overflow: 'hidden',
  },
  thumb: {
    position: 'absolute', top: 0, bottom: 0,
    borderRadius: 3, backgroundColor: colors.accentBright,
  },
  row: { gap: space.md, paddingVertical: 2 },
});
