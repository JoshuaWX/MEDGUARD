/**
 * MedGuard Brain v1 — Shared Types
 *
 * Phase 2 (wrap-first): these types describe the Brain signal-fusion layer.
 * Modules are PURE and consume values already computed by the intel function
 * (weather/AQI/outbreak/risk) plus optional personal/community inputs that are
 * fetched elsewhere. No network or DB access happens in these modules.
 *
 * SAFETY: Brain is awareness-only. It never diagnoses and never confirms
 * outbreaks. `diagnosis` and `outbreakConfirmed` are always false in v1.
 */

export type BrainRiskLevel = "Low" | "Moderate" | "Elevated";
export type BrainConfidence = "Low" | "Medium" | "High";
export type SignalSeverity = "low" | "medium" | "high";

export type SignalType =
  | "symptom_trend"
  | "weather"
  | "aqi"
  | "outbreak_alert"
  | "verified_report"
  | "historical_pattern"
  | "risk_forecast";

/**
 * A single normalized signal contributing to the area/community risk picture.
 * `source`/`sourceId` are attached where available for traceability.
 */
export interface BrainSignal {
  type: SignalType;
  severity: SignalSeverity;
  summary: string;
  evidence: string;
  source?: string;
  sourceId?: string;
  /** Internal-only weighting hint (0..1). Not part of the public contract. */
  weight?: number;
  /** Coarse freshness label for confidence scoring; not user-facing. */
  freshness?: "live" | "recent" | "stale" | "unknown";
}

export type BrainScope = "area" | "personal";

export interface BrainMeta {
  schemaVersion: "brain_v1";
  signalsUsed: number;
  dataFreshness: Record<string, string>;
  generatedBy: "deterministic" | "llm-assisted";
}

/**
 * The public Brain output contract (additive `brain` / `personalBrain` fields).
 * NOTE: emitting this onto the intel response happens in Phase 3, not Phase 2.
 */
export interface BrainResult {
  scope: BrainScope;
  riskLevel: BrainRiskLevel;
  confidence: BrainConfidence;
  area: string;
  timeWindow: string;
  signals: BrainSignal[];
  summary: string;
  recommendedActions: string[];
  diagnosis: false;
  outbreakConfirmed: false;
  meta: BrainMeta;
}

// ----------------------------------------------------------------------------
// Input shapes (already-computed values handed to the pure modules)
// ----------------------------------------------------------------------------

export interface BrainWeatherInput {
  temp: number;
  humidity: number;
  precipitation: number;
  windSpeed?: number;
  source?: string;
}

export interface BrainForecastInput {
  dates: string[];
  maxTemps: number[];
  minTemps: number[];
  precipitation: number[];
}

export interface BrainSeasonInput {
  label: "harmattan" | "dry" | "rainy" | "unknown";
  description: string;
  confidence: number;
}

export interface BrainAqiInput {
  level: "good" | "fair" | "moderate" | "poor" | "very_poor";
  dominantPollutant?: string;
  healthImplications?: string;
}

/** Minimal shape of a disease risk entry from the existing risk-engine. */
export interface BrainDiseaseRiskInput {
  disease: string;
  riskLevel: "low" | "medium" | "high";
  isActive: boolean;
  reasons: string[];
  sources: string[];
}

export interface BrainOutbreakInput {
  disease: string;
  region: string;
  severity: string;
  summary?: string;
  source: string;
  updated?: string;
}

export interface BrainWhoAlertInput {
  title: string;
  url: string;
  source: string;
}

/** A daily personal check-in row (only used when the user is authenticated). */
export interface BrainCheckinInput {
  checkinDate: string;
  riskLevel: "low" | "moderate" | "elevated";
  hasFever?: boolean;
  hasDigestiveIssues?: boolean;
  hasWaterExposure?: boolean;
  hasSickContact?: boolean;
}

/**
 * A logged symptom row (personal). Sourced from `symptom_logs` and only used
 * for the `personal` Brain scope. Includes symptoms the user typed in chat
 * (`source: 'chat'`) so the Brain reacts to them. AGGREGATED INTO A TREND
 * SIGNAL ONLY — never echoed back as a diagnosis.
 */
export interface BrainSymptomLogInput {
  symptomKey: string;
  severity?: number | null;
  occurredAt: string;
  source?: string;
}

/** Aggregated, anonymous community trend row for a state/week. */
export interface BrainCommunityTrendInput {
  isoWeek: string;
  state: string;
  totalCheckins: number;
  feverCount: number;
  digestiveCount: number;
  elevatedRiskCount: number;
  prevWeekTotal?: number | null;
  trendDirection?: "increasing" | "stable" | "decreasing" | null;
}

/**
 * Aggregated baseline from the Phase 4 SQL RPC (current vs 4-week rolling avg).
 * AGGREGATES ONLY — never raw personal rows.
 */
export interface BrainTrendBaselineInput {
  state?: string;
  symptomGroup: string;
  currentWeekCount: number;
  previous4WeekAverage?: number;
  percentageChange?: number;
  confidence?: "low" | "medium" | "high";
  /** Compatibility alias for older internal analyzers. */
  rollingAvg4w: number;
  classification: "normal" | "rising" | "elevated";
}

/** Verified, admin-entered report (Phase 5). Phase 2 keeps this as a stub input. */
export interface BrainVerifiedReportInput {
  id: string;
  state: string;
  signalType: SignalType;
  summary: string;
  sourceType: string;
  credibilityLevel: "low" | "medium" | "high";
  verificationStatus: "verified" | "pending" | "rejected";
  occurredAt: string;
  expiresAt?: string | null;
}

/**
 * A forward-looking, model-generated RISK PROJECTION for a state+disease
 * (from the offline ml/ pipeline via the `risk_forecast` table). Surfaced as a
 * PROJECTION signal — never an outbreak confirmation or diagnosis.
 */
export interface BrainRiskForecastInput {
  disease: string;
  projectedRiskLevel: "low" | "moderate" | "elevated" | "high";
  riskScore?: number | null;
  /** Model confidence, 0..1. */
  confidence?: number | null;
  driverFactors?: string[];
  /** Approved projection-framed summary written by the pipeline. */
  summary?: string | null;
  modelVersion?: string;
  /** Timestamp emitted by the forecast pipeline, for user-visible freshness. */
  generatedAt?: string | null;
  forecastPeriodStart?: string | null;
  horizonDays?: number | null;
  validUntil?: string | null;
}

/** Full input bundle for buildBrain orchestration. */
export interface BrainBuildInput {
  area: string;
  scope: BrainScope;
  weather?: BrainWeatherInput | null;
  forecast?: BrainForecastInput | null;
  season?: BrainSeasonInput | null;
  aqi?: BrainAqiInput | null;
  diseases?: BrainDiseaseRiskInput[] | null;
  outbreaks?: BrainOutbreakInput[] | null;
  whoAlerts?: BrainWhoAlertInput[] | null;
  /** Personal — only present when authenticated. */
  checkins?: BrainCheckinInput[] | null;
  /** Personal — logged symptoms (incl. chat-derived). Only used for personal scope. */
  symptomLogs?: BrainSymptomLogInput[] | null;
  /** Community aggregates (anonymous). */
  communityTrends?: BrainCommunityTrendInput[] | null;
  trendBaseline?: BrainTrendBaselineInput[] | null;
  verifiedReports?: BrainVerifiedReportInput[] | null;
  /** Model-generated risk projections for this state (e.g. Lassa). */
  riskForecast?: BrainRiskForecastInput[] | null;
  /** Reference time for freshness/decay math; defaults to now. */
  now?: Date;
}
