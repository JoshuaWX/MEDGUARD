/**
 * Shared Expo push sender, reused by the push dispatchers (notify-area, …).
 *
 * Delivery uses the Expo Push API. Push tokens are only captured once the Expo
 * project has a real EAS projectId AND Firebase Cloud Messaging (FCM) is
 * configured. Until then callers simply find no tokens and this is never
 * invoked — a safe no-op — so building on it now is harmless.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface ExpoMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  channelId: string;
  data: Record<string, unknown>;
}

/** True for a well-formed Expo push token (guards against stale/garbage rows). */
export function isExpoToken(token: string | null | undefined): boolean {
  const t = String(token ?? '');
  return t.startsWith('ExponentPushToken') || t.startsWith('ExpoPushToken');
}

/**
 * Deliver messages via Expo Push in batches of 100. Best-effort: returns the
 * number accepted by the API (a 2xx batch counts as delivered-to-Expo).
 */
export async function sendExpoPush(messages: ExpoMessage[]): Promise<number> {
  let delivered = 0;
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      if (res.ok) delivered += batch.length;
    } catch {
      // best-effort; the caller's notification_log rows reflect intent
    }
  }
  return delivered;
}
