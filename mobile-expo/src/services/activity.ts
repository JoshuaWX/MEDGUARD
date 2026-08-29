/**
 * Daily activity (step counter) persistence.
 *
 * On Android, expo-sensors only reports steps counted WHILE the app is
 * subscribed (no historical daily total). We therefore keep a per-day running
 * total in user_daily_activity: each session adds its live-counted steps onto
 * the day's stored base.
 */

import { supabase } from './supabase';

function isoDate(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export async function loadTodaySteps(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('user_daily_activity')
      .select('step_count')
      .eq('user_id', userId)
      .eq('activity_date', isoDate())
      .maybeSingle();
    if (error || !data) return 0;
    const n = Number((data as any).step_count);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export async function upsertTodaySteps(
  userId: string,
  steps: number,
  source: 'pedometer' | 'health_connect' = 'pedometer',
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_daily_activity')
      .upsert(
        { user_id: userId, activity_date: isoDate(), step_count: Math.max(0, Math.round(steps)), source, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,activity_date' }
      );
    return !error;
  } catch {
    return false;
  }
}

export interface StepPoint { date: string; steps: number }

export async function loadStepTrend(userId: string, days = 7): Promise<StepPoint[]> {
  try {
    const { data, error } = await supabase
      .from('user_daily_activity')
      .select('activity_date, step_count')
      .eq('user_id', userId)
      .order('activity_date', { ascending: false })
      .limit(days);
    if (error || !Array.isArray(data)) return [];
    return data
      .map((r) => ({ date: String((r as any).activity_date), steps: Number((r as any).step_count) }))
      .filter((p) => p.date && Number.isFinite(p.steps))
      .reverse();
  } catch {
    return [];
  }
}
