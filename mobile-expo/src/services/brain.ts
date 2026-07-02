/**
 * MedGuard Brain v1 — client-side types (Phase 6)
 *
 * Mirrors the additive `brain` / `personalBrain` fields returned by the intel
 * Edge Function. These are read-only on the client; the app never computes
 * Brain output itself.
 */

export type BrainRiskLevel = 'Low' | 'Moderate' | 'Elevated';
export type BrainConfidence = 'Low' | 'Medium' | 'High';
export type BrainSignalSeverity = 'low' | 'medium' | 'high';

export type BrainSignalType =
  | 'symptom_trend'
  | 'weather'
  | 'aqi'
  | 'outbreak_alert'
  | 'verified_report'
  | 'historical_pattern'
  | 'risk_forecast';

export interface BrainSignal {
  type: BrainSignalType;
  severity: BrainSignalSeverity;
  summary: string;
  evidence: string;
  source?: string;
  sourceId?: string;
}

export interface BrainResult {
  scope: 'area' | 'personal';
  riskLevel: BrainRiskLevel;
  confidence: BrainConfidence;
  area: string;
  timeWindow: string;
  signals: BrainSignal[];
  summary: string;
  recommendedActions: string[];
  diagnosis: false;
  outbreakConfirmed: false;
  meta: {
    schemaVersion: 'brain_v1';
    signalsUsed: number;
    dataFreshness: Record<string, string>;
    generatedBy: 'deterministic' | 'llm-assisted';
  };
}
