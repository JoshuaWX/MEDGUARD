/**
 * SymptomButton Component
 * Recreates the symptom selection buttons with animations
 */

import React, { useCallback } from 'react';
import { Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Colors, BorderRadius, Spacing, Shadows, FontFamily, FontSize } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface SymptomButtonProps {
  label: string;
  emoji: string;
  selected?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

const SymptomButton: React.FC<SymptomButtonProps> = ({
  label,
  emoji,
  selected = false,
  onPress,
  style,
}) => {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1.05, { damping: 15 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 15 });
    }, 100);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.container,
        selected && styles.selected,
        animatedStyle,
        style,
      ]}
    >
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    ...Shadows.sm,
  },
  selected: {
    backgroundColor: Colors.primaryLight,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  emoji: {
    fontSize: FontSize.base,
  },
  label: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  labelSelected: {
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
});

export default SymptomButton;
