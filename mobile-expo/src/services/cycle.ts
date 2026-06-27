/**
 * Menstrual cycle tracking — logging, settings, and deterministic predictions.
 *
 * Awareness/wellness only — estimates are based on the user's own logged history
 * and typical averages, NOT a medical or contraceptive guarantee. All data is
 * private to the user (RLS) and never enters any shared/area cache.
 */

import { supabase } from './supabase';

export type FlowIntensity = 'light' | 'normal' | 'heavy';
export type CyclePhase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal' | 'unknown';

export interface CycleLog {
  id: string;
  startDate: string;       // YYYY-MM-DD
  endDate: string | null;
  flowIntensity: FlowIntensity | null;
  symptoms: string[];
  notes: string | null;
}

export interface CycleSettings {
  avgCycleLength: number;  // days
  avgPeriodLength: number; // days
  remindersEnabled: boolean;
}

export interface CyclePrediction {
  phase: CyclePhase;
  dayOfCycle: number | null;
  nextPeriodStart: string | null;
  daysUntilNextPeriod: number | null;
  fertileWindowStart: string | null;
  fertileWindowEnd: string | null;
  ovulationDate: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  return isoDate(new Date(Date.parse(iso) + n * DAY_MS));
}
function daysBetween(aIso: string, bIso: string): number {
  return Math.round((Date.parse(bIso) - Date.parse(aIso)) / DAY_MS);
}

export const DEFAULT_CYCLE_SETTINGS: CycleSettings = {
  avgCycleLength: 28,
  avgPeriodLength: 5,
  remindersEnabled: false,
};

// --- Data access -----------------------------------------------------------

export async function loadCycleLogs(userId: string, limit = 12): Promise<CycleLog[]> {
  const { data, error } = await supabase
    .from('user_cycle_logs')
    .select('id, start_date, end_date, flow_intensity, symptoms, notes')
    .eq('user_id', userId)
    .order('start_date', { ascending: false })
    .limit(limit);
  if (error || !Array.isArray(data)) return [];
  return data.map((r: any) => ({
    id: String(r.id),
    startDate: String(r.start_date),
    endDate: r.end_date ? String(r.end_date) : null,
    flowIntensity: (r.flow_intensity as FlowIntensity) ?? null,
    symptoms: Array.isArray(r.symptoms) ? r.symptoms : [],
    notes: r.notes ?? null,
  }));
}

export async function loadCycleSettings(userId: string): Promise<CycleSettings> {
  const { data, error } = await supabase
    .from('user_cycle_settings')
    .select('avg_cycle_length, avg_period_length, reminders_enabled')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return { ...DEFAULT_CYCLE_SETTINGS };
  return {
    avgCycleLength: Number((data as any).avg_cycle_length) || 28,
    avgPeriodLength: Number((data as any).avg_period_length) || 5,
    remindersEnabled: Boolean((data as any).reminders_enabled),
  };
}

export async function saveCycleSettings(userId: string, s: CycleSettings): Promise<void> {
  await supabase.from('user_cycle_settings').upsert(
    {
      user_id: userId,
      avg_cycle_length: s.avgCycleLength,
      avg_period_length: s.avgPeriodLength,
      reminders_enabled: s.remindersEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );
}

export async function logPeriod(userId: string, entry: {
  startDate: string;
  endDate?: string | null;
  flowIntensity?: FlowIntensity | null;
  symptoms?: string[];
  notes?: string | null;
}): Promise<void> {
  await supabase.from('user_cycle_logs').upsert(
    {
      user_id: userId,
      start_date: entry.startDate,
      end_date: entry.endDate ?? null,
      flow_intensity: entry.flowIntensity ?? null,
      symptoms: entry.symptoms ?? [],
      notes: entry.notes ?? null,
    },
    { onConflict: 'user_id,start_date' }
  );
}

export async function setCycleTrackingEnabled(userId: string, enabled: boolean): Promise<void> {
  await supabase.from('profiles').update({ cycle_tracking_enabled: enabled }).eq('id', userId);
}

// --- Prediction (pure) -----------------------------------------------------

/**
 * Estimate cycle phase and upcoming dates from logged history + settings.
 * Uses the observed average cycle length when there are >=2 logs.
 */
export function computeCyclePrediction(
  logs: CycleLog[],
  settings: CycleSettings,
  today: string = isoDate(new Date())
): CyclePrediction {
  const sorted = logs.slice().sort((a, b) => b.startDate.localeCompare(a.startDate));
  const last = sorted[0];
  if (!last) {
    return {
      phase: 'unknown', dayOfCycle: null, nextPeriodStart: null, daysUntilNextPeriod: null,
      fertileWindowStart: null, fertileWindowEnd: null, ovulationDate: null,
    };
  }

  // Observed average cycle length from the gaps between consecutive starts.
  let cycleLen = settings.avgCycleLength;
  if (sorted.length >= 2) {
    const gaps: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const g = daysBetween(sorted[i + 1].startDate, sorted[i].startDate);
      if (g >= 18 && g <= 45) gaps.push(g);
    }
    if (gaps.length) cycleLen = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
  }
  const periodLen = settings.avgPeriodLength;

  const dayOfCycle = daysBetween(last.startDate, today); // 0 on first day
  const nextPeriodStart = addDays(last.startDate, cycleLen);
  const daysUntilNextPeriod = daysBetween(today, nextPeriodStart);
  const ovulationDate = addDays(last.startDate, cycleLen - 14);
  const fertileWindowStart = addDays(ovulationDate, -5);
  const fertileWindowEnd = addDays(ovulationDate, 1);

  let phase: CyclePhase = 'unknown';
  if (dayOfCycle >= 0) {
    const ovDay = cycleLen - 14;
    if (dayOfCycle < periodLen) phase = 'menstrual';
    else if (dayOfCycle < ovDay - 1) phase = 'follicular';
    else if (dayOfCycle <= ovDay + 1) phase = 'ovulation';
    else phase = 'luteal';
  }

  return {
    phase,
    dayOfCycle: dayOfCycle >= 0 ? dayOfCycle + 1 : null, // 1-indexed for display
    nextPeriodStart,
    daysUntilNextPeriod,
    fertileWindowStart,
    fertileWindowEnd,
    ovulationDate,
  };
}

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstrual: 'Menstrual',
  follicular: 'Follicular',
  ovulation: 'Ovulation (fertile)',
  luteal: 'Luteal',
  unknown: 'Not enough data yet',
};
