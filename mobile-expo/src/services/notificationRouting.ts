/**
 * notificationRouting
 *
 * Deep-links a tapped notification to the right screen. The dispatcher
 * (`supabase/functions/notify-area`) and local notifications
 * (`services/notifications.ts`) both stamp every message with `data.type`, which
 * we map to a destination here:
 *   - community_trend / outbreak(_alert)  → Alerts
 *   - checkin_reminder / streak_milestone → My Health tab
 *
 * A module-level `navigationRef` is shared with RootNavigator so we can navigate
 * from outside React (listeners fire regardless of what's mounted). Navigation
 * is gated on the user being signed in and the container being ready; taps that
 * arrive earlier (e.g. cold start) are queued and flushed once both hold.
 */

import { useEffect, useRef } from 'react';
import { createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import type { RootStackParamList } from '../navigation/types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type NotificationData = { type?: string; [key: string]: unknown };

/** Resolve a notification payload to a navigation action. Returns false if no route matches. */
function routeFor(data: NotificationData | undefined | null): (() => void) | null {
  const type = String(data?.type || '');
  switch (type) {
    case 'community_trend':
    case 'outbreak':
    case 'outbreak_alert':
      return () => navigationRef.navigate('Alerts' as never);
    case 'checkin_reminder':
    case 'streak_milestone':
      // My Health lives inside the MainTabs bottom-tab navigator.
      return () => (navigationRef.navigate as (name: string, params?: object) => void)('MainTabs', { screen: 'MyHealth' });
    default:
      return null;
  }
}

/**
 * Listen for notification taps and route them. `enabled` should be true only
 * once the user is authenticated (so we never push app screens onto the auth
 * stack). Cold-start taps are captured and replayed when enabled turns true.
 */
export function useNotificationRouting(enabled: boolean): void {
  const pendingRef = useRef<NotificationData | null>(null);

  const tryNavigate = (data: NotificationData | undefined | null) => {
    if (!enabled || !navigationRef.isReady()) {
      pendingRef.current = data ?? null;
      return;
    }
    const go = routeFor(data);
    if (go) go();
  };

  // Capture a cold-start tap (app launched by tapping a notification).
  useEffect(() => {
    let cancelled = false;
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (cancelled || !response) return;
        tryNavigate(response.notification.request.content.data as NotificationData);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live taps while the app is running.
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      tryNavigate(response.notification.request.content.data as NotificationData);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  // Flush a queued tap once the user is authenticated and nav is ready.
  useEffect(() => {
    if (!enabled || !pendingRef.current) return;
    const data = pendingRef.current;
    pendingRef.current = null;
    // Defer a tick so the tab navigator has mounted after auth routing.
    const id = setTimeout(() => {
      const go = routeFor(data);
      if (go && navigationRef.isReady()) go();
    }, 400);
    return () => clearTimeout(id);
  }, [enabled]);
}
