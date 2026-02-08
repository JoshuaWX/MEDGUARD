/**
 * CheckinQuestion Component
 * 
 * A Yes/No question button for daily health check-ins.
 * Designed for simple, accessible health self-assessment.
 * 
 * PUBLIC HEALTH REASONING:
 * - Clear yes/no format reduces ambiguity
 * - Visual feedback helps users track their responses
 * - Accessible design for all users
 */

import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  Colors,
  BorderRadius,
  Spacing,
  Shadows,
  FontFamily,
  FontSize,
  useThemedColors,
} from '../../theme';
import { useTheme } from '../hooks/useTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CheckinQuestionProps {
  question: string;
  emoji?: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const CheckinQuestion: React.FC<CheckinQuestionProps> = ({
  question,
  emoji,
  value,
  onChange,
  disabled = false,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  
  const scaleYes = useSharedValue(1);
  const scaleNo = useSharedValue(1);

  const handlePressIn = (isYes: boolean) => {
    if (isYes) {
      scaleYes.value = withSpring(0.95, { damping: 15 });
    } else {
      scaleNo.value = withSpring(0.95, { damping: 15 });
    }
  };

  const handlePressOut = (isYes: boolean) => {
    if (isYes) {
      scaleYes.value = withSpring(1, { damping: 15 });
    } else {
      scaleNo.value = withSpring(1, { damping: 15 });
    }
  };

  const animatedYesStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleYes.value }],
  }));

  const animatedNoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleNo.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: themed.surface }]}>
      <View style={styles.questionRow}>
        {emoji && <Text style={styles.emoji}>{emoji}</Text>}
        <Text style={[styles.question, { color: themed.text }]}>{question}</Text>
      </View>
      
      <View style={styles.buttonsRow}>
        <AnimatedPressable
          onPress={() => !disabled && onChange(true)}
          onPressIn={() => handlePressIn(true)}
          onPressOut={() => handlePressOut(true)}
          style={[animatedYesStyle]}
          disabled={disabled}
        >
          <View
            style={[
              styles.button,
              value === true && styles.buttonYesSelected,
              disabled && styles.buttonDisabled,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                value === true && styles.buttonTextYesSelected,
              ]}
            >
              Yes
            </Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => !disabled && onChange(false)}
          onPressIn={() => handlePressIn(false)}
          onPressOut={() => handlePressOut(false)}
          style={[animatedNoStyle]}
          disabled={disabled}
        >
          <View
            style={[
              styles.button,
              value === false && styles.buttonNoSelected,
              disabled && styles.buttonDisabled,
            ]}
          >
            <Text
              style={[
                styles.buttonText,
                value === false && styles.buttonTextNoSelected,
              ]}
            >
              No
            </Text>
          </View>
        </AnimatedPressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  emoji: {
    fontSize: FontSize.xl,
  },
  question: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.4,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  button: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.surfaceLight,
    minWidth: 80,
    alignItems: 'center',
  },
  buttonYesSelected: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',  // Red tint for "yes I have symptom"
    borderColor: Colors.danger,
  },
  buttonNoSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',  // Green tint for "no symptom"
    borderColor: Colors.success,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  buttonTextYesSelected: {
    color: Colors.danger,
  },
  buttonTextNoSelected: {
    color: Colors.success,
  },
});

export default CheckinQuestion;
