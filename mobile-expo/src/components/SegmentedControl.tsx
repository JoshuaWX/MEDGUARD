/**
 * SegmentedControl — iOS-style segmented toggle ("Calm Clinical").
 *
 * A sunken track with the active segment lifted as a surface pill. Optional
 * Lucide icon per segment. Use for mutually-exclusive view switches (e.g. the
 * Map's Facilities / Disease-risk toggle).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BorderRadius, FontFamily, FontSize, Shadows, Spacing } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import Icon, { type IconName } from './Icon';

export interface Segment {
  key: string;
  label: string;
  icon?: IconName;
}

interface SegmentedControlProps {
  segments: Segment[];
  value: string;
  onChange: (key: string) => void;
  style?: ViewStyle;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ segments, value, onChange, style }) => {
  const { isDark, colors } = useTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceSunken }, style]}>
      {segments.map((seg) => {
        const active = seg.key === value;
        return (
          <Pressable
            key={seg.key}
            onPress={() => onChange(seg.key)}
            style={[
              styles.segment,
              active && [styles.segmentActive, { backgroundColor: colors.surface, shadowColor: isDark ? '#000' : colors.shadow }],
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {seg.icon && (
              <Icon name={seg.icon} size={15} color={active ? colors.primary : colors.textSecondary} />
            )}
            <Text style={[styles.label, { color: active ? colors.text : colors.textSecondary }]} numberOfLines={1}>
              {seg.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: BorderRadius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: BorderRadius.base,
  },
  segmentActive: {
    ...Shadows.sm,
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
});

export default SegmentedControl;
