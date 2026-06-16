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

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
}

const LEVEL_META: Record<BrainRiskLevel, { icon: string; tint: string; bg: string }> = {
  Low: { icon: 'checkmark-circle', tint: Colors.success, bg: 'rgba(16,185,129,0.10)' },
  Moderate: { icon: 'information-circle', tint: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
  Elevated: { icon: 'warning', tint: Colors.warning, bg: 'rgba(245,158,11,0.12)' },
};

const BrainCard: React.FC<BrainCardProps> = ({ brain, compact = false, title }) => {
  const { isDark } = useTheme();
  const colors = useThemedColors(isDark);

  if (!brain) return null;

  const meta = LEVEL_META[brain.riskLevel] ?? LEVEL_META.Low;
  const heading =
    title ?? (brain.scope === 'personal' ? 'Your Health Signal' : 'Area Health Signal');

  return (
    <Animated.View
      entering={FadeInUp.duration(400)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={18} color={meta.tint} />
        </View>
        <View style={styles.headerText}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
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
        <View style={styles.metaPill}>
          <Ionicons name="analytics-outline" size={12} color={colors.textMuted} />
          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            Confidence: {brain.confidence}
          </Text>
        </View>
        {brain.meta?.signalsUsed > 0 && (
          <View style={styles.metaPill}>
            <Ionicons name="pulse-outline" size={12} color={colors.textMuted} />
            <Text style={[styles.metaText, { color: colors.textMuted }]}>
              {brain.meta.signalsUsed} signal{brain.meta.signalsUsed === 1 ? '' : 's'}
            </Text>
          </View>
        )}
      </View>

      <Text style={[styles.summary, { color: colors.textSecondary }]}>
        {brain.summary}
      </Text>

      {!compact && brain.recommendedActions?.length > 0 && (
        <View style={styles.actions}>
          {brain.recommendedActions.slice(0, 4).map((action, idx) => (
            <View key={idx} style={styles.actionRow}>
              <Ionicons name="bulb-outline" size={14} color={Colors.primary} />
              <Text style={[styles.actionText, { color: colors.text }]}>{action}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
        Awareness only — not a diagnosis or confirmed outbreak.
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  title: { fontFamily: FontFamily.semibold, fontSize: FontSize.base },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, marginTop: 1 },
  levelBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  levelText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: FontFamily.medium, fontSize: 11 },
  summary: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 19 },
  actions: { gap: 6, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  actionText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 18 },
  disclaimer: { fontFamily: FontFamily.regular, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
});

export default BrainCard;
