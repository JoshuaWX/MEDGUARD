/**
 * MedGuard Brain v1 — Safe explanation generation
 *
 * PHASE 2 (wrap-first): this generates a DETERMINISTIC, guardrail-passing
 * summary and DETERMINISTIC recommendedActions. No LLM is called yet.
 *
 * PHASE 3 will add an optional LLM phrasing step for the `summary` ONLY,
 * passed through `validateSummary` with this deterministic output as the
 * guaranteed fallback. recommendedActions remain deterministic forever.
 */

import type { BrainSignal, BrainRiskLevel } from './types.ts';
import {
  deterministicFallbackSummary,
  validateSummary,
  SAFE_BASELINE_ACTIONS,
  SAFE_CLOSING,
} from './safetyGuardrails.ts';
import { explainWithLlm } from './llmExplainer.ts';

/** Map signal types to safe, non-prescriptive preventive actions. */
const ACTION_LIBRARY: Record<BrainSignal['type'], string[]> = {
  weather: [
    'Avoid contact with floodwater and stagnant water where possible',
    'Drink only treated or boiled water',
    'Use mosquito nets and repellent, especially at dawn and dusk',
  ],
  aqi: [
    'Limit prolonged outdoor exertion when air quality is poor',
    'Keep windows closed during peak pollution hours',
  ],
  outbreak_alert: [
    'Follow guidance from official health authorities',
    'Practice regular handwashing and good hygiene',
  ],
  symptom_trend: [
    'Monitor for fever, diarrhea, or other symptoms in your household',
    'Practice regular handwashing and good hygiene',
  ],
  historical_pattern: [
    'Stay aware of seasonal health risks in your area',
    'Practice regular handwashing and good hygiene',
  ],
  verified_report: [
    'Follow guidance from official health authorities',
    'Avoid known affected areas or exposures where advised',
  ],
};

export interface ExplanationResult {
  summary: string;
  recommendedActions: string[];
  generatedBy: 'deterministic' | 'llm-assisted';
}

/**
 * Build deterministic recommendedActions from the active signal types,
 * always ending with the safe baseline "seek care" action.
 */
export function buildRecommendedActions(signals: BrainSignal[]): string[] {
  const actions = new Set<string>();
  const sorted = signals
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));

  for (const s of sorted) {
    const lib = ACTION_LIBRARY[s.type] ?? [];
    if (lib.length > 0) actions.add(lib[0]);
    if (actions.size >= 3) break;
  }

  // Always include safe baseline actions (deduped).
  for (const a of SAFE_BASELINE_ACTIONS) actions.add(a);

  return Array.from(actions).slice(0, 5);
}

/**
 * Deterministic explanation. The returned summary is guaranteed to pass
 * `validateSummary`; if for any reason it does not, fall back to the minimal
 * safe template.
 */
export function generateSafeExplanation(
  area: string,
  riskLevel: BrainRiskLevel,
  signals: BrainSignal[],
): ExplanationResult {
  const recommendedActions = buildRecommendedActions(signals);

  const topReasons = signals
    .filter((s) => s.severity !== 'low')
    .slice(0, 2)
    .map((s) => s.summary.toLowerCase());

  let summary: string;
  const a = area && area.trim() ? area.trim() : 'your area';
  if (riskLevel === 'Low' || topReasons.length === 0) {
    summary = deterministicFallbackSummary(area, riskLevel);
  } else {
    const lead =
      riskLevel === 'Elevated'
        ? `Health activity in ${a} appears higher than usual right now`
        : `Some health-risk signals in ${a} are slightly above normal`;
    summary = `${lead}: ${topReasons.join('; ')}. ${SAFE_CLOSING}`;
  }

  // Defensive: ensure the deterministic text is actually safe.
  if (!validateSummary(summary).ok) {
    summary = deterministicFallbackSummary(area, riskLevel);
  }

  return { summary, recommendedActions, generatedBy: 'deterministic' };
}

function severityRank(s: BrainSignal['severity']): number {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1;
}

/**
 * LLM-assisted explanation (Phase 3).
 *
 * recommendedActions remain DETERMINISTIC. Only the summary is phrased by the
 * LLM, and only if it passes safety validation; otherwise the deterministic
 * summary is used. This never throws and always returns safe output.
 */
export async function generateSafeExplanationAsync(
  area: string,
  riskLevel: BrainRiskLevel,
  signals: BrainSignal[],
  options?: { useLlm?: boolean; timeoutMs?: number },
): Promise<ExplanationResult> {
  const deterministic = generateSafeExplanation(area, riskLevel, signals);
  if (!options?.useLlm) return deterministic;

  try {
    const phrased = await explainWithLlm({ area, riskLevel, signals, timeoutMs: options.timeoutMs });
    if (phrased && validateSummary(phrased).ok) {
      return {
        summary: phrased,
        recommendedActions: deterministic.recommendedActions,
        generatedBy: 'llm-assisted',
      };
    }
  } catch {
    // fall through to deterministic
  }
  return deterministic;
}
