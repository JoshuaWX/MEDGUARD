/**
 * useHealthCheckin Hook
 * 
 * React hook for managing daily health check-ins, streaks, and community trends.
 * 
 * PUBLIC HEALTH REASONING:
 * - Provides easy access to check-in functionality
 * - Manages loading/error states
 * - Caches data appropriately
 * - Enforces one check-in per day rule
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { useUser } from './useUser';
import {
  CheckinAnswers,
  HealthCheckin,
  HealthStreak,
  CommunityTrend,
  RiskLevel,
  hasCheckedInToday,
  getTodayCheckin,
  submitCheckin,
  getRecentCheckins,
  getStreak,
  getCommunityTrends,
  calculateRiskLevel,
  getRiskLevelDisplay,
  getTrendMessage,
  getStreakEmoji,
  getStreakMessage,
} from '../services/healthCheckin';

// ============================================================================
// TYPES
// ============================================================================

interface UseHealthCheckinReturn {
  // State
  loading: boolean;
  submitting: boolean;
  error: string | null;
  
  // Today's check-in
  hasCheckedIn: boolean;
  todayCheckin: HealthCheckin | null;
  
  // Streak data
  streak: HealthStreak;
  streakEmoji: string;
  streakMessage: string;
  
  // Community trends
  communityTrends: CommunityTrend[];
  trendMessage: string | null;
  
  // Recent history
  recentCheckins: HealthCheckin[];
  
  // Actions
  submitDailyCheckin: (answers: CheckinAnswers, otherSymptoms?: string) => Promise<void>;
  calculateRisk: (answers: CheckinAnswers) => RiskLevel;
  getRiskDisplay: (level: RiskLevel) => ReturnType<typeof getRiskLevelDisplay>;
  refresh: () => Promise<void>;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useHealthCheckin(): UseHealthCheckinReturn {
  const { user: authUser } = useAuth();
  const { user: profile } = useUser();
  
  // State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [hasCheckedIn, setHasCheckedIn] = useState(false);
  const [todayCheckin, setTodayCheckin] = useState<HealthCheckin | null>(null);
  const [streak, setStreak] = useState<HealthStreak>({
    currentStreak: 0,
    longestStreak: 0,
    lastCheckinDate: null,
  });
  const [recentCheckins, setRecentCheckins] = useState<HealthCheckin[]>([]);
  const [communityTrends, setCommunityTrends] = useState<CommunityTrend[]>([]);
  
  const requestIdRef = useRef(0);
  
  // Get user's state for community trends
  const userState = profile?.state || null;
  
  /**
   * Fetch all check-in data
   */
  const fetchData = useCallback(async () => {
    if (!authUser?.id) {
      requestIdRef.current += 1;
      setLoading(false);
      return;
    }
    
    const requestId = ++requestIdRef.current;

    try {
      setLoading(true);
      setError(null);
      
      // Fetch in parallel for efficiency
      const [
        checkedIn,
        today,
        streakData,
        recent,
      ] = await Promise.all([
        hasCheckedInToday(authUser.id),
        getTodayCheckin(authUser.id),
        getStreak(authUser.id),
        getRecentCheckins(authUser.id, 7),
      ]);
      
      if (requestId !== requestIdRef.current) return;

      setHasCheckedIn(checkedIn);
      setTodayCheckin(today);
      setStreak(streakData);
      setRecentCheckins(recent);
      
      // Fetch community trends if user has a state
      if (userState) {
        const trends = await getCommunityTrends(userState, 4);
        if (requestId !== requestIdRef.current) return;
        setCommunityTrends(trends);
      } else {
        setCommunityTrends([]);
      }
      
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      console.error('Error fetching health checkin data:', err);
      setError('Failed to load health data');
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [authUser?.id, userState]);
  
  /**
   * Initial fetch on mount
   */
  useEffect(() => {
    fetchData();
  }, [authUser?.id, fetchData]);
  
  /**
   * Submit daily check-in
   */
  const submitDailyCheckin = useCallback(async (
    answers: CheckinAnswers,
    otherSymptoms?: string
  ) => {
    if (!authUser?.id) {
      throw new Error('You must be signed in to submit a check-in');
    }
    
    if (hasCheckedIn) {
      throw new Error('You have already completed your check-in for today');
    }
    
    try {
      setSubmitting(true);
      setError(null);
      
      const checkin = await submitCheckin(
        authUser.id,
        answers,
        userState,
        otherSymptoms
      );
      
      // Update local state
      setTodayCheckin(checkin);
      setHasCheckedIn(true);
      
      // Refresh streak after check-in
      const newStreak = await getStreak(authUser.id);
      setStreak(newStreak);
      
      // Add to recent checkins
      setRecentCheckins(prev => [checkin, ...prev.slice(0, 6)]);
      
    } catch (err: any) {
      const message = err?.message || 'Failed to submit check-in';
      setError(message);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, [authUser?.id, hasCheckedIn, userState]);
  
  /**
   * Get trend message for display
   */
  const trendMessage = communityTrends.length > 0 
    ? getTrendMessage(communityTrends[0])
    : null;
  
  /**
   * Get streak display helpers
   */
  const streakEmoji = getStreakEmoji(streak.currentStreak);
  const streakMessage = getStreakMessage(streak.currentStreak);
  
  return {
    // State
    loading,
    submitting,
    error,
    
    // Today's check-in
    hasCheckedIn,
    todayCheckin,
    
    // Streak
    streak,
    streakEmoji,
    streakMessage,
    
    // Community trends
    communityTrends,
    trendMessage,
    
    // History
    recentCheckins,
    
    // Actions
    submitDailyCheckin,
    calculateRisk: calculateRiskLevel,
    getRiskDisplay: getRiskLevelDisplay,
    refresh: fetchData,
  };
}

// Re-export types and helpers for convenience
export type { CheckinAnswers, HealthCheckin, HealthStreak, CommunityTrend, RiskLevel };
export { calculateRiskLevel, getRiskLevelDisplay, getStreakEmoji, getStreakMessage };
