/**
 * MapScreen
 * Interactive map with nearby clinics/pharmacies and live location.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import MapCanvas, { Marker, type MapCanvasHandle, type Region } from '../components/MapCanvas';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBanner, FeatureBlockedScreen } from '../components';
import { useAuthGate } from '../hooks/useAuthGate';
import { useLocationContext } from '../hooks/LocationContext';
import { useTheme } from '../hooks/useTheme';
import { fetchNearbyFacilities, type NearbyFacility } from '../services/nearbyFacilities';
import { toUserMessage } from '../services/errorMessages';
import { BorderRadius, Colors, FontFamily, FontSize, Shadows, Spacing } from '../../theme';

const DEFAULT_REGION: Region = {
  latitude: 9.082,
  longitude: 8.6753,
  latitudeDelta: 1.2,
  longitudeDelta: 1.2,
};

const TAB_BAR_OVERLAY_GUARD = 96;
const ANDROID_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || '';
const CAN_MOUNT_NATIVE_MAP =
  Platform.OS !== 'android' || Constants.appOwnership === 'expo' || Boolean(ANDROID_MAPS_KEY);

type FacilityFilter = 'all' | 'clinic' | 'pharmacy';

const MapScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuthGate();
  const { isDark, colors } = useTheme();
  const {
    location,
    geocoded,
    loading: locationLoading,
    permissionStatus,
    requestPermission,
    refreshLocation,
  } = useLocationContext();

  const mapRef = useRef<MapCanvasHandle | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [facilityFilter, setFacilityFilter] = useState<FacilityFilter>('all');
  const [facilities, setFacilities] = useState<NearbyFacility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<NearbyFacility | null>(null);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facilityRadiusUsed, setFacilityRadiusUsed] = useState<number | null>(null);
  const facilityRequestIdRef = useRef(0);

  const centerFromDevice = useMemo(() => {
    if (!location) return null;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }, [location]);

  const loadNearby = useCallback(async (targetRegion: Region, targetFilter: FacilityFilter) => {
    const requestId = ++facilityRequestIdRef.current;
    setLoadingFacilities(true);
    setError(null);
    setSelectedFacility(null);
    setFacilityRadiusUsed(null);

    const first = await fetchNearbyFacilities({
      latitude: targetRegion.latitude,
      longitude: targetRegion.longitude,
      radiusMeters: 5000,
      type: targetFilter,
    });

    if (requestId !== facilityRequestIdRef.current) return;

    if (first.error) {
      setError(toUserMessage(first.error, 'facilities'));
      setFacilities([]);
      setLoadingFacilities(false);
      return;
    }

    if (first.facilities.length > 0) {
      setFacilityRadiusUsed(5000);
      setFacilities(first.facilities);
      setLoadingFacilities(false);
      return;
    }

    const wider = await fetchNearbyFacilities({
      latitude: targetRegion.latitude,
      longitude: targetRegion.longitude,
      radiusMeters: 15000,
      type: targetFilter,
    });

    if (requestId !== facilityRequestIdRef.current) return;

    if (wider.error) {
      setError(toUserMessage(wider.error, 'facilities'));
      setFacilities([]);
      setLoadingFacilities(false);
      return;
    }

    setFacilityRadiusUsed(15000);
    setFacilities(wider.facilities);
    setLoadingFacilities(false);
  }, []);

  useEffect(() => {
    if (!centerFromDevice) return;
    const nextRegion: Region = {
      latitude: centerFromDevice.latitude,
      longitude: centerFromDevice.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };

    setRegion(nextRegion);
    loadNearby(nextRegion, facilityFilter);
  }, [centerFromDevice, facilityFilter, loadNearby]);

  if (isGuest) {
    return (
      <FeatureBlockedScreen
        title="Disease Map"
        description="Sign in to access interactive map intelligence and nearby clinics/pharmacies."
        icon="map"
        buttonText="Go Back"
        showHomeButton
      />
    );
  }

  const handleRecenter = async () => {
    const granted = permissionStatus === 'granted' ? true : await requestPermission();
    if (!granted) {
      setError(toUserMessage('Location permission is required to find nearby facilities.', 'location'));
      return;
    }

    const latest = await refreshLocation();
    if (!latest) {
      setError(toUserMessage('Unable to determine current location.', 'location'));
      return;
    }

    const next: Region = {
      latitude: latest.latitude,
      longitude: latest.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };

    setRegion(next);
    mapRef.current?.animateToRegion(next, 500);
    loadNearby(next, facilityFilter);
  };

  const handleSearchThisArea = () => {
    loadNearby(region, facilityFilter);
  };

  const facilityColor = (kind: NearbyFacility['kind']) => (kind === 'pharmacy' ? '#8b5cf6' : Colors.primary);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm, borderBottomColor: colors.border, backgroundColor: colors.surface }]}> 
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Nearby Health Map</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {locationLoading
              ? 'Finding your area...'
              : geocoded?.city || geocoded?.state || (location ? 'Using GPS location' : 'Search or recenter to load facilities')}
          </Text>
        </View>
        <Pressable
          onPress={handleRecenter}
          style={[styles.headerAction, { backgroundColor: colors.background }]}
          accessibilityRole="button"
          accessibilityLabel="Recenter map"
        >
          <Ionicons name="locate" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {(['all', 'clinic', 'pharmacy'] as FacilityFilter[]).map((f) => {
          const active = f === facilityFilter;
          return (
            <Pressable
              key={f}
              onPress={() => setFacilityFilter(f)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? Colors.primary : colors.surface,
                  borderColor: active ? Colors.primary : colors.border,
                },
              ]}
            >
              <Text style={[styles.filterChipText, { color: active ? Colors.textLight : colors.textSecondary }]}>
                {f === 'all' ? 'All' : f === 'clinic' ? 'Clinics' : 'Pharmacies'}
              </Text>
            </Pressable>
          );
        })}

        <Pressable
          onPress={handleSearchThisArea}
          style={[styles.searchAreaBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="search" size={16} color={colors.textSecondary} />
          <Text style={[styles.searchAreaText, { color: colors.textSecondary }]}>Search this area</Text>
        </Pressable>
      </View>

      {CAN_MOUNT_NATIVE_MAP ? (
        <MapCanvas
          ref={(r) => {
            mapRef.current = r;
          }}
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          showsUserLocation={permissionStatus === 'granted'}
          showsMyLocationButton={false}
        >
          {facilities.map((facility) => (
            <Marker
              key={facility.id}
              coordinate={{ latitude: facility.latitude, longitude: facility.longitude }}
              title={facility.name}
              description={facility.address || `${Math.round(facility.distanceMeters)}m away`}
              pinColor={facilityColor(facility.kind)}
              onPress={() => setSelectedFacility(facility)}
            />
          ))}
        </MapCanvas>
      ) : (
        <View style={[styles.mapUnavailable, { backgroundColor: colors.background }]}>
          <ErrorBanner
            title="Map unavailable"
            message="The map is not configured in this build. Please install an updated MedGuard build."
          />
        </View>
      )}

      <View style={[styles.bottomSheet, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + Spacing.sm + TAB_BAR_OVERLAY_GUARD }]}> 
        {loadingFacilities ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading nearby facilities...</Text>
          </View>
        ) : error ? (
          <ErrorBanner message={error} title="Map needs attention" onRetry={handleSearchThisArea} />
        ) : (
          <>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Nearby Clinics and Pharmacies</Text>
            {selectedFacility ? (
              <View style={[styles.selectedCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.selectedName, { color: colors.text }]} numberOfLines={1}>{selectedFacility.name}</Text>
                <Text style={[styles.selectedMeta, { color: colors.textSecondary }]}>
                  {selectedFacility.kind === 'pharmacy' ? 'Pharmacy' : 'Clinic'} · {Math.round(selectedFacility.distanceMeters)}m away
                </Text>
                {!!selectedFacility.address && (
                  <Text style={[styles.selectedMeta, { color: colors.textMuted }]} numberOfLines={2}>{selectedFacility.address}</Text>
                )}
              </View>
            ) : null}

            <View style={styles.list}>
              {facilities.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {facilityRadiusUsed
                    ? `No facilities found within ${Math.round(facilityRadiusUsed / 1000)} km. Tap Search this area after moving the map, or Recenter to use your current location.`
                    : 'Use Recenter or Search this area to look for nearby clinics and pharmacies.'}
                </Text>
              ) : null}
              {facilities.slice(0, 5).map((facility) => (
                <Pressable
                  key={facility.id}
                  onPress={() => {
                    setSelectedFacility(facility);
                    mapRef.current?.animateToRegion(
                      {
                        latitude: facility.latitude,
                        longitude: facility.longitude,
                        latitudeDelta: 0.03,
                        longitudeDelta: 0.03,
                      },
                      450
                    );
                  }}
                  style={[styles.listItem, { borderColor: colors.border }]}
                >
                  <View style={[styles.dot, { backgroundColor: facilityColor(facility.kind) }]} />
                  <View style={styles.listMain}>
                    <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>{facility.name}</Text>
                    <Text style={[styles.listMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {facility.kind === 'pharmacy' ? 'Pharmacy' : 'Clinic'} · {Math.round(facility.distanceMeters)}m
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    borderBottomWidth: 1,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    ...Shadows.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
    maxWidth: 250,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.sm,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  filterChip: {
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    ...Shadows.sm,
  },
  filterChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  searchAreaBtn: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    ...Shadows.sm,
  },
  searchAreaText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  map: {
    flex: 1,
  },
  mapUnavailable: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
  },
  bottomSheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    maxHeight: 300,
    ...Shadows.lg,
  },
  sheetTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    marginBottom: Spacing.sm,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.base,
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
  },
  selectedCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  selectedName: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  selectedMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  list: {
    gap: 6,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    minHeight: 54,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  listMain: {
    flex: 1,
  },
  listName: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  listMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
});

export default MapScreen;
