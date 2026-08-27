import type { HealthCheckin, HealthStreak } from './healthCheckin';
import type { ScorePoint } from './healthScore';
import type { StepPoint } from './activity';
import { supabase } from './supabase';

export interface PersonalHealthProfileSummary {
  name: string | null;
  state: string | null;
  heightCm: number | null;
  weightKg: number | null;
  cycleTrackingEnabled: boolean;
}

export interface PersonalHealthDashboard {
  profile: PersonalHealthProfileSummary;
  todayCheckin: HealthCheckin | null;
  streak: HealthStreak;
  recentCheckins: HealthCheckin[];
  scoreTrend: ScorePoint[];
  activityTrend: StepPoint[];
}

const emptyAnswers = {
  hasFever: false,
  hasHeadache: false,
  hasFatigue: false,
  hasDigestiveIssues: false,
  hasWaterExposure: false,
  hasSickContact: false,
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const numberValue = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function mapCheckin(row: any): HealthCheckin | null {
  if (!row || typeof row.id !== 'string' || typeof row.checkin_date !== 'string') return null;
  const riskLevel = row.risk_level;
  if (riskLevel !== 'low' && riskLevel !== 'moderate' && riskLevel !== 'elevated') return null;
  return {
    id: row.id,
    // The RPC never exposes user_id. This value is not used by the My Health
    // UI and avoids expanding the encrypted cache payload.
    userId: '',
    checkinDate: row.checkin_date,
    isoWeek: typeof row.iso_week === 'string' ? row.iso_week : '',
    state: typeof row.state === 'string' ? row.state : null,
    answers: {
      ...emptyAnswers,
      hasFever: Boolean(row.has_fever),
      hasHeadache: Boolean(row.has_headache),
      hasFatigue: Boolean(row.has_fatigue),
      hasDigestiveIssues: Boolean(row.has_digestive_issues),
      hasWaterExposure: Boolean(row.has_water_exposure),
      hasSickContact: Boolean(row.has_sick_contact),
    },
    riskLevel,
    createdAt: typeof row.created_at === 'string' ? row.created_at : '',
  };
}

function mapDashboard(value: any): PersonalHealthDashboard {
  const recentCheckins = Array.isArray(value?.recent_checkins)
    ? value.recent_checkins.map(mapCheckin).filter((row: HealthCheckin | null): row is HealthCheckin => row !== null)
    : [];
  const mappedToday = mapCheckin(value?.today_checkin);
  const scoreTrend = Array.isArray(value?.score_trend)
    ? value.score_trend
      .map((row: any) => ({ date: String(row?.date ?? ''), score: toNumber(row?.score) }))
      .filter((row: { date: string; score: number | null }): row is ScorePoint => Boolean(row.date) && row.score !== null)
    : [];
  const activityTrend = Array.isArray(value?.activity_trend)
    ? value.activity_trend
      .map((row: any) => ({ date: String(row?.date ?? ''), steps: toNumber(row?.steps) }))
      .filter((row: { date: string; steps: number | null }): row is StepPoint => Boolean(row.date) && row.steps !== null)
    : [];
  const profile = value?.profile && typeof value.profile === 'object' ? value.profile : {};
  const streak = value?.streak && typeof value.streak === 'object' ? value.streak : {};

  return {
    profile: {
      name: typeof profile.name === 'string' ? profile.name : null,
      state: typeof profile.state === 'string' ? profile.state : null,
      heightCm: toNumber(profile.height_cm),
      weightKg: toNumber(profile.weight_kg),
      cycleTrackingEnabled: Boolean(profile.cycle_tracking_enabled),
    },
    todayCheckin: mappedToday,
    streak: {
      currentStreak: Math.max(0, Math.round(toNumber(streak.current_streak) ?? 0)),
      longestStreak: Math.max(0, Math.round(toNumber(streak.longest_streak) ?? 0)),
      lastCheckinDate: typeof streak.last_checkin_date === 'string' ? streak.last_checkin_date : null,
    },
    recentCheckins,
    scoreTrend,
    activityTrend,
  };
}

export function parsePersonalHealthDashboard(value: unknown): PersonalHealthDashboard | null {
  if (!value || typeof value !== 'object') return null;
  try {
    return mapDashboard(value);
  } catch {
    return null;
  }
}

/** The RPC derives the caller from auth.uid(); callers cannot select a user. */
export async function fetchPersonalHealthDashboard(recentDays = 7): Promise<PersonalHealthDashboard> {
  const { data, error } = await supabase.rpc('get_personal_health_dashboard', {
    recent_days: Math.max(1, Math.min(Math.trunc(recentDays) || 7, 30)),
  });
  if (error) throw error;
  const dashboard = parsePersonalHealthDashboard(data);
  if (!dashboard) throw new Error('Personal health dashboard returned an invalid response.');
  return dashboard;
}
