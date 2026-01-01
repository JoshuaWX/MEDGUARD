/**
 * useLocation hook
 * Device location and geolocation
 */

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

interface LocationState {
  location: LocationData | null;
  address: string | null;
  state: string | null;
  loading: boolean;
  error: string | null;
  permissionGranted: boolean;
}

interface UseLocationReturn extends LocationState {
  requestPermission: () => Promise<boolean>;
  getCurrentLocation: () => Promise<LocationData | null>;
  reverseGeocode: (latitude: number, longitude: number) => Promise<string | null>;
}

export const useLocation = (): UseLocationReturn => {
  const [state, setState] = useState<LocationState>({
    location: null,
    address: null,
    state: null,
    loading: false,
    error: null,
    permissionGranted: false,
  });

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      
      setState(prev => ({
        ...prev,
        permissionGranted: granted,
        error: granted ? null : 'Location permission denied',
      }));

      return granted;
    } catch (err) {
      console.error('Error requesting location permission:', err);
      setState(prev => ({
        ...prev,
        error: 'Failed to request location permission',
      }));
      return false;
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));

      // Check permission
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          return null;
        }
      }

      // Get current position
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const locationData: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      // Reverse geocode
      const address = await reverseGeocode(
        locationData.latitude,
        locationData.longitude
      );

      setState(prev => ({
        ...prev,
        location: locationData,
        address,
        loading: false,
      }));

      return locationData;
    } catch (err) {
      console.error('Error getting location:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: 'Failed to get current location',
      }));
      return null;
    }
  }, [requestPermission]);

  const reverseGeocode = useCallback(
    async (latitude: number, longitude: number): Promise<string | null> => {
      try {
        const results = await Location.reverseGeocodeAsync({
          latitude,
          longitude,
        });

        if (results.length > 0) {
          const result = results[0];
          const addressParts = [
            result.street,
            result.city,
            result.region,
            result.country,
          ].filter(Boolean);

          const address = addressParts.join(', ');

          // Extract state for Nigeria
          const nigerianState = extractNigerianState(result.region);
          
          setState(prev => ({
            ...prev,
            address,
            state: nigerianState,
          }));

          return address;
        }

        return null;
      } catch (err) {
        console.error('Error reverse geocoding:', err);
        return null;
      }
    },
    []
  );

  // Check permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setState(prev => ({
        ...prev,
        permissionGranted: status === 'granted',
      }));
    };

    checkPermission();
  }, []);

  return {
    ...state,
    requestPermission,
    getCurrentLocation,
    reverseGeocode,
  };
};

// Map region to Nigerian state name
function extractNigerianState(region: string | null): string | null {
  if (!region) return null;

  // Common region variations
  const stateMap: Record<string, string> = {
    'Lagos': 'Lagos',
    'Lagos State': 'Lagos',
    'FCT': 'FCT',
    'Federal Capital Territory': 'FCT',
    'Abuja': 'FCT',
    'Kano': 'Kano',
    'Rivers': 'Rivers',
    'Oyo': 'Oyo',
    'Kaduna': 'Kaduna',
    'Delta': 'Delta',
    'Anambra': 'Anambra',
    'Enugu': 'Enugu',
    'Ogun': 'Ogun',
    'Ondo': 'Ondo',
    'Edo': 'Edo',
    'Katsina': 'Katsina',
    'Sokoto': 'Sokoto',
    'Borno': 'Borno',
    'Bauchi': 'Bauchi',
    'Plateau': 'Plateau',
    'Cross River': 'Cross River',
    'Akwa Ibom': 'Akwa Ibom',
    'Abia': 'Abia',
    'Imo': 'Imo',
    'Kwara': 'Kwara',
    'Niger': 'Niger',
    'Benue': 'Benue',
    'Osun': 'Osun',
    'Ekiti': 'Ekiti',
    'Taraba': 'Taraba',
    'Adamawa': 'Adamawa',
    'Gombe': 'Gombe',
    'Yobe': 'Yobe',
    'Jigawa': 'Jigawa',
    'Zamfara': 'Zamfara',
    'Kebbi': 'Kebbi',
    'Kogi': 'Kogi',
    'Nasarawa': 'Nasarawa',
    'Ebonyi': 'Ebonyi',
    'Bayelsa': 'Bayelsa',
  };

  // Try to find a match
  for (const [key, value] of Object.entries(stateMap)) {
    if (region.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  return region;
}
