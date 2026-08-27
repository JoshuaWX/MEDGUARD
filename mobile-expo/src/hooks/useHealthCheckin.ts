/**
 * My Health state built on the single personal-health dashboard request.
 * Community trends stay separate because they are anonymous, non-personal
 * public-health data rather than part of a person's encrypted dashboard.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { usePersonalHealthData } from './PersonalHealthDataContext';
import {
  CheckinAnswers,
  HealthCheckin,
  HealthStreak,
  CommunityTrend,
  RiskLevel,
  submitCheckin,
  getCommunityTrends,
  calculateRiskLevel,
  getRiskLevelDisplay,
  getTrendMessage,
  getStreakEmoji,
  getStreakMessage,
} from '../services/healthCheckin';
import type { PersonalHealthProfileSummary } from '../services/personalHealthDashboard';
import type { ScorePoint } from '../services/healthScore';
import type { StepPoint } from '../services/activity';
import { toUserMessage } from '../services/errorMessages';

interface UseHealthCheckinReturn {
  loading: boolean;
  submitting: boolean;
  error: string | null;
  hasCheckedIn: boolean;
  todayCheckin: HealthCheckin | null;
  streak: HealthStreak;
  streakEmoji: string;
  streakMessage: string;
  communityTrends: CommunityTrend[];
  trendMessage: string | null;
  recentCheckins: HealthCheckin[];
  profile: PersonalHealthProfileSummary | null;
  scoreTrend: ScorePoint[];
  activityTrend: StepPoint[];
  personalDataLastUpdated: string | null;
  usingCachedPersonalData: boolean;
  submitDailyCheckin: (answers: CheckinAnswers, otherSymptoms?: string) => Promise<void>;
  calculateRisk: (answers: CheckinAnswers) => RiskLevel;
  getRiskDisplay: (level: RiskLevel) => ReturnType<typeof getRiskLevelDisplay>;
  refresh: () => Promise<void>;
}

const emptyStreak: HealthStreak = {
  currentStreak: 0,
  longestStreak: 0,
  lastCheckinDate: null,
};

export function useHealthCheckin(): UseHealthCheckinReturn {
  const { user: authUser, session } = useAuth();
  const {
    dashboard,
    loading,
    error: dashboardError,
    cacheFreshness,
    lastUpdated,
    refresh: refreshDashboard,
  } = usePersonalHealthData();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [communityTrends, setCommunityTrends] = useState<CommunityTrend[]>([]);
  const [communityError, setCommunityError] = useState<string | null>(null);
  const communityRequestIdRef = useRef(0);

  const userState = dashboard?.profile.state ?? null;
  const streak = dashboard?.streak ?? emptyStreak;
  const todayCheckin = dashboard?.todayCheckin ?? null;

  useEffect(() => {
    const requestId = ++communityRequestIdRef.current;
    if (!userState) {
      setCommunityTrends([]);
      setCommunityError(null);
      return;
    }
    void (async () => {
      try {
        const trends = await getCommunityTrends(userState, 4);
        if (requestId === communityRequestIdRef.current) {
          setCommunityTrends(trends);
          setCommunityError(null);
        }
      } catch (cause) {
        if (requestId === communityRequestIdRef.current) {
          setCommunityTrends([]);
          setCommunityError(toUserMessage(cause, 'checkin'));
        }
      }
    })();
  }, [userState]);

  const refresh = useCallback(async () => {
    await refreshDashboard();
    if (!userState) return;
    const trends = await getCommunityTrends(userState, 4);
    setCommunityTrends(trends);
  }, [refreshDashboard, userState]);

  const submitDailyCheckin = useCallback(async (
    answers: CheckinAnswers,
    otherSymptoms?: string,
  ) => {
    if (!authUser?.id || !session?.access_token || session.user.id !== authUser.id) {
      throw new Error('You must be signed in to submit a check-in');
    }
    if (todayCheckin) {
      throw new Error('You have already completed your check-in for today');
    }

    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitCheckin(authUser.id, answers, userState, otherSymptoms);
      // The insert is confirmed before this refresh. Only the confirmed RPC
      // response is saved back into the encrypted device cache.
      await refreshDashboard();
    } catch (cause) {
      const message = toUserMessage(cause, 'checkin');
      setSubmitError(message);
      throw cause;
    } finally {
      setSubmitting(false);
    }
  }, [authUser?.id, refreshDashboard, session?.access_token, session?.user.id, todayCheckin, userState]);

  const trendMessage = communityTrends.length > 0 ? getTrendMessage(communityTrends[0]) : null;
  const error = submitError ?? communityError ?? (dashboardError ? toUserMessage(dashboardError, 'checkin') : null);

  return {
    loading,
    submitting,
    error,
    hasCheckedIn: Boolean(todayCheckin),
    todayCheckin,
    streak,
    streakEmoji: getStreakEmoji(streak.currentStreak),
    streakMessage: getStreakMessage(streak.currentStreak),
    communityTrends,
    trendMessage,
    recentCheckins: dashboard?.recentCheckins ?? [],
    profile: dashboard?.profile ?? null,
    scoreTrend: dashboard?.scoreTrend ?? [],
    activityTrend: dashboard?.activityTrend ?? [],
    personalDataLastUpdated: lastUpdated,
    // Only call out the offline/stale-cache case. A fresh cached payload is
    // normal on launch and is silently replaced by the background refresh.
    usingCachedPersonalData: cacheFreshness === 'stale',
    submitDailyCheckin,
    calculateRisk: calculateRiskLevel,
    getRiskDisplay: getRiskLevelDisplay,
    refresh,
  };
}

export type { CheckinAnswers, HealthCheckin, HealthStreak, CommunityTrend, RiskLevel };
export { calculateRiskLevel, getRiskLevelDisplay, getStreakEmoji, getStreakMessage };
