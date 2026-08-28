/**
 * Android Health Connect — reads aggregated step totals from the OS health
 * store. This gives true all-day, historical, and weekly step counts that are
 * recorded by the system/other fitness apps even while MedGuard is closed.
 *
 * Health Connect only has step data if a source on the device feeds it (the
 * phone's system step provider, Google Fit, Samsung Health, etc.). Where it is
 * unavailable or empty, callers fall back to the live foreground pedometer.
 */

import { Linking, Platform } from 'react-native';

type StepHistoryPoint = { date: string; steps: number };

let initialized = false;

// Lazily import so iOS / web builds never touch the native module.
async function hc() {
  if (Platform.OS !== 'android') return null;
  try {
    return await import('react-native-health-connect');
  } catch {
    return null;
  }
}

export async function isHealthConnectAvailable(): Promise<boolean> {
  return (await getHealthConnectCapability()) === 'available';
}

export type HealthConnectCapability = 'available' | 'update_required' | 'unavailable' | 'unsupported' | 'error';

export async function getHealthConnectCapability(): Promise<HealthConnectCapability> {
  if (Platform.OS !== 'android') return 'unsupported';
  const lib = await hc();
  if (!lib) return 'unsupported';
  try {
    const status = await lib.getSdkStatus();
    if (status === lib.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
    if (status === lib.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED) return 'update_required';
    return 'unavailable';
  } catch {
    return 'error';
  }
}

async function ensureInit(lib: NonNullable<Awaited<ReturnType<typeof hc>>>): Promise<boolean> {
  if (initialized) return true;
  try {
    initialized = await lib.initialize();
    return initialized;
  } catch {
    return false;
  }
}

export async function hasStepsPermission(): Promise<boolean> {
  const lib = await hc();
  if (!lib || !(await ensureInit(lib))) return false;
  try {
    const granted = await lib.getGrantedPermissions();
    return granted.some((p: any) => p.recordType === 'Steps' && p.accessType === 'read');
  } catch {
    return false;
  }
}

export async function requestStepsPermission(): Promise<boolean> {
  const lib = await hc();
  if (!lib || !(await ensureInit(lib))) return false;
  try {
    const granted = await lib.requestPermission([{ accessType: 'read', recordType: 'Steps' }]);
    return Array.isArray(granted) && granted.some((p: any) => p.recordType === 'Steps');
  } catch {
    return false;
  }
}

export async function openHealthConnectPermissions(): Promise<void> {
  const lib = await hc();
  if (lib) lib.openHealthConnectSettings();
}

export async function openHealthConnectInstallOrUpdate(): Promise<void> {
  const market = 'market://details?id=com.google.android.apps.healthdata';
  const web = 'https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata';
  await Linking.openURL(market).catch(() => Linking.openURL(web));
}

async function aggregateSteps(start: Date, end: Date): Promise<number> {
  const lib = await hc();
  if (!lib || !(await ensureInit(lib))) throw new Error('Health Connect could not initialize');
  const res = await lib.aggregateRecord({
    recordType: 'Steps',
    timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
  });
  const total = (res as any)?.COUNT_TOTAL ?? 0;
  return Number(total) || 0;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Steps recorded today (midnight → now), all-day. */
export async function getTodaySteps(): Promise<number> {
  return aggregateSteps(startOfDay(new Date()), new Date());
}

/** Per-day step totals for the last `days` days (oldest→newest). */
export async function getDailyHistory(days = 7): Promise<StepHistoryPoint[]> {
  const out: StepHistoryPoint[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const day = startOfDay(new Date(now.getTime() - i * 86400000));
    const end = new Date(day.getTime() + 86400000);
    const steps = await aggregateSteps(day, i === 0 ? now : end);
    out.push({ date: day.toISOString().slice(0, 10), steps });
  }
  return out;
}

export type { StepHistoryPoint };
