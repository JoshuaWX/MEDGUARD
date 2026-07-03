/**
 * SegmentedControl — iOS-style segmented toggle ("Calm Clinical").
 *
 * A sunken track with the active segment lifted as a surface pill. Optional
 * Lucide icon per segment. Use for mutually-exclusive view switches (e.g. the
 * Map's Facilities / Disease-risk toggle).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { BorderRadius, Colors, FontFamily, FontSize, Shadows, Spacing } from '../../theme';
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
  /**
   * 'raised' (default): active segment lifts as a surface pill.
   * 'solid': active segment fills with the brand color (white label) — bolder,
   * for a primary view switch that must read as obviously tappable.
   */
  variant?: 'raised' | 'solid';
  style?: ViewStyle;
}

const SegmentedControl: React.FC<SegmentedControlProps> = ({ segments, value, onChange, variant = 'raised', style }) => {
  const { isDark, colors } = useTheme();
  const solid = variant === 'solid';
  return (
    <View style={[styles.track, { backgroundColor: colors.surfaceSunken }, style]}>
      {segments.map((seg) => {
        const active = seg.key === value;
        const activeBg = solid ? colors.primary : colors.surface;
        const activeText = solid ? Colors.textLight : colors.text;
        const iconColor = active ? (solid ? Colors.textLight : colors.primary) : colors.textSecondary;
        return (
          <Pressable
            key={seg.key}
            onPress={() => onChange(seg.key)}
            style={[
              styles.segment,
              active && [styles.segmentActive, { backgroundColor: activeBg, shadowColor: solid ? colors.primary : isDark ? '#000' : colors.shadow }],
              active && solid && styles.segmentSolid,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            {seg.icon && <Icon name={seg.icon} size={16} color={iconColor} strokeWidth={active ? 2.1 : 1.8} />}
            <Text style={[styles.label, { color: active ? activeText : colors.textSecondary }]} numberOfLines={1}>
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
    gap: 7,
    paddingVertical: 11,
    borderRadius: BorderRadius.base,
  },
  segmentActive: {
    ...Shadows.sm,
  },
  segmentSolid: {
    ...Shadows.primary,
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
});

export default SegmentedControl;
