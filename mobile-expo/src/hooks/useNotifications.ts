/**
 * useNotifications Hook
 * 
 * Manages notification preferences and permission state.
 * 
 * PUBLIC HEALTH REASONING:
 * - Opt-in only, supportive reminders
 * - Easy to enable/disable
 * - Transparent about what notifications do
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './useAuth';
import {
  NotificationPreferences,
  NOTIFICATIONS_ENABLED,
  getNotificationPreferences,
  updateNotificationPreferences,
  registerPushToken,
  registerForPushNotifications,
  scheduleDailyReminder,
  cancelDailyReminder,
  sendTestNotification,
  formatTimeDisplay,
} from '../services/notifications';
import { toUserMessage } from '../services/errorMessages';

// ============================================================================
// TYPES
// ============================================================================

interface UseNotificationsReturn {
  // State
  loading: boolean;
  saving: boolean;
  error: string | null;
  
  // Permission status
  permissionGranted: boolean;
  permissionAsked: boolean;
  
  // Preferences
  preferences: NotificationPreferences | null;
  reminderEnabled: boolean;
  reminderTime: string;
  reminderTimeDisplay: string;
  communityAlertsEnabled: boolean;

  // Feature flag
  featureEnabled: boolean;

  // Actions
  requestPermission: () => Promise<boolean>;
  setReminderEnabled: (enabled: boolean) => Promise<void>;
  setReminderTime: (time: string) => Promise<void>;
  setCommunityAlertsEnabled: (enabled: boolean) => Promise<void>;
  sendTest: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

// ============================================================================
// HOOK
// ============================================================================

export function useNotifications(): UseNotificationsReturn {
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [permissionAsked, setPermissionAsked] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  
  const hasFetchedRef = useRef(false);

  /**
   * Check current notification permission status
   */
  const checkPermission = useCallback(async () => {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionGranted(status === 'granted');
    setPermissionAsked(status !== 'undetermined');
  }, []);

  /**
   * Fetch preferences from database
   */
  const fetchPreferences = useCallback(async () => {
    if (!user?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const prefs = await getNotificationPreferences(user.id);
      setPreferences(prefs);
      
      // If reminders are enabled, ensure they're scheduled
      if (prefs.checkinReminderEnabled && permissionGranted) {
        await scheduleDailyReminder(prefs.checkinReminderTime, true);
      }
    } catch (err) {
      console.error('Error fetching notification preferences:', err);
      setError(toUserMessage(err, 'notifications'));
    } finally {
      setLoading(false);
    }
  }, [user?.id, permissionGranted]);

  /**
   * Request notification permission
   * Note: Push token may be null if FCM isn't configured,
   * but local notifications will still work
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      // Register will request permission and try to get token
      const token = await registerForPushNotifications();
      
      // Check actual permission status (token being null doesn't mean denied)
      const { status } = await Notifications.getPermissionsAsync();
      const granted = status === 'granted';
      
      setPermissionGranted(granted);
      setPermissionAsked(true);
      
      // Store push token if we got one (for future server-side push)
      if (token && user?.id) {
        await registerPushToken(user.id, token);
      }
      
      return granted;
    } catch (err) {
      console.error('Error requesting notification permission:', err);
      return false;
    }
  }, [user?.id]);

  /**
   * Enable/disable reminder
   */
  const setReminderEnabled = useCallback(async (enabled: boolean) => {
    if (!user?.id) return;
    
    try {
      setSaving(true);
      setError(null);
      
      // Request permission if enabling and not yet granted
      if (enabled && !permissionGranted) {
        const granted = await requestPermission();
        if (!granted) {
          setError('Notifications are off. Enable them in device settings to receive reminders.');
          return;
        }
      }
      
      // Update preferences in database
      const updated = await updateNotificationPreferences(user.id, {
        checkinReminderEnabled: enabled,
      });
      setPreferences(updated);
      
      // Schedule or cancel reminder
      if (enabled) {
        await scheduleDailyReminder(updated.checkinReminderTime, true);
      } else {
        await cancelDailyReminder();
      }
    } catch (err) {
      console.error('Error updating reminder setting:', err);
      setError(toUserMessage(err, 'notifications'));
    } finally {
      setSaving(false);
    }
  }, [user?.id, permissionGranted, requestPermission]);

  /**
   * Update reminder time
   */
  const setReminderTime = useCallback(async (time: string) => {
    if (!user?.id) return;
    
    try {
      setSaving(true);
      setError(null);
      
      const updated = await updateNotificationPreferences(user.id, {
        checkinReminderTime: time,
      });
      setPreferences(updated);
      
      // Reschedule if enabled
      if (updated.checkinReminderEnabled) {
        await scheduleDailyReminder(time, true);
      }
    } catch (err) {
      console.error('Error updating reminder time:', err);
      setError(toUserMessage(err, 'notifications'));
    } finally {
      setSaving(false);
    }
  }, [user?.id]);

  /**
   * Enable/disable official community health alerts (server push).
   * Requesting permission also captures the push token (when FCM is configured).
   */
  const setCommunityAlertsEnabled = useCallback(async (enabled: boolean) => {
    if (!user?.id) return;
    try {
      setSaving(true);
      setError(null);
      if (enabled && !permissionGranted) {
        const granted = await requestPermission();
        if (!granted) {
          setError('Notifications are off. Enable them in device settings to receive alerts.');
          return;
        }
      }
      const updated = await updateNotificationPreferences(user.id, { communityAlertsEnabled: enabled });
      setPreferences(updated);
    } catch (err) {
      console.error('Error updating community alerts setting:', err);
      setError(toUserMessage(err, 'notifications'));
    } finally {
      setSaving(false);
    }
  }, [user?.id, permissionGranted, requestPermission]);

  /**
   * Send test notification
   */
  const sendTest = useCallback(async () => {
    try {
      await sendTestNotification();
      return true;
    } catch (err) {
      console.error('Error sending test notification:', err);
      setError(toUserMessage(err, 'notifications'));
      return false;
    }
  }, []);

  /**
   * Refresh all data
   */
  const refresh = useCallback(async () => {
    await checkPermission();
    await fetchPreferences();
  }, [checkPermission, fetchPreferences]);

  // Initial load
  useEffect(() => {
    if (!hasFetchedRef.current && user?.id) {
      hasFetchedRef.current = true;
      checkPermission();
      fetchPreferences();
    }
  }, [user?.id, checkPermission, fetchPreferences]);

  // Re-check permission when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkPermission();
      }
    });

    return () => subscription.remove();
  }, [checkPermission]);

  // Derived values
  const reminderEnabled = preferences?.checkinReminderEnabled ?? false;
  const reminderTime = preferences?.checkinReminderTime ?? '09:00:00';
  const reminderTimeDisplay = formatTimeDisplay(reminderTime);
  const communityAlertsEnabled = preferences?.communityAlertsEnabled ?? false;

  return {
    loading,
    saving,
    error,
    permissionGranted,
    permissionAsked,
    preferences,
    reminderEnabled,
    reminderTime,
    reminderTimeDisplay,
    communityAlertsEnabled,
    featureEnabled: NOTIFICATIONS_ENABLED,
    requestPermission,
    setReminderEnabled,
    setReminderTime,
    setCommunityAlertsEnabled,
    sendTest,
    refresh,
  };
}

// Re-export types
export type { NotificationPreferences };
