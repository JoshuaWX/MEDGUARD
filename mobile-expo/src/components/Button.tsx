/**
 * Button — "Calm Clinical" system.
 *
 * Solid, confident primary (deep teal, soft branded lift), plus quiet
 * secondary / outline / ghost / google variants. One accent, used with
 * restraint. Gentle spring press. API unchanged.
 */

import React, { useCallback } from 'react';
import {
  Pressable,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { BorderRadius, Colors, Spacing, Shadows, FontFamily, LetterSpacing, useThemedColors } from '../../theme';
import { useTheme } from '../hooks/useTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'google';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'right',
  style,
  textStyle,
  fullWidth = true,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, { damping: 18, stiffness: 280 });
  }, []);
  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 18, stiffness: 280 });
  }, []);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const { container, textColor } = getVariantStyles(variant, { isDark, themed });

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.base,
        styles.contentRow,
        fullWidth && styles.fullWidth,
        container,
        variant === 'primary' && Shadows.primary,
        animatedStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </AnimatedPressable>
  );
};

function getVariantStyles(
  variant: ButtonVariant,
  ctx: { isDark: boolean; themed: ReturnType<typeof useThemedColors> },
): { container: ViewStyle; textColor: string } {
  const { themed } = ctx;
  switch (variant) {
    case 'secondary':
      return {
        container: { backgroundColor: themed.primaryTint, borderWidth: StyleSheet.hairlineWidth, borderColor: themed.primaryTint },
        textColor: themed.primary,
      };
    case 'outline':
      return {
        container: { backgroundColor: themed.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: themed.border },
        textColor: themed.text,
      };
    case 'ghost':
      return { container: { backgroundColor: Colors.transparent }, textColor: themed.textSecondary };
    case 'google':
      return {
        container: { backgroundColor: themed.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: themed.border, ...Shadows.sm },
        textColor: themed.text,
      };
    case 'primary':
    default:
      return { container: { backgroundColor: themed.primary }, textColor: Colors.textLight };
  }
}

const styles = StyleSheet.create({
  base: {
    height: 54,
    borderRadius: BorderRadius.input,
    overflow: 'hidden',
  },
  fullWidth: { width: '100%' },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  text: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    letterSpacing: LetterSpacing.wide,
  },
  disabled: { opacity: 0.45 },
});

export default Button;
