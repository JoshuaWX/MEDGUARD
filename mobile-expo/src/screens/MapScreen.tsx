/**
 * MapScreen
 * Interactive map with nearby clinics/pharmacies and live location.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import MapCanvas, { Marker, type MapCanvasHandle, type Region } from '../components/MapCanvas';
import RiskChoropleth from '../components/RiskChoropleth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorBanner, FeatureBlockedScreen, Icon, Chip } from '../components';
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
import { type NearbyFacility } from '../services/nearbyFacilities';
import { loadNearbyFacilitySnapshot } from '../services/facilityRepository';
import { useAuth } from '../hooks/useAuth';
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
type MapMode = 'facilities' | 'treatment' | 'risk';
const RISK_LEVEL_LABEL: Record<string, string> = {
  low: 'Low', moderate: 'Moderate', elevated: 'Elevated', high: 'High',
};
const MODE_META: Record<MapMode, { label: string; icon: 'stethoscope' | 'heart-pulse' | 'activity' }> = {
  facilities: { label: 'Clinics', icon: 'stethoscope' },
  treatment: { label: 'Treatment', icon: 'heart-pulse' },
  risk: { label: 'Risk', icon: 'activity' },
};

const MapScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { isGuest } = useAuthGate();
  const { user: authUser } = useAuth();
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
  const [facilityCachedAt, setFacilityCachedAt] = useState<string | null>(null);
  const [facilityCacheStale, setFacilityCacheStale] = useState(false);
  const facilityRequestIdRef = useRef(0);

  const centerFromDevice = useMemo(() => {
    if (!location) return null;
    return {
      latitude: location.latitude,
      longitude: location.longitude,
    };
  }, [location]);

  const loadNearby = useCallback(
    async (targetRegion: Region, targetFilter: FacilityFilter, disease?: string, force = false) => {
      if (!authUser?.id) return;
      const requestId = ++facilityRequestIdRef.current;
      setLoadingFacilities(true);
      setError(null);
      setSelectedFacility(null);
      setFacilityRadiusUsed(null);
      setFacilityCachedAt(null);
      setFacilityCacheStale(false);

      const result = await loadNearbyFacilitySnapshot({
        userId: authUser.id,
        latitude: targetRegion.latitude,
        longitude: targetRegion.longitude,
        type: disease ? 'clinic' : targetFilter,
        disease,
        force,
      });

      if (requestId !== facilityRequestIdRef.current) return;

      if (result.error || !result.snapshot) {
        setError(toUserMessage(result.error || 'Facilities are unavailable.', 'facilities'));
        setFacilities([]);
        setLoadingFacilities(false);
        return;
      }
      setFacilityRadiusUsed(result.snapshot.radiusMeters);
      setFacilityCachedAt(result.snapshot.cachedAt);
      setFacilityCacheStale(result.snapshot.stale);
      setFacilities(result.snapshot.facilities);
      setLoadingFacilities(false);
    },
    [authUser?.id],
  );

  useEffect(() => {
    if (!centerFromDevice) return;
    const nextRegion: Region = {
      latitude: centerFromDevice.latitude,
      longitude: centerFromDevice.longitude,
      latitudeDelta: 0.08,
      longitudeDelta: 0.08,
    };

    setRegion(nextRegion);
    if (mapMode === 'facilities') loadNearby(nextRegion, facilityFilter);
    else if (mapMode === 'treatment') loadNearby(nextRegion, 'clinic', selectedDisease);
  }, [centerFromDevice, facilityFilter, mapMode, selectedDisease, loadNearby]);

  const openDirections = useCallback(
    (facility: NearbyFacility) => {
      const destination = facility.directionsQuery
        ? encodeURIComponent(facility.directionsQuery)
        : `${facility.latitude},${facility.longitude}`;
      const origin = centerFromDevice
        ? `&origin=${centerFromDevice.latitude},${centerFromDevice.longitude}`
        : '';
      const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}&travelmode=driving`;
      Linking.openURL(url).catch(() => setError('Could not open Google Maps for directions.'));
    },
    [centerFromDevice],
  );

  const openCall = useCallback((phone: string) => {
    Linking.openURL(`tel:${phone.replace(/\s+/g, '')}`).catch(() =>
      setError('Could not start a call on this device.'),
    );
  }, []);

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
    if (mapMode === 'treatment') loadNearby(next, 'clinic', selectedDisease, true);
    else loadNearby(next, facilityFilter, undefined, true);
  };

  const handleSearchThisArea = () => {
    if (mapMode === 'treatment') loadNearby(region, 'clinic', selectedDisease, true);
    else loadNearby(region, facilityFilter, undefined, true);
  };

  const facilityColor = (kind: NearbyFacility['kind']) => (kind === 'pharmacy' ? '#8b5cf6' : Colors.primary);
  const selectedDiseaseLabel = RISK_DISEASES.find((d) => d.key === selectedDisease)?.label ?? 'Treatment';

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

      <View style={styles.mapWrap}>
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

        {/* Floating controls that sit ON the map (Maps-app style) */}
        <View style={[styles.floatingTop, { top: Spacing.sm }]} pointerEvents="box-none">
          <View style={[styles.toggle, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {(['facilities', 'treatment', 'risk'] as MapMode[]).map((m) => {
              const active = mapMode === m;
              const meta = MODE_META[m];
              return (
                <Pressable
                  key={m}
                  onPress={() => setMapMode(m)}
                  style={[styles.toggleHalf, active && { backgroundColor: colors.primary }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={
                    m === 'facilities'
                      ? 'Show clinics and pharmacies'
                      : m === 'treatment'
                        ? 'Find treatment centres for a disease'
                        : 'Show disease risk map'
                  }
                >
                  <Icon
                    name={meta.icon}
                    size={17}
                    color={active ? Colors.textLight : colors.textSecondary}
                    strokeWidth={active ? 2.3 : 1.9}
                  />
                  <Text
                    style={[styles.toggleLabel, { color: active ? Colors.textLight : colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {meta.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
            style={styles.filterScrollWrap}
          >
            {mapMode === 'facilities' ? (
              <>
                {(['all', 'clinic', 'pharmacy'] as FacilityFilter[]).map((f) => (
                  <Chip
                    key={f}
                    label={f === 'all' ? 'All' : f === 'clinic' ? 'Clinics' : 'Pharmacies'}
                    active={f === facilityFilter}
                    onPress={() => setFacilityFilter(f)}
                  />
                ))}
                <Chip label="Search this area" icon="search" onPress={handleSearchThisArea} />
              </>
            ) : mapMode === 'treatment' ? (
              RISK_DISEASES.map(({ key, label }) => (
                <Chip
                  key={key}
                  label={label}
                  active={key === selectedDisease}
                  color={riskColor(key, 'elevated')}
                  onPress={() => setSelectedDisease(key)}
                />
              ))
            ) : (
              RISK_DISEASES.map(({ key, label }) => (
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
              ))
            )}
          </ScrollView>
        </View>
      </View>

      <View style={[styles.bottomSheet, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + Spacing.sm + TAB_BAR_OVERLAY_GUARD }]}>
        {mapMode === 'risk' ? (
          <>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Disease risk projection</Text>
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
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              {mapMode === 'treatment' ? `${selectedDiseaseLabel} treatment centres` : 'Nearby Clinics and Pharmacies'}
            </Text>
            {facilityRadiusUsed && facilityCachedAt ? (
              <View style={styles.facilityFreshness}>
                <Icon name={facilityCacheStale ? 'clock' : 'check'} size={12} color={facilityCacheStale ? colors.warning : colors.primary} />
                <Text style={[styles.sheetHint, { color: colors.textMuted }]}>
                  {Math.round(facilityRadiusUsed / 1000)} km search · {facilityCacheStale ? 'saved result' : 'current result'} · {new Date(facilityCachedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            ) : null}
            {mapMode === 'treatment' && (
              <Text style={[styles.sheetHint, { color: colors.textMuted }]}>
                NCDC-designated centres are listed first, then nearby hospitals. Guidance only — not a diagnosis.
              </Text>
            )}

            {selectedFacility ? (
              <View style={[styles.selectedCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
                {selectedFacility.ncdcDesignated && (
                  <View style={[styles.ncdcBadge, { backgroundColor: `${Colors.primary}18` }]}>
                    <Icon name="shield-check" size={12} color={Colors.primary} />
                    <Text style={[styles.ncdcBadgeText, { color: Colors.primary }]}>NCDC-designated</Text>
                  </View>
                )}
                <Text style={[styles.selectedName, { color: colors.text }]} numberOfLines={2}>{selectedFacility.name}</Text>
                <Text style={[styles.selectedMeta, { color: colors.textSecondary }]}>
                  {selectedFacility.kind === 'pharmacy' ? 'Pharmacy' : 'Clinic'} · {Math.round(selectedFacility.distanceMeters / 100) / 10} km away
                </Text>
                {!!selectedFacility.description && (
                  <Text style={[styles.selectedMeta, { color: colors.textSecondary }]}>{selectedFacility.description}</Text>
                )}
                {!!selectedFacility.address && (
                  <Text style={[styles.selectedMeta, { color: colors.textMuted }]} numberOfLines={2}>{selectedFacility.address}</Text>
                )}

                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => openDirections(selectedFacility)}
                    style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Directions to ${selectedFacility.name}`}
                  >
                    <Icon name="navigation" size={15} color={Colors.textLight} />
                    <Text style={[styles.actionBtnText, { color: Colors.textLight }]}>Directions</Text>
                  </Pressable>
                  {!!selectedFacility.phone && (
                    <Pressable
                      onPress={() => openCall(selectedFacility.phone!)}
                      style={[styles.actionBtn, styles.actionBtnGhost, { borderColor: colors.border }]}
                      accessibilityRole="button"
                      accessibilityLabel={`Call ${selectedFacility.name}`}
                    >
                      <Icon name="phone" size={15} color={colors.primary} />
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Call</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ) : null}

            <View style={styles.list}>
              {facilities.length === 0 ? (
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                  {facilityRadiusUsed
                    ? `No facilities found within ${Math.round(facilityRadiusUsed / 1000)} km. Tap Search this area after moving the map, or Recenter to use your current location.`
                    : mapMode === 'treatment'
                      ? 'Pick a disease above, then Recenter or Search this area.'
                      : 'Use Recenter or Search this area to look for nearby clinics and pharmacies.'}
                </Text>
              ) : null}
              {facilities.slice(0, mapMode === 'treatment' ? 6 : 5).map((facility) => (
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
                  <View style={[styles.dot, { backgroundColor: facility.ncdcDesignated ? Colors.primary : facilityColor(facility.kind) }]} />
                  <View style={styles.listMain}>
                    <View style={styles.listNameRow}>
                      <Text style={[styles.listName, { color: colors.text }]} numberOfLines={1}>{facility.name}</Text>
                      {facility.ncdcDesignated && (
                        <Icon name="shield-check" size={13} color={Colors.primary} />
                      )}
                    </View>
                    <Text style={[styles.listMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                      {facility.ncdcDesignated
                        ? `NCDC centre · ${Math.round(facility.distanceMeters / 100) / 10} km`
                        : `${facility.kind === 'pharmacy' ? 'Pharmacy' : 'Clinic'} · ${Math.round(facility.distanceMeters)}m`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => openDirections(facility)}
                    hitSlop={8}
                    style={[styles.rowDirBtn, { backgroundColor: colors.surfaceSunken }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Directions to ${facility.name}`}
                  >
                    <Icon name="navigation" size={15} color={colors.primary} />
                  </Pressable>
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
  mapWrap: {
    flex: 1,
    position: 'relative',
  },
  floatingTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: BorderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
    ...Shadows.lg,
  },
  toggleHalf: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 11,
    borderRadius: BorderRadius.pill,
    minWidth: 128,
  },
  toggleLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  filterScrollWrap: {
    alignSelf: 'stretch',
    flexGrow: 0,
  },
  filterScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
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
    marginBottom: Spacing.sm,
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
  sheetHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 16,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  facilityFreshness: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.xs },
  ncdcBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    marginBottom: 6,
  },
  ncdcBadgeText: { fontFamily: FontFamily.semibold, fontSize: 10, letterSpacing: 0.3 },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spacing.base,
    paddingVertical: 9,
    borderRadius: BorderRadius.pill,
  },
  actionBtnGhost: {
    backgroundColor: 'transparent',
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionBtnText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  listNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowDirBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
