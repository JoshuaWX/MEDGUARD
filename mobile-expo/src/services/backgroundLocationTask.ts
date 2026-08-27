import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from './supabase';
import {
  type DeviceLocation,
  verifyAndPersistLocation,
  writeConfirmedLocationCache,
} from './locationSync';

export const BACKGROUND_LOCATION_TASK = 'medguard-background-location-v1';

let registered = false;

export function registerBackgroundLocationTask(): void {
  if (registered || TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
    registered = true;
    return;
  }
  registered = true;

  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) return;
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
    } catch {
      // Background sync is best effort. The foreground provider retries next.
    }
  });
}

export async function startBackgroundLocationUpdates(): Promise<void> {
  registerBackgroundLocationTask();
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (running) return;
  await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 15 * 60 * 1000,
    distanceInterval: 1000,
    pausesUpdatesAutomatically: true,
    showsBackgroundLocationIndicator: true,
    foregroundService: {
      notificationTitle: 'MedGuard location updates',
      notificationBody: 'Keeping health alerts matched to your current area.',
    },
  });
}

export async function stopBackgroundLocationUpdates(): Promise<void> {
  const running = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
  if (running) await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
}
