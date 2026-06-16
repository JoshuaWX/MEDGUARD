/**
 * MedGuard Brain v1 — Notification trigger DESIGN (Phase 6)
 *
 * IMPORTANT: This module is DESIGN/LOGIC ONLY. It does NOT schedule, send, or
 * register any push notification. It is a pure decision function describing the
 * conditions under which a future push *would* be allowed. Wiring it to an
 * actual delivery mechanism is intentionally deferred to a later phase.
 *
 * SAFETY RULES (deferred-but-documented):
 *  - Opt-in only: user must have explicitly enabled Brain alerts.
 *  - Only Elevated risk with Medium/High confidence qualifies.
 *  - Prefer an official/verified signal in the mix (outbreak_alert /
 *    verified_report). Without one, do not auto-notify.
 *  - Cooldown: respect a minimum interval between alerts.
 *  - No panic language: the summary must pass a basic non-alarmist check.
 */

import type { BrainResult } from './brain';

export interface NotificationDecisionContext {
  /** User explicitly enabled Brain push alerts. */
  optedIn: boolean;
  /** Epoch ms of the last Brain alert shown to this user (null if never). */
  lastNotifiedAt: number | null;
  /** Minimum gap between alerts. Defaults to 24h. */
  cooldownMs?: number;
  /** Reference time (defaults to now). */
  now?: number;
}

export interface NotificationDecision {
  /** Whether a push WOULD be allowed (no push is actually sent here). */
  shouldNotify: boolean;
  /** Machine-readable reasons that blocked or allowed the decision. */
  reasons: string[];
  /** Suggested user-facing title/body if shouldNotify is true. */
  preview?: { title: string; body: string };
}

const DEFAULT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const PANIC_PATTERN = /\b(panic|deadly|catastroph|apocalyp|mass death)\w*/i;

const OFFICIAL_SIGNALS = ['outbreak_alert', 'verified_report'];

/**
 * Pure decision: would this Brain result qualify for a push right now?
 * Never performs any side effect.
 */
export function evaluateNotificationTrigger(
  brain: BrainResult | null | undefined,
  ctx: NotificationDecisionContext,
): NotificationDecision {
  const reasons: string[] = [];

  if (!brain) {
    return { shouldNotify: false, reasons: ['no_brain_result'] };
  }
  if (!ctx.optedIn) {
    return { shouldNotify: false, reasons: ['not_opted_in'] };
  }

  // Only Elevated risk qualifies.
  if (brain.riskLevel !== 'Elevated') {
    reasons.push('risk_not_elevated');
  }
  // Confidence must be Medium or High.
  if (brain.confidence === 'Low') {
    reasons.push('confidence_too_low');
  }
  // Require an official/verified signal in the mix.
  const hasOfficial = brain.signals.some((s) => OFFICIAL_SIGNALS.includes(s.type));
  if (!hasOfficial) {
    reasons.push('no_official_or_verified_signal');
  }
  // Cooldown.
  const now = ctx.now ?? Date.now();
  const cooldown = ctx.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  if (ctx.lastNotifiedAt !== null && now - ctx.lastNotifiedAt < cooldown) {
    reasons.push('within_cooldown');
  }
  // No panic language in the safe summary.
  if (PANIC_PATTERN.test(brain.summary)) {
    reasons.push('summary_failed_tone_check');
  }
  // Never notify on unsafe invariants (defensive).
  if (brain.diagnosis !== false || brain.outbreakConfirmed !== false) {
    reasons.push('unsafe_invariants');
  }

  const shouldNotify = reasons.length === 0;
  if (!shouldNotify) {
    return { shouldNotify, reasons };
  }

  return {
    shouldNotify: true,
    reasons: ['eligible'],
    preview: {
      title: `Health awareness update — ${brain.area || 'your area'}`,
      body: brain.summary,
    },
  };
}
