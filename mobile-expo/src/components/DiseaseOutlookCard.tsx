/**
 * DiseaseOutlookCard
 *
 * Compact, honest summary of the model disease-risk projections for the user's
 * state (Lassa / cholera / malaria …). Strengthens the area health signal by
 * surfacing the `risk_forecast` data with clear labels about what kind of
 * estimate each disease is (validated model forecast vs seasonal vs baseline).
 *
 * It renders projections only — never a confirmed outbreak.
 */

import React, { useMemo } from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import { forecastKind, type RiskRow } from '../hooks/useRiskMap';
import {
  RISK_DISEASES,
  riskColor,
  type RiskDisease,
  type RiskLevel,
} from '../theme/riskColors';

interface DiseaseOutlookCardProps {
  /** User's state (any case); matched case-insensitively to forecast rows. */
  state: string | null | undefined;
  rows: RiskRow[];
  loading?: boolean;
  onOpenMap?: () => void;
}

const LEVEL_LABEL: Record<RiskLevel, string> = {
  low: 'Low',
  moderate: 'Moderate',
  elevated: 'Elevated',
  high: 'High',
};

const DiseaseOutlookCard: React.FC<DiseaseOutlookCardProps> = ({ state, rows, loading, onOpenMap }) => {
  const { colors } = useTheme();

  const normalizedState = (state || '').toLowerCase().trim();

  // One row per disease for this state, ordered by the canonical disease list.
  const outlook = useMemo(() => {
    if (!normalizedState) return [];
    return RISK_DISEASES.map(({ key, label }) => {
      const row = rows.find((r) => r.state === normalizedState && r.disease === key);
      return row ? { key, label, row } : null;
    }).filter(Boolean) as Array<{ key: RiskDisease; label: string; row: RiskRow }>;
  }, [rows, normalizedState]);

  if (!normalizedState || (!loading && outlook.length === 0)) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <View style={styles.titleWrap}>
          <Ionicons name="map-outline" size={16} color={Colors.primary} />
          <Text style={[styles.title, { color: colors.text }]}>Disease outlook</Text>
        </View>
        {!!state && (
          <Text style={[styles.stateLabel, { color: colors.textSecondary }]} numberOfLines={1}>
            {state}
          </Text>
        )}
      </View>

      {outlook.map(({ key, label, row }) => {
        const dot = riskColor(key, row.level);
        return (
          <View key={key} style={styles.row}>
            <View style={[styles.dot, { backgroundColor: dot }]} />
            <View style={styles.rowText}>
              <Text style={[styles.disease, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.kind, { color: colors.textMuted }]}>
                {forecastKind(row.modelVersion)}
              </Text>
            </View>
            <View style={[styles.levelPill, { backgroundColor: `${dot}22` }]}>
              <Text style={[styles.levelText, { color: dot }]}>{LEVEL_LABEL[row.level]}</Text>
            </View>
          </View>
        );
      })}

      {onOpenMap && (
        <Pressable onPress={onOpenMap} style={styles.linkRow} accessibilityRole="button">
          <Text style={styles.linkText}>See the risk map</Text>
          <Ionicons name="chevron-forward" size={15} color={Colors.primary} />
        </Pressable>
      )}

      <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
        Risk projections — not confirmed outbreaks.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.base,
    gap: Spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  titleWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  stateLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, maxWidth: 140 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { flex: 1 },
  disease: { fontFamily: FontFamily.medium, fontSize: FontSize.sm },
  kind: { fontFamily: FontFamily.regular, fontSize: 11, marginTop: 1 },
  levelPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  levelText: { fontFamily: FontFamily.semibold, fontSize: FontSize.xs },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  linkText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, color: Colors.primary },
  disclaimer: { fontFamily: FontFamily.regular, fontSize: 11, fontStyle: 'italic' },
});

export default DiseaseOutlookCard;
