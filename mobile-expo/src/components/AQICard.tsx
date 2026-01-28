/**
 * AQICard Component
 * Displays Air Quality Index with health recommendations
 */

import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Colors, BorderRadius, Spacing, Shadows, FontFamily, FontSize, useThemedColors } from '../../theme';
import { useTheme } from '../hooks/useTheme';

export type AQILevel = 'good' | 'fair' | 'moderate' | 'poor' | 'very_poor';

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
  };
}

interface AQICardProps {
  aqi: number;
  insight: AQIInsight;
  style?: ViewStyle;
  compact?: boolean;
}

const aqiConfig: Record<AQILevel, {
  colors: readonly [string, string];
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  textColor: string;
}> = {
  good: {
    colors: ['#10b981', '#059669'],
    icon: 'leaf-outline',
    label: 'Good',
    textColor: '#059669',
  },
  fair: {
    colors: ['#22c55e', '#16a34a'],
    icon: 'sunny-outline',
    label: 'Fair',
    textColor: '#16a34a',
  },
  moderate: {
    colors: ['#f59e0b', '#d97706'],
    icon: 'partly-sunny-outline',
    label: 'Moderate',
    textColor: '#d97706',
  },
  poor: {
    colors: ['#ef4444', '#dc2626'],
    icon: 'cloud-outline',
    label: 'Poor',
    textColor: '#dc2626',
  },
  very_poor: {
    colors: ['#7c3aed', '#6d28d9'],
    icon: 'warning-outline',
    label: 'Very Poor',
    textColor: '#6d28d9',
  },
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
        { backgroundColor: isDark ? themed.surface : '#ffffff' },
        Shadows.card,
        style,
      ]}
    >
      {/* Header with AQI Value */}
      <View style={styles.header}>
        <View style={styles.aqiSection}>
          <LinearGradient
            colors={config.colors}
            style={styles.aqiCircle}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name={config.icon} size={compact ? 20 : 28} color="white" />
            <Text style={styles.aqiLabel}>{compact ? config.label : 'Air Quality'}</Text>
          </LinearGradient>
        </View>

        <View style={styles.infoSection}>
          <View style={styles.levelRow}>
            <Text style={[styles.levelText, { color: config.textColor }]}>
              {config.label}
            </Text>
          </View>
          <Text style={[styles.description, { color: themed.text }]}>
            {insight.description}
          </Text>
          <Text style={[styles.implications, { color: themed.textSecondary }]} numberOfLines={2}>
            {insight.healthImplications}
          </Text>
        </View>
      </View>

      {/* Pollutant Breakdown (if available and not compact) */}
      {!compact && insight.pollutants && (
        <View style={styles.pollutantsContainer}>
          <Text style={[styles.sectionTitle, { color: themed.text }]}>
            Pollutant Levels
          </Text>
          <View style={styles.pollutantsGrid}>
            {insight.pollutants.pm2_5 && (
              <PollutantBadge
                label="PM2.5"
                value={insight.pollutants.pm2_5.value}
                status={insight.pollutants.pm2_5.status}
                unit="μg/m³"
                themed={themed}
              />
            )}
            {insight.pollutants.pm10 && (
              <PollutantBadge
                label="PM10"
                value={insight.pollutants.pm10.value}
                status={insight.pollutants.pm10.status}
                unit="μg/m³"
                themed={themed}
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
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={Colors.primary}
                style={styles.recIcon}
              />
              <Text style={[styles.recommendationText, { color: themed.textSecondary }]}>
                {rec}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Sensitive Groups Warning (if applicable) */}
      {!compact && insight.sensitiveGroups.length > 0 && (
        <View style={[styles.warningBox, { backgroundColor: `${Colors.warning}15` }]}>
          <Ionicons name="people-outline" size={16} color={Colors.warning} />
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
}

const statusColors: Record<string, string> = {
  Good: '#10b981',
  Fair: '#22c55e',
  Moderate: '#f59e0b',
  Poor: '#ef4444',
};

const PollutantBadge: React.FC<PollutantBadgeProps> = ({ label, value, status, unit, themed }) => {
  const statusColor = statusColors[status] || themed.textSecondary;
  
  return (
    <View style={[styles.pollutantBadge, { borderColor: statusColor }]}>
      <Text style={[styles.pollutantLabel, { color: themed.textSecondary }]}>{label}</Text>
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
    borderRadius: BorderRadius.lg,
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
  sectionTitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.semibold,
    marginBottom: Spacing.sm,
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
