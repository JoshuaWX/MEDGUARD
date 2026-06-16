/**
 * MedGuard Brain v1 — Safety Guardrails
 *
 * Central enforcement of the public-health safety stance. Brain output is
 * awareness-only: it must never diagnose, never confirm an outbreak, never
 * prescribe, never use certainty/panic language.
 *
 * This module is PURE (no IO). It is used to:
 *   1. Validate any user-facing summary text (deterministic OR LLM-produced).
 *   2. Provide a guaranteed-safe deterministic fallback summary.
 *
 * In Phase 3 the LLM-produced summary is passed through `validateSummary`;
 * if it fails, the deterministic fallback is used instead.
 */

export interface GuardrailViolation {
  rule: string;
  match: string;
}

export interface GuardrailResult {
  ok: boolean;
  violations: GuardrailViolation[];
}

/**
 * Forbidden patterns. Each entry is a named rule with a regex. These target
 * unsafe framings, not ordinary health vocabulary used in a careful context.
 */
const FORBIDDEN_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  // Direct diagnosis of the user.
  { rule: 'diagnosis', pattern: /\byou (?:have|are infected with|are suffering from|have got|have contracted)\b/i },
  { rule: 'diagnosis', pattern: /\b(?:you are|you're)\s+(?:diagnosed|positive)\b/i },
  // Confirmed outbreak language.
  { rule: 'outbreak_confirmed', pattern: /\boutbreak (?:confirmed|detected|declared)\b/i },
  { rule: 'outbreak_confirmed', pattern: /\bconfirmed (?:outbreak|epidemic|cases)\b/i },
  { rule: 'outbreak_confirmed', pattern: /\bdisease confirmed\b/i },
  // Certainty about prediction.
  { rule: 'certainty', pattern: /\b(?:we|ai|model)\s+(?:predicts?|guarantees?)\b.*\b(?:outbreak|epidemic)\b/i },
  { rule: 'certainty', pattern: /\b(?:definitely|certainly|guaranteed|for sure)\b.*\b(?:outbreak|infected|disease)\b/i },
  // Prescription / specific medication directives.
  { rule: 'prescription', pattern: /\btake \d+\s*(?:mg|ml|tablets?|pills?|doses?)\b/i },
  { rule: 'prescription', pattern: /\b(?:prescribe|prescription)\b/i },
  { rule: 'prescription', pattern: /\b(?:take|use)\s+(?:antibiotics|chloroquine|artemisinin|amoxicillin|paracetamol)\b/i },
  // Panic language.
  { rule: 'panic', pattern: /\b(?:panic|deadly outbreak|mass death|catastroph|apocalyp)\w*/i },
];

/** Validate a candidate user-facing summary string against safety rules. */
export function validateSummary(text: string): GuardrailResult {
  const violations: GuardrailViolation[] = [];
  if (!text || !text.trim()) {
    return { ok: false, violations: [{ rule: 'empty', match: '' }] };
  }
  // Neutralize explicitly-negated SAFE phrasing (e.g. "not a diagnosis",
  // "not a confirmed outbreak") so the standard disclaimer is not flagged.
  const scan = text.replace(
    /\bno(?:t)?\s+(?:a\s+|an\s+)?(?:diagnos\w+|confirmed\s+\w+|outbreak\s+(?:confirmed|detected|declared))/gi,
    ' ',
  );
  for (const { rule, pattern } of FORBIDDEN_PATTERNS) {
    const m = scan.match(pattern);
    if (m) violations.push({ rule, match: m[0] });
  }
  return { ok: violations.length === 0, violations };
}

/**
 * Enforce structural safety invariants on a Brain-like object, returning a
 * shallow-corrected copy. Always forces diagnosis/outbreakConfirmed to false.
 */
export function enforceSafetyInvariants<T extends { diagnosis?: unknown; outbreakConfirmed?: unknown }>(
  result: T,
): T & { diagnosis: false; outbreakConfirmed: false } {
  return { ...result, diagnosis: false, outbreakConfirmed: false };
}

/** A standard, always-safe closing line appended to user-facing summaries. */
export const SAFE_CLOSING =
  'This is not a diagnosis and does not confirm any outbreak. Monitor your symptoms and seek medical care if symptoms persist or worsen.';

/** Standard safe baseline actions that are always appropriate. */
export const SAFE_BASELINE_ACTIONS: string[] = [
  'Maintain good hygiene and wash hands regularly',
  'Seek medical care if symptoms persist or worsen',
];

/**
 * Deterministic fallback summary, guaranteed to pass `validateSummary`.
 * Used when no LLM is involved, or when the LLM output fails validation.
 */
export function deterministicFallbackSummary(
  area: string,
  riskLevel: 'Low' | 'Moderate' | 'Elevated',
): string {
  const a = area && area.trim() ? area.trim() : 'your area';
  if (riskLevel === 'Elevated') {
    return `Health activity in ${a} appears higher than usual right now based on current conditions and recent reports. ${SAFE_CLOSING}`;
  }
  if (riskLevel === 'Moderate') {
    return `Some health-risk signals in ${a} are slightly above normal. ${SAFE_CLOSING}`;
  }
  return `Health activity in ${a} appears within normal range. ${SAFE_CLOSING}`;
}
