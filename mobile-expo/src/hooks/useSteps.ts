/**
 * useSteps — daily/weekly steps.
 *
 * Prefers Android Health Connect (true all-day + historical + weekly totals,
 * counted by the OS even while the app is closed). Falls back to the live
 * expo-sensors pedometer (foreground-only) where Health Connect is unavailable.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pedometer } from 'expo-sensors';
import { AppState } from 'react-native';
import { useAuth } from './useAuth';
import { usePersonalHealthData } from './PersonalHealthDataContext';
import { upsertTodaySteps } from '../services/activity';
import {
  isHealthConnectAvailable,
  hasStepsPermission,
  requestStepsPermission,
  getTodaySteps,
  getDailyHistory,
  type StepHistoryPoint,
} from '../services/healthConnect';

type StepSource = 'health_connect' | 'pedometer' | 'none';

interface UseStepsReturn {
  steps: number;             // today
  weeklySteps: number;       // last 7 days total
  history: StepHistoryPoint[]; // last 7 days, per day
  available: boolean;
  source: StepSource;
  needsPermission: boolean;  // Health Connect present but not yet granted
  connect: () => Promise<void>;
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
  const [loading, setLoading] = useState(true);

  // Pedometer fallback bookkeeping
  const baseRef = useRef(0);
  const totalRef = useRef(0);
  const lastPersistedRef = useRef(0);

  const today = new Date().toISOString().slice(0, 10);
  const storedTodaySteps = dashboard?.activityTrend.find((point) => point.date === today)?.steps ?? 0;

  const persistSteps = useCallback(async (value: number) => {
    if (!userId) return false;
    const rounded = Math.max(0, Math.round(value));
    const saved = await upsertTodaySteps(userId, rounded);
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
    void persistSteps(today);
  }, [persistSteps]);

  const connect = useCallback(async () => {
    const granted = await requestStepsPermission();
    if (granted) {
      setNeedsPermission(false);
      await loadFromHealthConnect();
    }
  }, [loadFromHealthConnect]);

  useEffect(() => {
    let pedoSub: { remove: () => void } | null = null;
    let appStateSub: { remove: () => void } | null = null;
    let cancelled = false;

    const startPedometer = async () => {
      const isAvail = await Pedometer.isAvailableAsync();
      if (cancelled) return;
      setAvailable(isAvail);
      setSource(isAvail ? 'pedometer' : 'none');
      if (!userId) return;

      const base = baseRef.current;
      baseRef.current = base;
      totalRef.current = base;
      lastPersistedRef.current = base;
      setSteps(base);
      if (!isAvail) return;

      try {
        const perm = await Pedometer.getPermissionsAsync();
        if (!perm.granted && perm.canAskAgain) await Pedometer.requestPermissionsAsync();
      } catch { /* not all platforms */ }

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
        const hcAvail = await isHealthConnectAvailable();
        if (cancelled) return;
        if (hcAvail) {
          const granted = await hasStepsPermission();
          if (cancelled) return;
          setAvailable(true);
          if (granted) {
            await loadFromHealthConnect();
          } else {
            setNeedsPermission(true);
            // Show the confirmed dashboard total until Health Connect is linked.
            if (!cancelled) setSteps(baseRef.current);
          }
        } else {
          await startPedometer();
        }
      } catch {
        // ignore
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
  }, [userId, loadFromHealthConnect, persistSteps]);

  return { steps, weeklySteps, history, available, source, needsPermission, connect, loading };
}
