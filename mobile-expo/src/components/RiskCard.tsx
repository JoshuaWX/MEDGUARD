/**
 * RiskCard Component
 * Displays disease risk assessments with visual indicators
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { BorderRadius, Spacing, Shadows, FontFamily, FontSize } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import Icon, { type IconName } from './Icon';

export type RiskLevel = 'low' | 'medium' | 'high';

export interface DiseaseRisk {
  disease: string;
  diseaseKey: string;
  riskLevel: RiskLevel;
  confidence: 'low' | 'medium' | 'high';
  reasons: string[];
  actions: string[];
  sources: string[];
  isActive: boolean;
  priority: number;
}

interface RiskCardProps {
  risk: DiseaseRisk;
  onPress?: () => void;
  style?: ViewStyle;
  expanded?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const riskMeta: Record<RiskLevel, { icon: IconName; label: string }> = {
  high: { icon: 'alert-triangle', label: 'HIGH RISK' },
  medium: { icon: 'alert-circle', label: 'MODERATE' },
  low: { icon: 'check-circle', label: 'LOW RISK' },
};

const diseaseIcons: Record<string, IconName> = {
  Malaria: 'bug',
  Cholera: 'droplet',
  Typhoid: 'utensils',
  Meningitis: 'activity',
  'Lassa Fever': 'thermometer',
};

const RiskCard: React.FC<RiskCardProps> = ({
  risk,
  onPress,
  style,
  expanded = false,
}) => {
  const { colors: themed } = useTheme();
  const scale = useSharedValue(1);
  const meta = riskMeta[risk.riskLevel];
  const accent =
    risk.riskLevel === 'high' ? themed.danger : risk.riskLevel === 'medium' ? themed.warning : themed.success;
  const accentTint =
    risk.riskLevel === 'high' ? themed.dangerLight : risk.riskLevel === 'medium' ? themed.warningLight : themed.successLight;
  const diseaseIcon: IconName = diseaseIcons[risk.disease] || 'heart-pulse';

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[animatedStyle, style]}
    >
      <View
        style={[
          styles.container,
          {
            backgroundColor: themed.surface,
            borderColor: themed.border,
            borderLeftColor: accent,
          },
          Shadows.sm,
        ]}
      >
        {/* Risk level accent strip */}
        <View style={[styles.riskBar, { backgroundColor: accent }]} />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.diseaseInfo}>
              <View style={[styles.iconCircle, { backgroundColor: accentTint }]}>
                <Icon name={diseaseIcon} size={20} color={accent} />
              </View>
              <View style={styles.titleContainer}>
                <Text style={[styles.diseaseName, { color: themed.text }]}>
                  {risk.disease}
                </Text>
                <View style={[styles.riskBadge, { backgroundColor: accentTint }]}>
                  <Icon name={meta.icon} size={12} color={accent} />
                  <Text style={[styles.riskLabel, { color: accent }]}>
                    {meta.label}
                  </Text>
                </View>
              </View>
            </View>

            {risk.confidence === 'high' && (
              <View style={styles.confidenceBadge}>
                <Icon name="shield-check" size={14} color={themed.primary} />
              </View>
            )}
          </View>

          {/* Primary Reason */}
          {risk.reasons.length > 0 && (
            <Text style={[styles.reason, { color: themed.textSecondary }]}>
              {risk.reasons[0]}
            </Text>
          )}

          {/* Expanded Content */}
          {expanded && (
            <>
              {/* Additional Reasons */}
              {risk.reasons.length > 1 && (
                <View style={styles.additionalReasons}>
                  {risk.reasons.slice(1).map((reason, idx) => (
                    <View key={idx} style={styles.reasonRow}>
                      <View style={[styles.bulletDot, { backgroundColor: themed.textMuted }]} />
                      <Text style={[styles.reasonText, { color: themed.textSecondary }]}>
                        {reason}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Actions */}
              {risk.actions.length > 0 && (
                <View style={styles.actionsContainer}>
                  <Text style={[styles.actionsHeader, { color: themed.text }]}>
                    Recommendations
                  </Text>
                  {risk.actions.slice(0, 3).map((action, idx) => (
                    <View key={idx} style={styles.actionRow}>
                      <View style={styles.actionIcon}>
                        <Icon name="check-circle" size={16} color={themed.success} />
                      </View>
                      <Text style={[styles.actionText, { color: themed.textSecondary }]}>
                        {action}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Sources */}
              {risk.sources.length > 0 && (
                <Text style={[styles.sources, { color: themed.textMuted }]}>
                  Sources: {risk.sources.join(', ')}
                </Text>
              )}
            </>
          )}

          {/* Expand indicator */}
          {!expanded && (risk.reasons.length > 1 || risk.actions.length > 0) && (
            <View style={styles.expandHint}>
              <Text style={[styles.expandText, { color: themed.primary }]}>
                Tap for details
              </Text>
              <Icon name="chevron-right" size={14} color={themed.primary} />
            </View>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    overflow: 'hidden',
  },
  riskBar: {
    height: 3,
    width: '100%',
  },
  content: {
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
  },
  diseaseInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  titleContainer: {
    flex: 1,
  },
  diseaseName: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.bold,
    marginBottom: 4,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
    alignSelf: 'flex-start',
  },
  riskLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  confidenceBadge: {
    padding: Spacing.xs,
  },
  reason: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  additionalReasons: {
    marginTop: Spacing.sm,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 7,
    marginRight: Spacing.sm,
  },
  reasonText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
  actionsContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  actionsHeader: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    marginBottom: Spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  actionIcon: {
    marginRight: Spacing.xs,
    marginTop: 2,
  },
  actionText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  sources: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    marginTop: Spacing.md,
    fontStyle: 'italic',
  },
  expandHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: Spacing.sm,
  },
  expandText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
  },
});

export default RiskCard;
