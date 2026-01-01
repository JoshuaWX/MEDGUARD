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
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, BorderRadius, Spacing, Shadows, TextStyles, FontFamily, Duration, CustomEasing } from '../../theme';

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

  const buttonStyles = getButtonStyles(variant);
  const textColor = getTextColor(variant);

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

function getButtonStyles(variant: ButtonVariant): ViewStyle {
  switch (variant) {
    case 'secondary':
      return {
        backgroundColor: Colors.whiteAlpha20,
        borderWidth: 1,
        borderColor: Colors.whiteAlpha30,
      };
    case 'outline':
      return {
        backgroundColor: Colors.surfaceLight,
        borderWidth: 1,
        borderColor: Colors.borderLight,
      };
    case 'ghost':
      return {
        backgroundColor: Colors.transparent,
      };
    case 'google':
      return {
        backgroundColor: Colors.surfaceLight,
        borderWidth: 1,
        borderColor: Colors.borderLight,
        ...Shadows.base,
      };
    default:
      return {};
  }
}

function getTextColor(variant: ButtonVariant): string {
  switch (variant) {
    case 'primary':
      return Colors.textLight;
    case 'secondary':
      return Colors.textLight;
    case 'outline':
    case 'google':
      return Colors.textPrimary;
    case 'ghost':
      return Colors.whiteAlpha80;
    default:
      return Colors.textLight;
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
