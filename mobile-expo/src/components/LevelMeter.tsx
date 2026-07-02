/**
 * LevelMeter — a small segmented bar for showing a discrete risk/level.
 *
 * Filled segments up to (and including) `active` render in `color`; earlier
 * filled segments are dimmed so the leading segment reads as the current level.
 * Used by the area health signal (3 segments: Low/Moderate/Elevated) and the
 * disease outlook (4 segments: low/moderate/elevated/high).
 */

import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface LevelMeterProps {
  segments: number;
  /** 0-based index of the active (current) level. */
  active: number;
  color: string;
  height?: number;
  style?: ViewStyle;
}

const LevelMeter: React.FC<LevelMeterProps> = ({ segments, active, color, height = 6, style }) => {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, style]}>
      {Array.from({ length: segments }).map((_, i) => {
        const filled = i <= active;
        const isLeading = i === active;
        return (
          <View
            key={i}
            style={[
              styles.seg,
              {
                height,
                borderRadius: height / 2,
                backgroundColor: filled ? color : colors.surfaceSunken,
                opacity: filled ? (isLeading ? 1 : 0.4) : 1,
              },
            ]}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 4, width: '100%' },
  seg: { flex: 1 },
});

export default LevelMeter;
