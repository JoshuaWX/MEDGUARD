/**
 * LocationContext
 * 
 * Provides secure, real-time location updates throughout the app with:
 * - Background-safe location tracking (respecting platform limits)
 * - AppState handling (foreground/background transitions)
 * - Network awareness and graceful degradation
 * - Permission revocation detection
 * - Throttled database updates to prevent battery drain
 * - Automatic sync with user profile
 */

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import * as Location from 'expo-location';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../services/supabase';
import { useAuth } from './useAuth';

// Configuration constants
const CONFIG = {
  // Foreground updates
  foregroundTimeInterval: 60 * 1000, // 1 minute minimum between updates
  foregroundDistanceInterval: 50, // 50 meters minimum movement

  // Database sync throttling
  dbSyncMinInterval: 2 * 60 * 1000, // Sync to DB at most every 2 minutes
  
  // Cache keys
  storageKeys: {
    lastLocation: 'mg_last_location',
    lastGeocoded: 'mg_last_geocoded',
    lastDbSync: 'mg_last_db_sync',
  },
} as const;

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  altitude: number | null;
  timestamp: number;
}

interface GeocodedLocation {
  address: string | null;
  state: string | null;
  city: string | null;
  country: string | null;
  region: string | null;
}

interface LocationContextValue {
  // Current location data
  location: LocationData | null;
  geocoded: GeocodedLocation | null;
  
  // Status flags
  loading: boolean;
  error: string | null;
  permissionStatus: Location.PermissionStatus | null;
  isTracking: boolean;
  isOnline: boolean;
  
  // Actions
  requestPermission: () => Promise<boolean>;
  refreshLocation: () => Promise<LocationData | null>;
  startWatching: () => Promise<void>;
  stopWatching: () => void;
  
  // Verification helper for signup
  verifyLocation: () => Promise<{ 
    success: boolean; 
    location: LocationData | null; 
    geocoded: GeocodedLocation | null;
    error: string | null;
  }>;

  // Legacy compatibility
  permissionGranted: boolean;
}

const LocationContext = createContext<LocationContextValue | null>(null);

// Nigerian state name normalization
const NIGERIAN_STATES: Record<string, string> = {
  'lagos': 'Lagos',
  'lagos state': 'Lagos',
  'fct': 'Federal Capital Territory',
  'federal capital territory': 'Federal Capital Territory',
  'abuja': 'Federal Capital Territory',
  'kano': 'Kano',
  'rivers': 'Rivers',
  'oyo': 'Oyo',
  'kaduna': 'Kaduna',
  'delta': 'Delta',
  'anambra': 'Anambra',
  'enugu': 'Enugu',
  'ogun': 'Ogun',
  'ondo': 'Ondo',
  'edo': 'Edo',
  'katsina': 'Katsina',
  'sokoto': 'Sokoto',
  'borno': 'Borno',
  'bauchi': 'Bauchi',
  'plateau': 'Plateau',
  'cross river': 'Cross River',
  'akwa ibom': 'Akwa Ibom',
  'abia': 'Abia',
  'imo': 'Imo',
  'kwara': 'Kwara',
  'niger': 'Niger',
  'benue': 'Benue',
  'osun': 'Osun',
  'ekiti': 'Ekiti',
  'taraba': 'Taraba',
  'adamawa': 'Adamawa',
  'gombe': 'Gombe',
  'yobe': 'Yobe',
  'jigawa': 'Jigawa',
  'zamfara': 'Zamfara',
  'kebbi': 'Kebbi',
  'kogi': 'Kogi',
  'nasarawa': 'Nasarawa',
  'ebonyi': 'Ebonyi',
  'bayelsa': 'Bayelsa',
};

function normalizeNigerianState(region: string | null): string | null {
  if (!region) return null;
  const lower = region.toLowerCase().replace(/\s+state$/i, '').trim();
  return NIGERIAN_STATES[lower] || region;
}

export const LocationProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const { user } = useAuth();
  
  // State
  const [location, setLocation] = useState<LocationData | null>(null);
  const [geocoded, setGeocoded] = useState<GeocodedLocation | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Location.PermissionStatus | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  
  // Refs
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const lastDbSyncRef = useRef<number>(0);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const mountedRef = useRef(true);

  // Derived state for legacy compatibility
  const permissionGranted = permissionStatus === 'granted';

  // Load cached location on mount
  useEffect(() => {
    mountedRef.current = true;
    
    const loadCached = async () => {
      try {
        const [cachedLocation, cachedGeocoded] = await Promise.all([
          AsyncStorage.getItem(CONFIG.storageKeys.lastLocation),
          AsyncStorage.getItem(CONFIG.storageKeys.lastGeocoded),
        ]);

        if (cachedLocation && mountedRef.current) {
          setLocation(JSON.parse(cachedLocation));
        }
        if (cachedGeocoded && mountedRef.current) {
          setGeocoded(JSON.parse(cachedGeocoded));
        }
      } catch {
        // Ignore cache read errors
      }
    };

    loadCached();
    
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (mountedRef.current) {
          setPermissionStatus(status);
        }
      } catch {
        // Ignore
      }
    };

    checkPermission();
  }, []);

  // Monitor network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      if (mountedRef.current) {
        setIsOnline(state.isConnected ?? true);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle AppState changes (foreground/background)
  useEffect(() => {
    const handleAppStateChange = async (nextAppState: AppStateStatus) => {
      const prevState = appStateRef.current;
      appStateRef.current = nextAppState;

      // Coming to foreground from background
      if (prevState.match(/inactive|background/) && nextAppState === 'active') {
        // Check if permission was revoked while in background
        const { status } = await Location.getForegroundPermissionsAsync();
        if (mountedRef.current) {
          setPermissionStatus(status);
          
          if (status !== 'granted') {
            setError('Location permission was revoked');
            stopWatching();
          } else if (user?.id && isTracking) {
            // Refresh location when coming back to foreground
            refreshLocation();
          }
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [user?.id, isTracking]);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);
      
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (mountedRef.current) {
        setPermissionStatus(status);
        
        if (status !== 'granted') {
          setError('Location permission denied. Please enable it in settings.');
          return false;
        }
      }

      // On Android, optionally request background permission
      if (Platform.OS === 'android') {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus === 'granted') {
          console.log('Background location permission granted');
        }
      }

      return status === 'granted';
    } catch (err) {
      console.error('Error requesting location permission:', err);
      if (mountedRef.current) {
        setError('Failed to request location permission');
      }
      return false;
    }
  }, []);

  // Reverse geocode and update state
  const reverseGeocodeAndSave = useCallback(async (lat: number, lon: number): Promise<GeocodedLocation | null> => {
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      
      if (results.length > 0) {
        const result = results[0];
        
        // Debug: Log raw geocoding result to see what we're getting
        console.log('[Geocode] Raw result:', JSON.stringify(result, null, 2));
        console.log('[Geocode] City:', result.city, 'Region:', result.region, 'SubRegion:', result.subregion);
        
        // Fix: Use subregion or district as city fallback (expo-location sometimes puts city in wrong field)
        // On Android, the "city" field sometimes contains business names or POIs
        const cityName = result.subregion || result.district || result.city;
        
        // Validate city name - skip if it looks like a business name (contains certain patterns)
        const isValidCity = cityName && 
          !cityName.includes('Advies') && 
          !cityName.includes('Ltd') && 
          !cityName.includes('Limited') &&
          !cityName.includes('Inc') &&
          !cityName.includes('Corp');
        
        const addressParts = [result.street, cityName, result.region, result.country].filter(Boolean);
        
        const newGeocoded: GeocodedLocation = {
          address: addressParts.join(', ') || null,
          state: normalizeNigerianState(result.region),
          city: isValidCity ? cityName : null,
          country: result.country || null,
          region: result.region || null,
        };

        if (mountedRef.current) {
          setGeocoded(newGeocoded);
        }
        await AsyncStorage.setItem(CONFIG.storageKeys.lastGeocoded, JSON.stringify(newGeocoded));

        return newGeocoded;
      }
    } catch (err) {
      console.warn('Reverse geocoding failed:', err);
    }
    return null;
  }, []);

  // Update profile in database with new location (throttled)
  const syncLocationToProfile = useCallback(async (lat: number, lon: number, state: string | null) => {
    if (!user?.id || !isOnline) return;

    const now = Date.now();
    if (now - lastDbSyncRef.current < CONFIG.dbSyncMinInterval) {
      return; // Throttle database updates
    }

    try {
      await supabase
        .from('profiles')
        .update({
          latitude: lat,
          longitude: lon,
          state: state || undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      lastDbSyncRef.current = now;
      await AsyncStorage.setItem(CONFIG.storageKeys.lastDbSync, String(now));
    } catch (err) {
      console.warn('Failed to sync location to profile:', err);
    }
  }, [user?.id, isOnline]);

  // Refresh location manually
  const refreshLocation = useCallback(async (): Promise<LocationData | null> => {
    if (permissionStatus !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return null;
    }

    setLoading(true);
    setError(null);

    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const newLocation: LocationData = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        timestamp: pos.timestamp,
      };

      if (mountedRef.current) {
        setLocation(newLocation);
      }
      await AsyncStorage.setItem(CONFIG.storageKeys.lastLocation, JSON.stringify(newLocation));

      // Reverse geocode
      const geo = await reverseGeocodeAndSave(newLocation.latitude, newLocation.longitude);

      // Sync to profile (throttled)
      await syncLocationToProfile(newLocation.latitude, newLocation.longitude, geo?.state || null);

      return newLocation;
    } catch (err) {
      console.error('Error getting location:', err);
      if (mountedRef.current) {
        setError('Failed to get current location');
      }
      return null;
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [permissionStatus, requestPermission, reverseGeocodeAndSave, syncLocationToProfile]);

  // Verify location for signup (strict verification, not throttled)
  const verifyLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        return {
          success: false,
          location: null,
          geocoded: null,
          error: 'Location permission is required to create an account. MedGuard needs your location to provide personalized health alerts.',
        };
      }

      // Step 2: Get high-accuracy location
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locationData: LocationData = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        timestamp: pos.timestamp,
      };

      // Step 3: Reverse geocode
      const geoResults = await Location.reverseGeocodeAsync({
        latitude: locationData.latitude,
        longitude: locationData.longitude,
      });

      if (geoResults.length === 0) {
        return {
          success: false,
          location: locationData,
          geocoded: null,
          error: 'Could not determine your location address. Please ensure you have a stable GPS signal.',
        };
      }

      const result = geoResults[0];
      const geocodedData: GeocodedLocation = {
        address: [result.street, result.city, result.region, result.country].filter(Boolean).join(', '),
        state: normalizeNigerianState(result.region),
        city: result.city || null,
        country: result.country || null,
        region: result.region || null,
      };

      // Update state
      if (mountedRef.current) {
        setLocation(locationData);
        setGeocoded(geocodedData);
        setPermissionStatus(status);
      }

      // Cache
      await Promise.all([
        AsyncStorage.setItem(CONFIG.storageKeys.lastLocation, JSON.stringify(locationData)),
        AsyncStorage.setItem(CONFIG.storageKeys.lastGeocoded, JSON.stringify(geocodedData)),
      ]);

      return {
        success: true,
        location: locationData,
        geocoded: geocodedData,
        error: null,
      };
    } catch (err) {
      console.error('Location verification failed:', err);
      return {
        success: false,
        location: null,
        geocoded: null,
        error: 'Failed to verify your location. Please check your GPS settings and try again.',
      };
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // Start watching location
  const startWatching = useCallback(async () => {
    if (watchSubscriptionRef.current) return; // Already watching

    if (permissionStatus !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return;
    }

    try {
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: CONFIG.foregroundTimeInterval,
          distanceInterval: CONFIG.foregroundDistanceInterval,
        },
        async (pos) => {
          const newLocation: LocationData = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            timestamp: pos.timestamp,
          };

          if (mountedRef.current) {
            setLocation(newLocation);
          }
          await AsyncStorage.setItem(CONFIG.storageKeys.lastLocation, JSON.stringify(newLocation));

          // Reverse geocode
          const geo = await reverseGeocodeAndSave(newLocation.latitude, newLocation.longitude);

          // Sync to profile (throttled)
          await syncLocationToProfile(newLocation.latitude, newLocation.longitude, geo?.state || null);
        }
      );

      watchSubscriptionRef.current = subscription;
      if (mountedRef.current) {
        setIsTracking(true);
      }
    } catch (err) {
      console.error('Error starting location watch:', err);
      if (mountedRef.current) {
        setError('Failed to start location tracking');
      }
    }
  }, [permissionStatus, requestPermission, reverseGeocodeAndSave, syncLocationToProfile]);

  // Stop watching location
  const stopWatching = useCallback(() => {
    if (watchSubscriptionRef.current) {
      watchSubscriptionRef.current.remove();
      watchSubscriptionRef.current = null;
    }
    if (mountedRef.current) {
      setIsTracking(false);
    }
  }, []);

  // Auto-start watching when user is authenticated and has granted permission
  useEffect(() => {
    if (user?.id && permissionStatus === 'granted') {
      // Get initial location and start watching
      refreshLocation().then(() => {
        startWatching();
      });
    } else {
      stopWatching();
    }

    return () => {
      stopWatching();
    };
  }, [user?.id, permissionStatus]);

  const value: LocationContextValue = {
    location,
    geocoded,
    loading,
    error,
    permissionStatus,
    isTracking,
    isOnline,
    requestPermission,
    refreshLocation,
    startWatching,
    stopWatching,
    verifyLocation,
    permissionGranted,
  };

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  );
};

export function useLocationContext() {
  const ctx = useContext(LocationContext);
  if (!ctx) {
    throw new Error('useLocationContext must be used within <LocationProvider>.');
  }
  return ctx;
}
