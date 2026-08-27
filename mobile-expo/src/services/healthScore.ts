/**
 * Health (wellness) score — transparent, non-diagnostic.
 *
 * A 0-100 indicator of day-to-day wellness habits, NOT a medical measure. The
 * formula is deterministic and explainable so the user (and the Brain/chat) can
 * see exactly why the number is what it is.
 *
 * Components (start at 100) — deltas kept GENTLE so a single off day doesn't
 * crater the number:
 *   - Today's check-in:       low 0 · moderate -12 · elevated -25 · none -8
 *   - Check-in streak:        +min(streak, 8)
 *   - Steps today (if known): >=8000 +5 · 5000-7999 +2 · <3000 -3
 *   - BMI band (if known):    normal 0 · overweight -3 · obese -8 · underweight -5
 * Clamped to 0-100. For display, `smoothScore()` blends today's raw score with
 * the recent trend so the headline number doesn't whipsaw day to day.
 */

import { supabase } from './supabase';

export type RiskLevel = 'low' | 'moderate' | 'elevated';
export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese';

export interface HealthScoreInput {
  todayRisk: RiskLevel | null;
  streak: number;
  steps?: number | null;
  bmi?: number | null;
}

export type FactorTone = 'positive' | 'negative' | 'neutral';

/** One human-readable contributor to the score, for the "why?" breakdown. */
export interface HealthScoreFactor {
  key: string;
  label: string;
  delta: number;
  tone: FactorTone;
}

export interface HealthScoreResult {
  score: number;
  /** Numeric deltas keyed by factor (persisted for history/debugging). */
  breakdown: Record<string, number>;
  /** Labelled contributors for the explainability UI. */
  factors: HealthScoreFactor[];
}

function toneOf(delta: number): FactorTone {
  return delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral';
}

export function computeBmi(heightCm?: number | null, weightKg?: number | null): number | null {
  if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
  const m = heightCm / 100;
  const bmi = weightKg / (m * m);
  return Number.isFinite(bmi) ? Math.round(bmi * 10) / 10 : null;
}

export function bmiCategory(bmi: number | null): BmiCategory | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

export function computeHealthScore(input: HealthScoreInput): HealthScoreResult {
  const breakdown: Record<string, number> = {};
  const factors: HealthScoreFactor[] = [];
  let score = 100;

  const add = (key: string, delta: number, label: string) => {
    breakdown[key] = delta;
    score += delta;
    factors.push({ key, label, delta, tone: toneOf(delta) });
  };

  // Today's check-in — gentle penalties; a missed day is a small nudge, not illness.
  const riskDelta = input.todayRisk === 'low' ? 0
    : input.todayRisk === 'moderate' ? -12
    : input.todayRisk === 'elevated' ? -25
    : -8; // no check-in today
  const checkinLabel = input.todayRisk === 'low' ? 'Checked in — feeling well'
    : input.todayRisk === 'moderate' ? 'Check-in noted mild symptoms'
    : input.todayRisk === 'elevated' ? 'Check-in noted symptoms'
    : 'No check-in today';
  add('checkin', riskDelta, checkinLabel);

  const streakBonus = Math.min(Math.max(input.streak ?? 0, 0), 8);
  if (streakBonus > 0) {
    add('streak', streakBonus, `${input.streak}-day check-in streak`);
  }

  if (typeof input.steps === 'number') {
    const stepDelta = input.steps >= 8000 ? 5 : input.steps >= 5000 ? 2 : input.steps < 3000 ? -3 : 0;
    const stepLabel = input.steps >= 8000 ? '8k+ steps today'
      : input.steps >= 5000 ? '5k+ steps today'
      : input.steps < 3000 ? 'Low activity today'
      : 'Some activity today';
    add('steps', stepDelta, stepLabel);
  }

  if (typeof input.bmi === 'number') {
    const cat = bmiCategory(input.bmi);
    const bmiDelta = cat === 'normal' ? 0 : cat === 'overweight' ? -3 : cat === 'obese' ? -8 : cat === 'underweight' ? -5 : 0;
    const bmiLabel = cat === 'normal' ? 'BMI in healthy range'
      : cat === 'overweight' ? 'BMI above healthy range'
      : cat === 'obese' ? 'BMI well above healthy range'
      : cat === 'underweight' ? 'BMI below healthy range'
      : 'BMI recorded';
    add('bmi', bmiDelta, bmiLabel);
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, breakdown, factors };
}

/**
 * Blend today's raw score with the recent trend so the headline number is
 * stable (0.6 today / 0.4 recent average). Returns the raw score when there's
 * no history yet. Pure + clamped.
 */
export function smoothScore(raw: number, trend: ScorePoint[]): number {
  if (!Array.isArray(trend) || trend.length === 0) return raw;
  const valid = trend.map((p) => p.score).filter((n) => Number.isFinite(n));
  if (valid.length === 0) return raw;
  const avg = valid.reduce((a, n) => a + n, 0) / valid.length;
  return Math.max(0, Math.min(100, Math.round(0.6 * raw + 0.4 * avg)));
}

/**
 * Ordered, human-readable explanation of a score: biggest drags first, then
 * boosts, then neutral notes. Drives the "Why this score?" breakdown.
 */
export function explainHealthScore(result: HealthScoreResult): HealthScoreFactor[] {
  const rank = (t: FactorTone) => (t === 'negative' ? 0 : t === 'positive' ? 1 : 2);
  return [...(result.factors ?? [])].sort(
    (a, b) => rank(a.tone) - rank(b.tone) || Math.abs(b.delta) - Math.abs(a.delta),
  );
}

/** Band label for the score, for UI tone. */
export function scoreBand(score: number): { label: string; tone: 'good' | 'fair' | 'low' } {
  if (score >= 80) return { label: 'Good', tone: 'good' };
  if (score >= 55) return { label: 'Fair', tone: 'fair' };
  return { label: 'Needs care', tone: 'low' };
}

function isoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Persist today's score so it can trend. Returns true only after Supabase confirms the write. */
export async function upsertDailyScore(userId: string, result: HealthScoreResult): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('health_score_daily')
      .upsert(
        { user_id: userId, score_date: isoDate(), score: result.score, breakdown: result.breakdown, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,score_date' }
      );
    return !error;
  } catch {
    return false;
  }
}

export interface ScorePoint { date: string; score: number }

/** Load the recent score history (oldest→newest) for a sparkline/trend. */
export async function loadScoreTrend(userId: string, days = 7): Promise<ScorePoint[]> {
  try {
    const { data, error } = await supabase
      .from('health_score_daily')
      .select('score_date, score')
      .eq('user_id', userId)
      .order('score_date', { ascending: false })
      .limit(days);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((r) => ({ date: String((r as any).score_date), score: Number((r as any).score) }))
      .filter((p) => p.date && Number.isFinite(p.score))
      .reverse();
  } catch {
    return [];
  }
}
