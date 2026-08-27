import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './useAuth';
import {
  clearPersonalHealthDashboardCache,
  readPersonalHealthDashboardCache,
  writePersonalHealthDashboardCache,
  type PersonalHealthCacheFreshness,
} from '../services/personalHealthCache';
import {
  fetchPersonalHealthDashboard,
  parsePersonalHealthDashboard,
  type PersonalHealthDashboard,
} from '../services/personalHealthDashboard';

interface PersonalHealthDataContextValue {
  dashboard: PersonalHealthDashboard | null;
  loading: boolean;
  error: Error | null;
  cacheFreshness: PersonalHealthCacheFreshness | null;
  lastUpdated: string | null;
  refresh: () => Promise<void>;
  updateAfterConfirmedWrite: (update: (current: PersonalHealthDashboard) => PersonalHealthDashboard) => Promise<void>;
}

const PersonalHealthDataContext = createContext<PersonalHealthDataContextValue | null>(null);

export const PersonalHealthDataProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user, session, initialized } = useAuth();
  const [dashboard, setDashboard] = useState<PersonalHealthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [cacheFreshness, setCacheFreshness] = useState<PersonalHealthCacheFreshness | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const activeUserIdRef = useRef<string | null>(null);
  const dashboardRef = useRef<PersonalHealthDashboard | null>(null);

  useEffect(() => {
    dashboardRef.current = dashboard;
  }, [dashboard]);

  const hasUsableSession = Boolean(
    initialized && user?.id && session?.access_token && session.user.id === user.id,
  );

  const fetchAndCache = useCallback(async (userId: string, requestId: number) => {
    const freshDashboard = await fetchPersonalHealthDashboard(7);
    if (requestId !== requestIdRef.current || activeUserIdRef.current !== userId) return;
    const cachedAt = await writePersonalHealthDashboardCache(userId, freshDashboard);
    if (requestId !== requestIdRef.current || activeUserIdRef.current !== userId) return;
    setDashboard(freshDashboard);
    setCacheFreshness('fresh');
    setLastUpdated(cachedAt ?? new Date().toISOString());
  }, []);

  const refresh = useCallback(async () => {
    if (!hasUsableSession || !user?.id) return;
    const requestId = ++requestIdRef.current;
    setError(null);
    try {
      await fetchAndCache(user.id, requestId);
    } catch (cause) {
      if (requestId === requestIdRef.current) {
        setError(cause instanceof Error ? cause : new Error('Unable to refresh personal health data.'));
      }
    }
  }, [fetchAndCache, hasUsableSession, user?.id]);

  // An account change is a strict cache boundary. A returning user only sees
  // their own encrypted cache once the persisted session has been validated.
  useEffect(() => {
    const previousUserId = activeUserIdRef.current;
    const nextUserId = hasUsableSession ? user?.id ?? null : null;
    const requestId = ++requestIdRef.current;

    if (previousUserId && previousUserId !== nextUserId) {
      void clearPersonalHealthDashboardCache(previousUserId);
    }
    activeUserIdRef.current = nextUserId;
    setDashboard(null);
    setError(null);
    setCacheFreshness(null);
    setLastUpdated(null);

    if (!initialized) {
      setLoading(true);
      return;
    }
    if (!nextUserId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    void (async () => {
      const cached = await readPersonalHealthDashboardCache<unknown>(nextUserId);
      if (cancelled || requestId !== requestIdRef.current || activeUserIdRef.current !== nextUserId) return;
      const cachedEntry = cached;
      const cachedDashboard = cachedEntry ? parsePersonalHealthDashboard(cachedEntry.data) : null;
      if (cachedDashboard) {
        setDashboard(cachedDashboard);
        setCacheFreshness(cachedEntry!.freshness);
        setLastUpdated(cachedEntry!.cachedAt);
        // Cached content is usable immediately, even while a background
        // network refresh is under way.
        setLoading(false);
      }

      try {
        await fetchAndCache(nextUserId, requestId);
      } catch (cause) {
        if (!cancelled && requestId === requestIdRef.current) {
          setError(cause instanceof Error ? cause : new Error('Unable to refresh personal health data.'));
        }
      } finally {
        if (!cancelled && requestId === requestIdRef.current) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchAndCache, hasUsableSession, initialized, user?.id]);

  const updateAfterConfirmedWrite = useCallback(async (
    update: (current: PersonalHealthDashboard) => PersonalHealthDashboard,
  ) => {
    const userId = activeUserIdRef.current;
    const current = dashboardRef.current;
    if (!userId || !current) return;
    const next = update(current);
    dashboardRef.current = next;
    setDashboard(next);
    const cachedAt = await writePersonalHealthDashboardCache(userId, next);
    if (activeUserIdRef.current === userId && cachedAt) {
      setCacheFreshness('fresh');
      setLastUpdated(cachedAt);
    }
  }, []);

  return (
    <PersonalHealthDataContext.Provider value={{
      dashboard,
      loading,
      error,
      cacheFreshness,
      lastUpdated,
      refresh,
      updateAfterConfirmedWrite,
    }}>
      {children}
    </PersonalHealthDataContext.Provider>
  );
};

export function usePersonalHealthData(): PersonalHealthDataContextValue {
  const context = useContext(PersonalHealthDataContext);
  if (!context) {
    throw new Error('usePersonalHealthData must be used within <PersonalHealthDataProvider>.');
  }
  return context;
}
