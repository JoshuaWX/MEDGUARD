/**
 * Health (wellness) score — transparent, non-diagnostic.
 *
 * A 0-100 indicator of day-to-day wellness habits, NOT a medical measure. The
 * formula is deterministic and explainable so the user (and the Brain/chat) can
 * see exactly why the number is what it is.
 *
 * Components (start at 100):
 *   - Today's check-in risk:  low 0 · moderate -20 · elevated -40 · none -10
 *   - Check-in streak:        +min(streak, 8)
 *   - Steps today (if known): >=8000 +5 · 5000-7999 +2 · <3000 -3
 *   - BMI band (if known):    normal 0 · overweight -3 · obese -8 · underweight -5
 * Clamped to 0-100.
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

export interface HealthScoreResult {
  score: number;
  breakdown: Record<string, number>;
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
  let score = 100;

  const riskDelta = input.todayRisk === 'low' ? 0
    : input.todayRisk === 'moderate' ? -20
    : input.todayRisk === 'elevated' ? -40
    : -10; // no check-in today
  breakdown.checkin = riskDelta;
  score += riskDelta;

  const streakBonus = Math.min(Math.max(input.streak ?? 0, 0), 8);
  breakdown.streak = streakBonus;
  score += streakBonus;

  if (typeof input.steps === 'number') {
    const stepDelta = input.steps >= 8000 ? 5 : input.steps >= 5000 ? 2 : input.steps < 3000 ? -3 : 0;
    breakdown.steps = stepDelta;
    score += stepDelta;
  }

  if (typeof input.bmi === 'number') {
    const cat = bmiCategory(input.bmi);
    const bmiDelta = cat === 'normal' ? 0 : cat === 'overweight' ? -3 : cat === 'obese' ? -8 : cat === 'underweight' ? -5 : 0;
    breakdown.bmi = bmiDelta;
    score += bmiDelta;
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, breakdown };
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

/** Persist today's score so it can trend. Best-effort. */
export async function upsertDailyScore(userId: string, result: HealthScoreResult): Promise<void> {
  try {
    await supabase
      .from('health_score_daily')
      .upsert(
        { user_id: userId, score_date: isoDate(), score: result.score, breakdown: result.breakdown, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,score_date' }
      );
  } catch {
    // non-fatal
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
