/**
 * MedGuard Brain v1 — Symptom trend analysis (PURE)
 *
 * Consumes anonymous community trend rows and/or the Phase 4 SQL RPC baseline
 * (current week vs 4-week rolling average). AGGREGATES ONLY — never raw
 * personal rows. Produces `symptom_trend` and `historical_pattern` signals.
 *
 * Phase 2: works off community_weekly_trends-style aggregates that already
 * exist. The richer rolling-average baseline arrives in Phase 4 and is
 * consumed via `trendBaseline` when present.
 */

import type {
  BrainSignal,
  BrainCommunityTrendInput,
  BrainTrendBaselineInput,
} from './types.ts';

/** Analyze week-over-week community aggregates (anonymous). */
export function analyzeSymptomTrends(
  communityTrends: BrainCommunityTrendInput[] | null | undefined,
  trendBaseline?: BrainTrendBaselineInput[] | null,
): BrainSignal[] {
  const signals: BrainSignal[] = [];

  // Prefer the explicit rolling-average baseline (Phase 4) when available.
  for (const b of trendBaseline ?? []) {
    if (b.classification === 'normal') continue;
    const ratio = b.rollingAvg4w > 0 ? b.currentWeekCount / b.rollingAvg4w : 0;
    signals.push({
      type: b.classification === 'elevated' ? 'historical_pattern' : 'symptom_trend',
      severity: b.classification === 'elevated' ? 'high' : 'medium',
      summary: `${capitalize(b.symptomGroup)} reports are ${b.classification} versus recent weeks`,
      evidence: `${b.currentWeekCount} this week vs ${b.rollingAvg4w.toFixed(1)} 4-week average` +
        (ratio > 0 ? ` (${ratio.toFixed(1)}x)` : ''),
      source: 'community_trends_baseline',
      weight: b.classification === 'elevated' ? 0.65 : 0.4,
      freshness: 'recent',
    });
  }

  if (signals.length > 0) return signals;

  // Fallback: simple week-over-week from community_weekly_trends aggregates.
  const latest = pickLatest(communityTrends);
  if (!latest) return signals;

  const prev = latest.prevWeekTotal ?? null;
  if (prev !== null && prev > 0) {
    const ratio = latest.totalCheckins / prev;
    if (ratio >= 1.5) {
      signals.push({
        type: 'symptom_trend',
        severity: ratio >= 2 ? 'high' : 'medium',
        summary: 'Community health reports are higher than the previous week',
        evidence: `${latest.totalCheckins} reports this week vs ${prev} last week`,
        source: 'community_trends',
        sourceId: `${latest.state}:${latest.isoWeek}`,
        weight: ratio >= 2 ? 0.55 : 0.35,
        freshness: 'recent',
      });
    }
  }

  // Elevated-share signal (share of check-ins marked elevated this week).
  if (latest.totalCheckins >= 5) {
    const elevatedShare = latest.elevatedRiskCount / latest.totalCheckins;
    if (elevatedShare >= 0.3) {
      signals.push({
        type: 'symptom_trend',
        severity: elevatedShare >= 0.5 ? 'high' : 'medium',
        summary: 'A notable share of community check-ins are elevated this week',
        evidence: `${latest.elevatedRiskCount} of ${latest.totalCheckins} check-ins elevated`,
        source: 'community_trends',
        sourceId: `${latest.state}:${latest.isoWeek}`,
        weight: elevatedShare >= 0.5 ? 0.5 : 0.3,
        freshness: 'recent',
      });
    }
  }

  return signals;
}

function pickLatest(
  rows: BrainCommunityTrendInput[] | null | undefined,
): BrainCommunityTrendInput | null {
  if (!rows || rows.length === 0) return null;
  return rows.slice().sort((a, b) => b.isoWeek.localeCompare(a.isoWeek))[0];
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
