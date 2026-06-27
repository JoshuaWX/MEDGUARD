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
import { loadTodaySteps, upsertTodaySteps } from '../services/activity';
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

  const loadFromHealthConnect = useCallback(async () => {
    const [today, hist] = await Promise.all([getTodaySteps(), getDailyHistory(7)]);
    setSteps(today);
    setHistory(hist);
    setWeeklySteps(hist.reduce((a, b) => a + b.steps, 0));
    setSource('health_connect');
    setAvailable(true);
    if (userId) void upsertTodaySteps(userId, today);
  }, [userId]);

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

      const base = await loadTodaySteps(userId);
      if (cancelled) return;
      baseRef.current = base;
      totalRef.current = base;
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
          void upsertTodaySteps(userId, total);
          lastPersistedRef.current = total;
        }
      });

      appStateSub = AppState.addEventListener('change', (s) => {
        if (s !== 'active' && totalRef.current !== lastPersistedRef.current) {
          void upsertTodaySteps(userId, totalRef.current);
          lastPersistedRef.current = totalRef.current;
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
            // Show last stored total as a placeholder until connected.
            const base = await loadTodaySteps(userId);
            if (!cancelled) setSteps(base);
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
        void upsertTodaySteps(userId, totalRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadFromHealthConnect]);

  return { steps, weeklySteps, history, available, source, needsPermission, connect, loading };
}
