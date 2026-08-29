import { isExpoToken } from './push.ts';

export type PushRecipient = { userId: string; deviceId: string; token: string };

export function matchPushRecipients(
  devices: Array<Record<string, unknown>>,
  preferences: Array<Record<string, unknown>>,
  profiles: Array<Record<string, unknown>>,
  state: string | null,
): PushRecipient[] {
  const optedIn = new Set(preferences
    .filter((preference) => preference.community_alerts_enabled === true && preference.notifications_paused === false)
    .map((preference) => String(preference.user_id)));
  const usersInState = state
    ? new Set(profiles.filter((profile) => String(profile.state ?? '') === state).map((profile) => String(profile.id)))
    : null;
  return devices.map((device) => ({
    userId: String(device.user_id),
    deviceId: String(device.id),
    token: String(device.expo_push_token ?? ''),
  })).filter((device) => optedIn.has(device.userId) && (!usersInState || usersInState.has(device.userId)) && isExpoToken(device.token));
}

/** Resolve active device tokens for opted-in users in an exact canonical state. */
export async function activeRecipientsForState(db: any, state: string | null, limit = 1000): Promise<PushRecipient[]> {
  const { data: devices, error: deviceError } = await db
    .from('push_devices').select('id, user_id, expo_push_token').is('disabled_at', null)
    .order('last_seen_at', { ascending: false }).limit(limit);
  if (deviceError) throw new Error('push_devices_lookup_failed');
  if (!Array.isArray(devices) || devices.length === 0) return [];

  const userIds = [...new Set(devices.map((device: Record<string, unknown>) => String(device.user_id)))];
  const { data: prefs, error: preferenceError } = await db
    .from('notification_preferences')
    .select('user_id, community_alerts_enabled, notifications_paused')
    .in('user_id', userIds).eq('community_alerts_enabled', true).eq('notifications_paused', false);
  if (preferenceError) throw new Error('notification_preferences_lookup_failed');
  if (!Array.isArray(prefs)) return [];
  const optedInUserIds = prefs.map((preference: Record<string, unknown>) => String(preference.user_id));
  let profiles: Array<Record<string, unknown>> = [];
  if (state && optedInUserIds.length) {
    const { data: profileRows, error: profileError } = await db
      .from('profiles').select('id, state').in('id', optedInUserIds).eq('state', state);
    if (profileError) throw new Error('profiles_state_lookup_failed');
    profiles = Array.isArray(profileRows) ? profileRows : [];
  }
  return matchPushRecipients(devices, prefs, profiles, state);
}
