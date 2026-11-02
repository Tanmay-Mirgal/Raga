import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius } from '../theme';

/** Pulsing placeholder block shown while content loads. */
export function Skeleton({ width, height, round, style }: { width: DimensionValue; height: number; round?: boolean; style?: ViewStyle }) {
  const pulse = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[{ width, height, borderRadius: round ? height / 2 : radius.sm, backgroundColor: colors.surfaceRaised, opacity: pulse }, style]}
    />
  );
}

export function HomeSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 16 }]}>
      <View style={styles.headerRow}>
        <View>
          <Skeleton width={90} height={12} />
          <Skeleton width={160} height={24} style={{ marginTop: 8 }} />
        </View>
        <Skeleton width={40} height={40} round />
      </View>
      <Skeleton width="100%" height={84} style={{ borderRadius: radius.lg, marginTop: 20 }} />
      <View style={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} width="48.5%" height={56} style={{ borderRadius: radius.sm }} />
        ))}
      </View>
      {[0, 1].map((row) => (
        <View key={row} style={{ marginTop: 28 }}>
          <Skeleton width={160} height={20} />
          <View style={styles.shelf}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ marginRight: 16 }}>
                <Skeleton width={140} height={140} />
                <Skeleton width={110} height={12} style={{ marginTop: 10 }} />
                <Skeleton width={70} height={10} style={{ marginTop: 6 }} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 8, marginTop: 20 },
  shelf: { flexDirection: 'row', marginTop: 14 },
});
