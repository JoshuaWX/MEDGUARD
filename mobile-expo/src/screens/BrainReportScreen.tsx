/**
 * BrainReportScreen — full "Area Health Signal" report.
 *
 * Shows the deterministic risk picture transparently: the signals it is based
 * on (with sources), a forecast-based forward look (projection, never
 * certainty), any OFFICIAL outbreak reports (NCDC/WHO, attributed), recommended
 * actions, and the data sources used. Awareness only — never a diagnosis or a
 * self-declared outbreak.
 */

import React, { useMemo } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useIntel } from '../hooks/useIntel';
import { useTheme } from '../hooks/useTheme';
import type { BrainSignal, BrainSignalType } from '../services/brain';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '../../theme';

const LEVEL_TINT: Record<string, string> = {
  Low: Colors.success,
  Moderate: '#3B82F6',
  Elevated: Colors.warning,
};

const SIGNAL_LABEL: Record<BrainSignalType, string> = {
  weather: 'Weather',
  aqi: 'Air quality',
  symptom_trend: 'Community symptoms',
  outbreak_alert: 'Official alert',
  verified_report: 'Verified report',
  historical_pattern: 'Historical pattern',
};

const SEVERITY_TINT: Record<string, string> = {
  low: Colors.success,
  medium: '#3B82F6',
  high: Colors.warning,
};

function timeAgo(iso?: string): string {
  if (!iso) return 'recently';
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return 'recently';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} day(s) ago`;
}

const BrainReportScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { intel, loading, refresh } = useIntel();

  const brain = intel?.brain ?? null;

  const forwardLook = useMemo(() => buildForwardLook(intel), [intel]);

  const officialSignals: BrainSignal[] = useMemo(
    () => (brain?.signals ?? []).filter((s) => s.type === 'verified_report' || s.type === 'outbreak_alert'),
    [brain]
  );
  const whoAlerts: Array<{ title?: string; url?: string }> = Array.isArray(intel?.whoAlerts) ? intel!.whoAlerts : [];

  const open = (url?: string) => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border, backgroundColor: colors.surface }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={10} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>Health Signal Report</Text>
        <View style={styles.headerBtn} />
      </View>

      {loading && !brain ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.muted, { color: colors.textSecondary }]}>Loading report…</Text>
        </View>
      ) : !brain ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.muted, { color: colors.textSecondary }]}>No health signal available for your area yet.</Text>
          <Pressable onPress={refresh} style={[styles.retryBtn, { borderColor: colors.border }]}>
            <Text style={[styles.retryText, { color: colors.primary }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.base, paddingBottom: insets.bottom + 40, gap: Spacing.base }} showsVerticalScrollIndicator={false}>
          {/* Risk hero */}
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.heroRow}>
              <View>
                <Text style={[styles.heroArea, { color: colors.textSecondary }]}>{brain.area || 'Your area'}</Text>
                <Text style={[styles.heroLevel, { color: LEVEL_TINT[brain.riskLevel] ?? colors.text }]}>{brain.riskLevel} risk</Text>
              </View>
              <View style={[styles.confBadge, { backgroundColor: isDark ? Colors.whiteAlpha10 : '#f1f9f8' }]}>
                <Text style={[styles.confText, { color: colors.textSecondary }]}>{brain.confidence} confidence</Text>
              </View>
            </View>
            <Text style={[styles.updated, { color: colors.textMuted }]}>
              Updated {timeAgo(intel?.generatedAt)} · {brain.meta?.signalsUsed ?? 0} signal{(brain.meta?.signalsUsed ?? 0) === 1 ? '' : 's'}
            </Text>
            <Text style={[styles.summary, { color: colors.text }]}>{brain.summary}</Text>
          </View>

          {/* What this is based on */}
          <Section title="What this is based on" colors={colors}>
            {(brain.signals ?? []).length === 0 ? (
              <Text style={[styles.body, { color: colors.textSecondary }]}>No active signals — conditions look normal.</Text>
            ) : (
              brain.signals.map((s, i) => (
                <View key={i} style={[styles.signalRow, { borderColor: colors.border }]}>
                  <View style={[styles.dot, { backgroundColor: SEVERITY_TINT[s.severity] ?? colors.textMuted }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.signalTitle, { color: colors.text }]}>
                      {SIGNAL_LABEL[s.type] ?? s.type} · {s.severity}
                    </Text>
                    <Text style={[styles.body, { color: colors.textSecondary }]}>{s.summary || s.evidence}</Text>
                    {!!s.source && (
                      <Text style={[styles.sourceTag, { color: colors.textMuted }]}>Source: {s.source}</Text>
                    )}
                  </View>
                </View>
              ))
            )}
          </Section>

          {/* Forward look */}
          {forwardLook && (
            <Section title="Forward look (next few days)" colors={colors}>
              <Text style={[styles.body, { color: colors.textSecondary }]}>{forwardLook}</Text>
              <Text style={[styles.projection, { color: colors.textMuted }]}>
                This is a risk projection from the weather forecast and season — not a prediction of any specific outcome.
              </Text>
            </Section>
          )}

          {/* Official reports */}
          <Section title="Official outbreak reports" colors={colors}>
            {officialSignals.length === 0 && whoAlerts.length === 0 ? (
              <Text style={[styles.body, { color: colors.textSecondary }]}>
                No official outbreak has been reported for your area right now. We only show outbreaks confirmed by NCDC or WHO.
              </Text>
            ) : (
              <>
                {officialSignals.map((s, i) => (
                  <View key={`o${i}`} style={styles.officialItem}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.body, { color: colors.text }]}>{s.summary || s.evidence}</Text>
                      {!!s.source && <Text style={[styles.sourceTag, { color: colors.textMuted }]}>{s.source}</Text>}
                    </View>
                  </View>
                ))}
                {whoAlerts.map((a, i) => (
                  <Pressable key={`w${i}`} style={styles.officialItem} onPress={() => open(a.url)}>
                    <Ionicons name="globe-outline" size={16} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.body, { color: colors.text }]}>{a.title}</Text>
                      <Text style={[styles.sourceTag, { color: Colors.primary }]}>WHO Disease Outbreak News ›</Text>
                    </View>
                  </Pressable>
                ))}
              </>
            )}
          </Section>

          {/* Recommended actions */}
          {(brain.recommendedActions ?? []).length > 0 && (
            <Section title="What you can do" colors={colors}>
              {brain.recommendedActions.map((a, i) => (
                <View key={i} style={styles.actionRow}>
                  <Ionicons name="bulb-outline" size={15} color={Colors.primary} />
                  <Text style={[styles.body, { color: colors.text, flex: 1 }]}>{a}</Text>
                </View>
              ))}
            </Section>
          )}

          {/* Data sources */}
          {Array.isArray(intel?.sources) && intel!.sources!.length > 0 && (
            <Section title="Data sources" colors={colors}>
              {intel!.sources!.map((src, i) => (
                <Pressable key={i} style={styles.sourceRow} onPress={() => open(src.url)} disabled={!src.url}>
                  <Ionicons name="link-outline" size={14} color={colors.textMuted} />
                  <Text style={[styles.body, { color: src.url ? Colors.primary : colors.textSecondary, flex: 1 }]}>
                    {src.name}{src.url ? ' ›' : ''}
                  </Text>
                </Pressable>
              ))}
            </Section>
          )}

          <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
            MedGuard provides health awareness only. It does not diagnose, and it never confirms an
            outbreak on its own — official confirmation comes from NCDC and WHO. If you feel unwell,
            seek care from a health professional.
          </Text>
        </ScrollView>
      )}
    </View>
  );
};

const Section: React.FC<{ title: string; colors: any; children: React.ReactNode }> = ({ title, colors, children }) => (
  <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
    <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
    <View style={{ gap: Spacing.sm }}>{children}</View>
  </View>
);

function buildForwardLook(intel: ReturnType<typeof useIntel>['intel']): string | null {
  const f = intel?.weather?.forecast;
  const season = intel?.season?.label;
  if (!f || !Array.isArray(f.precipitation) || f.precipitation.length === 0) return null;
  const next = f.precipitation.slice(0, 3);
  const maxP = Math.max(...next);
  const totalP = next.reduce((a, b) => a + b, 0);

  if (season === 'rainy' && maxP >= 20) {
    return 'Heavy rain is forecast over the next few days during the rainy season. Standing water and humidity can increase mosquito breeding and water contamination, so malaria and cholera/typhoid risk may rise. Use nets, store and treat water safely, and watch for fever or diarrhoea.';
  }
  if (maxP >= 20) {
    return 'Significant rain is forecast over the next few days, which can raise mosquito-borne and water-borne risk. Take normal precautions with water and mosquito protection.';
  }
  if (season === 'harmattan') {
    return 'Dry, dusty harmattan conditions are expected to continue. Air quality and respiratory irritation can rise, and in the meningitis belt meningitis risk increases — stay hydrated and limit dust exposure.';
  }
  if (totalP < 1) {
    return 'Mostly dry conditions are forecast for the next few days; area risk is expected to stay broadly stable.';
  }
  return 'Conditions are expected to stay broadly stable over the next few days.';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, flex: 1, textAlign: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, padding: Spacing.xl },
  muted: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, textAlign: 'center' },
  retryBtn: { borderWidth: 1, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  retryText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  card: { borderRadius: BorderRadius.xl, borderWidth: 1, padding: Spacing.base, gap: Spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroArea: { fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  heroLevel: { fontFamily: FontFamily.bold, fontSize: FontSize['2xl'] },
  confBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  confText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  updated: { fontFamily: FontFamily.regular, fontSize: FontSize.xs },
  summary: { fontFamily: FontFamily.regular, fontSize: FontSize.base, lineHeight: 23 },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, marginBottom: 2 },
  body: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20 },
  signalRow: { flexDirection: 'row', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  signalTitle: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, textTransform: 'capitalize' },
  sourceTag: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, marginTop: 2 },
  projection: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, fontStyle: 'italic', marginTop: 4 },
  officialItem: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  actionRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  sourceRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  disclaimer: { fontFamily: FontFamily.regular, fontSize: 11, fontStyle: 'italic', lineHeight: 16, paddingHorizontal: Spacing.xs },
});

export default BrainReportScreen;
