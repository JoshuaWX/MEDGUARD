/**
 * Button Component
 * Recreates all button variants with animations from web
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
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Spacing, Shadows, FontFamily, useThemedColors } from '../../theme';
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
  const translateY = useSharedValue(0);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.98, { damping: 15 });
    translateY.value = withSpring(2, { damping: 15 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, { damping: 15 });
    translateY.value = withSpring(-2, { damping: 15 }); // Lift on hover equivalent
    // Return to normal after short delay
    setTimeout(() => {
      translateY.value = withSpring(0, { damping: 15 });
    }, 150);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: translateY.value },
    ],
  }));

  const buttonStyles = getButtonStyles(variant, { isDark, themed });
  const textColor = getTextColor(variant, { themed });

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={[styles.text, { color: textColor }, textStyle]}>{title}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </>
  );

  if (variant === 'primary') {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        style={[
          styles.base,
          fullWidth && styles.fullWidth,
          animatedStyle,
          Shadows.primary,
          disabled && styles.disabled,
          style,
        ]}
      >
        <LinearGradient
          colors={[Colors.primary, '#06b6d4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.gradient, styles.contentRow]}
        >
          {content}
        </LinearGradient>
      </AnimatedPressable>
    );
  }

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        buttonStyles,
        animatedStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Animated.View style={styles.contentRow}>{content}</Animated.View>
    </AnimatedPressable>
  );
};

function getTextColor(variant: ButtonVariant, ctx: { themed: ReturnType<typeof useThemedColors> }): string {
  switch (variant) {
    case 'primary':
      return Colors.textLight;
    case 'secondary':
      return Colors.textLight;
    case 'outline':
    case 'google':
      return ctx.themed.text;
    case 'ghost':
      return ctx.themed.textSecondary;
    default:
      return Colors.textLight;
  }
}

function getButtonStyles(
  variant: ButtonVariant,
  ctx: { isDark: boolean; themed: ReturnType<typeof useThemedColors> }
): ViewStyle {
  const themedBackground = () => (ctx.isDark ? Colors.blackAlpha20 : Colors.whiteAlpha20);
  const themedSurface = () => ctx.themed.surface;
  const themedBorder = () => ctx.themed.border;

  switch (variant) {
    case 'secondary':
      return {
        backgroundColor: themedBackground(),
        borderWidth: 1,
        borderColor: ctx.isDark ? Colors.whiteAlpha10 : Colors.whiteAlpha30,
      };
    case 'outline':
      return {
        backgroundColor: themedSurface(),
        borderWidth: 1,
        borderColor: themedBorder(),
      };
    case 'ghost':
      return {
        backgroundColor: Colors.transparent,
      };
    case 'google':
      return {
        backgroundColor: themedSurface(),
        borderWidth: 1,
        borderColor: themedBorder(),
        ...Shadows.base,
      };
    default:
      return {};
  }
}

const styles = StyleSheet.create({
  base: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  gradient: {
    flex: 1,
    borderRadius: BorderRadius.xl,
  },
  contentRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  text: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
  },
  disabled: {
    opacity: 0.5,
  },
});

export default Button;
