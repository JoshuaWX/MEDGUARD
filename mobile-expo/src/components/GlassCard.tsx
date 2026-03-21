/**
 * GlassCard Component
 * Recreates the glass-card effect from web CSS
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
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
      <LinearGradient
        pointerEvents="none"
        colors={
          isDark
            ? ['rgba(255,255,255,0.16)', 'rgba(17,180,212,0.02)', 'rgba(255,255,255,0.03)']
            : ['rgba(255,255,255,0.85)', 'rgba(17,180,212,0.08)', 'rgba(16,185,129,0.08)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.borderGlow, { borderRadius }]}
      />
      <View style={[styles.content, { padding }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  borderGlow: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.8,
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
