/**
 * useCycle — menstrual cycle tracking state for the cycle screen.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import {
  loadCycleLogs,
  loadCycleSettings,
  saveCycleSettings,
  logPeriod as logPeriodSvc,
  setCycleTrackingEnabled as setEnabledSvc,
  computeCyclePrediction,
  DEFAULT_CYCLE_SETTINGS,
  type CycleLog,
  type CycleSettings,
  type CyclePrediction,
  type FlowIntensity,
} from '../services/cycle';

interface UseCycleReturn {
  loading: boolean;
  logs: CycleLog[];
  settings: CycleSettings;
  prediction: CyclePrediction;
  refresh: () => Promise<void>;
  logPeriod: (entry: { startDate: string; endDate?: string | null; flowIntensity?: FlowIntensity | null; symptoms?: string[]; notes?: string | null }) => Promise<void>;
  updateSettings: (s: CycleSettings) => Promise<void>;
  setEnabled: (enabled: boolean) => Promise<void>;
}

export function useCycle(): UseCycleReturn {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<CycleLog[]>([]);
  const [settings, setSettings] = useState<CycleSettings>({ ...DEFAULT_CYCLE_SETTINGS });

  const refresh = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [l, s] = await Promise.all([loadCycleLogs(userId), loadCycleSettings(userId)]);
      setLogs(l);
      setSettings(s);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const logPeriod = useCallback(async (entry: { startDate: string; endDate?: string | null; flowIntensity?: FlowIntensity | null; symptoms?: string[]; notes?: string | null }) => {
    if (!userId) return;
    await logPeriodSvc(userId, entry);
    await refresh();
  }, [userId, refresh]);

  const updateSettings = useCallback(async (s: CycleSettings) => {
    if (!userId) return;
    setSettings(s);
    await saveCycleSettings(userId, s);
  }, [userId]);

  const setEnabled = useCallback(async (enabled: boolean) => {
    if (!userId) return;
    await setEnabledSvc(userId, enabled);
  }, [userId]);

  const prediction = computeCyclePrediction(logs, settings);

  return { loading, logs, settings, prediction, refresh, logPeriod, updateSettings, setEnabled };
}
