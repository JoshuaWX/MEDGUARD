import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import {
  type DeviceLocation,
  verifyAndPersistLocation,
  writeConfirmedLocationCache,
} from './locationSync';
import { captureOperationalError } from './sentry';

export const BACKGROUND_LOCATION_TASK = 'medguard-background-location-v1';

// This is intentionally module-scoped. Expo spins up the bundle without
// mounting React when a background location event arrives.
if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      captureOperationalError('background_location_task', error);
      return;
    }
    const locations = (data as { locations?: Location.LocationObject[] } | undefined)?.locations ?? [];
    const latest = locations.at(-1);
    if (!latest) return;

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId) return;
      const point: DeviceLocation = {
        latitude: latest.coords.latitude,
        longitude: latest.coords.longitude,
        accuracy: latest.coords.accuracy,
        altitude: latest.coords.altitude,
        timestamp: latest.timestamp,
      };
      const confirmed = await verifyAndPersistLocation(point);
      await writeConfirmedLocationCache(userId, confirmed);
    } catch (taskError) {
      // Background sync is best effort. The foreground provider retries next.
      captureOperationalError('background_location_sync', taskError);
    }
  });
}

export type BackgroundLocationStartReason =
  | 'started'
  | 'already_running'
  | 'task_manager_unavailable'
  | 'task_definition_missing'
  | 'background_location_unavailable'
  | 'start_failed';

export type BackgroundLocationStartResult = {
  ok: boolean;
  reason: BackgroundLocationStartReason;
};

export async function getBackgroundLocationRuntimeStatus(): Promise<{
  available: boolean;
  defined: boolean;
  registered: boolean;
  running: boolean;
}> {
  const [taskManagerAvailable, locationAvailable] = await Promise.all([
    TaskManager.isAvailableAsync(),
    Location.isBackgroundLocationAvailableAsync(),
  ]);
  const defined = TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK);
  const registered = taskManagerAvailable && defined
    ? await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK).catch(() => false)
    : false;
  const running = taskManagerAvailable && defined
    ? await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK).catch(() => false)
    : false;
  return { available: taskManagerAvailable && locationAvailable, defined, registered, running };
}

export async function startBackgroundLocationUpdates(): Promise<BackgroundLocationStartResult> {
  try {
    const taskManagerAvailable = await TaskManager.isAvailableAsync();
    if (!taskManagerAvailable) return { ok: false, reason: 'task_manager_unavailable' };
    if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) return { ok: false, reason: 'task_definition_missing' };
    if (!(await Location.isBackgroundLocationAvailableAsync())) return { ok: false, reason: 'background_location_unavailable' };
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      return { ok: true, reason: 'already_running' };
    }
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 15 * 60 * 1000,
      distanceInterval: 1000,
      deferredUpdatesInterval: 15 * 60 * 1000,
      deferredUpdatesDistance: 1000,
      pausesUpdatesAutomatically: true,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'MedGuard location updates',
        notificationBody: 'Keeping health alerts matched to your current area.',
      },
    });
    const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    return running ? { ok: true, reason: 'started' } : { ok: false, reason: 'start_failed' };
  } catch (startError) {
    captureOperationalError('background_location_start', startError);
    return { ok: false, reason: 'start_failed' };
  }
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}
