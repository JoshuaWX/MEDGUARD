/**
 * Chip — compact pill for filters / selectable tags ("Calm Clinical").
 *
 * Active: tinted fill + accent text. Inactive: surface + hairline border +
 * secondary text. Optional Lucide icon and a custom active color (e.g. a disease
 * hue for the map filters).
 */

import React from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import { BorderRadius, FontFamily, FontSize, Spacing } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import Icon, { type IconName } from './Icon';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Active accent (defaults to brand primary). */
  color?: string;
  /** Dim the label (e.g. a filter with no data). */
  muted?: boolean;
  style?: ViewStyle;
}

const Chip: React.FC<ChipProps> = ({ label, active = false, onPress, icon, color, muted, style }) => {
  const { colors } = useTheme();
  const accent = color ?? colors.primary;
  const bg = active ? `${accent}1F` : colors.surface;
  const borderColor = active ? `${accent}1F` : colors.border;
  const textColor = active ? accent : muted ? colors.textMuted : colors.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, { backgroundColor: bg, borderColor }, style]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {icon && <Icon name={icon} size={14} color={textColor} />}
      <Text style={[styles.label, { color: textColor }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: 9,
    borderRadius: BorderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
});

export default Chip;
