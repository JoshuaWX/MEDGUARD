/**
 * StreakBadge Component (v3 — Professional)
 *
 * DESIGN:
 * - Compact mode: pill chip with Ionicons icon + streak count (for title row)
 * - Full mode: animated SVG progress ring + milestone info
 * - Professional Ionicons for streak tiers (no emojis)
 * - Calm color progression: green → purple → blue → gold
 *
 * PUBLIC HEALTH REASONING:
 * - Supportive, never punishing for missed days
 * - Celebrates consistency over perfection
 * - No competitive framing
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  useSharedValue,
  useAnimatedProps,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
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
import { getStreakMessage } from '../services/healthCheckin';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface StreakBadgeProps {
  currentStreak: number;
  longestStreak?: number;
  compact?: boolean;
}

// Ring constants
const RING_SIZE = 72;
const STROKE_WIDTH = 5;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const NEXT_MILESTONE = (s: number) => {
  if (s < 7) return 7;
  if (s < 14) return 14;
  if (s < 30) return 30;
  return 30;
};

/** Professional icon + accent color for streak tier */
function getStreakTier(streak: number): { icon: string; color: string } {
  if (streak >= 30) return { icon: 'trophy', color: '#f59e0b' };
  if (streak >= 14) return { icon: 'flame', color: '#ef4444' };
  if (streak >= 7) return { icon: 'star', color: Colors.primary };
  if (streak >= 3) return { icon: 'flash', color: '#8b5cf6' };
  return { icon: 'fitness', color: '#10b981' };
}

const StreakBadge: React.FC<StreakBadgeProps> = ({
  currentStreak,
  longestStreak,
  compact = false,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  const message = getStreakMessage(currentStreak);
  const { icon: iconName, color: accent } = getStreakTier(currentStreak);

  // Animate ring fill
  const milestone = NEXT_MILESTONE(currentStreak);
  const progress = Math.min(currentStreak / milestone, 1);
  const dashOffset = useSharedValue(CIRCUMFERENCE);

  useEffect(() => {
    dashOffset.value = withTiming(CIRCUMFERENCE * (1 - progress), {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: dashOffset.value,
  }));

  // ── Compact chip (inline, for title row) ──────────────────────────────
  if (compact) {
    return (
      <Animated.View entering={FadeIn.duration(350)}>
        <View
          style={[
            styles.chip,
            {
              backgroundColor: accent + '14',
              borderColor: accent + '30',
            },
          ]}
        >
          <Ionicons name={iconName as any} size={14} color={accent} />
          <Text style={[styles.chipCount, { color: accent }]}>{currentStreak}</Text>
          <Text style={[styles.chipLabel, { color: themed.textSecondary }]}>
            day{currentStreak !== 1 ? 's' : ''}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // ── Full card ─────────────────────────────────────────────────────────
  return (
    <Animated.View
      entering={FadeIn.duration(450)}
      style={[styles.card, { backgroundColor: themed.surface, borderColor: themed.border }]}
    >
      <View style={styles.topRow}>
        {/* Progress ring + count */}
        <View style={styles.ringWrap}>
          <Svg width={RING_SIZE} height={RING_SIZE} style={styles.svg}>
            <Circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={isDark ? Colors.whiteAlpha10 : '#e5e7eb'}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              stroke={accent}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
              animatedProps={ringProps}
              rotation="-90"
              origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
            />
          </Svg>
          <View style={styles.ringCenter}>
            <Text style={[styles.ringCount, { color: accent }]}>{currentStreak}</Text>
          </View>
        </View>

        {/* Text area */}
        <View style={styles.textArea}>
          <View style={styles.streakTitleRow}>
            <Ionicons name={iconName as any} size={20} color={accent} />
            <Text style={[styles.message, { color: themed.text }]}>{message}</Text>
          </View>
          <Text style={[styles.milestoneHint, { color: themed.textSecondary }]}>
            {currentStreak < 30
              ? `Next milestone: ${milestone} days`
              : 'You reached the top milestone!'}
          </Text>
        </View>
      </View>

      {/* Personal best — normal flow, no overlap */}
      {longestStreak !== undefined && longestStreak > currentStreak && (
        <View style={[styles.bestRow, { borderTopColor: themed.border }]}>
          <Ionicons name="trophy-outline" size={14} color={themed.textMuted} />
          <Text style={[styles.bestText, { color: themed.textMuted }]}>
            Personal best: {longestStreak} days
          </Text>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // ── Compact chip ──────────────────────────────────────────────────────
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  chipCount: { fontFamily: FontFamily.bold, fontSize: FontSize.sm },
  chipLabel: { fontFamily: FontFamily.regular, fontSize: FontSize.xs },

  // ── Full card ─────────────────────────────────────────────────────────
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    gap: Spacing.sm,
    ...Shadows.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  svg: {
    position: 'absolute',
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringCount: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
  },
  textArea: {
    flex: 1,
  },
  streakTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  message: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * 1.3,
    flex: 1,
  },
  milestoneHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 4,
    marginLeft: 28,
  },
  bestRow: {
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  bestText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
});

export default StreakBadge;
