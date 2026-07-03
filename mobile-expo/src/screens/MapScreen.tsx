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
import RiskChoropleth from '../components/RiskChoropleth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBanner, FeatureBlockedScreen, Icon, Chip, SegmentedControl } from '../components';
import { useAuthGate } from '../hooks/useAuthGate';
import { useLocationContext } from '../hooks/LocationContext';
import { useTheme } from '../hooks/useTheme';
import { useRiskMap, riskByState } from '../hooks/useRiskMap';
import {
  RISK_DISEASES,
  RISK_LEVELS,
  riskColor,
  NO_DATA_FILL,
  type RiskDisease,
} from '../theme/riskColors';
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
type MapMode = 'facilities' | 'risk';
const RISK_LEVEL_LABEL: Record<string, string> = {
  low: 'Low', moderate: 'Moderate', elevated: 'Elevated', high: 'High',
};

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
  const [mapMode, setMapMode] = useState<MapMode>('facilities');
  const [selectedDisease, setSelectedDisease] = useState<RiskDisease>('lassa');
  const [selectedState, setSelectedState] = useState<{ state: string; level: string | null; summary: string | null } | null>(null);
  const [facilityFilter, setFacilityFilter] = useState<FacilityFilter>('all');
  const [facilities, setFacilities] = useState<NearbyFacility[]>([]);
  const [selectedFacility, setSelectedFacility] = useState<NearbyFacility | null>(null);
  const [loadingFacilities, setLoadingFacilities] = useState(false);

  const { rows: riskRows, loading: riskLoading } = useRiskMap();
  const riskLookup = useMemo(() => riskByState(riskRows, selectedDisease), [riskRows, selectedDisease]);
  const diseasesWithData = useMemo(() => new Set(riskRows.map((r) => r.disease)), [riskRows]);
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
          style={[styles.headerAction, { backgroundColor: colors.surfaceSunken, borderColor: colors.border }]}
          accessibilityRole="button"
          accessibilityLabel="Recenter map"
        >
          <Icon name="navigation" size={20} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        <SegmentedControl
          variant="solid"
          segments={[
            { key: 'facilities', label: 'Clinics & pharmacies', icon: 'stethoscope' },
            { key: 'risk', label: 'Disease risk', icon: 'activity' },
          ]}
          value={mapMode}
          onChange={(k) => setMapMode(k as MapMode)}
        />
      </View>

      {mapMode === 'facilities' ? (
        <View style={styles.filterRow}>
          {(['all', 'clinic', 'pharmacy'] as FacilityFilter[]).map((f) => (
            <Chip
              key={f}
              label={f === 'all' ? 'All' : f === 'clinic' ? 'Clinics' : 'Pharmacies'}
              active={f === facilityFilter}
              onPress={() => setFacilityFilter(f)}
            />
          ))}
          <Chip label="Search this area" icon="search" onPress={handleSearchThisArea} style={styles.searchChip} />
        </View>
      ) : (
        <View style={styles.filterRow}>
          {RISK_DISEASES.map(({ key, label }) => (
            <Chip
              key={key}
              label={label}
              active={key === selectedDisease}
              muted={!diseasesWithData.has(key)}
              color={riskColor(key, 'elevated')}
              onPress={() => {
                setSelectedDisease(key);
                setSelectedState(null);
              }}
            />
          ))}
        </View>
      )}

      {mapMode === 'risk' && (
        <View style={styles.legendBar}>
          <Text style={[styles.legendBarLabel, { color: colors.textMuted }]}>Low</Text>
          <View style={styles.legendSwatches}>
            {RISK_LEVELS.map((lvl) => (
              <View key={lvl} style={[styles.legendBarSwatch, { backgroundColor: riskColor(selectedDisease, lvl) }]} />
            ))}
          </View>
          <Text style={[styles.legendBarLabel, { color: colors.textMuted }]}>High</Text>
          <View style={[styles.legendDivider, { backgroundColor: colors.border }]} />
          <View style={[styles.legendDot, { backgroundColor: NO_DATA_FILL }]} />
          <Text style={[styles.legendBarLabel, { color: colors.textMuted }]}>No forecast</Text>
        </View>
      )}

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
          {mapMode === 'risk' ? (
            <RiskChoropleth
              disease={selectedDisease}
              lookup={riskLookup}
              onSelect={(state, row) =>
                setSelectedState({ state, level: row?.level ?? null, summary: row?.summary ?? null })
              }
            />
          ) : (
            facilities.map((facility) => (
              <Marker
                key={facility.id}
                coordinate={{ latitude: facility.latitude, longitude: facility.longitude }}
                title={facility.name}
                description={facility.address || `${Math.round(facility.distanceMeters)}m away`}
                pinColor={facilityColor(facility.kind)}
                onPress={() => setSelectedFacility(facility)}
              />
            ))
          )}
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
        {mapMode === 'risk' ? (
          <>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Disease risk projection</Text>
            {riskLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading risk projections...</Text>
              </View>
            ) : selectedState ? (
              <View style={[styles.selectedCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <View style={styles.riskDetailHead}>
                  <View style={[styles.legendSwatch, { backgroundColor: riskColor(selectedDisease, (selectedState.level as any) ?? null) }]} />
                  <Text style={[styles.selectedName, { color: colors.text }]}>
                    {selectedState.state.replace(/\b\w/g, (c) => c.toUpperCase())} · {selectedState.level ? RISK_LEVEL_LABEL[selectedState.level] : 'No forecast'}
                  </Text>
                </View>
                <Text style={[styles.selectedMeta, { color: colors.textSecondary }]} numberOfLines={4}>
                  {selectedState.summary
                    || (riskLookup.size === 0
                      ? 'No forecast has been published for this disease yet.'
                      : 'No active forecast for this state.')}
                </Text>
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {riskLookup.size === 0
                  ? 'No forecast published for this disease yet. Lassa fever is available first.'
                  : 'Tap a colored state to see its projected risk. Colors are a risk projection, not a confirmed outbreak.'}
              </Text>
            )}
          </>
        ) : loadingFacilities ? (
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
                  <Icon name="chevron-right" size={16} color={colors.textMuted} />
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
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  modeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.sm,
  },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.xs,
    ...Shadows.sm,
  },
  modeChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  legend: {
    position: 'absolute',
    top: 172,
    right: Spacing.base,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    gap: 4,
    ...Shadows.md,
  },
  legendTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    marginBottom: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.sm,
  },
  legendSwatches: { flexDirection: 'row', gap: 3 },
  legendBarSwatch: { width: 16, height: 8, borderRadius: 2 },
  legendBarLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.overline },
  legendDivider: { width: StyleSheet.hairlineWidth, height: 14, marginHorizontal: 2 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
  riskDetailHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
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
    fontFamily: FontFamily.display,
    fontSize: FontSize.base,
    letterSpacing: -0.2,
    marginBottom: Spacing.sm,
  },
  searchChip: { marginLeft: 'auto' },
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
