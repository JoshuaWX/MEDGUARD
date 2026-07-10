/**
 * RiskLevelCard ("Calm Clinical" / island theme)
 *
 * Shows the result of a daily check-in. Redesigned to the app's flat, themed
 * language: a surface card with a hairline border, a colored left accent, a
 * tinted icon chip, and a sunken "what you can do" box. Semantics are themed +
 * dark-aware (low→success, moderate→info, elevated→warning) — no hardcoded neon.
 *
 * PUBLIC HEALTH REASONING:
 * - Non-alarmist: amber (not red) for elevated
 * - Actionable guidance, not diagnosis; clear disclaimer in every view
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
import {
  BorderRadius,
  Spacing,
  Shadows,
  FontFamily,
  FontSize,
} from '../../theme';
import { useTheme } from '../hooks/useTheme';
import { RiskLevel, getRiskLevelDisplay } from '../services/healthCheckin';
import Icon, { type IconName } from './Icon';

interface RiskLevelCardProps {
  level: RiskLevel;
  showGuidance?: boolean;
  compact?: boolean;
  /** Show a small "Checked in today" confirmation header (completed state). */
  showCheckedInHeader?: boolean;
}

const RISK_ICON: Record<RiskLevel, IconName> = {
  low: 'check-circle',
  moderate: 'info',
  elevated: 'alert-triangle',
};

const RiskLevelCard: React.FC<RiskLevelCardProps> = ({
  level,
  showGuidance = true,
  compact = false,
  showCheckedInHeader = false,
}) => {
  const { colors } = useTheme();
  const display = getRiskLevelDisplay(level);
  const icon = RISK_ICON[level];

  // Themed, dark-aware accent per level (ignores the service's hardcoded hue).
  const accent =
    level === 'low' ? colors.success : level === 'elevated' ? colors.warning : colors.info;
  const accentTint =
    level === 'low' ? colors.successLight : level === 'elevated' ? colors.warningLight : colors.infoLight;

  // Animated accent bar
  const barScale = useSharedValue(0);
  useEffect(() => {
    barScale.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });
  }, [level]);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: barScale.value }] }));

  // ── Compact pill ──────────────────────────────────────────────────────
  if (compact) {
    return (
      <Animated.View entering={FadeIn.duration(300)}>
        <View style={[styles.compactRow, { backgroundColor: accentTint }]}>
          <Icon name={icon} size={16} color={accent} />
          <Text style={[styles.compactLabel, { color: accent }]}>{display.label}</Text>
        </View>
      </Animated.View>
    );
  }

  // ── Full card ─────────────────────────────────────────────────────────
  return (
    <Animated.View
      entering={FadeInUp.duration(450)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, Shadows.sm]}
    >
      {/* Left accent bar */}
      <Animated.View style={[styles.accentBar, { backgroundColor: accent }, barStyle]} />

      <View style={styles.body}>
        {/* Optional "checked in today" confirmation */}
        {showCheckedInHeader && (
          <View style={styles.checkedInRow}>
            <Icon name="check-circle" size={15} color={colors.success} />
            <Text style={[styles.checkedInText, { color: colors.textSecondary }]}>Checked in today</Text>
          </View>
        )}

        {/* Header row: icon chip + label + description */}
        <View style={styles.headerRow}>
          <View style={[styles.iconChip, { backgroundColor: accentTint }]}>
            <Icon name={icon} size={24} color={accent} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.levelLabel, { color: accent }]}>{display.label} Health Awareness</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{display.description}</Text>
          </View>
        </View>

        {/* Guidance box */}
        {showGuidance && (
          <View style={[styles.guidanceBox, { backgroundColor: colors.surfaceSunken }]}>
            <View style={styles.guidanceTitleRow}>
              <Icon name="lightbulb" size={16} color={colors.text} />
              <Text style={[styles.guidanceTitle, { color: colors.text }]}>What you can do</Text>
            </View>
            <Text style={[styles.guidanceText, { color: colors.textSecondary }]}>{display.guidance}</Text>
          </View>
        )}

        {/* Disclaimer */}
        <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
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
    borderRadius: BorderRadius.pill,
    alignSelf: 'flex-start',
  },
  compactLabel: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },

  // ── Full card ─────────────────────────────────────────────────────────
  card: {
    flexDirection: 'row',
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginVertical: Spacing.md,
  },
  accentBar: {
    width: 5,
  },
  body: {
    flex: 1,
    padding: Spacing.lg,
  },
  checkedInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: Spacing.md,
  },
  checkedInText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  iconChip: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  levelLabel: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
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
    marginLeft: 24,
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
