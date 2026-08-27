import { isExpoToken } from './push.ts';

export type PushRecipient = { userId: string; deviceId: string; token: string };

/** Resolve active device tokens for opted-in users in an exact canonical state. */
export async function activeRecipientsForState(db: any, state: string | null, limit = 1000): Promise<PushRecipient[]> {
  const { data: devices, error: deviceError } = await db
    .from('push_devices').select('id, user_id, expo_push_token').is('disabled_at', null)
    .order('last_seen_at', { ascending: false }).limit(limit);
  if (deviceError || !Array.isArray(devices) || devices.length === 0) return [];

  const userIds = [...new Set(devices.map((device: Record<string, unknown>) => String(device.user_id)))];
  const { data: prefs, error: preferenceError } = await db
    .from('notification_preferences')
    .select('user_id, community_alerts_enabled, notifications_paused, profiles!inner(state)')
    .in('user_id', userIds).eq('community_alerts_enabled', true).eq('notifications_paused', false);
  if (preferenceError || !Array.isArray(prefs)) return [];

  const optedIn = new Set(prefs
    .filter((pref: Record<string, any>) => !state || String(pref.profiles?.state ?? '') === state)
    .map((pref: Record<string, unknown>) => String(pref.user_id)));
  return devices.map((device: Record<string, unknown>) => ({
    userId: String(device.user_id), deviceId: String(device.id), token: String(device.expo_push_token ?? ''),
  })).filter((device: PushRecipient) => optedIn.has(device.userId) && isExpoToken(device.token));
}
