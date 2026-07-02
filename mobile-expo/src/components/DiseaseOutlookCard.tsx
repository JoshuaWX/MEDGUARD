/**
 * DiseaseOutlookCard — model disease-risk projections for the user's state.
 *
 * Each disease renders as a scannable row: a hued icon chip, the disease name +
 * honest "kind" label, a 4-step tier meter, and the level word. Strengthens the
 * area signal by making the Lassa/cholera/malaria outlook visual and honest
 * (projections only — never a confirmed outbreak).
 */

import React, { useMemo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { BorderRadius, Colors, FontFamily, FontSize, LetterSpacing, Spacing } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import { forecastKind, type RiskRow } from '../hooks/useRiskMap';
import { RISK_DISEASES, riskColor, type RiskDisease, type RiskLevel } from '../theme/riskColors';
import Icon, { type IconName } from './Icon';
import LevelMeter from './LevelMeter';

interface DiseaseOutlookCardProps {
  state: string | null | undefined;
  rows: RiskRow[];
  loading?: boolean;
  onOpenMap?: () => void;
}

const LEVEL_LABEL: Record<RiskLevel, string> = { low: 'Low', moderate: 'Moderate', elevated: 'Elevated', high: 'High' };
const LEVEL_INDEX: Record<RiskLevel, number> = { low: 0, moderate: 1, elevated: 2, high: 3 };
const DISEASE_ICON: Record<RiskDisease, IconName> = {
  lassa: 'thermometer',
  malaria: 'bug',
  cholera: 'droplet',
  meningitis: 'activity',
};

const DiseaseOutlookCard: React.FC<DiseaseOutlookCardProps> = ({ state, rows, loading, onOpenMap }) => {
  const { isDark, colors } = useTheme();
  const normalizedState = (state || '').toLowerCase().trim();

  const outlook = useMemo(() => {
    if (!normalizedState) return [];
    return RISK_DISEASES.map(({ key, label }) => {
      const row = rows.find((r) => r.state === normalizedState && r.disease === key);
      return row ? { key, label, row } : null;
    }).filter(Boolean) as Array<{ key: RiskDisease; label: string; row: RiskRow }>;
  }, [rows, normalizedState]);

  if (!normalizedState || (!loading && outlook.length === 0)) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: isDark ? '#000' : colors.shadow }]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Icon name="map" size={16} color={colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Disease outlook</Text>
        </View>
        {!!state && (
          <View style={[styles.stateChip, { backgroundColor: colors.surfaceSunken }]}>
            <Text style={[styles.stateLabel, { color: colors.textSecondary }]} numberOfLines={1}>{state}</Text>
          </View>
        )}
      </View>

      <View style={styles.list}>
        {outlook.map(({ key, label, row }, idx) => {
          const hue = riskColor(key, row.level);
          const activeIdx = LEVEL_INDEX[row.level];
          return (
            <View
              key={key}
              style={[styles.row, idx > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}
            >
              <View style={[styles.diseaseIcon, { backgroundColor: `${hue}1F` }]}>
                <Icon name={DISEASE_ICON[key]} size={18} color={hue} />
              </View>
              <View style={styles.rowMain}>
                <View style={styles.rowTop}>
                  <Text style={[styles.disease, { color: colors.text }]}>{label}</Text>
                  <Text style={[styles.levelWord, { color: hue }]}>{LEVEL_LABEL[row.level]}</Text>
                </View>
                <LevelMeter segments={4} active={activeIdx} color={hue} style={{ marginTop: 7, marginBottom: 5 }} />
                <Text style={[styles.kind, { color: colors.textMuted }]}>{forecastKind(row.modelVersion)}</Text>
              </View>
            </View>
          );
        })}
      </View>

      {onOpenMap && (
        <Pressable onPress={onOpenMap} style={[styles.linkRow, { borderTopColor: colors.border }]} accessibilityRole="button">
          <Text style={[styles.linkText, { color: colors.primary }]}>See the risk map</Text>
          <Icon name="chevron-right" size={15} color={colors.primary} />
        </Pressable>
      )}

      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>Risk projections — not confirmed outbreaks.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.lg,
    gap: Spacing.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { fontFamily: FontFamily.display, fontSize: FontSize.base, letterSpacing: -0.2 },
  stateChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.pill, maxWidth: 150 },
  stateLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  list: {},
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingVertical: Spacing.md },
  diseaseIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  disease: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  levelWord: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, letterSpacing: 0.2 },
  kind: { fontFamily: FontFamily.regular, fontSize: 11 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  linkText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  disclaimer: { fontFamily: FontFamily.regular, fontSize: 11, fontStyle: 'italic' },
});

export default DiseaseOutlookCard;
