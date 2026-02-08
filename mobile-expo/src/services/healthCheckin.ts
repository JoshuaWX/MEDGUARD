/**
 * Health Check-In Service
 * 
 * Handles daily health self-assessments, streak tracking, and community trend queries.
 * 
 * PUBLIC HEALTH REASONING:
 * - All risk levels are awareness-based, NOT diagnostic
 * - Uses transparent, rule-based logic only (no ML)
 * - Aggregated data is fully anonymous
 * - Supports early awareness without causing alarm
 */

import { supabase } from './supabase';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Risk levels for health check-ins
 * These are awareness levels, NOT diagnoses
 */
export type RiskLevel = 'low' | 'moderate' | 'elevated';

/**
 * Health check-in answers
 */
export interface CheckinAnswers {
  hasFever: boolean;
  hasHeadache: boolean;
  hasFatigue: boolean;
  hasDigestiveIssues: boolean;  // Diarrhea or vomiting
  hasWaterExposure: boolean;    // Exposure to stagnant water
  hasSickContact: boolean;      // Contact with someone visibly sick
}

/**
 * Complete health check-in record
 */
export interface HealthCheckin {
  id: string;
  userId: string;
  checkinDate: string;         // YYYY-MM-DD
  isoWeek: string;             // YYYY-Wxx
  state: string | null;
  answers: CheckinAnswers;
  riskLevel: RiskLevel;
  createdAt: string;
}

/**
 * User's health streak data
 */
export interface HealthStreak {
  currentStreak: number;
  longestStreak: number;
  lastCheckinDate: string | null;
}

/**
 * Community weekly trend for a state
 */
export interface CommunityTrend {
  isoWeek: string;
  state: string;
  totalCheckins: number;
  symptomCounts: {
    fever: number;
    headache: number;
    fatigue: number;
    digestive: number;
    waterExposure: number;
    sickContact: number;
  };
  riskDistribution: {
    low: number;
    moderate: number;
    elevated: number;
  };
  trendDirection: 'increasing' | 'stable' | 'decreasing' | null;
  prevWeekTotal: number | null;
}

/**
 * Free-text symptom entry (for future checkbox improvements)
 */
export interface FreetextSymptom {
  id: string;
  symptomText: string;
  checkinId: string | null;
  isoWeek: string;
  state: string | null;
  createdAt: string;
}

// ============================================================================
// RISK CALCULATION (RULE-BASED, TRANSPARENT)
// ============================================================================

/**
 * Calculate risk level based on check-in answers.
 * 
 * PUBLIC HEALTH NOTE:
 * This is NOT a diagnosis. It provides awareness-based risk levels
 * to encourage preventive measures and timely care-seeking.
 * 
 * Rules are transparent and deterministic:
 * - Elevated: Multiple symptoms + exposure, OR fever + digestive issues
 * - Moderate: Some symptoms OR symptoms + exposure
 * - Low: Minimal or no symptoms
 */
export function calculateRiskLevel(answers: CheckinAnswers): RiskLevel {
  let symptomScore = 0;
  let exposureCount = 0;

  // Weight symptoms (fever and digestive issues weighted higher)
  if (answers.hasFever) symptomScore += 2;
  if (answers.hasHeadache) symptomScore += 1;
  if (answers.hasFatigue) symptomScore += 1;
  if (answers.hasDigestiveIssues) symptomScore += 2;

  // Count exposure factors
  if (answers.hasWaterExposure) exposureCount += 1;
  if (answers.hasSickContact) exposureCount += 1;

  // Rule-based determination
  // Elevated: High symptom load + exposure, or fever + digestive (common illness pattern)
  if ((symptomScore >= 4 && exposureCount >= 1) || (answers.hasFever && answers.hasDigestiveIssues)) {
    return 'elevated';
  }

  // Moderate: Some symptoms or symptom + exposure
  if (symptomScore >= 2 || (symptomScore >= 1 && exposureCount >= 1)) {
    return 'moderate';
  }

  // Low: Minimal concerns
  return 'low';
}

/**
 * Get the current ISO week string (YYYY-Wxx format)
 */
export function getISOWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

/**
 * Get today's date in YYYY-MM-DD format (local time)
 */
export function getTodayDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
}

// ============================================================================
// CHECK-IN OPERATIONS
// ============================================================================

/**
 * Check if user has already completed today's check-in
 */
export async function hasCheckedInToday(userId: string): Promise<boolean> {
  const today = getTodayDate();
  
  const { data, error } = await supabase
    .from('health_checkins')
    .select('id')
    .eq('user_id', userId)
    .eq('checkin_date', today)
    .maybeSingle();

  if (error) {
    console.error('Error checking today\'s checkin:', error);
    return false;
  }

  return !!data;
}

/**
 * Get today's check-in if it exists
 */
export async function getTodayCheckin(userId: string): Promise<HealthCheckin | null> {
  const today = getTodayDate();
  
  const { data, error } = await supabase
    .from('health_checkins')
    .select('*')
    .eq('user_id', userId)
    .eq('checkin_date', today)
    .maybeSingle();

  if (error) {
    console.error('Error fetching today\'s checkin:', error);
    return null;
  }

  if (!data) return null;

  return mapCheckinFromDb(data);
}

/**
 * Submit a daily health check-in
 * 
 * @param userId - User's ID
 * @param answers - Check-in answers (yes/no to health questions)
 * @param state - User's current state (for aggregate trends)
 * @param otherSymptoms - Optional free-text symptoms (stored separately)
 * @returns The created check-in record
 */
export async function submitCheckin(
  userId: string,
  answers: CheckinAnswers,
  state: string | null,
  otherSymptoms?: string
): Promise<HealthCheckin> {
  const today = getTodayDate();
  const isoWeek = getISOWeek();
  const riskLevel = calculateRiskLevel(answers);

  // Insert check-in
  const { data: checkinData, error: checkinError } = await supabase
    .from('health_checkins')
    .insert({
      user_id: userId,
      checkin_date: today,
      iso_week: isoWeek,
      state,
      has_fever: answers.hasFever,
      has_headache: answers.hasHeadache,
      has_fatigue: answers.hasFatigue,
      has_digestive_issues: answers.hasDigestiveIssues,
      has_water_exposure: answers.hasWaterExposure,
      has_sick_contact: answers.hasSickContact,
      risk_level: riskLevel,
      answers: answers,
    })
    .select()
    .single();

  if (checkinError) {
    // Handle duplicate check-in gracefully
    if (checkinError.code === '23505') {
      throw new Error('You have already completed your check-in for today.');
    }
    console.error('Error submitting checkin:', checkinError);
    throw new Error('Failed to submit check-in. Please try again.');
  }

  // Store free-text symptoms separately if provided
  // NOTE: These are NOT used in risk calculation
  if (otherSymptoms && otherSymptoms.trim().length > 0) {
    await supabase
      .from('freetext_symptoms')
      .insert({
        user_id: userId,
        checkin_id: checkinData.id,
        symptom_text: otherSymptoms.trim(),
        iso_week: isoWeek,
        state,
      });
    // Don't throw on freetext error - it's optional
  }

  // Update streak
  await updateStreak(userId, today);

  return mapCheckinFromDb(checkinData);
}

/**
 * Get recent check-ins for a user (for history view)
 */
export async function getRecentCheckins(
  userId: string,
  limit: number = 7
): Promise<HealthCheckin[]> {
  const { data, error } = await supabase
    .from('health_checkins')
    .select('*')
    .eq('user_id', userId)
    .order('checkin_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching recent checkins:', error);
    return [];
  }

  return (data || []).map(mapCheckinFromDb);
}

// ============================================================================
// STREAK OPERATIONS
// ============================================================================

/**
 * Get user's current streak data
 */
export async function getStreak(userId: string): Promise<HealthStreak> {
  const { data, error } = await supabase
    .from('health_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching streak:', error);
    return { currentStreak: 0, longestStreak: 0, lastCheckinDate: null };
  }

  if (!data) {
    return { currentStreak: 0, longestStreak: 0, lastCheckinDate: null };
  }

  // Validate streak is still valid (check if yesterday was last check-in)
  const today = getTodayDate();
  const yesterday = getYesterdayDate();
  
  // If last check-in was today or yesterday, streak is valid
  // If older, streak should show 0 (will reset on next check-in)
  const isStreakValid = data.last_checkin_date === today || 
                        data.last_checkin_date === yesterday;

  return {
    currentStreak: isStreakValid ? data.current_streak : 0,
    longestStreak: data.longest_streak,
    lastCheckinDate: data.last_checkin_date,
  };
}

/**
 * Update streak after a check-in
 */
async function updateStreak(userId: string, checkinDate: string): Promise<void> {
  const yesterday = getYesterdayDate();
  
  // Get current streak
  const { data: existing } = await supabase
    .from('health_streaks')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  let newStreak = 1;
  let longestStreak = 1;

  if (existing) {
    // Check if this is consecutive
    if (existing.last_checkin_date === yesterday) {
      newStreak = existing.current_streak + 1;
    } else if (existing.last_checkin_date === checkinDate) {
      // Same day - no change needed
      return;
    }
    // Otherwise streak resets to 1
    
    longestStreak = Math.max(existing.longest_streak, newStreak);
  }

  // Upsert streak
  const { error } = await supabase
    .from('health_streaks')
    .upsert({
      user_id: userId,
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_checkin_date: checkinDate,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Error updating streak:', error);
  }
}

function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
}

// ============================================================================
// COMMUNITY TRENDS
// ============================================================================

/**
 * Get community health trends for a state
 * 
 * PUBLIC HEALTH NOTE:
 * This data is fully anonymous - no user identifiers are exposed.
 * Trends are informational only, NOT diagnostic.
 */
export async function getCommunityTrends(
  state: string,
  weeksBack: number = 4
): Promise<CommunityTrend[]> {
  const { data, error } = await supabase
    .from('community_weekly_trends')
    .select('*')
    .eq('state', state)
    .order('iso_week', { ascending: false })
    .limit(weeksBack);

  if (error) {
    console.error('Error fetching community trends:', error);
    return [];
  }

  return (data || []).map(mapTrendFromDb);
}

/**
 * Get the latest trend message for user's state
 * 
 * PUBLIC HEALTH NOTE:
 * Messages are informational only. Never imply diagnosis or outbreak.
 */
export function getTrendMessage(trend: CommunityTrend | null): string | null {
  if (!trend || trend.totalCheckins < 10) {
    // Not enough data for meaningful trend
    return null;
  }

  const { symptomCounts, totalCheckins, trendDirection } = trend;
  const messages: string[] = [];

  // Check for notable symptom prevalence (>20% of check-ins)
  const feverRate = symptomCounts.fever / totalCheckins;
  const digestiveRate = symptomCounts.digestive / totalCheckins;
  const fatigueRate = symptomCounts.fatigue / totalCheckins;

  if (feverRate > 0.2) {
    messages.push('More users in your area reported fever-related symptoms this week.');
  }

  if (digestiveRate > 0.15) {
    messages.push('Some users reported digestive concerns. Stay hydrated and practice food safety.');
  }

  if (fatigueRate > 0.25) {
    messages.push('Many users reported fatigue. Remember to rest and stay hydrated.');
  }

  // Add general preventive message if any notable trends
  if (messages.length > 0) {
    messages.push('Take preventive health measures and monitor how you feel.');
  } else if (trendDirection === 'increasing') {
    return 'Health check-ins are increasing in your area. Stay alert to how you feel.';
  }

  return messages.length > 0 ? messages.join(' ') : null;
}

// ============================================================================
// DATABASE MAPPERS
// ============================================================================

function mapCheckinFromDb(row: any): HealthCheckin {
  return {
    id: row.id,
    userId: row.user_id,
    checkinDate: row.checkin_date,
    isoWeek: row.iso_week,
    state: row.state,
    answers: {
      hasFever: row.has_fever,
      hasHeadache: row.has_headache,
      hasFatigue: row.has_fatigue,
      hasDigestiveIssues: row.has_digestive_issues,
      hasWaterExposure: row.has_water_exposure,
      hasSickContact: row.has_sick_contact,
    },
    riskLevel: row.risk_level,
    createdAt: row.created_at,
  };
}

function mapTrendFromDb(row: any): CommunityTrend {
  return {
    isoWeek: row.iso_week,
    state: row.state,
    totalCheckins: row.total_checkins,
    symptomCounts: {
      fever: row.fever_count,
      headache: row.headache_count,
      fatigue: row.fatigue_count,
      digestive: row.digestive_count,
      waterExposure: row.water_exposure_count,
      sickContact: row.sick_contact_count,
    },
    riskDistribution: {
      low: row.low_risk_count,
      moderate: row.moderate_risk_count,
      elevated: row.elevated_risk_count,
    },
    trendDirection: row.trend_direction,
    prevWeekTotal: row.prev_week_total,
  };
}

// ============================================================================
// RISK LEVEL DISPLAY HELPERS
// ============================================================================

/**
 * Get display text for risk level
 * 
 * PUBLIC HEALTH NOTE:
 * Language is carefully chosen to be:
 * - Non-diagnostic
 * - Non-alarmist
 * - Actionable without causing panic
 */
export function getRiskLevelDisplay(level: RiskLevel): {
  label: string;
  color: string;
  description: string;
  guidance: string;
} {
  switch (level) {
    case 'elevated':
      return {
        label: 'Elevated',
        color: '#f59e0b', // Warning amber
        description: 'Your responses suggest you may benefit from extra attention to your health today.',
        guidance: 'Consider resting, staying hydrated, and monitoring your symptoms. If symptoms persist or worsen, seek care from a healthcare provider.',
      };
    case 'moderate':
      return {
        label: 'Moderate',
        color: '#3b82f6', // Info blue
        description: 'Some health factors to be aware of.',
        guidance: 'Continue monitoring how you feel. Rest and hydration can help. If you notice changes, check in again tomorrow.',
      };
    case 'low':
    default:
      return {
        label: 'Low',
        color: '#10b981', // Success green
        description: 'Your responses indicate a healthy day.',
        guidance: 'Keep up the good habits! Stay hydrated and maintain your wellness routine.',
      };
  }
}

/**
 * Get emoji for streak milestones
 */
export function getStreakEmoji(streak: number): string {
  if (streak >= 30) return '🏆';
  if (streak >= 14) return '🔥';
  if (streak >= 7) return '⭐';
  if (streak >= 3) return '✨';
  return '💪';
}

/**
 * Get encouragement message for streak
 * 
 * Language is supportive, not competitive or pressuring
 */
export function getStreakMessage(streak: number): string {
  if (streak === 0) return 'Start your wellness journey today!';
  if (streak === 1) return 'Great start! One day at a time.';
  if (streak < 7) return `${streak} day streak! Keep it going.`;
  if (streak < 14) return `${streak} days! You're building a healthy habit.`;
  if (streak < 30) return `${streak} days strong! Amazing consistency.`;
  return `${streak} days! You're a wellness champion!`;
}
