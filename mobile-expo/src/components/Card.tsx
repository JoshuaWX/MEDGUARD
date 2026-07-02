/**
 * Card — the primary surface primitive for the "Calm Clinical" system.
 *
 * Flat themed surface + hairline border + soft low shadow. Variants:
 *  - plain    : resting card (default)
 *  - elevated : raised (more shadow) — for the one focal card on a screen
 *  - sunken   : inset well (no shadow, sunken bg) — for grouped rows/insets
 *  - accent   : subtly tinted with the brand color — for the primary highlight
 * Optionally pressable (adds a gentle press scale via reanimated).
 */

import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { BorderRadius, Shadows, Spacing } from '../../theme';
import { useTheme } from '../hooks/useTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type CardVariant = 'plain' | 'elevated' | 'sunken' | 'accent';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  padding?: number;
  radius?: number;
  style?: ViewStyle;
  onPress?: () => void;
}

const Card: React.FC<CardProps> = ({
  children,
  variant = 'plain',
  padding = Spacing.lg,
  radius = BorderRadius.card,
  style,
  onPress,
}) => {
  const { isDark, colors } = useTheme();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const surface =
    variant === 'sunken' ? colors.surfaceSunken
    : variant === 'accent' ? colors.primaryTint
    : variant === 'elevated' ? colors.surfaceElevated
    : colors.surface;

  const borderColor =
    variant === 'accent' ? (isDark ? colors.border : colors.primaryTint)
    : colors.border;

  const base: ViewStyle = {
    borderRadius: radius,
    backgroundColor: surface,
    borderColor,
    borderWidth: StyleSheet.hairlineWidth,
    padding,
    shadowColor: isDark ? '#000' : colors.shadow,
  };

  const shadow =
    variant === 'sunken' ? Shadows.none
    : variant === 'elevated' ? Shadows.md
    : Shadows.sm;

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={() => (scale.value = withTiming(0.985, { duration: 120 }))}
        onPressOut={() => (scale.value = withTiming(1, { duration: 140 }))}
        style={[base, shadow, pressStyle, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[base, shadow, style]}>{children}</View>;
};

export default Card;
