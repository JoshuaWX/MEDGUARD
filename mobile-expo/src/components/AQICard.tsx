/**
 * AQICard Component
 * Displays Air Quality Index with health recommendations
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { BorderRadius, Spacing, Shadows, FontFamily, FontSize, useThemedColors } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import Icon, { type IconName } from './Icon';

export type AQILevel = 'good' | 'fair' | 'moderate' | 'poor' | 'very_poor';

/**
 * AQI Insight data structure
 * 
 * NOTE: AQI is calculated using a health-first, "worst pollutant" approach:
 *   Priority: PM2.5 > PM10 > CO > NO₂
 * 
 * The dominantPollutant field indicates which pollutant drove the AQI calculation.
 * This ensures particulate matter (most health-critical) is never masked by
 * lower-priority pollutants like NO₂.
 */
export interface AQIInsight {
  level: AQILevel;
  levelKey: string;
  description: string;
  healthImplications: string;
  recommendations: string[];
  sensitiveGroups: string[];
  pollutants?: {
    pm2_5?: { value: number; status: string };
    pm10?: { value: number; status: string };
    o3?: { value: number; status: string };
    no2?: { value: number; status: string };
    co?: { value: number; status: string };
  };
  /** Which pollutant drove the overall AQI (e.g., "PM2.5", "PM10", "CO", "NO₂") */
  dominantPollutant?: string;
}

interface AQICardProps {
  aqi: number;
  insight: AQIInsight;
  style?: ViewStyle;
  compact?: boolean;
}

const aqiConfig: Record<AQILevel, {
  color: string;
  icon: IconName;
  label: string;
}> = {
  good: { color: '#2FB187', icon: 'leaf', label: 'Good' },
  fair: { color: '#4FA85F', icon: 'sun', label: 'Fair' },
  moderate: { color: '#E0A32C', icon: 'cloud', label: 'Moderate' },
  poor: { color: '#E4574C', icon: 'wind', label: 'Poor' },
  very_poor: { color: '#8B7BE8', icon: 'alert-triangle', label: 'Very Poor' },
};

const AQICard: React.FC<AQICardProps> = ({
  aqi,
  insight,
  style,
  compact = false,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);
  const config = aqiConfig[insight.level];

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: themed.surface, borderColor: themed.border },
        Shadows.sm,
        style,
      ]}
    >
      {/* Header with AQI Value */}
      <View style={styles.header}>
        <View style={styles.aqiSection}>
          <View style={[styles.aqiCircle, { backgroundColor: config.color }]}>
            <Icon name={config.icon} size={compact ? 20 : 28} color="#fff" />
            <Text style={styles.aqiLabel}>{compact ? config.label : 'Air Quality'}</Text>
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.levelRow}>
            <Text style={[styles.levelText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
          <Text style={[styles.description, { color: themed.text }]}>
            {insight.description}
          </Text>
          <Text style={[styles.implications, { color: themed.textSecondary }]}>
            {insight.healthImplications}
          </Text>
        </View>
      </View>

      {/* Pollutant Breakdown (if available and not compact) */}
      {!compact && insight.pollutants && (
        <View style={styles.pollutantsContainer}>
          <View style={styles.pollutantHeader}>
            <Text style={[styles.sectionTitle, { color: themed.text }]}>
              Pollutant Levels
            </Text>
            {insight.dominantPollutant && (
              <Text style={[styles.dominantLabel, { color: config.color }]}>
                Primary: {insight.dominantPollutant}
              </Text>
            )}
          </View>
          <View style={styles.pollutantsGrid}>
            {/* PM2.5 first - highest priority for health */}
            {insight.pollutants.pm2_5 && (
              <PollutantBadge
                label="PM2.5"
                value={insight.pollutants.pm2_5.value}
                status={insight.pollutants.pm2_5.status}
                unit="μg/m³"
                themed={themed}
                isPrimary={insight.dominantPollutant === 'PM2.5'}
              />
            )}
            {insight.pollutants.pm10 && (
              <PollutantBadge
                label="PM10"
                value={insight.pollutants.pm10.value}
                status={insight.pollutants.pm10.status}
                unit="μg/m³"
                themed={themed}
                isPrimary={insight.dominantPollutant === 'PM10'}
              />
            )}
            {insight.pollutants.co && (
              <PollutantBadge
                label="CO"
                value={insight.pollutants.co.value}
                status={insight.pollutants.co.status}
                unit="μg/m³"
                themed={themed}
                isPrimary={insight.dominantPollutant === 'CO'}
              />
            )}
            {insight.pollutants.o3 && (
              <PollutantBadge
                label="O₃"
                value={insight.pollutants.o3.value}
                status={insight.pollutants.o3.status}
                unit="μg/m³"
                themed={themed}
              />
            )}
            {insight.pollutants.no2 && (
              <PollutantBadge
                label="NO₂"
                value={insight.pollutants.no2.value}
                status={insight.pollutants.no2.status}
                unit="μg/m³"
                themed={themed}
                isPrimary={insight.dominantPollutant === 'NO₂'}
              />
            )}
          </View>
        </View>
      )}

      {/* Recommendations (if not compact) */}
      {!compact && insight.recommendations.length > 0 && (
        <View style={styles.recommendationsContainer}>
          <Text style={[styles.sectionTitle, { color: themed.text }]}>
            Recommendations
          </Text>
          {insight.recommendations.slice(0, 3).map((rec, idx) => (
            <View key={idx} style={styles.recommendationRow}>
              <View style={styles.recIcon}>
                <Icon name="check-circle" size={16} color={themed.primary} />
              </View>
              <Text style={[styles.recommendationText, { color: themed.textSecondary }]}>
                {rec}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Sensitive Groups Warning (if applicable) */}
      {!compact && insight.sensitiveGroups.length > 0 && (
        <View style={[styles.warningBox, { backgroundColor: themed.warningLight }]}>
          <Icon name="users" size={16} color={themed.warning} />
          <Text style={[styles.warningText, { color: themed.textSecondary }]}>
            <Text style={{ fontFamily: FontFamily.semibold }}>Sensitive groups: </Text>
            {insight.sensitiveGroups.join(', ')}
          </Text>
        </View>
      )}
    </View>
  );
};

interface PollutantBadgeProps {
  label: string;
  value: number;
  status: string;
  unit: string;
  themed: ReturnType<typeof useThemedColors>;
  /** Highlight this pollutant as the one driving the AQI */
  isPrimary?: boolean;
}

const statusColors: Record<string, string> = {
  Good: '#2FB187',
  Fair: '#4FA85F',
  Moderate: '#E0A32C',
  Poor: '#E4574C',
  Hazardous: '#8B7BE8',
};

const PollutantBadge: React.FC<PollutantBadgeProps> = ({ label, value, status, unit, themed, isPrimary }) => {
  const statusColor = statusColors[status] || themed.textSecondary;
  
  return (
    <View style={[
      styles.pollutantBadge, 
      { borderColor: statusColor },
      isPrimary && styles.pollutantBadgePrimary,
    ]}>
      <View style={styles.pollutantLabelRow}>
        <Text style={[styles.pollutantLabel, { color: themed.textSecondary }]}>{label}</Text>
        {isPrimary && (
          <View style={[styles.primaryIndicator, { backgroundColor: statusColor }]} />
        )}
      </View>
      <Text style={[styles.pollutantValue, { color: themed.text }]}>
        {value.toFixed(1)}
      </Text>
      <Text style={[styles.pollutantUnit, { color: themed.textMuted }]}>{unit}</Text>
      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aqiSection: {
    marginRight: Spacing.md,
  },
  aqiCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  aqiValue: {
    fontSize: 24,
    fontFamily: FontFamily.bold,
    color: '#ffffff',
  },
  aqiLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: -2,
  },
  infoSection: {
    flex: 1,
  },
  levelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  levelText: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.bold,
    marginLeft: Spacing.xs,
  },
  description: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    marginBottom: 4,
  },
  implications: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    lineHeight: 16,
  },
  pollutantsContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  pollutantHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  dominantLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
  },
  pollutantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  pollutantBadge: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    minWidth: 70,
  },
  pollutantBadgePrimary: {
    borderWidth: 2,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
  },
  pollutantLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  primaryIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pollutantLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.semibold,
  },
  pollutantValue: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.bold,
    marginVertical: 2,
  },
  pollutantUnit: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 4,
  },
  recommendationsContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  recommendationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.xs,
  },
  recIcon: {
    marginRight: Spacing.xs,
    marginTop: 2,
  },
  recommendationText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    lineHeight: 20,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.md,
  },
  warningText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.regular,
    marginLeft: Spacing.xs,
    lineHeight: 16,
  },
});

export default AQICard;
