/**
 * MedGuard Brain v1 — Orchestrator (PURE)
 *
 * Assembles a complete BrainResult from already-computed inputs:
 *   collectSignals -> calculateRiskScore -> calculateConfidence
 *   -> generateSafeExplanation -> enforceSafetyInvariants
 *
 * PHASE 2: deterministic only, and NOT yet wired into intel/index.ts. This is
 * the seam Phase 3 will call to attach `brain` (area) and `personalBrain`.
 *
 * SAFETY: diagnosis/outbreakConfirmed are always false (enforced).
 */

import type { BrainBuildInput, BrainResult } from './types.ts';
import { collectSignals } from './collectSignals.ts';
import { calculateRiskScore } from './calculateRiskScore.ts';
import { calculateConfidence } from './calculateConfidence.ts';
import { generateSafeExplanation, generateSafeExplanationAsync } from './generateSafeExplanation.ts';
import { enforceSafetyInvariants } from './safetyGuardrails.ts';

const TIME_WINDOW = 'Current conditions and recent reports';

import type { ExplanationResult } from './generateSafeExplanation.ts';

function assembleBrain(
  input: BrainBuildInput,
  signals: ReturnType<typeof collectSignals>,
  riskLevel: BrainResult['riskLevel'],
  confidence: BrainResult['confidence'],
  explanation: ExplanationResult,
): BrainResult {
  const dataFreshness: Record<string, string> = {
    weather: input.weather ? 'live' : 'unavailable',
    aqi: input.aqi ? 'live' : 'unavailable',
    outbreaks: (input.outbreaks?.length ?? 0) > 0 ? 'live' : 'none_active',
    whoAlerts: (input.whoAlerts?.length ?? 0) > 0 ? 'live' : 'none_relevant',
    communityTrends: (input.communityTrends?.length ?? 0) > 0 ? 'recent' : 'unavailable',
    verifiedReports: (input.verifiedReports?.length ?? 0) > 0 ? 'recent' : 'none',
    checkins: input.scope === 'personal' && (input.checkins?.length ?? 0) > 0 ? 'live' : 'n/a',
  };

  const result: BrainResult = {
    scope: input.scope,
    riskLevel,
    confidence,
    area: input.area,
    timeWindow: TIME_WINDOW,
    signals,
    summary: explanation.summary,
    recommendedActions: explanation.recommendedActions,
    diagnosis: false,
    outbreakConfirmed: false,
    meta: {
      schemaVersion: 'brain_v1',
      signalsUsed: signals.length,
      dataFreshness,
      generatedBy: explanation.generatedBy,
    },
  };

  return enforceSafetyInvariants(result);
}

/** Synchronous, deterministic Brain assembly (no LLM). */
export function buildBrain(input: BrainBuildInput): BrainResult {
  const signals = collectSignals(input);
  const { riskLevel } = calculateRiskScore(signals);
  const { confidence } = calculateConfidence(signals);
  const explanation = generateSafeExplanation(input.area, riskLevel, signals);
  return assembleBrain(input, signals, riskLevel, confidence, explanation);
}

/**
 * Async Brain assembly with optional LLM-phrased summary (Phase 3).
 * Falls back to the deterministic summary when the LLM is disabled, not
 * configured, times out, or produces text that fails safety validation.
 * recommendedActions and risk/confidence stay deterministic.
 */
export async function buildBrainAsync(
  input: BrainBuildInput,
  options?: { useLlm?: boolean; timeoutMs?: number },
): Promise<BrainResult> {
  const signals = collectSignals(input);
  const { riskLevel } = calculateRiskScore(signals);
  const { confidence } = calculateConfidence(signals);
  const explanation = await generateSafeExplanationAsync(input.area, riskLevel, signals, options);
  return assembleBrain(input, signals, riskLevel, confidence, explanation);
}
