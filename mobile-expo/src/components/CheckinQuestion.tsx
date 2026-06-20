/**
 * CheckinQuestion Component (v3 — Professional)
 *
 * DESIGN:
 * - Horizontal card: Ionicons icon circle → question text → Yes / No toggle buttons
 * - Professional Ionicons (no emojis)
 * - Yes button: checkmark icon, No button: close icon
 * - Spring micro-interaction on press (scale 0.88 → 1)
 * - Selected state: solid fill with white icon + text
 * - Calm border tint changes to match selection
 *
 * PUBLIC HEALTH REASONING:
 * - Clear yes/no reduces ambiguity
 * - Green = "No" (healthy), Amber = "Yes" (concern worth noting)
 * - Accessible 44×36 min touch targets
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
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
  icon?: string;
  iconColor?: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const CheckinQuestion: React.FC<CheckinQuestionProps> = ({
  question,
  icon = 'heart-outline',
  iconColor = Colors.primary,
  value,
  onChange,
  disabled = false,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);

  const scaleYes = useSharedValue(1);
  const scaleNo = useSharedValue(1);

  const press = (isYes: boolean, down: boolean) => {
    const sv = isYes ? scaleYes : scaleNo;
    sv.value = withSpring(down ? 0.88 : 1, { damping: 14, stiffness: 280 });
  };

  const yesStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleYes.value }],
  }));
  const noStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleNo.value }],
  }));

  const isYes = value === true;
  const isNo = value === false;

  const borderColor = isYes
    ? 'rgba(245,158,11,0.35)'
    : isNo
    ? 'rgba(16,185,129,0.35)'
    : isDark
    ? Colors.whiteAlpha10
    : Colors.borderLight;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? Colors.whiteAlpha10 : '#ffffff',
          borderColor,
        },
      ]}
    >
      <View style={styles.questionRow}>
        <View
          style={[
            styles.iconBadge,
            {
              backgroundColor: isYes
                ? 'rgba(245,158,11,0.10)'
                : isNo
                ? 'rgba(16,185,129,0.10)'
                : (iconColor + '14'),
            },
          ]}
        >
          <Ionicons
            name={icon as any}
            size={20}
            color={isYes ? '#d97706' : isNo ? '#059669' : iconColor}
          />
        </View>

        <Text style={[styles.question, { color: themed.text }]}>
          {question}
        </Text>
      </View>

      {/* Toggle buttons */}
      <View style={styles.toggleGroup}>
        <AnimatedPressable
          onPress={() => !disabled && onChange(true)}
          onPressIn={() => press(true, true)}
          onPressOut={() => press(true, false)}
          style={yesStyle}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="Yes"
        >
          <View
            style={[
              styles.toggleBtn,
              isYes && styles.toggleYesActive,
              disabled && styles.toggleDisabled,
            ]}
          >
            <Ionicons
              name={isYes ? 'checkmark-circle' : 'checkmark-circle-outline'}
              size={15}
              color={isYes ? '#ffffff' : '#9ca3af'}
            />
            <Text style={[styles.toggleText, isYes && styles.toggleTextActive]}>
              Yes
            </Text>
          </View>
        </AnimatedPressable>

        <AnimatedPressable
          onPress={() => !disabled && onChange(false)}
          onPressIn={() => press(false, true)}
          onPressOut={() => press(false, false)}
          style={noStyle}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel="No"
        >
          <View
            style={[
              styles.toggleBtn,
              isNo && styles.toggleNoActive,
              disabled && styles.toggleDisabled,
            ]}
          >
            <Ionicons
              name={isNo ? 'close-circle' : 'close-circle-outline'}
              size={15}
              color={isNo ? '#ffffff' : '#9ca3af'}
            />
            <Text style={[styles.toggleText, isNo && styles.toggleTextActive]}>
              No
            </Text>
          </View>
        </AnimatedPressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.base,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
    gap: Spacing.base,
    ...Shadows.xs,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  question: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.4,
  },
  toggleGroup: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  toggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: 'transparent',
    minWidth: 92,
    minHeight: 46,
    justifyContent: 'center',
  },
  toggleYesActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  toggleNoActive: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  toggleDisabled: {
    opacity: 0.4,
  },
  toggleText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: '#9ca3af',
  },
  toggleTextActive: {
    color: '#ffffff',
  },
});

export default CheckinQuestion;
