/**
 * BrainCard — MedGuard Brain area/personal health signal (read-only).
 *
 * "Calm Clinical" treatment: a hued icon chip, a Low/Moderate/Elevated signal
 * meter, a confidence readout, a plain-language summary, the key signal, and
 * recommended actions. Non-alarmist palette (amber for elevated, never red).
 * Renders the provided BrainResult; it never computes risk itself.
 */

import React, { useState } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { BorderRadius, Colors, Spacing, FontFamily, FontSize, LetterSpacing } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import { BrainResult, BrainRiskLevel } from '../services/brain';
import Icon, { type IconName } from './Icon';
import LevelMeter from './LevelMeter';

interface BrainCardProps {
  brain: BrainResult | null | undefined;
  compact?: boolean;
  title?: string;
  onPress?: () => void;
}

const LEVELS: BrainRiskLevel[] = ['Low', 'Moderate', 'Elevated'];
const LEVEL_META: Record<BrainRiskLevel, { icon: IconName; tint: string }> = {
  Low: { icon: 'shield-check', tint: Colors.success },
  Moderate: { icon: 'info', tint: Colors.info },
  Elevated: { icon: 'alert-triangle', tint: Colors.warning },
};
const CONFIDENCE_INDEX: Record<string, number> = { Low: 0, Medium: 1, High: 2 };

const BrainCard: React.FC<BrainCardProps> = ({ brain, compact = false, title, onPress }) => {
  const { isDark, colors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  if (!brain) return null;

  const meta = LEVEL_META[brain.riskLevel] ?? LEVEL_META.Low;
  const levelIndex = LEVELS.indexOf(brain.riskLevel);
  const heading = title ?? (brain.scope === 'personal' ? 'Your Health Signal' : 'Area Health Signal');
  const keySignal = brain.signals?.find((s) => s.summary || s.evidence) ?? null;
  const actionsToShow = compact && !expanded
    ? brain.recommendedActions?.slice(0, 1) ?? []
    : brain.recommendedActions?.slice(0, 3) ?? [];
  const canExpand = compact && ((brain.recommendedActions?.length ?? 0) > 1 || (brain.signals?.length ?? 0) > 0);

  return (
    <Animated.View
      entering={FadeInUp.duration(360)}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: isDark ? '#000' : colors.shadow }]}
    >
      {/* Colored level accent strip */}
      <View style={[styles.accent, { backgroundColor: meta.tint }]} />

      <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={styles.body}>
        <View style={styles.headerRow}>
          <View style={[styles.iconChip, { backgroundColor: `${meta.tint}1F` }]}>
            <Icon name={meta.icon} size={19} color={meta.tint} />
          </View>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>{heading}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {brain.area ? `${brain.area} · ` : ''}{brain.timeWindow}
            </Text>
          </View>
          <View style={[styles.levelPill, { backgroundColor: `${meta.tint}1F` }]}>
            <Text style={[styles.levelText, { color: meta.tint }]}>{brain.riskLevel}</Text>
          </View>
        </View>

        {/* Signal meter */}
        <View style={styles.meterBlock}>
          <LevelMeter segments={3} active={levelIndex < 0 ? 0 : levelIndex} color={meta.tint} height={7} />
          <View style={styles.meterLabels}>
            {LEVELS.map((lvl, i) => (
              <Text
                key={lvl}
                style={[styles.meterLabel, { color: i === levelIndex ? meta.tint : colors.textMuted, textAlign: i === 0 ? 'left' : i === 2 ? 'right' : 'center' }]}
              >
                {lvl}
              </Text>
            ))}
          </View>
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={[styles.metaPill, { backgroundColor: colors.surfaceSunken }]}>
            <Icon name="activity" size={12} color={colors.textSecondary} />
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>{brain.confidence} confidence</Text>
            <View style={styles.confDots}>
              {[0, 1, 2].map((d) => (
                <View
                  key={d}
                  style={[styles.confDot, { backgroundColor: d <= (CONFIDENCE_INDEX[brain.confidence] ?? 0) ? colors.primary : colors.border }]}
                />
              ))}
            </View>
          </View>
          {brain.meta?.signalsUsed > 0 && (
            <View style={[styles.metaPill, { backgroundColor: colors.surfaceSunken }]}>
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {brain.meta.signalsUsed} signal{brain.meta.signalsUsed === 1 ? '' : 's'}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.summary, { color: colors.textSecondary }]}>{brain.summary}</Text>

        {keySignal && (!compact || expanded) && (
          <View style={[styles.reasonBox, { backgroundColor: colors.surfaceSunken }]}>
            <Text style={[styles.reasonLabel, { color: colors.textMuted }]}>KEY SIGNAL</Text>
            <Text style={[styles.reasonText, { color: colors.textSecondary }]}>{keySignal.summary || keySignal.evidence}</Text>
          </View>
        )}

        {actionsToShow.length > 0 && (
          <View style={styles.actions}>
            {actionsToShow.map((action, idx) => (
              <View key={idx} style={styles.actionRow}>
                <View style={[styles.actionDot, { backgroundColor: colors.primaryTint }]}>
                  <Icon name="check" size={11} color={colors.primary} strokeWidth={2.5} />
                </View>
                <Text style={[styles.actionText, { color: colors.text }]}>{action}</Text>
              </View>
            ))}
          </View>
        )}

        {canExpand && (
          <Pressable onPress={() => setExpanded((n) => !n)} accessibilityRole="button" style={styles.detailsButton}>
            <Text style={[styles.detailsText, { color: colors.primary }]}>{expanded ? 'Show less' : 'View details'}</Text>
            <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={15} color={colors.primary} />
          </Pressable>
        )}

        {onPress && (
          <View style={[styles.reportRow, { borderTopColor: colors.border }]}>
            <Text style={[styles.reportText, { color: colors.primary }]}>View full report</Text>
            <Icon name="chevron-right" size={16} color={colors.primary} />
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
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 2,
  },
  accent: { height: 4, width: '100%' },
  body: { padding: Spacing.lg, gap: Spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  iconChip: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  title: { fontFamily: FontFamily.display, fontSize: FontSize.lg, letterSpacing: -0.2 },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, marginTop: 1 },
  levelPill: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: BorderRadius.pill },
  levelText: { fontFamily: FontFamily.bold, fontSize: FontSize.xs },

  meterBlock: { gap: 6 },
  meterLabels: { flexDirection: 'row' },
  meterLabel: { flex: 1, fontFamily: FontFamily.medium, fontSize: 11 },

  metaRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  metaPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: BorderRadius.pill },
  metaText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  confDots: { flexDirection: 'row', gap: 3, marginLeft: 2 },
  confDot: { width: 5, height: 5, borderRadius: 2.5 },

  summary: { fontFamily: FontFamily.regular, fontSize: FontSize.base, lineHeight: 23 },
  reasonBox: { borderRadius: BorderRadius.md, padding: Spacing.md, gap: 4 },
  reasonLabel: { fontFamily: FontFamily.semibold, fontSize: FontSize.overline, letterSpacing: LetterSpacing.overline },
  reasonText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20 },
  actions: { gap: Spacing.sm, marginTop: 2 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  actionDot: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20 },
  detailsButton: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  detailsText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  reportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: Spacing.xs,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reportText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  disclaimer: { fontFamily: FontFamily.regular, fontSize: 11, fontStyle: 'italic', marginTop: 2 },
});

export default BrainCard;
