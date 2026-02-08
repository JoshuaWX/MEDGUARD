/**
 * RiskLevelCard Component (v3 — Professional)
 *
 * DESIGN:
 * - Left accent bar with animated scaleY entrance
 * - Ionicons in tinted circle (no emojis)
 * - "What you can do" guidance with bulb icon
 * - Compact pill variant for inline preview
 * - Clean type hierarchy
 *
 * PUBLIC HEALTH REASONING:
 * - Non-alarmist: amber (not red) for elevated
 * - Actionable guidance, not diagnosis
 * - Clear disclaimer in every view
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  FadeInUp,
  FadeIn,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
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
import { RiskLevel, getRiskLevelDisplay } from '../services/healthCheckin';

interface RiskLevelCardProps {
  level: RiskLevel;
  showGuidance?: boolean;
  compact?: boolean;
}

const RISK_META: Record<RiskLevel, { icon: string; bg: string }> = {
  low: { icon: 'checkmark-circle', bg: 'rgba(16,185,129,0.10)' },
  moderate: { icon: 'information-circle', bg: 'rgba(59,130,246,0.10)' },
  elevated: { icon: 'warning', bg: 'rgba(245,158,11,0.10)' },
};

const RiskLevelCard: React.FC<RiskLevelCardProps> = ({
  level,
  showGuidance = true,
  compact = false,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  const display = getRiskLevelDisplay(level);
  const meta = RISK_META[level];

  // Animated accent bar
  const barScale = useSharedValue(0);
  useEffect(() => {
    barScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [level]);

  const barStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: barScale.value }],
  }));

  // ── Compact pill ──────────────────────────────────────────────────────
  if (compact) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <View style={[styles.compactRow, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as any} size={18} color={display.color} />
          <Text style={[styles.compactLabel, { color: display.color }]}>
            {display.label}
          </Text>
        </View>
      </Animated.View>
    );
  }

  // ── Full card ─────────────────────────────────────────────────────────
  return (
    <Animated.View
      entering={FadeInUp.duration(450)}
      style={[styles.card, { backgroundColor: meta.bg }]}
    >
      {/* Left accent bar */}
      <Animated.View
        style={[
          styles.accentBar,
          { backgroundColor: display.color },
          barStyle,
        ]}
      />

      <View style={styles.body}>
        {/* Header row: icon circle + label + description */}
        <View style={styles.headerRow}>
          <View style={[styles.iconCircle, { backgroundColor: display.color + '1A' }]}>
            <Ionicons name={meta.icon as any} size={26} color={display.color} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.levelLabel, { color: display.color }]}>
              {display.label} Health Awareness
            </Text>
            <Text style={[styles.description, { color: themed.textSecondary }]}>
              {display.description}
            </Text>
          </View>
        </View>

        {/* Guidance box */}
        {showGuidance && (
          <View style={[styles.guidanceBox, { backgroundColor: themed.surface }]}>
            <View style={styles.guidanceTitleRow}>
              <Ionicons name="bulb-outline" size={18} color={themed.text} />
              <Text style={[styles.guidanceTitle, { color: themed.text }]}>
                What you can do
              </Text>
            </View>
            <Text style={[styles.guidanceText, { color: themed.textSecondary }]}>
              {display.guidance}
            </Text>
          </View>
        )}

        {/* Disclaimer */}
        <Text style={[styles.disclaimer, { color: themed.textMuted }]}>
          For awareness only — not a medical diagnosis. Consult a healthcare provider for medical advice.
        </Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  // ── Compact ───────────────────────────────────────────────────────────
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
  },
  compactLabel: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },

  // ── Full card ─────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginVertical: Spacing.md,
    ...Shadows.sm,
  },
  accentBar: {
    width: 5,
    borderTopLeftRadius: BorderRadius.xl,
    borderBottomLeftRadius: BorderRadius.xl,
  },
  body: {
    flex: 1,
    padding: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  levelLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    marginBottom: 4,
  },
  description: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  guidanceBox: {
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  guidanceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.xs,
  },
  guidanceTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  guidanceText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.6,
    marginLeft: 26,
  },
  disclaimer: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: FontSize.xs * 1.5,
  },
});

export default RiskLevelCard;
