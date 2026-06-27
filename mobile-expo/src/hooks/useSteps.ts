/**
 * useSteps — live step counting via expo-sensors with per-day persistence.
 *
 * Android note: the platform only provides steps counted while subscribed, so
 * each session's live count is added onto the day's stored base. Persisted
 * (throttled) so the daily total survives app restarts.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pedometer } from 'expo-sensors';
import { AppState } from 'react-native';
import { useAuth } from './useAuth';
import { loadTodaySteps, upsertTodaySteps } from '../services/activity';

interface UseStepsReturn {
  steps: number;
  available: boolean;
  loading: boolean;
}

const PERSIST_EVERY_STEPS = 25;

export function useSteps(): UseStepsReturn {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [steps, setSteps] = useState(0);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);

  const baseRef = useRef(0);
  const totalRef = useRef(0);
  const lastPersistedRef = useRef(0);

  const persist = useCallback((value: number) => {
    if (!userId) return;
    void upsertTodaySteps(userId, value);
    lastPersistedRef.current = value;
  }, [userId]);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let cancelled = false;

    (async () => {
      if (!userId) { setLoading(false); return; }
      try {
        const isAvail = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        setAvailable(isAvail);

        const base = await loadTodaySteps(userId);
        if (cancelled) return;
        baseRef.current = base;
        totalRef.current = base;
        setSteps(base);
        setLoading(false);

        if (!isAvail) return;

        try {
          const perm = await Pedometer.getPermissionsAsync();
          if (!perm.granted && perm.canAskAgain) {
            await Pedometer.requestPermissionsAsync();
          }
        } catch {
          // permission API not available on all platforms; continue
        }

        sub = Pedometer.watchStepCount((result) => {
          const total = baseRef.current + (result?.steps ?? 0);
          totalRef.current = total;
          setSteps(total);
          if (total - lastPersistedRef.current >= PERSIST_EVERY_STEPS) {
            persist(total);
          }
        });
      } catch {
        setLoading(false);
      }
    })();

    // Persist when the app goes to background so the day's total is saved.
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && totalRef.current !== lastPersistedRef.current) {
        persist(totalRef.current);
      }
    });

    return () => {
      cancelled = true;
      sub?.remove();
      appStateSub.remove();
      if (totalRef.current !== lastPersistedRef.current) persist(totalRef.current);
    };
  }, [userId, persist]);

  return { steps, available, loading };
}
