/**
 * Input Component
 * Recreates the glass input effect from web
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing, FontFamily, FontSize, Duration, useThemedColors } from '../../theme';
import { useTheme } from '../hooks/useTheme';

const AnimatedView = Animated.createAnimatedComponent(View);

interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  enablePasswordToggle?: boolean;
}

const Input: React.FC<InputProps> = ({
  icon,
  containerStyle,
  rightIcon,
  onRightIconPress,
  enablePasswordToggle = false,
  secureTextEntry,
  onFocus,
  onBlur,
  ...props
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  const [isFocused, setIsFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const focusAnim = useSharedValue(0);

  const effectiveSecureTextEntry = enablePasswordToggle
    ? !passwordVisible
    : Boolean(secureTextEntry);

  const togglePasswordVisibility = useCallback(() => {
    setPasswordVisible((prev) => !prev);
  }, []);

  const handleFocus = useCallback((e: any) => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, { duration: Duration.normal });
    onFocus?.(e);
  }, [onFocus]);

  const handleBlur = useCallback((e: any) => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, { duration: Duration.normal });
    onBlur?.(e);
  }, [onBlur]);

  const animatedContainerStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      focusAnim.value,
      [0, 1],
      [isDark ? Colors.glassDark : Colors.whiteAlpha90, isDark ? Colors.surfaceDark : Colors.surfaceLight]
    ),
    borderColor: interpolateColor(focusAnim.value, [0, 1], ['rgba(0,0,0,0)', Colors.primary]),
    borderWidth: 1,
    shadowColor: Colors.primary,
    shadowOpacity: focusAnim.value * 0.24,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: focusAnim.value > 0.5 ? 4 : 0,
  }));

  return (
    <AnimatedView
      style={[
        styles.container,
        animatedContainerStyle,
        containerStyle,
      ]}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <TextInput
        style={[
          styles.input,
          icon ? styles.inputWithIcon : null,
          (rightIcon || enablePasswordToggle) ? styles.inputWithRightIcon : null,
          { color: themed.text },
        ]}
        placeholderTextColor={themed.textMuted}
        secureTextEntry={effectiveSecureTextEntry}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
      {(rightIcon || enablePasswordToggle) && (
        <Pressable
          style={styles.rightIconContainer}
          onPress={enablePasswordToggle ? togglePasswordVisibility : onRightIconPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={
            enablePasswordToggle
              ? passwordVisible
                ? 'Hide password'
                : 'Show password'
              : 'Input action'
          }
        >
          {enablePasswordToggle ? (
            <Ionicons
              name={passwordVisible ? 'eye-off-outline' : 'eye-outline'}
              size={22}
              color={themed.textMuted}
            />
          ) : (
            rightIcon
          )}
        </Pressable>
      )}
    </AnimatedView>
  );
};

const styles = StyleSheet.create({
  container: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xl,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.whiteAlpha90,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  iconContainer: {
    position: 'absolute',
    left: Spacing.base,
    zIndex: 1,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: Spacing.base,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  inputWithIcon: {
    paddingLeft: Spacing.inputHeight,
  },
  inputWithRightIcon: {
    paddingRight: Spacing.inputHeight,
  },
  rightIconContainer: {
    position: 'absolute',
    right: Spacing.base,
    zIndex: 1,
  },
});

export default Input;
