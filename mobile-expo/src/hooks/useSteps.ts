/**
 * useSteps — daily/weekly steps.
 *
 * Prefers Android Health Connect (true all-day + historical + weekly totals,
 * counted by the OS even while the app is closed). Falls back to the live
 * expo-sensors pedometer (foreground-only) where Health Connect is unavailable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pedometer } from 'expo-sensors';
import { AppState, Linking } from 'react-native';
import { useAuth } from './useAuth';
import { usePersonalHealthData } from './PersonalHealthDataContext';
import { upsertTodaySteps } from '../services/activity';
import {
  getHealthConnectCapability,
  hasStepsPermission,
  requestStepsPermission,
  openHealthConnectInstallOrUpdate,
  openHealthConnectPermissions,
  getTodaySteps,
  getDailyHistory,
  type StepHistoryPoint,
} from '../services/healthConnect';

type StepSource = 'health_connect' | 'pedometer' | 'none';

export type StepAccessState =
  | 'checking'
  | 'health_connect_permission'
  | 'health_connect_denied'
  | 'health_connect_connected'
  | 'health_connect_empty'
  | 'health_connect_update_required'
  | 'foreground_permission'
  | 'foreground_connected'
  | 'unavailable'
  | 'error';

export type StepConnectResult = { ok: boolean; state: StepAccessState };

interface UseStepsReturn {
  steps: number;             // today
  weeklySteps: number;       // last 7 days total
  history: StepHistoryPoint[]; // last 7 days, per day
  available: boolean;
  source: StepSource;
  needsPermission: boolean;
  permissionCanAskAgain: boolean;
  accessState: StepAccessState;
  statusMessage: string;
  connect: () => Promise<StepConnectResult>;
  openSettings: () => Promise<void>;
  loading: boolean;
}

const PERSIST_EVERY_STEPS = 25;

export function useSteps(): UseStepsReturn {
  const { user } = useAuth();
  const { dashboard, updateAfterConfirmedWrite } = usePersonalHealthData();
  const userId = user?.id ?? null;

  const [steps, setSteps] = useState(0);
  const [weeklySteps, setWeeklySteps] = useState(0);
  const [history, setHistory] = useState<StepHistoryPoint[]>([]);
  const [available, setAvailable] = useState(false);
  const [source, setSource] = useState<StepSource>('none');
  const [needsPermission, setNeedsPermission] = useState(false);
  const [permissionCanAskAgain, setPermissionCanAskAgain] = useState(true);
  const [accessState, setAccessState] = useState<StepAccessState>('checking');
  const [loading, setLoading] = useState(true);
  const [permissionRevision, setPermissionRevision] = useState(0);

  // Pedometer fallback bookkeeping
  const baseRef = useRef(0);
  const totalRef = useRef(0);
  const lastPersistedRef = useRef(0);

  const today = new Date().toISOString().slice(0, 10);
  const storedTodaySteps = dashboard?.activityTrend.find((point) => point.date === today)?.steps ?? 0;

  const persistSteps = useCallback(async (value: number, persistedSource: 'pedometer' | 'health_connect' = 'pedometer') => {
    if (!userId) return false;
    const rounded = Math.max(0, Math.round(value));
    const saved = await upsertTodaySteps(userId, rounded, persistedSource);
    if (!saved) return false;
    await updateAfterConfirmedWrite((current) => {
      const withoutToday = current.activityTrend.filter((point) => point.date !== today);
      return {
        ...current,
        activityTrend: [...withoutToday, { date: today, steps: rounded }].slice(-7),
      };
    });
    return true;
  }, [today, updateAfterConfirmedWrite, userId]);

  // When the encrypted dashboard cache arrives after the hook starts, use its
  // confirmed total as the pedometer baseline without another table request.
  useEffect(() => {
    if (storedTodaySteps <= baseRef.current) return;
    baseRef.current = storedTodaySteps;
    totalRef.current = Math.max(totalRef.current, storedTodaySteps);
    setSteps(totalRef.current);
  }, [storedTodaySteps]);

  const loadFromHealthConnect = useCallback(async () => {
    const [today, hist] = await Promise.all([getTodaySteps(), getDailyHistory(7)]);
    setSteps(today);
    setHistory(hist);
    setWeeklySteps(hist.reduce((a, b) => a + b.steps, 0));
    setSource('health_connect');
    setAvailable(true);
    setNeedsPermission(false);
    setPermissionCanAskAgain(false);
    setAccessState(today > 0 || hist.some((point) => point.steps > 0) ? 'health_connect_connected' : 'health_connect_empty');
    void persistSteps(today, 'health_connect');
  }, [persistSteps]);

  const connect = useCallback(async (): Promise<StepConnectResult> => {
    try {
      const capability = await getHealthConnectCapability();
      if (capability === 'available') {
        const granted = await requestStepsPermission();
        setNeedsPermission(!granted);
        setPermissionCanAskAgain(false);
        if (granted) {
          await loadFromHealthConnect();
          return { ok: true, state: 'health_connect_connected' };
        }
        setAccessState('health_connect_denied');
        return { ok: false, state: 'health_connect_denied' };
      }
      if (capability === 'update_required') {
        setAccessState('health_connect_update_required');
        return { ok: false, state: 'health_connect_update_required' };
      }

      const permission = await Pedometer.requestPermissionsAsync();
      setPermissionCanAskAgain(permission.canAskAgain);
      setNeedsPermission(!permission.granted);
      if (permission.granted) {
        setAccessState('foreground_connected');
        setPermissionRevision((value) => value + 1);
        return { ok: true, state: 'foreground_connected' };
      }
      setAccessState('foreground_permission');
      return { ok: false, state: 'foreground_permission' };
    } catch {
      setAccessState('error');
      return { ok: false, state: 'error' };
    }
  }, [loadFromHealthConnect]);

  const openSettings = useCallback(async () => {
    if (accessState === 'health_connect_update_required' || accessState === 'unavailable') {
      await openHealthConnectInstallOrUpdate();
      return;
    }
    if (accessState === 'health_connect_denied' || source === 'health_connect') {
      await openHealthConnectPermissions();
      return;
    }
    await Linking.openSettings();
  }, [accessState, source]);

  useEffect(() => {
    let pedoSub: { remove: () => void } | null = null;
    let appStateSub: { remove: () => void } | null = null;
    let cancelled = false;

    const startPedometer = async () => {
      const isAvail = await Pedometer.isAvailableAsync();
      if (cancelled) return;
      setAvailable(isAvail);
      setSource(isAvail ? 'pedometer' : 'none');
      if (!isAvail) setAccessState('unavailable');
      if (!userId) return;

      const base = baseRef.current;
      baseRef.current = base;
      totalRef.current = base;
      lastPersistedRef.current = base;
      setSteps(base);
      if (!isAvail) return;

      try {
        const permission = await Pedometer.getPermissionsAsync();
        setPermissionCanAskAgain(permission.canAskAgain);
        if (!permission.granted) {
          setNeedsPermission(true);
          setAccessState('foreground_permission');
          return;
        }
        setNeedsPermission(false);
        setAccessState('foreground_connected');
      } catch {
        setNeedsPermission(true);
        setAccessState('error');
        return;
      }

      pedoSub = Pedometer.watchStepCount((result) => {
        const total = baseRef.current + (result?.steps ?? 0);
        totalRef.current = total;
        setSteps(total);
        if (total - lastPersistedRef.current >= PERSIST_EVERY_STEPS) {
          void persistSteps(total).then((saved) => {
            if (saved) lastPersistedRef.current = total;
          });
        }
      });

      appStateSub = AppState.addEventListener('change', (s) => {
        if (s !== 'active' && totalRef.current !== lastPersistedRef.current) {
          const total = totalRef.current;
          void persistSteps(total).then((saved) => {
            if (saved) lastPersistedRef.current = total;
          });
        }
      });
    };

    (async () => {
      if (!userId) { setLoading(false); return; }
      try {
        const capability = await getHealthConnectCapability();
        if (cancelled) return;
        if (capability === 'available') {
          const granted = await hasStepsPermission();
          if (cancelled) return;
          setAvailable(true);
          if (granted) {
            await loadFromHealthConnect();
          } else {
            setNeedsPermission(true);
            setPermissionCanAskAgain(false);
            setAccessState('health_connect_permission');
            // Show the confirmed dashboard total until Health Connect is linked.
            if (!cancelled) setSteps(baseRef.current);
          }
        } else if (capability === 'update_required') {
          setAvailable(false);
          setNeedsPermission(true);
          setPermissionCanAskAgain(false);
          setAccessState('health_connect_update_required');
        } else {
          await startPedometer();
        }
      } catch {
        if (!cancelled) setAccessState('error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      pedoSub?.remove();
      appStateSub?.remove();
      if (source === 'pedometer' && userId && totalRef.current !== lastPersistedRef.current) {
        void persistSteps(totalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadFromHealthConnect, persistSteps, permissionRevision]);

  const statusMessage: Record<StepAccessState, string> = {
    checking: 'Checking step access…',
    health_connect_permission: 'Allow Steps inside Health Connect. Android activity permission alone is not enough.',
    health_connect_denied: 'Steps were not enabled. Open Health Connect to allow MedGuard to read Steps.',
    health_connect_connected: 'All-day steps are connected through Health Connect.',
    health_connect_empty: 'Connected. Health Connect has no step data for today yet.',
    health_connect_update_required: 'Install or update Health Connect to read all-day steps.',
    foreground_permission: 'Allow physical activity to count live steps while MedGuard is open.',
    foreground_connected: 'Live steps are available while MedGuard is open.',
    unavailable: 'Step counting is not available on this device.',
    error: 'MedGuard could not read step access. Open settings and try again.',
  };

  return { steps, weeklySteps, history, available, source, needsPermission, permissionCanAskAgain, accessState, statusMessage: statusMessage[accessState], connect, openSettings, loading };
}
