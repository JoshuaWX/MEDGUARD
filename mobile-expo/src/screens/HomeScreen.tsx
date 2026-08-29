/**
 * HomeScreen — "Calm Clinical" dashboard.
 *
 * Flat background, generous grid, display-font headings, big-number data, and a
 * single confident accent. A welcoming overview leads; live environment,
 * official news, and response-driven area estimates follow in a calm rhythm.
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Linking,
  StatusBar,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import {
  Avatar,
  Card,
  Icon,
  HomeHeroArt,
  SkeletonLoader,
  FloatingActionButton,
  HealthNewsCard,
  PermissionsPrimerModal,
  ScreenLoader,
} from '../components';
import type { IconName } from '../components';
import { EnvironmentModal } from '../components/EnvironmentModal';

import { useUser } from '../hooks/useUser';
import { useIntel } from '../hooks/useIntel';
import { useLocationContext } from '../hooks/LocationContext';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import { Colors, FontFamily, FontSize, LetterSpacing, Spacing, BorderRadius } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const getAqiLabel = (aqi: number): { label: string; color: string } => {
  const levels: Record<number, { label: string; color: string }> = {
    1: { label: 'Good', color: Colors.success },
    2: { label: 'Fair', color: '#3FA45B' },
    3: { label: 'Moderate', color: Colors.warning },
    4: { label: 'Poor', color: Colors.danger },
    5: { label: 'Very Poor', color: '#7c3aed' },
  };
  return levels[aqi] || levels[3];
};

const getRiskMeta = (level: string): { tint: string; title: string; icon: IconName } => {
  switch (level) {
    case 'high':
      return { tint: Colors.danger, title: 'Elevated risk area', icon: 'alert-triangle' };
    case 'elevated':
    case 'verified':
      return { tint: Colors.warning, title: 'Verified or elevated outlook', icon: 'alert-circle' };
    case 'medium':
    case 'moderate':
      return { tint: Colors.warning, title: 'Moderate risk area', icon: 'alert-circle' };
    default:
      return { tint: Colors.success, title: 'Low risk area', icon: 'shield-check' };
  }
};

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, loading: userLoading } = useUser();
  const { intel, loading: intelLoading, refresh } = useIntel();
  const { alertArea, refreshLocation, requestPermission, permissionStatus } = useLocationContext();
  const { t } = useI18n();
  const { isDark, colors } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState<'aqi' | 'weather'>('aqi');

  const urgentAlert = useMemo(() => {
    if (!intel) return null;
    if (intel.airQuality?.aqi && intel.airQuality.aqi >= 4) {
      const label = intel.airQuality.aqi === 5 ? 'Very Poor' : 'Poor';
      return {
        icon: 'cloud' as IconName,
        title: `Air quality: ${label}`,
        message: 'Limit outdoor activity. Wear a mask if going outside.',
        action: () => openModal('aqi'),
      };
    }
    const precip = intel.weather?.current?.precipitation || 0;
    if (precip >= 50) {
      return {
        icon: 'droplets' as IconName,
        title: 'Heavy rainfall conditions',
        message: 'Current rainfall may increase flood exposure. Avoid low-lying areas where possible.',
        action: () => openModal('weather'),
      };
    }
    return null;
  }, [intel]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshLocation()]);
    setRefreshing(false);
  }, [refresh, refreshLocation]);

  const openModal = (tab: 'aqi' | 'weather') => {
    setModalTab(tab);
    setModalVisible(true);
  };

  const handleEnableLocation = () => {
    if (permissionStatus === 'denied') Linking.openSettings();
    else requestPermission();
  };

  const location = alertArea?.state || 'Your saved area';
  const showLocationPrompt = permissionStatus !== 'granted' && permissionStatus !== 'denied';
  const activeRisks = intel?.areaOutlook?.filter((item) => item.level !== 'low') || [];
  const topRecommendation = activeRisks[0]?.kind === 'forecast'
    ? 'Follow official guidance and seek care if symptoms persist or worsen.'
    : undefined;
  const firstName = user?.name?.split(' ')[0] || 'Friend';

  // Welcoming, time-aware hero without an unverified risk verdict.
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const greetIcon: IconName = hour >= 18 || hour < 5 ? 'moon' : 'sun';
  const todayLabel = now
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase();
  const heroTip: { icon: IconName; text: string } = topRecommendation
    ? { icon: 'sparkles', text: topRecommendation }
    : { icon: 'shield-check', text: 'Keep your check-ins current and follow official health guidance for your area.' };

  const bottomPadding = Math.max(insets.bottom, 12) + 100;

  // Wait for the signed-in user's profile before rendering the header, so we
  // never flash a placeholder greeting (matches MyHealth/Profile behaviour).
  if (userLoading && !user) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ScreenLoader label="Loading your dashboard…" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <HomeHeroArt height={insets.top + 240} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.base, paddingBottom: bottomPadding, flexGrow: 1 },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.userSection}>
            <Avatar size={46} source={user?.avatarUrl} />
            <View style={styles.userInfo}>
              <Text style={[styles.greeting, { color: colors.textMuted }]}>{t('welcome_back')}</Text>
              <Text style={[styles.userName, { color: colors.text }]} numberOfLines={1}>
                {firstName}
              </Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              style={[styles.locationChip, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => (permissionStatus === 'granted' ? refreshLocation() : handleEnableLocation())}
            >
              <Icon name="map-pin" size={13} color={colors.primary} />
              <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
                {location}
              </Text>
            </Pressable>
            <Pressable
              style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate('Alerts')}
            >
              <Icon name="bell" size={19} color={colors.text} />
            </Pressable>
          </View>
        </View>

        {intelLoading && !intel ? (
          <View style={styles.loadingContainer}>
            <SkeletonLoader height={132} style={{ borderRadius: BorderRadius.card }} />
            <View style={{ height: 14 }} />
            <SkeletonLoader height={104} style={{ borderRadius: BorderRadius.card }} />
            <View style={{ height: 14 }} />
            <SkeletonLoader height={150} style={{ borderRadius: BorderRadius.card }} />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(350)}>
            {/* Urgent alert */}
            {urgentAlert && (
              <Animated.View entering={FadeInDown.duration(350)}>
                <Pressable onPress={urgentAlert.action} style={[styles.alertBanner, { backgroundColor: isDark ? 'rgba(220,59,59,0.14)' : Colors.dangerLight, borderColor: isDark ? 'rgba(220,59,59,0.35)' : '#F3C6C6' }]}>
                  <View style={[styles.alertIcon, { backgroundColor: Colors.danger }]}>
                    <Icon name={urgentAlert.icon} size={18} color={Colors.textLight} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertTitle, { color: colors.text }]}>{urgentAlert.title}</Text>
                    <Text style={[styles.alertMessage, { color: colors.textSecondary }]}>{urgentAlert.message}</Text>
                  </View>
                  <Icon name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
              </Animated.View>
            )}

            {/* Welcoming hero — warm greeting, date, and one friendly line (no risk verdict) */}
            <Card variant="elevated" style={styles.heroCard}>
              <View style={styles.heroRow}>
                <View style={[styles.heroIcon, { backgroundColor: colors.primaryTint }]}>
                  <Icon name={greetIcon} size={24} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.heroOverline, { color: colors.textMuted }]}>{todayLabel}</Text>
                  <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={1}>
                    {greeting}, {firstName}
                  </Text>
                </View>
              </View>

              <View style={[styles.heroTipRow, { borderTopColor: colors.border }]}>
                <View style={[styles.heroTipIcon, { backgroundColor: colors.primaryTint }]}>
                  <Icon name={heroTip.icon} size={13} color={colors.primary} />
                </View>
                <Text style={[styles.heroTipText, { color: colors.textSecondary }]}>{heroTip.text}</Text>
              </View>
            </Card>

            {/* Current conditions */}
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>CURRENT CONDITIONS</Text>
            <View style={styles.envRow}>
              {intel?.airQuality && (() => {
                const aqiData = getAqiLabel(intel.airQuality.aqi);
                const dominant = intel.airQuality.insight?.dominantPollutant;
                return (
                  <Card variant="plain" padding={Spacing.base} style={styles.envCard} onPress={() => openModal('aqi')}>
                    <View style={styles.envCardHeader}>
                      <Icon name="leaf" size={16} color={aqiData.color} />
                      <Text style={[styles.envCardLabel, { color: colors.textMuted }]}>Air quality</Text>
                    </View>
                    <Text style={[styles.envCardValue, { color: aqiData.color }]}>{aqiData.label}</Text>
                    <Text style={[styles.envCardHint, { color: colors.textMuted }]} numberOfLines={1}>
                      {dominant ? `Primary: ${dominant}` : 'Tap for details'}
                    </Text>
                  </Card>
                );
              })()}

              {intel?.weather && (
                <Card variant="plain" padding={Spacing.base} style={styles.envCard} onPress={() => openModal('weather')}>
                  <View style={styles.envCardHeader}>
                    <Icon name={intel.weather.current.precipitation > 0 ? 'rain' : 'sun'} size={16} color={colors.primary} />
                    <Text style={[styles.envCardLabel, { color: colors.textMuted }]}>Weather</Text>
                  </View>
                  <Text style={[styles.envCardValue, { color: colors.text }]}>
                    {Math.round(intel.weather.current.temp)}°
                  </Text>
                  <Text style={[styles.envCardHint, { color: colors.textMuted }]}>{intel.season?.label || 'Clear'}</Text>
                </Card>
              )}
            </View>

            {/* Health News (auto-ingested official updates + tips) */}
            <HealthNewsCard />

            {/* Live response-driven outlook. These are estimates, not official alerts. */}
            <>
                <View style={styles.outlookHeader}>
                  <View>
                    <Text style={[styles.sectionLabel, { color: colors.textMuted, marginBottom: 3 }]}>CURRENT AREA OUTLOOK</Text>
                    <Text style={[styles.outlookMeta, { color: colors.textMuted }]}>
                      {location} · verified reports and active projections
                      {intel?.generatedAt ? ` · ${new Date(intel.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.estimatePill, { backgroundColor: colors.primaryTint }]}>
                    <Text style={[styles.estimatePillText, { color: colors.primary }]}>Estimate</Text>
                  </View>
                </View>
              {activeRisks.length > 0 ? (
                <>
                <View style={styles.riskList}>
                  {activeRisks.slice(0, 3).map((risk) => {
                    const m = getRiskMeta(risk.level);
                    return (
                      <Card key={risk.id} variant="plain" padding={Spacing.base} style={styles.riskItem}>
                        <View style={[styles.riskIndicator, { backgroundColor: m.tint }]} />
                        <View style={{ flex: 1 }}>
                          <View style={styles.riskHeader}>
                            <Text style={[styles.riskName, { color: colors.text }]}>{risk.disease || risk.headline}</Text>
                            <View style={[styles.riskBadge, { backgroundColor: `${m.tint}18` }]}>
                              <Text style={[styles.riskBadgeText, { color: m.tint }]}>{risk.kind === 'forecast' ? `${risk.level} projection` : 'verified report'}</Text>
                            </View>
                          </View>
                          <Text style={[styles.riskReason, { color: colors.textSecondary }]} numberOfLines={2}>
                            {risk.summary}
                          </Text>
                          <View style={styles.riskEvidence}>
                            <Icon name="shield-check" size={12} color={colors.primary} />
                            <Text style={[styles.riskEvidenceText, { color: colors.textMuted }]} numberOfLines={2}>
                              {risk.source}
                              {risk.confidence != null ? ` · ${Math.round(risk.confidence * (risk.confidence <= 1 ? 100 : 1))}% confidence` : ''}
                              {risk.generatedAt ? ` · ${new Date(risk.generatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                              {risk.validUntil ? ` · valid to ${new Date(risk.validUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
                            </Text>
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                </View>
                {activeRisks.length > 3 && (
                  <Pressable style={styles.viewAllBtn} onPress={() => navigation.navigate('MainTabs', { screen: 'MyHealth' })}>
                    <Text style={[styles.viewAllText, { color: colors.primary }]}>View all {activeRisks.length} risks</Text>
                    <Icon name="arrow-right" size={14} color={colors.primary} />
                  </Pressable>
                )}
                </>
              ) : (
                <Card variant="sunken" padding={Spacing.base} style={styles.outlookEmpty}>
                  <Icon name="shield-check" size={18} color={colors.primary} />
                  <Text style={[styles.outlookEmptyText, { color: colors.textSecondary }]}>No elevated modelled risks are active for {location} right now.</Text>
                </Card>
              )}
            </>

            {/* Location prompt */}
            {showLocationPrompt && (
              <Card variant="sunken" padding={Spacing.base} style={styles.locationPrompt} onPress={handleEnableLocation}>
                <View style={[styles.locationPromptIcon, { backgroundColor: colors.primaryTint }]}>
                  <Icon name="navigation" size={19} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.locationPromptTitle, { color: colors.text }]}>Enable precise location</Text>
                  <Text style={[styles.locationPromptDesc, { color: colors.textSecondary }]}>
                    Get more accurate health alerts for your area
                  </Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textMuted} />
              </Card>
            )}

            <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
              Projection and report awareness only — not a diagnosis or outbreak confirmation. Consult a clinician for symptoms.
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      <FloatingActionButton onPress={() => navigation.navigate('Chatbot')} />
      <EnvironmentModal visible={modalVisible} onClose={() => setModalVisible(false)} data={intel} initialTab={modalTab} />
      <PermissionsPrimerModal />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  userSection: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  userInfo: { gap: 1, flex: 1 },
  greeting: { fontFamily: FontFamily.medium, fontSize: FontSize.xs, letterSpacing: 0.2 },
  userName: { fontFamily: FontFamily.displayBold, fontSize: FontSize['2xl'], letterSpacing: LetterSpacing.tight },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: BorderRadius.pill,
    maxWidth: 118,
    borderWidth: StyleSheet.hairlineWidth,
  },
  locationText: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },

  loadingContainer: { marginTop: Spacing.sm },

  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.card,
    padding: Spacing.base,
    marginBottom: Spacing.base,
    gap: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  alertIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertTitle: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  alertMessage: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, marginTop: 2, lineHeight: 17 },

  heroCard: { marginBottom: Spacing.xl },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroOverline: { fontFamily: FontFamily.semibold, fontSize: FontSize.overline, letterSpacing: LetterSpacing.overline },
  heroTitle: { fontFamily: FontFamily.display, fontSize: FontSize.xl, letterSpacing: LetterSpacing.tight, marginTop: 2 },
  heroTipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.base,
    paddingTop: Spacing.base,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  heroTipIcon: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  heroTipText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20 },

  sectionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.overline,
    letterSpacing: LetterSpacing.overline,
    marginBottom: Spacing.md,
  },
  outlookHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, marginBottom: Spacing.md },
  outlookMeta: { fontFamily: FontFamily.regular, fontSize: 10, lineHeight: 14 },
  estimatePill: { borderRadius: BorderRadius.pill, paddingHorizontal: 9, paddingVertical: 5 },
  estimatePillText: { fontFamily: FontFamily.semibold, fontSize: 10 },
  outlookEmpty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xl },
  outlookEmptyText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 19 },

  envRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.xl },
  envCard: { flex: 1 },
  envCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: Spacing.sm },
  envCardLabel: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  envCardValue: { fontFamily: FontFamily.displayBold, fontSize: FontSize['2xl'], letterSpacing: -0.4, marginBottom: 3 },
  envCardHint: { fontFamily: FontFamily.regular, fontSize: 11 },

  riskList: { gap: Spacing.sm, marginBottom: Spacing.base },
  riskItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  riskIndicator: { width: 4, height: 42, borderRadius: 2 },
  riskHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
  riskName: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  riskBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: BorderRadius.pill },
  riskBadgeText: { fontFamily: FontFamily.bold, fontSize: 10, letterSpacing: 0.4 },
  riskReason: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, lineHeight: 17 },
  riskEvidence: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 7 },
  riskEvidenceText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 9, lineHeight: 13 },

  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  viewAllText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },

  locationPrompt: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.sm, marginBottom: Spacing.base },
  locationPromptIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPromptTitle: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  locationPromptDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, marginTop: 2 },

  disclaimer: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    textAlign: 'center',
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    lineHeight: 16,
  },
});

export default HomeScreen;
