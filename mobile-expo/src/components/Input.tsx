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
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing, FontFamily, FontSize, Duration } from '../../theme';

const AnimatedView = Animated.createAnimatedComponent(View);

interface InputProps extends TextInputProps {
  icon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

const Input: React.FC<InputProps> = ({
  icon,
  containerStyle,
  onFocus,
  onBlur,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const focusAnim = useSharedValue(0);

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
    backgroundColor: focusAnim.value === 1 ? Colors.surfaceLight : Colors.whiteAlpha90,
    borderColor: focusAnim.value === 1 ? Colors.primary : 'transparent',
    borderWidth: focusAnim.value === 1 ? 2 : 0,
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
        style={[styles.input, icon ? styles.inputWithIcon : null]}
        placeholderTextColor={Colors.textMuted}
        onFocus={handleFocus}
        onBlur={handleBlur}
        {...props}
      />
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
});

export default Input;
