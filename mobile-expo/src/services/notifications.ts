/**
 * Notification Preferences Service
 * 
 * Push notification support for daily health check-in reminders.
 * 
 * PUBLIC HEALTH REASONING:
 * - Opt-in only, never enabled by default
 * - Maximum one reminder per day
 * - Supportive, non-alarmist language
 * - No pressure or urgency-inducing copy
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { supabase } from './supabase';

// ============================================================================
// FEATURE FLAG - MASTER SWITCH
// ============================================================================

/**
 * Master switch for notification feature.
 * Set to true to enable notifications.
 */
export const NOTIFICATIONS_ENABLED = true;

// ============================================================================
// EXPO NOTIFICATIONS SETUP
// ============================================================================

/**
 * Configure notification handler
 * Must be called at app startup
 */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request notification permissions and get push token
 * Returns null if permissions denied or not a physical device
 * 
 * NOTE: Push tokens require Firebase (FCM) setup on Android.
 * Local scheduled notifications work without FCM.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Must be a physical device for push notifications
  if (!Device.isDevice) {
    console.log('[Notifications] Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('[Notifications] Permission not granted');
    return null;
  }

  // Android routes each kind of MedGuard message through a clear channel.
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('area-alerts', {
      name: 'Area health alerts', importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250], lightColor: '#11b4d4', description: 'Verified area alerts and risk estimates',
    });
    await Notifications.setNotificationChannelAsync('health-news', {
      name: 'Health News', importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 180], lightColor: '#11b4d4', description: 'Official NCDC and WHO updates',
    });
    await Notifications.setNotificationChannelAsync('health-reminders', {
      name: 'Health Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#11b4d4',
      description: 'Daily health check-in reminders',
    });
  }

  // Try to get Expo push token (requires Firebase/FCM on Android)
  // This is only needed for remote push notifications from a server
  // Local scheduled notifications work without this
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    // No real EAS project id yet → remote push isn't provisioned. Skip quietly;
    // local scheduled notifications still work. (Replace the placeholder in
    // app.json via `eas init` to enable server-sent push.)
    if (!projectId || projectId === 'REPLACE_WITH_EAS_PROJECT_ID') {
      console.log('[Notifications] EAS projectId not set; skipping push token (local notifications still work).');
      return null;
    }
    const token = await Notifications.getExpoPushTokenAsync({
      projectId,
    });
    return token.data;
  } catch (error) {
    // FCM not configured - this is OK for local notifications
    console.log('[Notifications] Push token unavailable (FCM not configured). Local notifications will still work.');
    return null;
  }
}

/** Get a token only when permission already exists; never prompts on app launch. */
export async function getExistingPushToken(): Promise<string | null> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted' ? registerForPushNotifications() : null;
}

// ============================================================================
// TYPES
// ============================================================================

export interface NotificationPreferences {
  userId: string;
  
  // Daily check-in reminder
  checkinReminderEnabled: boolean;
  checkinReminderTime: string;  // HH:MM:SS format
  
  // Timezone for local time
  timezone: string;
  
  // Community trend alerts
  communityAlertsEnabled: boolean;
  
  // Push token (for future use)
  pushToken: string | null;
  
  // Pause all notifications
  notificationsPaused: boolean;
  notificationsPausedUntil: string | null;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
}

export interface ReminderConfig {
  enabled: boolean;
  time: string;  // HH:MM format for display
  timezone: string;
}

// ============================================================================
// DEFAULT PREFERENCES
// ============================================================================

/**
 * Default notification preferences.
 * All opt-in features are disabled by default.
 */
export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'createdAt' | 'updatedAt'> = {
  checkinReminderEnabled: false,  // Disabled by default
  checkinReminderTime: '09:00:00',
  timezone: 'Africa/Lagos',
  communityAlertsEnabled: false,  // Disabled by default
  pushToken: null,
  notificationsPaused: false,
  notificationsPausedUntil: null,
};

// ============================================================================
// NOTIFICATION COPY (NON-ALARMIST, SUPPORTIVE)
// ============================================================================

/**
 * Notification message templates.
 * 
 * Language guidelines:
 * - Supportive, not urgent
 * - Optional, not mandatory
 * - Encouraging, not pressuring
 * - No medical urgency
 */
export const NOTIFICATION_TEMPLATES = {
  checkinReminder: {
    title: 'Daily Health Check-In',
    body: 'Take a moment to check in on how you\'re feeling today. Your wellness matters.',
  },
  streakMilestone: {
    title: 'Wellness Milestone! 🎉',
    body: (days: number) => `You've checked in for ${days} days in a row. Great job staying consistent!`,
  },
  communityTrend: {
    title: 'Community Health Update',
    body: 'See what\'s trending in your area\'s health reports.',
  },
};

// ============================================================================
// PREFERENCES OPERATIONS (ARCHITECTURE ONLY)
// ============================================================================

/**
 * Get user's notification preferences.
 * Returns defaults if no preferences exist.
 */
export async function getNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('Error fetching notification preferences:', error);
  }

  if (!data) {
    return {
      userId,
      ...DEFAULT_PREFERENCES,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  return mapPreferencesFromDb(data);
}

/**
 * Update notification preferences.
 * 
 * NOTE: Even if enabled, notifications won't be sent until
 * NOTIFICATIONS_ENABLED is set to true.
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: Partial<Pick<NotificationPreferences, 
    'checkinReminderEnabled' | 
    'checkinReminderTime' | 
    'timezone' | 
    'communityAlertsEnabled' | 
    'notificationsPaused' |
    'notificationsPausedUntil'
  >>
): Promise<NotificationPreferences> {
  const { data, error } = await supabase
    .from('notification_preferences')
    .upsert({
      user_id: userId,
      checkin_reminder_enabled: updates.checkinReminderEnabled,
      checkin_reminder_time: updates.checkinReminderTime,
      timezone: updates.timezone,
      community_alerts_enabled: updates.communityAlertsEnabled,
      notifications_paused: updates.notificationsPaused,
      notifications_paused_until: updates.notificationsPausedUntil,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    console.error('Error updating notification preferences:', error);
    throw new Error('Failed to update notification preferences');
  }

  return mapPreferencesFromDb(data);
}

/**
 * Register push token for future use.
 * 
 * NOTE: Tokens are stored but not used until notifications are enabled.
 */
export async function registerPushToken(_userId: string, token: string): Promise<void> {
  const { error } = await supabase.functions.invoke('register-push-device', {
    body: { token, platform: Platform.OS },
  });
  if (error) {
    console.error('Error registering push token:', error);
    throw new Error('Failed to register push token');
  }
}

export async function unregisterPushToken(token: string): Promise<void> {
  await supabase.functions.invoke('register-push-device', { body: { action: 'unregister', token } });
}

export async function sendTestNotification(token: string): Promise<boolean> {
  const { data, error } = await supabase.functions.invoke('send-test-notification', { body: { token } });
  if (error) throw new Error('Could not send test notification');
  return Boolean((data as { accepted?: boolean } | null)?.accepted);
}

// ============================================================================
// REMINDER SCHEDULING
// ============================================================================

/**
 * Schedule daily check-in reminder notification
 * Uses local notifications for reliability
 */
export async function scheduleDailyReminder(
  userId: string,
  reminderTime: string,
  enabled: boolean
): Promise<void> {
  // Cancel any existing reminders first
  await cancelDailyReminder(userId);

  if (!enabled || !NOTIFICATIONS_ENABLED) {
    return;
  }

  // Parse reminder time (HH:MM:SS)
  const [hours, minutes] = reminderTime.split(':').map(Number);

  // Schedule daily repeating notification
  const identifier = await Notifications.scheduleNotificationAsync({
    content: {
      title: NOTIFICATION_TEMPLATES.checkinReminder.title,
      body: NOTIFICATION_TEMPLATES.checkinReminder.body,
      sound: 'default',
      data: { type: 'checkin_reminder', medguardReminder: true, userId },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: hours,
      minute: minutes,
    },
  });
  await SecureStore.setItemAsync(`mg:reminder:${userId}`, identifier);

  console.log(`[Notifications] Daily reminder scheduled for ${hours}:${minutes}`);
}

/**
 * Cancel daily check-in reminder
 */
export async function cancelDailyReminder(userId: string): Promise<void> {
  const key = `mg:reminder:${userId}`;
  const identifier = await SecureStore.getItemAsync(key);
  if (identifier) await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => undefined);
  await SecureStore.deleteItemAsync(key);
}

/**
 * Check if a check-in reminder should be sent.
 */
export async function shouldSendReminder(userId: string): Promise<boolean> {
  // Feature is disabled
  if (!NOTIFICATIONS_ENABLED) {
    return false;
  }

  // This would check:
  // 1. User has opted in
  // 2. User hasn't checked in today
  // 3. Current time is past reminder time
  // 4. No reminder sent today
  
  return false;
}

/**
 * Schedule a one-time local notification.
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  triggerTime: Date
): Promise<string | null> {
  if (!NOTIFICATIONS_ENABLED) {
    console.log('[Notifications] Feature disabled. Would schedule:', { title, body, triggerTime });
    return null;
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: 'default',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerTime,
    },
  });

  return id;
}

/**
 * Fire a local streak-milestone celebration (immediate). No-op without
 * permission. Supportive, never pressuring.
 */
export async function notifyStreakMilestone(days: number): Promise<void> {
  if (!NOTIFICATIONS_ENABLED) return;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: NOTIFICATION_TEMPLATES.streakMilestone.title,
        body: NOTIFICATION_TEMPLATES.streakMilestone.body(days),
        sound: 'default',
        data: { type: 'streak_milestone' },
      },
      trigger: null,
    });
  } catch {
    // permission not granted — ignore
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function mapPreferencesFromDb(row: any): NotificationPreferences {
  return {
    userId: row.user_id,
    checkinReminderEnabled: row.checkin_reminder_enabled ?? false,
    checkinReminderTime: row.checkin_reminder_time ?? '09:00:00',
    timezone: row.timezone ?? 'Africa/Lagos',
    communityAlertsEnabled: row.community_alerts_enabled ?? false,
    pushToken: row.push_token,
    notificationsPaused: row.notifications_paused ?? false,
    notificationsPausedUntil: row.notifications_paused_until,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Parse time string to Date for today.
 */
export function parseTimeToday(timeString: string, timezone: string): Date {
  const [hours, minutes] = timeString.split(':').map(Number);
  const now = new Date();
  now.setHours(hours, minutes, 0, 0);
  return now;
}

/**
 * Format time for display (HH:MM AM/PM).
 */
export function formatTimeDisplay(timeString: string): string {
  const [hours, minutes] = timeString.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}
