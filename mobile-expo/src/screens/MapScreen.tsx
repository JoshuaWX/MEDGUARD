/**
 * MapScreen
 * UI scaffold matching the original map.html layout (static - no map logic).
 */

import React from 'react';
import {
  View,
  Text as RNText,
  StyleSheet,
  Pressable,
  TextInput,
  ImageBackground,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { ArrowBackIcon, ChevronDownIcon, LocationIcon } from '../components';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  useThemedColors,
} from '../../theme';

const MAP_BG_URI =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuCAPWSL2asbAADrThVKxzPYcMB4a-6zl1XNwhgJdxonOA2o4C9Bj2f49_JhxInHe3oU2NKBP8HRpclw16zK8_vA2u0_jww07JBBxJpz6kMbmtmRO3KySBflylhnqFB7plOgvDrJySDB02rguGsOwnpj7ya9Y36he3QUerbM3mSoqhBdDnTF0kxEaKMCQlS6rNxrLHh6qan4JehYfB1CWlc-UJGCTFbbR1rR45eEk5P8BpGObP-y2DkmiVXbD27pRXEMu7iZkUydYI0';

const SearchIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 20,
  color = Colors.textMuted,
}) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 21l-4.35-4.35" />
    <Path d="M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16z" />
  </Svg>
);

const MapScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useI18n();
  const { isDark } = useTheme();
  const colors = useThemedColors(isDark);

  const Text: React.FC<React.ComponentProps<typeof RNText>> = ({ style, ...props }) => (
    <RNText {...props} style={[{ color: colors.text }, style]} />
  );

  const headerBg = isDark ? 'rgba(16, 31, 34, 0.85)' : 'rgba(246, 248, 248, 0.8)';

  const handleBack = () => {
    // Keep behavior safe for tab usage.
    // If there's no back stack, do nothing.
    // (UI parity requires the back button to exist.)
    const nav = navigation as any;
    if (typeof nav?.canGoBack === 'function' && nav.canGoBack()) {
      nav.goBack();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Sticky header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.base, backgroundColor: headerBg }]}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ArrowBackIcon size={24} color={colors.text} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('disease_map')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Map area */}
      <View style={[styles.mapArea, { backgroundColor: colors.background }]}>
        <ImageBackground
          source={{ uri: MAP_BG_URI }}
          resizeMode="cover"
          style={styles.mapBg}
        >
          <View style={styles.mapOverlay}>
            {/* Search */}
            <View style={[styles.searchBar, { backgroundColor: colors.surface }]}>
              <View style={styles.searchIcon}>
                <SearchIcon color={colors.textMuted} />
              </View>
              <TextInput
                placeholder={t('search_location')}
                placeholderTextColor={colors.textMuted}
                style={[styles.searchInput, { color: colors.text }]}
              />
            </View>

            {/* Controls */}
            <View style={styles.controlsColumn}>
              <View style={styles.zoomCard}>
                <Pressable style={({ pressed }) => [styles.zoomBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Zoom in">
                  <Text style={styles.zoomText}>+</Text>
                </Pressable>
                <View style={styles.zoomDivider} />
                <Pressable style={({ pressed }) => [styles.zoomBtn, pressed && styles.pressed]} accessibilityRole="button" accessibilityLabel="Zoom out">
                  <Text style={styles.zoomText}>−</Text>
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [styles.locateBtn, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel="Locate me"
              >
                <LocationIcon size={22} color={colors.text} />
              </Pressable>
            </View>
          </View>
        </ImageBackground>
      </View>

      {/* Bottom panel */}
      <View style={[styles.bottomPanel, { paddingBottom: insets.bottom + Spacing.base }]}>
        <View style={styles.chipsRow}>
          <Pressable style={({ pressed }) => [styles.chip, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.chipText}>{t('map_month')}: {t('month_june')}</Text>
            <ChevronDownIcon size={18} color={colors.textMuted} />
          </Pressable>
          <Pressable style={({ pressed }) => [styles.chip, pressed && styles.pressed]} accessibilityRole="button">
            <Text style={styles.chipText}>{t('map_season')}: {t('season_rainy')}</Text>
            <ChevronDownIcon size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={[styles.legendCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.legendTitle}>{t('legend')}</Text>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: Colors.warning }]} />
            <Text style={styles.legendLabel}>{t('legend_malaria')}</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: Colors.danger }]} />
            <Text style={styles.legendLabel}>{t('legend_cholera')}</Text>
          </View>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: '#9C27B0' }]} />
            <Text style={styles.legendLabel}>{t('legend_lassa')}</Text>
          </View>

          <Text style={[styles.legendTitle, { marginTop: Spacing.base }]}>{t('map_weather')}</Text>
          <View style={styles.weatherRow}>
            <Text style={styles.weatherIcon}>💧</Text>
            <Text style={styles.weatherLabel}>{t('weather_rainy_conditions')}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(246, 248, 248, 0.8)',
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.sm,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  mapArea: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  mapBg: {
    flex: 1,
  },
  mapOverlay: {
    flex: 1,
    padding: Spacing.base,
    justifyContent: 'space-between',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.base,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  controlsColumn: {
    alignSelf: 'flex-end',
    gap: Spacing.base,
  },
  zoomCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  zoomBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  zoomText: {
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  locateBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  bottomPanel: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    backgroundColor: Colors.backgroundLight,
  },
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    ...Shadows.sm,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  legendCard: {
    marginTop: Spacing.base,
    padding: Spacing.base,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  legendTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    marginBottom: Spacing.sm,
  },
  legendDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  legendLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  weatherIcon: {
    fontSize: 16,
  },
  weatherLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  pressed: {
    opacity: 0.75,
  },
});

export default MapScreen;
