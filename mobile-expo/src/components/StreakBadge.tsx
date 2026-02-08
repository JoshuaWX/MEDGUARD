/**
 * StreakBadge Component
 * 
 * Displays the user's daily check-in streak.
 * 
 * PUBLIC HEALTH REASONING:
 * - Light gamification to encourage habit-building
 * - Supportive, not competitive language
 * - No pressure or shame for missed days
 * - Celebrates consistency, not perfection
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
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
import { getStreakEmoji, getStreakMessage } from '../services/healthCheckin';

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak?: number;
  compact?: boolean;
}

const StreakBadge: React.FC<StreakBadgeProps> = ({
  currentStreak,
  longestStreak,
  compact = false,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  const emoji = getStreakEmoji(currentStreak);
  const message = getStreakMessage(currentStreak);

  // Streak color based on length
  const getStreakColor = () => {
    if (currentStreak >= 30) return '#f59e0b';  // Gold for 30+ days
    if (currentStreak >= 14) return '#ef4444';  // Red fire for 14+ days
    if (currentStreak >= 7) return Colors.primary;  // Brand color for 7+ days
    return Colors.success;  // Green for starting out
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: themed.surface }]}>
        <Text style={styles.compactEmoji}>{emoji}</Text>
        <Text style={[styles.compactStreak, { color: getStreakColor() }]}>
          {currentStreak}
        </Text>
        <Text style={[styles.compactLabel, { color: themed.textSecondary }]}>
          day streak
        </Text>
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeIn.duration(400)}
      style={[styles.container, { backgroundColor: themed.surface }]}
    >
      <View style={styles.streakRow}>
        <Text style={styles.emoji}>{emoji}</Text>
        <View style={styles.streakInfo}>
          <View style={styles.countRow}>
            <Text style={[styles.count, { color: getStreakColor() }]}>
              {currentStreak}
            </Text>
            <Text style={[styles.countLabel, { color: themed.textSecondary }]}>
              day streak
            </Text>
          </View>
          <Text style={[styles.message, { color: themed.text }]}>
            {message}
          </Text>
        </View>
      </View>

      {/* Longest streak (if different from current) */}
      {longestStreak !== undefined && longestStreak > currentStreak && (
        <View style={[styles.longestRow, { borderTopColor: themed.border }]}>
          <Text style={[styles.longestLabel, { color: themed.textMuted }]}>
            🏆 Personal best: {longestStreak} days
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    ...Shadows.sm,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  emoji: {
    fontSize: 40,
  },
  streakInfo: {
    flex: 1,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  count: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['3xl'],
  },
  countLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
  },
  message: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  longestRow: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
  },
  longestLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  // Compact variant
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    ...Shadows.xs,
  },
  compactEmoji: {
    fontSize: FontSize.lg,
  },
  compactStreak: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
  },
  compactLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
});

export default StreakBadge;
