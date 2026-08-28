/**
 * Sentry — real-time error & crash reporting.
 *
 * PRIVACY (MedGuard is a health app): we do NOT send personal data to Sentry.
 * - `sendDefaultPii: false` keeps IPs/usernames off events.
 * - `beforeSend` strips any user email/username/ip that slips through; we only
 *   ever attach the Supabase user *id* (see `setSentryUser`).
 * - `beforeBreadcrumb` drops console breadcrumbs, because check-in answers and
 *   Brain payloads can be console-logged during development.
 *
 * The DSN is write-only (safe to ship in the binary). Everything else — source
 * map upload etc. — happens at build time via the Expo config plugin using a
 * separate secret token (SENTRY_AUTH_TOKEN), never in this file.
 */

import * as Sentry from '@sentry/react-native';

// DSN can be overridden per-environment; falls back to the project's DSN so the
// SDK works even without a .env entry. (Non-secret — receives events only.)
const SENTRY_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  'https://7e77d8754e58e2926dbd2a6b14594ddc@o4511438941978624.ingest.de.sentry.io/4511677991682128';

/**
 * Shared navigation integration — created here so both `initSentry` (App.tsx)
 * and the NavigationContainer (RootNavigator) can reference the same instance.
 * Registering the container gives Sentry screen-transition breadcrumbs.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
});

export function initSentry(): void {
  Sentry.init({
    dsn: SENTRY_DSN,
    // Report only from real (release/preview) builds — not the local dev machine.
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    // Performance sampling (screen loads, network). Keep modest to control volume.
    tracesSampleRate: 0.2,
    // Native (Java/Kotlin/ObjC) crash capture, on by default — kept explicit.
    enableNativeCrashHandling: true,
    // Do not collect IP/PII automatically.
    sendDefaultPii: false,
    integrations: [navigationIntegration],
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Console logs may contain symptoms / Brain payloads — never ship them.
      if (breadcrumb.category === 'console') return null;
      return breadcrumb;
    },
  });
}

/** Attach only the Supabase user id (no email/health data) for issue grouping. */
export function setSentryUser(userId: string | null | undefined): void {
  Sentry.setUser(userId ? { id: userId } : null);
}

/** Report a technical failure without attaching coordinates, symptoms, or copy. */
export function captureOperationalError(scope: string, error: unknown): void {
  Sentry.captureException(error instanceof Error ? error : new Error(String(error)), {
    tags: { medguard_scope: scope },
  });
}
