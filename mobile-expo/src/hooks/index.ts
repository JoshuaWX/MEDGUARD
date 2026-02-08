/**
 * Hooks exports
 */

export { useAuth } from './useAuth';
export { useUser } from './useUser';
export type { UserProfile } from './useUser';
export { useIntel } from './useIntel';
export { useAlerts } from './useAlerts';
export { useLocation } from './useLocation';
export { ThemeProvider, useTheme, useThemeColor } from './useTheme';
export type { ThemeMode, ThemeColors } from './useTheme';

// Health Check-in Hook
export { useHealthCheckin } from './useHealthCheckin';
export type {
  CheckinAnswers,
  HealthCheckin,
  HealthStreak,
  CommunityTrend,
  RiskLevel,
} from './useHealthCheckin';

// Notifications Hook
export { useNotifications } from './useNotifications';
