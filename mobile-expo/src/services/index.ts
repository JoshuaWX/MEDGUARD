/**
 * Services exports
 */

export { supabase } from './supabase';
export type { Database } from './supabase';

export { invokeEdgeFunction } from './edge';
export type { EdgeInvokeOptions } from './edge';

// Health Check-in Service
export {
  calculateRiskLevel,
  getISOWeek,
  getTodayDate,
  hasCheckedInToday,
  getTodayCheckin,
  submitCheckin,
  getRecentCheckins,
  getStreak,
  getCommunityTrends,
  getTrendMessage,
  getRiskLevelDisplay,
  getStreakEmoji,
  getStreakMessage,
} from './healthCheckin';
export type {
  RiskLevel,
  CheckinAnswers,
  HealthCheckin,
  HealthStreak,
  CommunityTrend,
} from './healthCheckin';

// Notification Preferences (architecture only, not enabled)
export {
  NOTIFICATIONS_ENABLED,
  DEFAULT_PREFERENCES,
  NOTIFICATION_TEMPLATES,
  getNotificationPreferences,
  updateNotificationPreferences,
  formatTimeDisplay,
} from './notifications';
export type { NotificationPreferences, ReminderConfig } from './notifications';
