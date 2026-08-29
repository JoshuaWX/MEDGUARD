/**
 * MedGuard Brain — Risk forecast loader
 *
 * Fetches active, model-generated risk projections for a state from the
 * `risk_forecast` table (written by the offline ml/ pipeline) and maps them to
 * BrainRiskForecastInput[] for analyzeRiskForecast. Best-effort: any error
 * returns [] so the area Brain still builds from other signals.
 *
 * SAFETY: these are PROJECTIONS, not confirmations. Only active rows
 * (valid_until in the future) are used; the newest row per disease wins.
 */

import type { BrainRiskForecastInput } from './types.ts';

interface QueryCapableClient {
  from: (table: string) => {
    // deno-lint-ignore no-explicit-any
    select: (cols: string) => any;
  };
}

interface RawForecastRow {
  disease?: string;
  projected_risk_level?: string;
  risk_score?: number | null;
  confidence?: number | null;
  driver_factors?: string[] | null;
  summary?: string | null;
  model_version?: string;
  generated_at?: string | null;
  forecast_period_start?: string | null;
  forecast_horizon_days?: number | null;
  valid_until?: string | null;
}

const VALID_LEVELS = ['low', 'moderate', 'elevated', 'high'] as const;

export async function loadRiskForecast(
  client: QueryCapableClient | null | undefined,
  state: string,
  nowIso?: string,
): Promise<BrainRiskForecastInput[]> {
  if (!client || !state || !state.trim()) return [];
  const now = nowIso ?? new Date().toISOString();

  try {
    const { data, error } = await client
      .from('risk_forecast')
      .select(
        'disease, projected_risk_level, risk_score, confidence, driver_factors, summary, model_version, forecast_period_start, forecast_horizon_days, valid_until, generated_at',
      )
      .ilike('state', state) // case-insensitive: risk_forecast.state is Title-case, callers vary
      .gt('valid_until', now)
      .order('generated_at', { ascending: false })
      .limit(12);

    if (error || !Array.isArray(data)) return [];

    // Newest row per disease (results already sorted newest-first).
    const seen = new Set<string>();
    const out: BrainRiskForecastInput[] = [];
    for (const r of data as RawForecastRow[]) {
      const disease = String(r.disease ?? '').trim();
      const level = String(r.projected_risk_level ?? '').toLowerCase();
      if (!disease || seen.has(disease)) continue;
      if (!(VALID_LEVELS as readonly string[]).includes(level)) continue;
      seen.add(disease);
      out.push({
        disease,
        projectedRiskLevel: level as BrainRiskForecastInput['projectedRiskLevel'],
        riskScore: typeof r.risk_score === 'number' ? r.risk_score : null,
        confidence: typeof r.confidence === 'number' ? r.confidence : null,
        driverFactors: Array.isArray(r.driver_factors) ? r.driver_factors : [],
        summary: r.summary ?? null,
        modelVersion: String(r.model_version ?? 'forecast'),
        generatedAt: r.generated_at ?? null,
        forecastPeriodStart: r.forecast_period_start ?? null,
        horizonDays: typeof r.forecast_horizon_days === 'number' ? r.forecast_horizon_days : null,
        validUntil: r.valid_until ?? null,
      });
    }
    return out;
  } catch {
    return [];
  }
}
