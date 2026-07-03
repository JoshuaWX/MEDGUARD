/**
 * CheckinQuestion Component ("Calm Clinical")
 *
 * DESIGN:
 * - Horizontal card: Lucide icon chip → question text → Yes / No toggle buttons
 * - Themed, dark-aware semantics (no hardcoded neon): "No" = healthy (success),
 *   "Yes" = a concern worth noting (warning)
 * - Spring micro-interaction on press (scale 0.88 → 1)
 * - Selected state: solid fill with white icon + text
 *
 * PUBLIC HEALTH REASONING:
 * - Clear yes/no reduces ambiguity; supportive, never punishing
 * - Accessible ≥44px touch targets
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import {
  BorderRadius,
  Spacing,
  Shadows,
  FontFamily,
  FontSize,
} from '../../theme';
import { useTheme } from '../hooks/useTheme';
import Icon, { type IconName } from './Icon';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface CheckinQuestionProps {
  question: string;
  icon?: IconName;
  iconColor?: string;
  value: boolean | null;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

const CheckinQuestion: React.FC<CheckinQuestionProps> = ({
  question,
  icon = 'heart',
  iconColor,
  value,
  onChange,
  disabled = false,
}) => {
  const { colors } = useTheme();
  const accent = iconColor ?? colors.primary;

  const scaleYes = useSharedValue(1);
  const scaleNo = useSharedValue(1);

  const press = (isYes: boolean, down: boolean) => {
    const sv = isYes ? scaleYes : scaleNo;
    sv.value = withSpring(down ? 0.88 : 1, { damping: 14, stiffness: 280 });
  };

  const yesStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleYes.value }] }));
  const noStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleNo.value }] }));

  const isYes = value === true;
  const isNo = value === false;

  const borderColor = isYes
    ? colors.warning
    : isNo
    ? colors.success
    : colors.border;

  const chipBg = isYes ? colors.warningLight : isNo ? colors.successLight : `${accent}1F`;
  const chipColor = isYes ? colors.warning : isNo ? colors.success : accent;

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor },
        Shadows.sm,
      ]}
    >
      <View style={styles.questionRow}>
        <View style={[styles.iconBadge, { backgroundColor: chipBg }]}>
          <Icon name={icon} size={20} color={chipColor} />
        </View>
        <Text style={[styles.question, { color: colors.text }]}>{question}</Text>
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
              { borderColor: colors.border },
              isYes && { backgroundColor: colors.warning, borderColor: colors.warning },
              disabled && styles.toggleDisabled,
            ]}
          >
            <Icon name="check-circle" size={15} color={isYes ? '#fff' : colors.textMuted} />
            <Text style={[styles.toggleText, { color: isYes ? '#fff' : colors.textSecondary }]}>Yes</Text>
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
              { borderColor: colors.border },
              isNo && { backgroundColor: colors.success, borderColor: colors.success },
              disabled && styles.toggleDisabled,
            ]}
          >
            <Icon name="close" size={15} color={isNo ? '#fff' : colors.textMuted} />
            <Text style={[styles.toggleText, { color: isNo ? '#fff' : colors.textSecondary }]}>No</Text>
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
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    marginBottom: Spacing.sm,
    gap: Spacing.base,
  },
  questionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    gap: 5,
    paddingHorizontal: Spacing.base,
    paddingVertical: 10,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    minWidth: 92,
    minHeight: 46,
    justifyContent: 'center',
  },
  toggleDisabled: {
    opacity: 0.4,
  },
  toggleText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
});

export default CheckinQuestion;
