/**
 * GlassCard (name kept for API compatibility) — now a flat "Calm Clinical"
 * surface: solid themed background, hairline border, soft low shadow. The old
 * BlurView/gradient glass has been retired for a calmer, more premium look.
 *
 * Prefer the newer `Card` primitive for new code; this remains so existing
 * screens keep working unchanged while inheriting the new look.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { BorderRadius, Shadows, Spacing } from '../../theme';
import { useTheme } from '../hooks/useTheme';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  borderRadius?: number;
  /** Ignored (legacy glass intensity). */
  intensity?: number;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  padding = Spacing.lg,
  borderRadius = BorderRadius.card,
  ...props
}) => {
  const { isDark, colors } = useTheme();

  return (
    <View
      style={[
        styles.container,
        {
          borderRadius,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowColor: isDark ? '#000' : colors.shadow,
        },
        Shadows.sm,
        style,
        { padding },
      ]}
      {...props}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export default GlassCard;
