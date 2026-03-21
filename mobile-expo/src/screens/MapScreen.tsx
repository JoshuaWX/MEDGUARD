/**
 * MapScreen
 * Interactive map with nearby clinics/pharmacies and live location.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeatureBlockedScreen } from '../components';
import { useAuthGate } from '../hooks/useAuthGate';
import { useLocationContext } from '../hooks/LocationContext';
import { useTheme } from '../hooks/useTheme';
import { fetchNearbyFacilities, type NearbyFacility } from '../services/nearbyFacilities';
import { BorderRadius, Colors, FontFamily, FontSize, Shadows, Spacing } from '../../theme';

const DEFAULT_REGION: Region = {
  latitude: 9.082,
  longitude: 8.6753,
  latitudeDelta: 1.2,
  longitudeDelta: 1.2,
};

type FacilityFilter = 'all' | 'clinic' | 'pharmacy';

const MapScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuthGate();
  const { isDark, colors } = useTheme();
  const {
    location,
    geocoded,
    permissionStatus,
    requestPermission,
    refreshLocation,
  } = useLocationContext();

  const mapRef = useRef<MapView | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [facilityFilter, setFacilityFilter] = useState<FacilityFilter>('all');
  const [facilities, setFacilities] = useState<NearbyFacility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<NearbyFacility | null>(null);
  const [loadingFacilities, setLoadingFacilities] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const centerFromDevice = useMemo(() => {
    if (!location) return null;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }, [location]);

  useEffect(() => {
    if (!centerFromDevice) return;
    setRegion((prev) => ({
      ...prev,
      latitude: centerFromDevice.latitude,
      longitude: centerFromDevice.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    }));
  }, [centerFromDevice]);

  const loadNearby = useCallback(async (targetRegion: Region, targetFilter: FacilityFilter) => {
    setLoadingFacilities(true);
    setError(null);

    const { facilities: data, error: facilitiesErr } = await fetchNearbyFacilities({
      latitude: targetRegion.latitude,
      longitude: targetRegion.longitude,
      radiusMeters: 5000,
      type: targetFilter,
    });

    if (facilitiesErr) {
      setError(facilitiesErr.message || 'Unable to load nearby facilities.');
      setFacilities([]);
      setLoadingFacilities(false);
      return;
    }

    setFacilities(data);
    setLoadingFacilities(false);
  }, []);

  useEffect(() => {
    loadNearby(region, facilityFilter);
  }, [facilityFilter, loadNearby]);

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
      setError('Location permission is required to find nearby facilities.');
      return;
    }

    const latest = await refreshLocation();
    if (!latest) {
      setError('Unable to determine current location.');
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
            {geocoded?.city || geocoded?.state || 'Using current map center'}
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

      <MapView
        ref={(r) => {
          mapRef.current = r;
        }}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
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
      </MapView>

      <View style={[styles.bottomSheet, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + Spacing.sm }]}> 
        {loadingFacilities ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading nearby facilities...</Text>
          </View>
        ) : error ? (
          <Text style={[styles.errorText, { color: Colors.danger }]}>{error}</Text>
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
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
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
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  searchAreaText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  map: {
    flex: 1,
  },
  bottomSheet: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    maxHeight: 260,
    ...Shadows.md,
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
