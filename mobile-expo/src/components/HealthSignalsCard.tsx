import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { BorderRadius, Colors, FontFamily, FontSize, LetterSpacing, Spacing } from '../../theme';
import type { BrainResult, BrainRiskLevel } from '../services/brain';
import { useTheme } from '../hooks/useTheme';
import Icon, { type IconName } from './Icon';

type SignalTab = 'personal' | 'area';

interface HealthSignalsCardProps {
  personal: BrainResult | null | undefined;
  area: BrainResult | null | undefined;
  areaName?: string | null;
  generatedAt?: string | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onOpenPersonal: () => void;
  onOpenArea: () => void;
}

const LEVEL_META: Record<BrainRiskLevel, { color: string; icon: IconName }> = {
  Low: { color: Colors.success, icon: 'shield-check' },
  Moderate: { color: Colors.info, icon: 'info' },
  Elevated: { color: Colors.warning, icon: 'alert-triangle' },
};

function freshness(value?: string | null): string {
  if (!value) return 'Waiting for an update';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently updated';
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'Updated just now';
  if (minutes < 60) return `Updated ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated ${hours} hr ago`;
  return `Updated ${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

const HealthSignalsCard: React.FC<HealthSignalsCardProps> = ({
  personal,
  area,
  areaName,
  generatedAt,
  loading = false,
  error = false,
  onRetry,
  onOpenPersonal,
  onOpenArea,
}) => {
  const { isDark, colors } = useTheme();
  const [tab, setTab] = useState<SignalTab>('personal');
  const brain = tab === 'personal' ? personal : area;
  const openReport = tab === 'personal' ? onOpenPersonal : onOpenArea;
  const meta = brain ? LEVEL_META[brain.riskLevel] : LEVEL_META.Low;
  const updatedLabel = useMemo(() => freshness(generatedAt), [generatedAt]);

  const emptyCopy = tab === 'personal'
    ? 'Complete a daily check-in to start building a private signal from your recent entries.'
    : `Area conditions for ${areaName || 'your saved alert area'} are not available yet.`;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: isDark ? '#000' : colors.shadow }]}>
      <View style={styles.header}>
        <View style={[styles.headerIcon, { backgroundColor: colors.primaryTint }]}>
          <Icon name="activity" size={19} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, { color: colors.textMuted }]}>AWARENESS, NOT DIAGNOSIS</Text>
          <Text style={[styles.title, { color: colors.text }]}>Health Signals</Text>
        </View>
        <Text style={[styles.updated, { color: colors.textMuted }]}>{updatedLabel}</Text>
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.surfaceSunken }]} accessibilityRole="tablist">
        {([
          { key: 'personal' as const, label: 'You', icon: 'heart-pulse' as const },
          { key: 'area' as const, label: 'Your area', icon: 'map-pin' as const },
        ]).map((item) => {
          const selected = tab === item.key;
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={`${item.label} health signal`}
              style={({ pressed }) => [
                styles.tab,
                selected && { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}
            >
              <Icon name={item.icon} size={16} color={selected ? colors.primary : colors.textMuted} />
              <Text style={[styles.tabLabel, { color: selected ? colors.text : colors.textMuted }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.body}>
        {loading && !brain ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.stateTitle, { color: colors.text }]}>Updating your signals</Text>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>Checking the latest confirmed information…</Text>
          </View>
        ) : error && !brain ? (
          <View style={styles.centerState}>
            <View style={[styles.stateIcon, { backgroundColor: colors.primaryTint }]}><Icon name="wifi-off" size={21} color={colors.primary} /></View>
            <Text style={[styles.stateTitle, { color: colors.text }]}>Signal unavailable</Text>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>Your saved health data is still private and unchanged.</Text>
            {onRetry && <Pressable onPress={onRetry} accessibilityRole="button" style={styles.retry}><Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text></Pressable>}
          </View>
        ) : !brain ? (
          <View style={styles.centerState}>
            <View style={[styles.stateIcon, { backgroundColor: colors.primaryTint }]}><Icon name={tab === 'personal' ? 'heart-pulse' : 'map-pin'} size={21} color={colors.primary} /></View>
            <Text style={[styles.stateTitle, { color: colors.text }]}>{tab === 'personal' ? 'Build your signal' : 'No area signal yet'}</Text>
            <Text style={[styles.stateText, { color: colors.textSecondary }]}>{emptyCopy}</Text>
          </View>
        ) : (
          <>
            <View style={styles.signalRow}>
              <View style={[styles.levelIcon, { backgroundColor: `${meta.color}1F` }]}><Icon name={meta.icon} size={20} color={meta.color} /></View>
              <View style={styles.signalHeading}>
                <Text style={[styles.scope, { color: colors.textMuted }]}>{tab === 'personal' ? 'YOUR RECENT CHECK-INS' : `${brain.area || areaName || 'YOUR AREA'} · CURRENT CONDITIONS`}</Text>
                <Text style={[styles.level, { color: colors.text }]}>{brain.riskLevel} signal</Text>
              </View>
              <View style={[styles.levelPill, { backgroundColor: `${meta.color}1F` }]}><Text style={[styles.levelPillText, { color: meta.color }]}>{brain.confidence} confidence</Text></View>
            </View>

            <View style={styles.trace} accessibilityLabel={`${brain.riskLevel} signal level`}>
              {[0, 1, 2].map((index) => (
                <View key={index} style={[styles.traceSegment, { backgroundColor: index <= ['Low', 'Moderate', 'Elevated'].indexOf(brain.riskLevel) ? meta.color : colors.border }]} />
              ))}
            </View>

            <Text style={[styles.summary, { color: colors.textSecondary }]} numberOfLines={5}>{brain.summary}</Text>

            {(brain.recommendedActions?.[0] || brain.signals?.[0]?.summary) && (
              <View style={[styles.action, { backgroundColor: colors.surfaceSunken }]}>
                <View style={[styles.actionIcon, { backgroundColor: colors.primaryTint }]}><Icon name="check" size={12} color={colors.primary} strokeWidth={2.5} /></View>
                <Text style={[styles.actionText, { color: colors.text }]}>{brain.recommendedActions?.[0] || brain.signals?.[0]?.summary}</Text>
              </View>
            )}

            <Pressable onPress={openReport} accessibilityRole="button" style={({ pressed }) => [styles.report, { borderTopColor: colors.border }, pressed && styles.pressed]}>
              <Text style={[styles.reportText, { color: colors.primary }]}>View {tab === 'personal' ? 'your' : 'area'} report</Text>
              <Icon name="arrow-right" size={16} color={colors.primary} />
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.card, borderWidth: StyleSheet.hairlineWidth, padding: Spacing.lg, gap: Spacing.base, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 18, elevation: 2 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { fontFamily: FontFamily.semibold, fontSize: 9, letterSpacing: LetterSpacing.overline },
  title: { fontFamily: FontFamily.display, fontSize: FontSize.lg, marginTop: 2 },
  updated: { maxWidth: 82, textAlign: 'right', fontFamily: FontFamily.regular, fontSize: 10, lineHeight: 14 },
  tabs: { flexDirection: 'row', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, minHeight: 44, flexDirection: 'row', gap: 7, alignItems: 'center', justifyContent: 'center', borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, borderColor: 'transparent' },
  tabLabel: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  pressed: { opacity: 0.72 },
  body: { minHeight: 244, justifyContent: 'center' },
  centerState: { minHeight: 220, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  stateIcon: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontFamily: FontFamily.display, fontSize: FontSize.base, textAlign: 'center' },
  stateText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20, textAlign: 'center' },
  retry: { minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.base },
  retryText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  signalRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  levelIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  signalHeading: { flex: 1 },
  scope: { fontFamily: FontFamily.semibold, fontSize: 9, letterSpacing: 0.7 },
  level: { fontFamily: FontFamily.display, fontSize: FontSize.base, marginTop: 2 },
  levelPill: { maxWidth: 94, borderRadius: BorderRadius.pill, paddingHorizontal: 9, paddingVertical: 6 },
  levelPillText: { fontFamily: FontFamily.bold, fontSize: 10, textAlign: 'center' },
  trace: { flexDirection: 'row', gap: 6, marginTop: Spacing.base },
  traceSegment: { flex: 1, height: 6, borderRadius: 3 },
  summary: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 21, marginTop: Spacing.base },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: Spacing.md },
  actionIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.xs, lineHeight: 18 },
  report: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderTopWidth: StyleSheet.hairlineWidth, marginTop: Spacing.base, paddingTop: Spacing.sm },
  reportText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
});

export default HealthSignalsCard;
