/**
 * useRiskMap — fetch model risk projections for ALL states directly from the
 * `risk_forecast` table (RLS allows anon/authenticated read of active rows).
 * No edge function needed. Returns the newest active row per state+disease.
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../services/supabase';
import type { RiskDisease, RiskLevel } from '../theme/riskColors';

export interface RiskRow {
  state: string; // lowercased, matches the map GeoJSON `state` property
  disease: string;
  level: RiskLevel;
  score: number | null;
  confidence: number | null;
  summary: string | null;
  modelVersion: string | null;
}

/**
 * Human-honest label for what kind of estimate a forecast row is, derived from
 * its model_version. Keeps the app from overstating unvalidated indicators.
 */
export function forecastKind(modelVersion: string | null): string {
  const v = (modelVersion || '').toLowerCase();
  if (v.includes('seasonal')) return 'Seasonal risk';
  if (v.includes('baseline') || v.includes('map_')) return 'Baseline risk';
  if (v) return 'Model forecast';
  return 'Risk estimate';
}

const LEVELS: RiskLevel[] = ['low', 'moderate', 'elevated', 'high'];

export function useRiskMap() {
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setError('Not configured');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('risk_forecast')
        .select('state, disease, projected_risk_level, risk_score, confidence, summary, model_version, valid_until, generated_at')
        .gt('valid_until', new Date().toISOString())
        .order('generated_at', { ascending: false });

      if (err) throw err;

      const seen = new Set<string>();
      const out: RiskRow[] = [];
      for (const r of (data ?? []) as Array<Record<string, unknown>>) {
        const state = String(r.state ?? '').toLowerCase().trim();
        const disease = String(r.disease ?? '').toLowerCase().trim();
        const level = String(r.projected_risk_level ?? '').toLowerCase() as RiskLevel;
        if (!state || !disease || !LEVELS.includes(level)) continue;
        const key = `${state}|${disease}`;
        if (seen.has(key)) continue; // newest wins (already sorted desc)
        seen.add(key);
        out.push({
          state,
          disease,
          level,
          score: typeof r.risk_score === 'number' ? r.risk_score : null,
          confidence: typeof r.confidence === 'number' ? r.confidence : null,
          summary: r.summary ? String(r.summary) : null,
          modelVersion: r.model_version ? String(r.model_version) : null,
        });
      }
      setRows(out);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load risk map');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { rows, loading, error, refresh: load };
}

/** Build a lookup of state -> RiskRow for a single disease. */
export function riskByState(rows: RiskRow[], disease: RiskDisease): Map<string, RiskRow> {
  const m = new Map<string, RiskRow>();
  for (const r of rows) {
    if (r.disease === disease) m.set(r.state, r);
  }
  return m;
}
