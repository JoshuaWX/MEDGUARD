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
  interpolateColor,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, Shadows, FontFamily, FontSize, useThemedColors } from '../../theme';
import { useTheme } from '../hooks/useTheme';

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

const riskConfig = {
  high: {
    colors: ['#ef4444', '#dc2626'] as const,
    bgColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: '#ef4444',
    icon: 'warning' as const,
    label: 'HIGH RISK',
  },
  medium: {
    colors: ['#f59e0b', '#d97706'] as const,
    bgColor: 'rgba(245, 158, 11, 0.1)',
    borderColor: '#f59e0b',
    icon: 'alert-circle' as const,
    label: 'MODERATE',
  },
  low: {
    colors: ['#10b981', '#059669'] as const,
    bgColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
    icon: 'checkmark-circle' as const,
    label: 'LOW RISK',
  },
};

const diseaseIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Malaria': 'bug-outline',
  'Cholera': 'water-outline',
  'Typhoid': 'restaurant-outline',
  'Meningitis': 'fitness-outline',
  'Lassa Fever': 'paw-outline',
};

const RiskCard: React.FC<RiskCardProps> = ({
  risk,
  onPress,
  style,
  expanded = false,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  const scale = useSharedValue(1);
  const config = riskConfig[risk.riskLevel];
  const diseaseIcon = diseaseIcons[risk.disease] || 'medical-outline';

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
            backgroundColor: isDark ? themed.surface : '#ffffff',
            borderColor: config.borderColor,
          },
          Shadows.card,
        ]}
      >
        {/* Risk Level Indicator Bar */}
        <LinearGradient
          colors={config.colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.riskBar}
        />

        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.diseaseInfo}>
              <View style={[styles.iconCircle, { backgroundColor: config.bgColor }]}>
                <Ionicons name={diseaseIcon} size={20} color={config.borderColor} />
              </View>
              <View style={styles.titleContainer}>
                <Text style={[styles.diseaseName, { color: themed.text }]}>
                  {risk.disease}
                </Text>
                <View style={[styles.riskBadge, { backgroundColor: config.bgColor }]}>
                  <Ionicons name={config.icon} size={12} color={config.borderColor} />
                  <Text style={[styles.riskLabel, { color: config.borderColor }]}>
                    {config.label}
                  </Text>
                </View>
              </View>
            </View>
            
            {risk.confidence === 'high' && (
              <View style={styles.confidenceBadge}>
                <Ionicons name="shield-checkmark" size={14} color={Colors.primary} />
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
                      <Ionicons
                        name="ellipse"
                        size={6}
                        color={themed.textSecondary}
                        style={styles.bulletIcon}
                      />
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
                      <Ionicons
                        name="checkmark-circle-outline"
                        size={16}
                        color={Colors.success}
                        style={styles.actionIcon}
                      />
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
              <Text style={[styles.expandText, { color: Colors.primary }]}>
                Tap for details
              </Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
            </View>
          )}
        </View>
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
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
  bulletIcon: {
    marginTop: 6,
    marginRight: Spacing.xs,
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
