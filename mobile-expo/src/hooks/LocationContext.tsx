/** One canonical server-verified alert area; raw GPS remains available for maps. */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';
import { clearConfirmedLocationCache, readConfirmedLocationCache, type DeviceLocation, verifyAndPersistLocation, writeConfirmedLocationCache } from '../services/locationSync';
import { registerBackgroundLocationTask, startBackgroundLocationUpdates, stopBackgroundLocationUpdates } from '../services/backgroundLocationTask';

const FOREGROUND_TIME_MS = 60_000;
const FOREGROUND_DISTANCE_M = 50;
export type LocationData = DeviceLocation;
export interface GeocodedLocation { address: string | null; state: string | null; city: string | null; country: string | null; region: string | null; }
export interface AlertArea { state: string; source: 'gps' | 'manual'; updatedAt: string | null; }
interface LocationContextValue {
  location: LocationData | null; geocoded: GeocodedLocation | null; alertArea: AlertArea | null;
  locationSharingEnabled: boolean; backgroundLocationEnabled: boolean;
  loading: boolean; error: string | null; permissionStatus: Location.PermissionStatus | null; permissionCanAskAgain: boolean;
  backgroundPermissionStatus: Location.PermissionStatus | null; backgroundPermissionCanAskAgain: boolean; isTracking: boolean; isOnline: boolean;
  requestPermission: () => Promise<boolean>; refreshLocation: () => Promise<LocationData | null>; startWatching: () => Promise<void>; stopWatching: () => void;
  refreshPermissionStatus: () => Promise<void>;
  setLocationSharing: (enabled: boolean) => Promise<boolean>; setBackgroundLocationEnabled: (enabled: boolean) => Promise<boolean>; setManualAlertState: (state: string) => Promise<boolean>;
  verifyLocation: () => Promise<{ success: boolean; location: LocationData | null; geocoded: GeocodedLocation | null; error: string | null }>;
  permissionGranted: boolean;
}
const LocationContext = createContext<LocationContextValue | null>(null);
const toPoint = (p: Location.LocationObject): LocationData => ({ latitude: p.coords.latitude, longitude: p.coords.longitude, accuracy: p.coords.accuracy, altitude: p.coords.altitude, timestamp: p.timestamp });

export const LocationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user, initialized } = useAuth();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [geocoded, setGeocoded] = useState<GeocodedLocation | null>(null);
  const [alertArea, setAlertArea] = useState<AlertArea | null>(null);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(true);
  const [backgroundLocationEnabled, setBackgroundLocationEnabledState] = useState(false);
  const [loading, setLoading] = useState(false); const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [permissionCanAskAgain, setPermissionCanAskAgain] = useState(true);
  const [backgroundPermissionStatus, setBackgroundPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [backgroundPermissionCanAskAgain, setBackgroundPermissionCanAskAgain] = useState(true);
  const [isTracking, setIsTracking] = useState(false); const [isOnline, setIsOnline] = useState(true);
  const watcher = useRef<Location.LocationSubscription | null>(null); const mounted = useRef(true);
  const activeUserId = useRef<string | null>(null); const observationRevision = useRef(0); const appState = useRef<AppStateStatus>(AppState.currentState);

  const stopWatching = useCallback(() => { watcher.current?.remove(); watcher.current = null; if (mounted.current) setIsTracking(false); }, []);
  const clearLocationState = useCallback(async (id?: string | null) => {
    stopWatching(); await stopBackgroundLocationUpdates().catch(() => undefined); if (id) await clearConfirmedLocationCache(id);
    if (mounted.current) { setLocation(null); setGeocoded(null); setAlertArea(null); setBackgroundLocationEnabledState(false); }
  }, [stopWatching]);
  const requestPermission = useCallback(async () => {
    try { const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync(); if (mounted.current) { setPermissionStatus(status); setPermissionCanAskAgain(canAskAgain); setError(status === 'granted' ? null : 'Location permission denied. Your home state will be used for alerts.'); } return status === 'granted'; }
    catch { if (mounted.current) setError('Unable to request location permission.'); return false; }
  }, []);
  const refreshPermissionStatus = useCallback(async () => {
    const [foreground, background] = await Promise.all([
      Location.getForegroundPermissionsAsync(),
      Location.getBackgroundPermissionsAsync(),
    ]);
    if (!mounted.current) return;
    setPermissionStatus(foreground.status);
    setPermissionCanAskAgain(foreground.canAskAgain);
    setBackgroundPermissionStatus(background.status);
    setBackgroundPermissionCanAskAgain(background.canAskAgain);
  }, []);
  const confirmLocation = useCallback(async (point: LocationData) => {
    const id = activeUserId.current; if (!id || !locationSharingEnabled || !isOnline) return;
    const revision = ++observationRevision.current;
    try {
      const confirmed = await verifyAndPersistLocation(point);
      if (!mounted.current || id !== activeUserId.current || revision !== observationRevision.current) return;
      const geo = { address: confirmed.address, state: confirmed.state, city: null, country: 'Nigeria', region: confirmed.state };
      setGeocoded(geo); setAlertArea({ state: confirmed.state, source: 'gps', updatedAt: confirmed.observedAt }); await writeConfirmedLocationCache(id, confirmed);
    } catch { /* retain the last server-confirmed area */ }
  }, [isOnline, locationSharingEnabled]);
  const refreshLocation = useCallback(async (): Promise<LocationData | null> => {
    try { setLoading(true); setError(null); let granted = permissionStatus === 'granted'; if (!granted) granted = await requestPermission(); if (!granted) return null;
      const point = toPoint(await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })); if (mounted.current) setLocation(point); if (locationSharingEnabled) void confirmLocation(point); return point;
    } catch { if (mounted.current) setError('Unable to get your current location.'); return null; } finally { if (mounted.current) setLoading(false); }
  }, [confirmLocation, locationSharingEnabled, permissionStatus, requestPermission]);
  const startWatching = useCallback(async () => {
    if (watcher.current || !locationSharingEnabled || !activeUserId.current) return; let granted = permissionStatus === 'granted'; if (!granted) granted = await requestPermission(); if (!granted) return;
    try { watcher.current = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: FOREGROUND_TIME_MS, distanceInterval: FOREGROUND_DISTANCE_M }, (position) => { const point = toPoint(position); if (mounted.current) setLocation(point); void confirmLocation(point); }); if (mounted.current) setIsTracking(true); }
    catch { if (mounted.current) setError('Unable to start location updates.'); }
  }, [confirmLocation, locationSharingEnabled, permissionStatus, requestPermission]);
  const setLocationSharing = useCallback(async (enabled: boolean) => {
    const id = activeUserId.current; if (!id) return false;
    const { data, error: rpcError } = await supabase.rpc('set_location_preferences', { p_use_location: enabled, p_background_location_enabled: enabled && backgroundLocationEnabled });
    if (rpcError || !data) { if (mounted.current) setError('Unable to save your location setting.'); return false; }
    const next = data as { state?: string; background_location_enabled?: boolean }; setLocationSharingEnabled(enabled); setBackgroundLocationEnabledState(Boolean(next.background_location_enabled));
    if (!enabled) { await clearLocationState(id); if (next.state && mounted.current) setAlertArea({ state: next.state, source: 'manual', updatedAt: new Date().toISOString() }); return true; }
    const granted = await requestPermission(); if (granted) { void refreshLocation(); void startWatching(); } return true;
  }, [backgroundLocationEnabled, clearLocationState, refreshLocation, requestPermission, startWatching]);
  const setBackgroundLocationEnabled = useCallback(async (enabled: boolean) => {
    if (!activeUserId.current || (enabled && !locationSharingEnabled)) return false;
    if (enabled) { const { status, canAskAgain } = await Location.requestBackgroundPermissionsAsync(); if (mounted.current) { setBackgroundPermissionStatus(status); setBackgroundPermissionCanAskAgain(canAskAgain); } if (status !== 'granted') { if (mounted.current) setError('Background location permission was not granted.'); return false; } }
    const { data, error: rpcError } = await supabase.rpc('set_location_preferences', { p_use_location: locationSharingEnabled, p_background_location_enabled: enabled }); if (rpcError || !data) return false;
    try { if (enabled) await startBackgroundLocationUpdates(); else await stopBackgroundLocationUpdates(); if (mounted.current) setBackgroundLocationEnabledState(enabled); return true; }
    catch { await supabase.rpc('set_location_preferences', { p_use_location: locationSharingEnabled, p_background_location_enabled: false }); return false; }
  }, [locationSharingEnabled]);
  const setManualAlertState = useCallback(async (state: string) => {
    const { data, error: rpcError } = await supabase.rpc('set_manual_alert_state', { p_manual_state: state }); if (rpcError || !data) return false;
    const next = data as { state?: string; use_location?: boolean }; if (!next.use_location && next.state && mounted.current) setAlertArea({ state: next.state, source: 'manual', updatedAt: new Date().toISOString() }); return true;
  }, []);
  const verifyLocation = useCallback(async () => { const point = await refreshLocation(); if (!point) return { success: false, location: null, geocoded: null, error: error ?? 'Location verification failed.' }; await confirmLocation(point); return { success: true, location: point, geocoded, error: null }; }, [confirmLocation, error, geocoded, refreshLocation]);

  useEffect(() => {
    mounted.current = true; registerBackgroundLocationTask(); const id = user?.id ?? null; const previous = activeUserId.current; activeUserId.current = id;
    if (previous && previous !== id) {
      // Never leave one account's last location visible while another account loads.
      stopWatching(); setLocation(null); setGeocoded(null); setAlertArea(null); setBackgroundLocationEnabledState(false);
      void clearConfirmedLocationCache(previous); void stopBackgroundLocationUpdates().catch(() => undefined);
    }
    if (!id) { if (previous) void clearLocationState(previous); return () => { mounted.current = false; }; }
    let cancelled = false;
    void (async () => {
      const cached = await readConfirmedLocationCache(id); if (cancelled || activeUserId.current !== id) return;
      if (cached) { setLocation(cached.location); setGeocoded({ address: cached.address, state: cached.state, city: null, country: 'Nigeria', region: cached.state }); setAlertArea({ state: cached.state, source: 'gps', updatedAt: cached.observedAt }); }
      const { data } = await supabase.from('profiles').select('state, manual_state, use_location, background_location_enabled, location_observed_at, latitude, longitude, location_accuracy_meters').eq('id', id).maybeSingle();
      if (cancelled || !data || activeUserId.current !== id) return;
      const sharing = data.use_location !== false; setLocationSharingEnabled(sharing); setBackgroundLocationEnabledState(Boolean(data.background_location_enabled));
      if (data.state) setAlertArea({ state: data.state, source: sharing && data.latitude != null ? 'gps' : 'manual', updatedAt: data.location_observed_at ?? null });
      if (sharing && data.latitude != null && data.longitude != null && !cached) setLocation({ latitude: data.latitude, longitude: data.longitude, accuracy: data.location_accuracy_meters ?? null, altitude: null, timestamp: data.location_observed_at ? new Date(data.location_observed_at).getTime() : Date.now() });
      const [{ status, canAskAgain }, backgroundPermission] = await Promise.all([Location.getForegroundPermissionsAsync(), Location.getBackgroundPermissionsAsync()]);
      if (!cancelled) { setPermissionStatus(status); setPermissionCanAskAgain(canAskAgain); setBackgroundPermissionStatus(backgroundPermission.status); setBackgroundPermissionCanAskAgain(backgroundPermission.canAskAgain); }
      if (sharing && status === 'granted') { void refreshLocation(); void startWatching(); if (data.background_location_enabled) void startBackgroundLocationUpdates().catch(() => undefined); }
      else if (sharing && status === 'denied') {
        // A revoked/denied foreground permission immediately returns alerts to
        // the persisted home state, including push targeting and Personal Brain.
        const { data: fallback } = await supabase.rpc('set_location_preferences', { p_use_location: false, p_background_location_enabled: false });
        if (!cancelled) { setLocationSharingEnabled(false); setBackgroundLocationEnabledState(false); if (fallback?.state ?? data.manual_state) setAlertArea({ state: fallback?.state ?? data.manual_state, source: 'manual', updatedAt: new Date().toISOString() }); }
      }
    })();
    return () => { cancelled = true; mounted.current = false; stopWatching(); };
  }, [clearLocationState, refreshLocation, startWatching, stopWatching, user?.id]);
  useEffect(() => NetInfo.addEventListener((state) => setIsOnline(state.isConnected ?? true)), []);
  useEffect(() => { const sub = AppState.addEventListener('change', (next) => { const prior = appState.current; appState.current = next; if (prior.match(/inactive|background/) && next === 'active') { void refreshPermissionStatus(); if (locationSharingEnabled) void refreshLocation(); } }); return () => sub.remove(); }, [locationSharingEnabled, refreshLocation, refreshPermissionStatus]);

  return <LocationContext.Provider value={{ location, geocoded, alertArea, locationSharingEnabled, backgroundLocationEnabled, loading: loading || !initialized, error, permissionStatus, permissionCanAskAgain, backgroundPermissionStatus, backgroundPermissionCanAskAgain, isTracking, isOnline, requestPermission, refreshPermissionStatus, refreshLocation, startWatching, stopWatching, setLocationSharing, setBackgroundLocationEnabled, setManualAlertState, verifyLocation, permissionGranted: permissionStatus === 'granted' }}>{children}</LocationContext.Provider>;
};
export function useLocationContext() { const context = useContext(LocationContext); if (!context) throw new Error('useLocationContext must be used within LocationProvider.'); return context; }
