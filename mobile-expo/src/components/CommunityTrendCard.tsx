/**
 * CommunityTrendCard Component
 * 
 * Displays community health trend insights for the user's state.
 * 
 * PUBLIC HEALTH REASONING:
 * - Informational only, never diagnostic
 * - No disease labels or outbreak language
 * - Anonymous aggregate data
 * - Encourages preventive measures
 * - Clear disclaimer about data limitations
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
import { CommunityTrend } from '../services/healthCheckin';

interface CommunityTrendCardProps {
  trend: CommunityTrend | null;
  message: string | null;
  state: string;
}

const CommunityTrendCard: React.FC<CommunityTrendCardProps> = ({
  trend,
  message,
  state,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);

  // Not enough data
  if (!trend || trend.totalCheckins < 5) {
    return (
      <Animated.View
        entering={FadeInUp.duration(400)}
        style={[styles.container, { backgroundColor: themed.surface }]}
      >
        <View style={styles.header}>
          <Text style={styles.icon}>📊</Text>
          <Text style={[styles.title, { color: themed.text }]}>
            Community Health Insights
          </Text>
        </View>
        <Text style={[styles.noDataText, { color: themed.textSecondary }]}>
          Not enough check-ins from {state} yet this week. Check back as more users participate!
        </Text>
        <Text style={[styles.privacy, { color: themed.textMuted }]}>
          🔒 All community data is anonymous and aggregated
        </Text>
      </Animated.View>
    );
  }

  // Get trend direction icon
  const getTrendIcon = () => {
    switch (trend.trendDirection) {
      case 'increasing':
        return '📈';
      case 'decreasing':
        return '📉';
      default:
        return '📊';
    }
  };

  // Calculate percentages for visualization
  const total = trend.riskDistribution.low + trend.riskDistribution.moderate + trend.riskDistribution.elevated;
  const lowPercent = total > 0 ? Math.round((trend.riskDistribution.low / total) * 100) : 0;
  const moderatePercent = total > 0 ? Math.round((trend.riskDistribution.moderate / total) * 100) : 0;
  const elevatedPercent = total > 0 ? Math.round((trend.riskDistribution.elevated / total) * 100) : 0;

  return (
    <Animated.View
      entering={FadeInUp.duration(400)}
      style={[styles.container, { backgroundColor: themed.surface }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.icon}>{getTrendIcon()}</Text>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: themed.text }]}>
            Community Health Insights
          </Text>
          <Text style={[styles.subtitle, { color: themed.textSecondary }]}>
            {state} · {trend.isoWeek}
          </Text>
        </View>
      </View>

      {/* Trend Message */}
      {message && (
        <View style={[styles.messageBox, { backgroundColor: 'rgba(17, 180, 212, 0.1)' }]}>
          <Text style={[styles.messageText, { color: themed.text }]}>
            {message}
          </Text>
        </View>
      )}

      {/* Risk Distribution */}
      <View style={styles.distributionSection}>
        <Text style={[styles.sectionLabel, { color: themed.textSecondary }]}>
          This week's health check-ins ({trend.totalCheckins} users)
        </Text>
        
        {/* Simple bar chart */}
        <View style={styles.barChart}>
          {lowPercent > 0 && (
            <View style={[styles.bar, styles.barLow, { flex: lowPercent }]} />
          )}
          {moderatePercent > 0 && (
            <View style={[styles.bar, styles.barModerate, { flex: moderatePercent }]} />
          )}
          {elevatedPercent > 0 && (
            <View style={[styles.bar, styles.barElevated, { flex: elevatedPercent }]} />
          )}
        </View>
        
        {/* Legend */}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
            <Text style={[styles.legendText, { color: themed.textSecondary }]}>
              Low {lowPercent}%
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.info }]} />
            <Text style={[styles.legendText, { color: themed.textSecondary }]}>
              Moderate {moderatePercent}%
            </Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
            <Text style={[styles.legendText, { color: themed.textSecondary }]}>
              Elevated {elevatedPercent}%
            </Text>
          </View>
        </View>
      </View>

      {/* Privacy notice */}
      <Text style={[styles.privacy, { color: themed.textMuted }]}>
        🔒 All data is anonymous. Individual responses are never shared.
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    ...Shadows.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  icon: {
    fontSize: 28,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  noDataText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
    marginBottom: Spacing.md,
  },
  messageBox: {
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.base,
  },
  messageText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
  },
  distributionSection: {
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  barChart: {
    flexDirection: 'row',
    height: 12,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  bar: {
    height: '100%',
  },
  barLow: {
    backgroundColor: Colors.success,
  },
  barModerate: {
    backgroundColor: Colors.info,
  },
  barElevated: {
    backgroundColor: Colors.warning,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
  privacy: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
});

export default CommunityTrendCard;
