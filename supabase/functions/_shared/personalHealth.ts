/**
 * MedGuard — Shared personal health snapshot loader.
 *
 * Single source of truth for a user's personal health picture, used by BOTH
 * the `intel` function (to attach `personalBrain`) and the `chat` function (to
 * make replies health-aware). Keeping it here means neither function grows its
 * own bespoke check-in/symptom logic.
 *
 * SAFETY / PRIVACY:
 *   - Always called with the RLS-protected user client, so only the
 *     authenticated user's own rows are visible.
 *   - The resulting `personalBrain` is awareness-only (diagnosis/outbreak flags
 *     stay false) and must NEVER be written to the shared `intel_cache`.
 */

import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.48.1';
import { buildBrainAsync } from './brain/buildBrain.ts';
import { toBrainInput } from './brain/intelAdapter.ts';
import type {
  BrainResult,
  BrainCheckinInput,
  BrainSymptomLogInput,
} from './brain/types.ts';

const CHECKIN_LIMIT = 14;
const SYMPTOM_WINDOW_DAYS = 14;
const SYMPTOM_LIMIT = 50;

const BRAIN_LLM_SUMMARY_DEFAULT =
  (Deno.env.get('BRAIN_LLM_SUMMARY') || '').toLowerCase() === 'true';

export interface PersonalHealthSnapshot {
  /** Full personal Brain result (same contract intel already returns). */
  personalBrain: BrainResult;
  riskLevel: BrainResult['riskLevel'];
  confidence: BrainResult['confidence'];
  /** Short, user-safe signal summaries for prompt/UI use. */
  topSignalSummaries: string[];
  /** Distinct recently-logged symptom keys (incl. chat-derived). */
  recentSymptoms: string[];
  /** Whether the user has completed today's daily check-in. */
  hasCheckedInToday: boolean;
  /** Today's check-in risk level, if the user checked in today. */
  todayCheckinRisk: BrainCheckinInput['riskLevel'] | null;
  /** Current daily check-in streak (consecutive days), 0 if none. */
  streak: number;
  /** Latest persisted wellness score (0-100), or null. Context only. */
  wellnessScore: number | null;
  /** Steps recorded today, or null if none. Context only. */
  stepsToday: number | null;
  /** Body-mass index from profile height/weight, or null. Context only. */
  bmi: number | null;
}

/**
 * Load and assemble the personal health snapshot. Returns `null` when the user
 * has no personal data at all (no check-ins and no logged symptoms), matching
 * the prior intel behavior of omitting `personalBrain` when there is nothing
 * personal to say.
 */
export async function loadPersonalHealthSnapshot(
  userClient: SupabaseClient,
  area: string,
  options?: { useLlm?: boolean; now?: Date },
): Promise<PersonalHealthSnapshot | null> {
  const now = options?.now ?? new Date();
  const useLlm = options?.useLlm ?? BRAIN_LLM_SUMMARY_DEFAULT;

  const [checkins, symptomLogs, streak, metrics] = await Promise.all([
    loadCheckins(userClient),
    loadSymptomLogs(userClient, now),
    loadStreak(userClient),
    loadMetrics(userClient, now),
  ]);

  if (checkins.length === 0 && symptomLogs.length === 0) return null;

  const personalBrain = await buildBrainAsync(
    toBrainInput({ area, scope: 'personal', checkins, symptomLogs, now }),
    { useLlm },
  );

  const todayIso = toIsoDate(now);
  const todayCheckin = checkins.find((c) => c.checkinDate === todayIso) ?? null;

  return {
    personalBrain,
    riskLevel: personalBrain.riskLevel,
    confidence: personalBrain.confidence,
    topSignalSummaries: personalBrain.signals.slice(0, 3).map((s) => s.summary),
    recentSymptoms: distinctSymptomKeys(symptomLogs),
    hasCheckedInToday: todayCheckin !== null,
    todayCheckinRisk: todayCheckin?.riskLevel ?? null,
    streak,
    wellnessScore: metrics.wellnessScore,
    stepsToday: metrics.stepsToday,
    bmi: metrics.bmi,
  };
}

async function loadMetrics(
  userClient: SupabaseClient,
  now: Date,
): Promise<{ wellnessScore: number | null; stepsToday: number | null; bmi: number | null }> {
  const todayIso = toIsoDate(now);
  const [scoreRes, stepsRes, profileRes] = await Promise.all([
    userClient.from('health_score_daily').select('score').order('score_date', { ascending: false }).limit(1).maybeSingle(),
    userClient.from('user_daily_activity').select('step_count').eq('activity_date', todayIso).maybeSingle(),
    userClient.from('profiles').select('height_cm, weight_kg').maybeSingle(),
  ]);

  const score = scoreRes.data ? Number((scoreRes.data as Record<string, unknown>).score) : null;
  const steps = stepsRes.data ? Number((stepsRes.data as Record<string, unknown>).step_count) : null;

  let bmi: number | null = null;
  const prof = profileRes.data as Record<string, unknown> | null;
  const h = prof && typeof prof.height_cm !== 'undefined' ? Number(prof.height_cm) : NaN;
  const w = prof && typeof prof.weight_kg !== 'undefined' ? Number(prof.weight_kg) : NaN;
  if (Number.isFinite(h) && Number.isFinite(w) && h > 0 && w > 0) {
    const m = h / 100;
    bmi = Math.round((w / (m * m)) * 10) / 10;
  }

  return {
    wellnessScore: Number.isFinite(score as number) ? (score as number) : null,
    stepsToday: Number.isFinite(steps as number) ? (steps as number) : null,
    bmi,
  };
}

async function loadStreak(userClient: SupabaseClient): Promise<number> {
  const { data, error } = await userClient
    .from('health_streaks')
    .select('current_streak')
    .maybeSingle();
  if (error || !data) return 0;
  const value = (data as Record<string, unknown>).current_streak;
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function loadCheckins(userClient: SupabaseClient): Promise<BrainCheckinInput[]> {
  const { data, error } = await userClient
    .from('health_checkins')
    .select('checkin_date, risk_level, has_fever, has_digestive_issues, has_water_exposure, has_sick_contact')
    .order('checkin_date', { ascending: false })
    .limit(CHECKIN_LIMIT);

  if (error || !Array.isArray(data)) return [];
  return data.map((r) => {
    const row = r as Record<string, unknown>;
    return {
      checkinDate: String(row.checkin_date ?? ''),
      riskLevel: (row.risk_level as BrainCheckinInput['riskLevel']) ?? 'low',
      hasFever: Boolean(row.has_fever),
      hasDigestiveIssues: Boolean(row.has_digestive_issues),
      hasWaterExposure: Boolean(row.has_water_exposure),
      hasSickContact: Boolean(row.has_sick_contact),
    };
  });
}

async function loadSymptomLogs(
  userClient: SupabaseClient,
  now: Date,
): Promise<BrainSymptomLogInput[]> {
  const since = new Date(now.getTime() - SYMPTOM_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await userClient
    .from('symptom_logs')
    .select('symptom_key, severity, occurred_at, source')
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: false })
    .limit(SYMPTOM_LIMIT);

  if (error || !Array.isArray(data)) return [];
  return data
    .map((r) => {
      const row = r as Record<string, unknown>;
      return {
        symptomKey: String(row.symptom_key ?? '').trim(),
        severity: typeof row.severity === 'number' ? row.severity : null,
        occurredAt: String(row.occurred_at ?? ''),
        source: typeof row.source === 'string' ? row.source : undefined,
      };
    })
    .filter((r) => r.symptomKey.length > 0);
}

function distinctSymptomKeys(logs: BrainSymptomLogInput[]): string[] {
  const seen: string[] = [];
  for (const log of logs) {
    const key = log.symptomKey.toLowerCase();
    if (key && !seen.includes(key)) seen.push(key);
    if (seen.length >= 8) break;
  }
  return seen;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
