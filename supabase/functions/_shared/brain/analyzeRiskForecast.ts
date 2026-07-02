/**
 * MedGuard Brain — Risk forecast analysis (PURE)
 *
 * Turns model-generated risk PROJECTIONS (e.g. the national Lassa model,
 * apportioned to this state) into Brain signals. Strictly a forward-looking
 * projection — never an outbreak confirmation or diagnosis.
 *
 * SAFETY:
 *  - `summary` is kept short and projection-framed so that, if it is folded into
 *    the Brain's overall summary, it still passes validateSummary. The detailed
 *    attribution goes in `evidence` (shown in the report, never claimed as fact).
 *  - Low projections contribute little weight so they never inflate risk.
 */

import type { BrainRiskForecastInput, BrainSignal, SignalSeverity } from './types.ts';

const SEVERITY_BY_LEVEL: Record<BrainRiskForecastInput['projectedRiskLevel'], SignalSeverity> = {
  low: 'low',
  moderate: 'medium',
  elevated: 'high',
  high: 'high',
};

const WEIGHT_BY_LEVEL: Record<BrainRiskForecastInput['projectedRiskLevel'], number> = {
  low: 0.12,
  moderate: 0.25,
  elevated: 0.35,
  high: 0.4,
};

function titleCase(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

export function analyzeRiskForecast(
  forecasts: BrainRiskForecastInput[] | null | undefined,
): BrainSignal[] {
  const signals: BrainSignal[] = [];

  for (const f of forecasts ?? []) {
    const level = f.projectedRiskLevel;
    const disease = titleCase(f.disease);
    const weeks = f.horizonDays ? Math.max(1, Math.round(f.horizonDays / 7)) : null;

    const confPct = typeof f.confidence === 'number' ? `${Math.round(f.confidence * 100)}% model confidence` : null;
    const drivers = f.driverFactors && f.driverFactors.length
      ? `Drivers: ${f.driverFactors.join(', ')}.`
      : '';
    // Prefer the pipeline's projection-framed summary as detailed evidence.
    const evidence = [
      f.summary?.trim(),
      confPct,
      drivers,
      f.modelVersion ? `Model: ${f.modelVersion}.` : '',
    ].filter(Boolean).join(' ');

    signals.push({
      type: 'risk_forecast',
      severity: SEVERITY_BY_LEVEL[level],
      // Short + projection-framed (safe to fold into the Brain summary).
      summary: `${disease} risk projected ${level}${weeks ? ` over the next ${weeks} weeks` : ''}`,
      evidence: evidence || `${disease} risk is projected to be ${level}.`,
      source: `MedGuard forecast model (${f.modelVersion ?? 'forecast'})`,
      weight: WEIGHT_BY_LEVEL[level],
      freshness: 'recent',
    });
  }

  return signals;
}
