/**
 * GlassCard Component
 * Recreates the glass-card effect from web CSS
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius, Shadows, Spacing, useThemedColors } from '../../theme';
import { useTheme } from '../hooks/useTheme';

interface GlassCardProps extends ViewProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: number;
  borderRadius?: number;
  intensity?: number;
}

const GlassCard: React.FC<GlassCardProps> = ({
  children,
  style,
  padding = Spacing.lg,
  borderRadius = BorderRadius.xl,
  intensity = 20,
  ...props
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);

  return (
    <View
      style={[
        styles.container,
        { borderRadius, borderColor: isDark ? Colors.whiteAlpha10 : Colors.whiteAlpha30 },
        Shadows.glass,
        style,
      ]}
      {...props}
    >
      <BlurView intensity={intensity} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill}>
        <View style={[styles.overlay, { borderRadius, backgroundColor: themed.glass }]} />
      </BlurView>
      <View style={[styles.content, { padding }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});

export default GlassCard;
