/**
 * RiskLevelCard Component
 * 
 * Displays the calculated health risk level with guidance.
 * 
 * PUBLIC HEALTH REASONING:
 * - Clear visual hierarchy for risk communication
 * - Non-alarmist colors and language
 * - Actionable guidance without diagnosis
 * - Subtle disclaimer to avoid medical certainty
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
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

const RiskLevelCard: React.FC<RiskLevelCardProps> = ({
  level,
  showGuidance = true,
  compact = false,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  const display = getRiskLevelDisplay(level);

  const getBackgroundColor = () => {
    switch (level) {
      case 'elevated':
        return 'rgba(245, 158, 11, 0.1)';  // Amber tint
      case 'moderate':
        return 'rgba(59, 130, 246, 0.1)';  // Blue tint
      case 'low':
      default:
        return 'rgba(16, 185, 129, 0.1)';  // Green tint
    }
  };

  const getIcon = () => {
    switch (level) {
      case 'elevated':
        return '⚠️';
      case 'moderate':
        return 'ℹ️';
      case 'low':
      default:
        return '✅';
    }
  };

  if (compact) {
    return (
      <View style={[styles.compactContainer, { backgroundColor: getBackgroundColor() }]}>
        <Text style={styles.compactIcon}>{getIcon()}</Text>
        <Text style={[styles.compactLabel, { color: display.color }]}>
          {display.label} Risk
        </Text>
      </View>
    );
  }

  return (
    <Animated.View
      entering={FadeInUp.duration(400)}
      style={[styles.container, { backgroundColor: getBackgroundColor() }]}
    >
      {/* Risk Level Header */}
      <View style={styles.header}>
        <Text style={styles.icon}>{getIcon()}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.levelLabel, { color: display.color }]}>
            {display.label} Health Awareness
          </Text>
          <Text style={[styles.description, { color: themed.textSecondary }]}>
            {display.description}
          </Text>
        </View>
      </View>

      {/* Guidance */}
      {showGuidance && (
        <View style={[styles.guidanceBox, { backgroundColor: themed.surface }]}>
          <Text style={[styles.guidanceTitle, { color: themed.text }]}>
            💡 What you can do
          </Text>
          <Text style={[styles.guidanceText, { color: themed.textSecondary }]}>
            {display.guidance}
          </Text>
        </View>
      )}

      {/* Disclaimer */}
      <Text style={[styles.disclaimer, { color: themed.textMuted }]}>
        This is for awareness only and is not a medical diagnosis. Consult a healthcare provider for medical advice.
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginVertical: Spacing.md,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  icon: {
    fontSize: 32,
    marginTop: 2,
  },
  headerText: {
    flex: 1,
  },
  levelLabel: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
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
  guidanceTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    marginBottom: Spacing.xs,
  },
  guidanceText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.6,
  },
  disclaimer: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: FontSize.xs * 1.5,
  },
  // Compact variant
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    alignSelf: 'flex-start',
  },
  compactIcon: {
    fontSize: FontSize.base,
  },
  compactLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
});

export default RiskLevelCard;
