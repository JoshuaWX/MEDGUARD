/**
 * GlassCard Component
 * Recreates the glass-card effect from web CSS
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius, Shadows, Spacing } from '../../theme';

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
  return (
    <View style={[styles.container, { borderRadius }, Shadows.glass, style]} {...props}>
      <BlurView intensity={intensity} tint="light" style={StyleSheet.absoluteFill}>
        <View style={[styles.overlay, { borderRadius }]} />
      </BlurView>
      <View style={[styles.content, { padding }]}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha30,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.glassLight,
  },
  content: {
    position: 'relative',
    zIndex: 1,
  },
});

export default GlassCard;
