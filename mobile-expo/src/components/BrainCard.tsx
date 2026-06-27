/**
 * BrainCard Component (MedGuard Brain v1 — Phase 6)
 *
 * Read-only presentation of the Brain area/community intelligence summary.
 * - Non-alarmist palette (amber for elevated, not red).
 * - Shows risk level + confidence, a safe summary, and recommended actions.
 * - Always renders the safety stance (awareness, not diagnosis).
 *
 * The component does NOT compute anything; it renders the BrainResult provided
 * by the intel Edge Function.
 */

import React, { useState } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import {
  Colors,
  BorderRadius,
  Spacing,
  FontFamily,
  FontSize,
  useThemedColors,
} from '../../theme';
import { useTheme } from '../hooks/useTheme';
import { BrainResult, BrainRiskLevel } from '../services/brain';

interface BrainCardProps {
  brain: BrainResult | null | undefined;
  /** Compact variant hides the actions list (e.g. for Map callouts). */
  compact?: boolean;
  /** Optional title override; defaults to scope-aware label. */
  title?: string;
  /** When set, the whole card is tappable and shows a "View full report" affordance. */
  onPress?: () => void;
}

const LEVEL_META: Record<BrainRiskLevel, { icon: string; tint: string; bg: string }> = {
  Low: { icon: 'checkmark-circle', tint: Colors.success, bg: 'rgba(16,185,129,0.10)' },
  Moderate: { icon: 'information-circle', tint: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  Elevated: { icon: 'warning', tint: Colors.warning, bg: 'rgba(245,158,11,0.12)' },
};

const BrainCard: React.FC<BrainCardProps> = ({ brain, compact = false, title, onPress }) => {
  const { isDark } = useTheme();
  const colors = useThemedColors(isDark);
  const [expanded, setExpanded] = useState(false);

  if (!brain) return null;

  const meta = LEVEL_META[brain.riskLevel] ?? LEVEL_META.Low;
  const heading =
    title ?? (brain.scope === 'personal' ? 'Your Health Signal' : 'Area Health Signal');
  const keySignal = brain.signals?.find((signal) => signal.summary || signal.evidence) ?? null;
  const actionsToShow = compact && !expanded
    ? brain.recommendedActions?.slice(0, 1) ?? []
    : brain.recommendedActions?.slice(0, 3) ?? [];
  const canExpand = compact && ((brain.recommendedActions?.length ?? 0) > 1 || (brain.signals?.length ?? 0) > 0);

  return (
    <Animated.View
      entering={FadeInUp.duration(400)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={18} color={meta.tint} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]}>
            {heading}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {brain.area ? `${brain.area} · ` : ''}{brain.timeWindow}
          </Text>
        </View>
        <View style={[styles.levelBadge, { backgroundColor: meta.bg }]}>
          <Text style={[styles.levelText, { color: meta.tint }]}>
            {brain.riskLevel}
          </Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        <View style={[styles.metaPill, { backgroundColor: isDark ? Colors.whiteAlpha10 : '#f1f9f8' }]}>
          <Ionicons name="analytics-outline" size={13} color={Colors.primary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {brain.confidence} confidence
          </Text>
        </View>
        {brain.meta?.signalsUsed > 0 && (
          <View style={[styles.metaPill, { backgroundColor: isDark ? Colors.whiteAlpha10 : '#f1f9f8' }]}>
            <Ionicons name="pulse-outline" size={13} color={Colors.primary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {brain.meta.signalsUsed} signal{brain.meta.signalsUsed === 1 ? '' : 's'}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.summaryLabel, { color: colors.text }]}>Summary</Text>
      <Text style={[styles.summary, { color: colors.textSecondary }]}>
        {brain.summary}
      </Text>

      {keySignal && (!compact || expanded) && (
        <View style={[styles.reasonBox, { backgroundColor: isDark ? Colors.whiteAlpha10 : '#f8fbfb' }]}>
          <Text style={[styles.reasonLabel, { color: colors.textMuted }]}>Key signal</Text>
          <Text style={[styles.reasonText, { color: colors.textSecondary }]}>
            {keySignal.summary || keySignal.evidence}
          </Text>
        </View>
      )}

      {actionsToShow.length > 0 && (
        <View style={styles.actions}>
          {actionsToShow.map((action, idx) => (
            <View key={idx} style={styles.actionRow}>
              <Ionicons name="bulb-outline" size={14} color={Colors.primary} />
              <Text style={[styles.actionText, { color: colors.text }]}>{action}</Text>
            </View>
          ))}
        </View>
      )}

      {canExpand && (
        <Pressable
          onPress={() => setExpanded((next) => !next)}
          accessibilityRole="button"
          style={styles.detailsButton}
        >
          <Text style={styles.detailsText}>{expanded ? 'Show less' : 'View details'}</Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={15}
            color={Colors.primary}
          />
        </Pressable>
      )}

      {onPress && (
        <View style={[styles.reportRow, { borderTopColor: colors.border }]}>
          <Text style={styles.reportText}>View full report</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </View>
      )}

      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
        Awareness only — not a diagnosis or confirmed outbreak.
      </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.md,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconWrap: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, lineHeight: 24 },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, marginTop: 1 },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  levelText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
  },
  metaText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  summaryLabel: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, marginBottom: -Spacing.xs },
  summary: { fontFamily: FontFamily.regular, fontSize: FontSize.base, lineHeight: 23 },
  reasonBox: { borderRadius: BorderRadius.lg, padding: Spacing.sm, gap: 3 },
  reasonLabel: { fontFamily: FontFamily.semibold, fontSize: FontSize.xs, textTransform: 'uppercase' },
  reasonText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20 },
  actions: { gap: 8, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actionText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20 },
  detailsButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  detailsText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, color: Colors.primary },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reportText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, color: Colors.primary },
  disclaimer: { fontFamily: FontFamily.regular, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
});

export default BrainCard;
