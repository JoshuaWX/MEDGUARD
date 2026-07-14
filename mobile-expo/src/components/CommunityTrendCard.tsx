/**
 * CommunityTrendCard Component (v3 — Professional)
 *
 * DESIGN:
 * - Professional Ionicons throughout (no emojis)
 * - stats-chart icon in header circle
 * - Per-symptom animated horizontal bars with icon labels
 * - Stacked risk distribution bar with legend dots
 * - Trend direction badges with trending-up/down icons
 * - Privacy footer with lock icon
 * - Message box with chat icon
 *
 * PUBLIC HEALTH REASONING:
 * - Informational only, never diagnostic
 * - No disease labels or outbreak language
 * - Anonymous aggregate data with clear privacy notice
 * - Encourages preventive measures
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
import { CommunityTrend } from '../services/healthCheckin';

interface CommunityTrendCardProps {
  trend: CommunityTrend | null;
  /** Previous ISO week (for week-over-week symptom deltas). Optional. */
  prevTrend?: CommunityTrend | null;
  message: string | null;
  state: string;
}

// Symptom config: icon name, label, accent color
const SYMPTOM_BARS = [
  { key: 'fever' as const, label: 'Fever', icon: 'thermometer-outline', color: '#ef4444' },
  { key: 'headache' as const, label: 'Headache', icon: 'pulse-outline', color: '#8b5cf6' },
  { key: 'fatigue' as const, label: 'Fatigue', icon: 'moon-outline', color: '#6366f1' },
  { key: 'digestive' as const, label: 'Digestive', icon: 'nutrition-outline', color: '#f59e0b' },
  { key: 'waterExposure' as const, label: 'Water exp.', icon: 'water-outline', color: '#0ea5e9' },
  { key: 'sickContact' as const, label: 'Sick contact', icon: 'people-outline', color: '#ec4899' },
];

const TREND_BADGES: Record<string, { label: string; icon: string; color: string }> = {
  increasing: { label: 'Increasing', icon: 'trending-up', color: '#f59e0b' },
  decreasing: { label: 'Decreasing', icon: 'trending-down', color: '#10b981' },
  stable: { label: 'Stable', icon: 'remove-outline', color: '#6b7280' },
};

// =====================================================================
// Animated horizontal bar sub-component
// =====================================================================
const AnimatedBar: React.FC<{
  ratio: number; // 0–1
  color: string;
}> = ({ ratio, color }) => {
  const width = useSharedValue(0);
  useEffect(() => {
    width.value = withTiming(ratio, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [ratio]);

  const style = useAnimatedStyle(() => ({
    width: `${Math.round(width.value * 100)}%`,
    backgroundColor: color,
  }));

  return (
    <View style={barStyles.track}>
      <Animated.View style={[barStyles.fill, style]} />
    </View>
  );
};

const barStyles = StyleSheet.create({
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});

// =====================================================================
// Main Component
// =====================================================================
const CommunityTrendCard: React.FC<CommunityTrendCardProps> = ({
  trend,
  prevTrend,
  message,
  state,
}) => {
  const { isDark } = useTheme();
  const themed = useThemedColors(isDark);

  // ── No data state ─────────────────────────────────────────────────
  if (!trend || trend.totalCheckins < 5) {
    return (
      <Animated.View
        entering={FadeInUp.duration(400)}
        style={[styles.card, { backgroundColor: themed.surface }]}
      >
        <View style={styles.headerRow}>
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: isDark ? Colors.whiteAlpha10 : '#f0f9ff' },
            ]}
          >
            <Ionicons name="stats-chart" size={22} color={Colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: themed.text }]}>
              Community Health Insights
            </Text>
            <Text style={[styles.subtitle, { color: themed.textSecondary }]}>
              {state}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.emptyBox,
            {
              backgroundColor: isDark ? Colors.whiteAlpha10 : '#f8fafc',
            },
          ]}
        >
          <Ionicons
            name="search-outline"
            size={36}
            color={themed.textSecondary}
            style={{ marginBottom: Spacing.sm }}
          />
          <Text style={[styles.emptyTitle, { color: themed.text }]}>
            Not enough data yet
          </Text>
          <Text style={[styles.emptyDesc, { color: themed.textSecondary }]}>
            Check back as more users in {state} complete their daily check-ins.
          </Text>
        </View>

        <View style={styles.privacyRow}>
          <Ionicons name="lock-closed-outline" size={14} color={themed.textMuted} />
          <Text style={[styles.privacy, { color: themed.textMuted }]}>
            All community data is anonymous and aggregated
          </Text>
        </View>
      </Animated.View>
    );
  }

  // ── Computed values ───────────────────────────────────────────────
  const total = trend.totalCheckins;
  const trendBadge = trend.trendDirection
    ? TREND_BADGES[trend.trendDirection]
    : null;

  const riskTotal =
    trend.riskDistribution.low +
    trend.riskDistribution.moderate +
    trend.riskDistribution.elevated;
  const lowPct =
    riskTotal > 0
      ? Math.round((trend.riskDistribution.low / riskTotal) * 100)
      : 0;
  const modPct =
    riskTotal > 0
      ? Math.round((trend.riskDistribution.moderate / riskTotal) * 100)
      : 0;
  const elvPct =
    riskTotal > 0
      ? Math.round((trend.riskDistribution.elevated / riskTotal) * 100)
      : 0;

  // Scale bars relative to max symptom count
  const maxCount = Math.max(
    ...SYMPTOM_BARS.map((s) => trend.symptomCounts[s.key]),
    1,
  );

  // Most reported symptom this week (informational, non-diagnostic)
  const notable = SYMPTOM_BARS.map((s) => ({
    ...s,
    count: trend.symptomCounts[s.key],
  })).sort((a, b) => b.count - a.count)[0];
  const notablePct =
    notable && notable.count > 0 && total > 0
      ? Math.round((notable.count / total) * 100)
      : 0;

  // Week-over-week participation (uses prevWeekTotal from the aggregate)
  const participationDelta =
    trend.prevWeekTotal != null ? total - trend.prevWeekTotal : null;

  return (
    <Animated.View
      entering={FadeInUp.duration(450)}
      style={[styles.card, { backgroundColor: themed.surface }]}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.iconCircle,
            { backgroundColor: isDark ? Colors.whiteAlpha10 : '#f0f9ff' },
          ]}
        >
          <Ionicons name="stats-chart" size={22} color={Colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: themed.text }]}>
            Community Health Insights
          </Text>
          <Text style={[styles.subtitle, { color: themed.textSecondary }]}>
            {state} · {trend.isoWeek}
          </Text>
        </View>
        {/* Participants pill */}
        <View
          style={[
            styles.participantPill,
            {
              backgroundColor: isDark ? Colors.whiteAlpha10 : '#f1f5f9',
            },
          ]}
        >
          <Text style={[styles.participantCount, { color: themed.text }]}>
            {total}
          </Text>
          <Text style={[styles.participantLabel, { color: themed.textSecondary }]}>
            users
          </Text>
        </View>
      </View>

      {/* ── Trend direction badge ──────────────────────────────────── */}
      {trendBadge && (
        <Animated.View entering={FadeIn.delay(200).duration(300)}>
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor: trendBadge.color + '14',
                borderColor: trendBadge.color + '30',
              },
            ]}
          >
            <Ionicons
              name={trendBadge.icon as any}
              size={16}
              color={trendBadge.color}
            />
            <Text style={[styles.trendLabel, { color: trendBadge.color }]}>
              {trendBadge.label} from last week
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── Trend message ──────────────────────────────────────────── */}
      {message && (
        <Animated.View entering={FadeIn.delay(250).duration(300)}>
          <View
            style={[
              styles.messageBox,
              {
                backgroundColor: isDark
                  ? 'rgba(17,180,212,0.08)'
                  : 'rgba(17,180,212,0.06)',
              },
            ]}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={Colors.primary}
              style={{ marginTop: 2 }}
            />
            <Text style={[styles.messageText, { color: themed.text }]}>
              {message}
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── Most reported callout ──────────────────────────────────── */}
      {notable && notable.count > 0 && (
        <Animated.View entering={FadeIn.delay(280).duration(300)}>
          <View
            style={[
              styles.notableBox,
              { backgroundColor: notable.color + (isDark ? '18' : '12') },
            ]}
          >
            <Ionicons name={notable.icon as any} size={18} color={notable.color} />
            <Text style={[styles.notableText, { color: themed.text }]}>
              <Text style={styles.notableStrong}>Most reported this week:</Text>{' '}
              {notable.label} · {notablePct}% of check-ins
            </Text>
          </View>
        </Animated.View>
      )}

      {/* ── Symptom breakdown bars ─────────────────────────────────── */}
      <View style={styles.section}>
        <View style={styles.sectionHeaderRow}>
          <Text style={[styles.sectionLabel, { color: themed.textSecondary }]}>
            REPORTED SYMPTOMS
          </Text>
          {prevTrend && (
            <Text style={[styles.sectionHint, { color: themed.textMuted }]}>
              vs last week
            </Text>
          )}
        </View>
        {SYMPTOM_BARS.map((s, i) => {
          const count = trend.symptomCounts[s.key];
          if (count === 0) return null;
          const pct =
            total > 0 ? Math.round((count / total) * 100) : 0;
          const prevCount = prevTrend ? prevTrend.symptomCounts[s.key] : null;
          const delta = prevCount != null ? count - prevCount : null;
          return (
            <Animated.View
              key={s.key}
              entering={FadeInUp.delay(300 + i * 60).duration(350)}
            >
              <View style={styles.barRow}>
                <Ionicons
                  name={s.icon as any}
                  size={16}
                  color={s.color}
                  style={{ width: 22, textAlign: 'center' as const }}
                />
                <Text style={[styles.barLabel, { color: themed.text }]}>
                  {s.label}
                </Text>
                <AnimatedBar ratio={count / maxCount} color={s.color} />
                <Text style={[styles.barPct, { color: themed.textSecondary }]}>
                  {pct}%
                </Text>
                {delta != null && (
                  <View style={styles.deltaCell}>
                    {delta === 0 ? (
                      <Ionicons name="remove-outline" size={13} color={themed.textMuted} />
                    ) : (
                      <>
                        <Ionicons
                          name={delta > 0 ? 'arrow-up' : 'arrow-down'}
                          size={12}
                          color={delta > 0 ? '#f59e0b' : '#10b981'}
                        />
                        <Text
                          style={[
                            styles.deltaText,
                            { color: delta > 0 ? '#f59e0b' : '#10b981' },
                          ]}
                        >
                          {Math.abs(delta)}
                        </Text>
                      </>
                    )}
                  </View>
                )}
              </View>
            </Animated.View>
          );
        })}
        {participationDelta != null && (
          <Text style={[styles.participationLine, { color: themed.textMuted }]}>
            {total} check-in{total === 1 ? '' : 's'} this week
            {participationDelta === 0
              ? ' · same as last week'
              : ` · ${participationDelta > 0 ? '+' : ''}${participationDelta} vs last week`}
          </Text>
        )}
      </View>

      {/* ── Risk distribution stacked bar ──────────────────────────── */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: themed.textSecondary }]}>
          RISK DISTRIBUTION
        </Text>
        <View style={styles.stackedBar}>
          {lowPct > 0 && (
            <View
              style={[styles.stackSeg, styles.segLow, { flex: lowPct }]}
            />
          )}
          {modPct > 0 && (
            <View
              style={[styles.stackSeg, styles.segMod, { flex: modPct }]}
            />
          )}
          {elvPct > 0 && (
            <View
              style={[styles.stackSeg, styles.segElv, { flex: elvPct }]}
            />
          )}
        </View>
        <View style={styles.legendRow}>
          <LegendDot
            color="#10b981"
            label={`Low ${lowPct}%`}
            themed={themed}
          />
          <LegendDot
            color="#3b82f6"
            label={`Moderate ${modPct}%`}
            themed={themed}
          />
          <LegendDot
            color="#f59e0b"
            label={`Elevated ${elvPct}%`}
            themed={themed}
          />
        </View>
      </View>

      {/* ── Privacy footer ─────────────────────────────────────────── */}
      <View style={styles.privacyRow}>
        <Ionicons
          name="lock-closed-outline"
          size={14}
          color={themed.textMuted}
        />
        <Text style={[styles.privacy, { color: themed.textMuted }]}>
          All data is anonymous. Individual responses are never shared.
        </Text>
      </View>
    </Animated.View>
  );
};

// Small legend dot helper
const LegendDot: React.FC<{
  color: string;
  label: string;
  themed: any;
}> = ({ color, label, themed }) => (
  <View style={styles.legendItem}>
    <View style={[styles.dot, { backgroundColor: color }]} />
    <Text style={[styles.legendText, { color: themed.textSecondary }]}>
      {label}
    </Text>
  </View>
);

// =====================================================================
// Styles
// =====================================================================
const styles = StyleSheet.create({
  card: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.xl,
    ...Shadows.sm,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.base,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.lg },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  participantPill: {
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  participantCount: { fontFamily: FontFamily.bold, fontSize: FontSize.base },
  participantLabel: { fontFamily: FontFamily.regular, fontSize: 10 },

  // Trend badge
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    marginBottom: Spacing.base,
  },
  trendLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },

  // Message box
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.base,
  },
  messageText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
    flex: 1,
  },

  // Most reported callout
  notableBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.base,
  },
  notableText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.4,
  },
  notableStrong: { fontFamily: FontFamily.semibold },

  // Sections
  section: { marginBottom: Spacing.base },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 11,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  sectionHint: {
    fontFamily: FontFamily.regular,
    fontSize: 10,
    fontStyle: 'italic',
  },
  deltaCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    width: 30,
    justifyContent: 'flex-end',
  },
  deltaText: { fontFamily: FontFamily.semibold, fontSize: 11 },
  participationLine: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 4,
  },

  // Symptom bars
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 8,
  },
  barLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    width: 76,
  },
  barPct: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    width: 36,
    textAlign: 'right',
  },

  // Stacked risk bar
  stackedBar: {
    flexDirection: 'row',
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: Spacing.sm,
  },
  stackSeg: { height: '100%' },
  segLow: { backgroundColor: '#10b981' },
  segMod: { backgroundColor: '#3b82f6' },
  segElv: { backgroundColor: '#f59e0b' },

  // Legend
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: FontFamily.regular, fontSize: FontSize.xs },

  // Empty state
  emptyBox: {
    alignItems: 'center',
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.base,
  },
  emptyTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    marginBottom: 4,
  },
  emptyDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.5,
  },

  // Privacy
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: Spacing.sm,
  },
  privacy: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
});

export default CommunityTrendCard;
