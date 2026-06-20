/**
 * MyHealthScreen
 * Health tracking with symptom logging, daily check-ins, and community trends
 * 
 * PUBLIC HEALTH REASONING:
 * - Self-assessment for early awareness, NOT diagnosis
 * - Rule-based risk levels (low/moderate/elevated)
 * - Streak gamification for habit-building, not pressure
 * - Anonymous community trends for awareness
 * - Clear disclaimers throughout
 * 
 * FEATURE CONSTRAINTS:
 * - No disease labels
 * - No ML predictions
 * - No medical certainty language
 * - Anonymous aggregation enforced
 * 
 * GUEST GATED: Guests see preview UI with sign-in prompt.
 * 
 * ANDROID FIXES:
 * - Uses flexGrow for proper scrollable content
 * - Dynamic bottom padding for tab bar avoidance
 * - Removed fixed heights
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Image,
  ImageBackground,
  TextInput,
  RefreshControl,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeInUp,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import {
  GlassCard,
  Button,
  HeartIcon,
  ShieldIcon,
  ArrowRightIcon,
  LocationIcon,
  Avatar,
  FeatureBlockedScreen,
  CheckinQuestion,
  RiskLevelCard,
  StreakBadge,
  CommunityTrendCard,
} from '../components';
import { toUserMessage } from '../services/errorMessages';
import { fetchNearbyFacilities, type NearbyFacility } from '../services/nearbyFacilities';
import { useUser } from '../hooks/useUser';
import { useTheme } from '../hooks/useTheme';
import { useAuthGate } from '../hooks/useAuthGate';
import { useHealthCheckin, CheckinAnswers } from '../hooks/useHealthCheckin';
import { useLocationContext } from '../hooks/LocationContext';
import { useI18n } from '../i18n';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  Duration,
  Gradients,
} from '../../theme';

// ============================================================================
// FEATURE FLAG
// Set to true when the feature is ready for release
// ============================================================================
const FEATURE_ENABLED = true;

/**
 * Derive a 0-100 wellness score from the latest check-in risk level.
 * If no check-in exists yet today, defaults to neutral (75).
 *
 * PUBLIC HEALTH NOTE: This is a self-awareness indicator only,
 * NOT a clinical health metric.
 */
function deriveWellnessScore(riskLevel: 'low' | 'moderate' | 'elevated' | null): number {
  switch (riskLevel) {
    case 'low':      return 92;
    case 'moderate': return 65;
    case 'elevated': return 40;
    default:         return 75; // No check-in yet today
  }
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Daily check-in questions (Yes/No format)
const CHECKIN_QUESTIONS: Array<{ key: keyof CheckinAnswers; question: string; icon: string; iconColor: string }> = [
  { key: 'hasFever', question: 'checkin_fever', icon: 'thermometer-outline', iconColor: '#ef4444' },
  { key: 'hasHeadache', question: 'checkin_headache', icon: 'pulse-outline', iconColor: '#8b5cf6' },
  { key: 'hasFatigue', question: 'checkin_fatigue', icon: 'moon-outline', iconColor: '#6366f1' },
  { key: 'hasDigestiveIssues', question: 'checkin_digestive', icon: 'nutrition-outline', iconColor: '#f59e0b' },
  { key: 'hasWaterExposure', question: 'checkin_water_exposure', icon: 'water-outline', iconColor: '#0ea5e9' },
  { key: 'hasSickContact', question: 'checkin_sick_contact', icon: 'people-outline', iconColor: '#ec4899' },
];

function formatDistance(distanceMeters: number): string {
  if (distanceMeters < 1000) return `${Math.max(1, Math.round(distanceMeters))} m`;
  return `${(distanceMeters / 1000).toFixed(distanceMeters < 10000 ? 1 : 0)} km`;
}

const MyHealthScreen: React.FC = () => {
  const { t } = useI18n();
  const { isGuest } = useAuthGate();

  // Guest users see sign-in required message
  if (isGuest) {
    return (
      <FeatureBlockedScreen
        title={t('my_health')}
        description="Sign in to access personal health tracking, symptom logging, and AI-powered wellness insights."
        icon="health"
        buttonText="Go Back"
        showHomeButton={true}
      />
    );
  }

  // Show feature blocked screen if feature is not enabled (for authenticated users)
  if (!FEATURE_ENABLED) {
    return (
      <FeatureBlockedScreen
        title={t('my_health')}
        description="Personal health tracking and symptom logging is coming soon. Monitor your wellness score and log symptoms for AI-powered insights."
        icon="health"
        buttonText="Go Back"
        showHomeButton={true}
      />
    );
  }

  // Original screen content (rendered when FEATURE_ENABLED = true)
  return <MyHealthScreenContent />;
};

// ============================================================================
// ORIGINAL SCREEN CONTENT
// Separated for clean feature flag pattern
// ============================================================================
const MyHealthScreenContent: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const { t } = useI18n();
  const { isDark, colors } = useTheme();
  const {
    location,
    geocoded,
    loading: locationLoading,
    refreshLocation,
  } = useLocationContext();

  // Health check-in state
  const {
    loading: checkinLoading,
    submitting,
    hasCheckedIn,
    todayCheckin,
    streak,
    communityTrends,
    trendMessage,
    submitDailyCheckin,
    calculateRisk,
    getRiskDisplay,
    refresh,
  } = useHealthCheckin();

  const [checkinAnswers, setCheckinAnswers] = useState<Partial<CheckinAnswers>>({});
  const [freeTextSymptoms, setFreeTextSymptoms] = useState('');
  const [showCheckinForm, setShowCheckinForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [nearbyFacilities, setNearbyFacilities] = useState<NearbyFacility[]>([]);
  const [facilitiesLoading, setFacilitiesLoading] = useState(false);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);
  const [facilitiesRadiusUsed, setFacilitiesRadiusUsed] = useState<number | null>(null);
  const facilitiesRequestIdRef = useRef(0);

  const healthScore = deriveWellnessScore(todayCheckin?.riskLevel ?? null);
  const displayName = user?.name || 'User';

  const loadHealthFacilities = useCallback(async (latitude: number, longitude: number) => {
    const requestId = ++facilitiesRequestIdRef.current;
    setFacilitiesLoading(true);
    setFacilitiesError(null);
    setFacilitiesRadiusUsed(null);

    const first = await fetchNearbyFacilities({
      latitude,
      longitude,
      radiusMeters: 5000,
      type: 'clinic',
    });

    if (requestId !== facilitiesRequestIdRef.current) return;

    if (first.error) {
      setNearbyFacilities([]);
      setFacilitiesError(toUserMessage(first.error, 'facilities'));
      setFacilitiesLoading(false);
      return;
    }

    if (first.facilities.length > 0) {
      setFacilitiesRadiusUsed(5000);
      setNearbyFacilities(first.facilities);
      setFacilitiesLoading(false);
      return;
    }

    const wider = await fetchNearbyFacilities({
      latitude,
      longitude,
      radiusMeters: 15000,
      type: 'clinic',
    });

    if (requestId !== facilitiesRequestIdRef.current) return;

    if (wider.error) {
      setNearbyFacilities([]);
      setFacilitiesError(toUserMessage(wider.error, 'facilities'));
      setFacilitiesLoading(false);
      return;
    }

    setFacilitiesRadiusUsed(15000);
    setNearbyFacilities(wider.facilities);
    setFacilitiesLoading(false);
  }, []);

  useEffect(() => {
    if (!location) {
      if (!locationLoading) {
        setNearbyFacilities([]);
        setFacilitiesRadiusUsed(null);
      }
      return;
    }

    loadHealthFacilities(location.latitude, location.longitude);
  }, [location?.latitude, location?.longitude, locationLoading, loadHealthFacilities]);

  const handleRetryFacilities = useCallback(async () => {
    if (location) {
      await loadHealthFacilities(location.latitude, location.longitude);
      return;
    }

    const latest = await refreshLocation();
    if (latest) {
      await loadHealthFacilities(latest.latitude, latest.longitude);
    }
  }, [loadHealthFacilities, location, refreshLocation]);

  const handleOpenMap = useCallback(() => {
    navigation.navigate('Map');
  }, [navigation]);

  // Pulse ring animation for health score
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.4, { duration: Duration.pulse, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 0 })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: Duration.pulse, easing: Easing.out(Easing.ease) }),
        withTiming(0.4, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Handle check-in answer
  const handleCheckinAnswer = (key: keyof CheckinAnswers, value: boolean) => {
    setCheckinAnswers(prev => ({ ...prev, [key]: value }));
  };

  // Submit daily check-in
  const handleSubmitCheckin = async () => {
    // Validate all questions answered
    const allAnswered = CHECKIN_QUESTIONS.every(q => checkinAnswers[q.key] !== undefined);
    if (!allAnswered) {
      Alert.alert(t('checkin_incomplete'), t('checkin_answer_all'));
      return;
    }

    try {
      await submitDailyCheckin(
        checkinAnswers as CheckinAnswers,
        freeTextSymptoms.trim() || undefined
      );
      setShowCheckinForm(false);
      setCheckinAnswers({});
      setFreeTextSymptoms('');
      Alert.alert(t('checkin_success'), t('checkin_recorded'));
    } catch (error) {
      Alert.alert(t('error'), toUserMessage(error, 'checkin'));
    }
  };

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refresh(),
      location
        ? loadHealthFacilities(location.latitude, location.longitude)
        : Promise.resolve(),
    ]);
    setRefreshing(false);
  }, [refresh, location, loadHealthFacilities]);

  // Calculate current risk preview
  const currentRisk = calculateRisk(checkinAnswers as CheckinAnswers);
  const riskDisplay = getRiskDisplay(currentRisk);

  const getScoreColor = (score: number) => {
    if (score >= 80) return Colors.emerald;
    if (score >= 60) return '#fbbf24';
    return Colors.danger;
  };

  const gradientColors = isDark
    ? [colors.gradientFrom, colors.gradientVia, colors.gradientTo] as unknown as [string, string, string]
    : Gradients.background.colors as unknown as [string, string, string];
  const scoreColor = getScoreColor(healthScore);

  return (
    <LinearGradient
      colors={gradientColors}
      start={Gradients.background.start}
      end={Gradients.background.end}
      style={styles.container}
    >
      <View style={styles.page}>
        {/* Hero Header (matches myhealth.html) */}
        <Animated.View entering={FadeInUp.delay(100).duration(450)}>
          <ImageBackground
            source={{ uri: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=800&q=80' }}
            style={[styles.header, { paddingTop: insets.top + Spacing.base }]}
            imageStyle={styles.headerImage}
          >
            <LinearGradient
              colors={Gradients.healthHeader.colors as unknown as [string, string, string]}
              start={Gradients.healthHeader.start}
              end={Gradients.healthHeader.end}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.headerOverlay} />

            <View style={styles.headerTopRow}>
              <Text style={styles.headerTitle}>{t('my_health')}</Text>
              <View style={styles.userChip}>
                <Text style={styles.userName} numberOfLines={1}>{displayName}</Text>
                <View style={styles.userAvatarWrap}>
                  <Avatar source={user?.avatarUrl} size={44} />
                </View>
              </View>
            </View>

            {/* Wellness Score Card */}
            <View style={styles.scoreWrap}>
              <Animated.View style={[styles.scorePulseRing, pulseStyle]} />
              <LinearGradient
                colors={isDark ? ['#0f3b46', '#0d6b73'] : ['#0f8b8d', '#11b4d4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.scoreCard}
              >
                <Text style={styles.scoreMeta}>{t('health_score_label')}</Text>
                <Text style={styles.scoreValue}>{healthScore}</Text>
                <View style={[styles.scoreStatusPill, { backgroundColor: scoreColor }]}>
                  <Text style={styles.scoreStatusText}>
                    {todayCheckin?.riskLevel ? todayCheckin.riskLevel.toUpperCase() : 'BASELINE'}
                  </Text>
                </View>
                <Text style={styles.scoreDesc}>{t('health_score_desc')}</Text>
              </LinearGradient>
            </View>
          </ImageBackground>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { 
              // ANDROID FIX: Dynamic bottom padding for tab bar and safe area
              paddingBottom: Math.max(insets.bottom, 12) + 120,
              // ANDROID FIX: flexGrow ensures proper scrolling on short screens
              flexGrow: 1,
            },
          ]}
          showsVerticalScrollIndicator={false}
          // ANDROID FIX: Improve scroll performance
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* ============================================================== */}
          {/* DAILY CHECK-IN SECTION (NEW) */}
          {/* ============================================================== */}
          <Animated.View entering={FadeInUp.delay(150).duration(450)}>
            <GlassCard style={styles.checkinCard}>
              <View style={styles.checkinHeader}>
                <View style={styles.checkinTitleRow}>
                  <Text style={[styles.sectionTitle, { color: colors.text }]}>
                    {t('daily_checkin')}
                  </Text>
                  {streak && streak.currentStreak > 0 && (
                    <StreakBadge
                      currentStreak={streak.currentStreak}
                      longestStreak={streak.longestStreak}
                      compact
                    />
                  )}
                </View>
                <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>
                  {hasCheckedIn ? t('checkin_completed_today') : t('checkin_prompt')}
                </Text>
              </View>

              {hasCheckedIn && todayCheckin ? (
                // Show today's result
                <View style={styles.checkinResult}>
                  <RiskLevelCard level={todayCheckin.riskLevel} />
                </View>
              ) : showCheckinForm ? (
                // Show check-in form
                <View style={styles.checkinForm}>
                  {/* Progress indicator */}
                  <View style={styles.progressRow}>
                    {CHECKIN_QUESTIONS.map((q) => {
                      const answered = checkinAnswers[q.key] !== undefined;
                      return (
                        <View
                          key={q.key}
                          style={[
                            styles.progressSegment,
                            answered && {
                              backgroundColor: checkinAnswers[q.key]
                                ? '#f59e0b'
                                : '#10b981',
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                  <Text style={[styles.progressText, { color: colors.textSecondary }]}>
                    {Object.keys(checkinAnswers).length} of {CHECKIN_QUESTIONS.length} answered
                  </Text>

                  {CHECKIN_QUESTIONS.map((q, index) => (
                    <Animated.View
                      key={q.key}
                      entering={FadeInUp.delay(index * 50).duration(300)}
                    >
                      <CheckinQuestion
                        question={t(q.question)}
                        icon={q.icon}
                        iconColor={q.iconColor}
                        value={checkinAnswers[q.key] ?? null}
                        onChange={(val: boolean) => handleCheckinAnswer(q.key, val)}
                      />
                    </Animated.View>
                  ))}

                  {/* Real-time risk preview */}
                  {Object.keys(checkinAnswers).length > 0 && (
                    <Animated.View entering={FadeIn.duration(300)}>
                      <View style={[styles.riskPreview, { backgroundColor: riskDisplay.color + '15' }]}>
                        <Text style={[styles.riskPreviewLabel, { color: colors.textSecondary }]}>
                          {t('current_risk_preview')}
                        </Text>
                        <Text style={[styles.riskPreviewValue, { color: riskDisplay.color }]}>
                          {riskDisplay.label}
                        </Text>
                      </View>
                    </Animated.View>
                  )}

                  {/* Optional free-text */}
                  <View style={styles.freeTextWrap}>
                    <Text style={[styles.freeTextLabel, { color: colors.textSecondary }]}>
                      {t('additional_symptoms_optional')}
                    </Text>
                    <TextInput
                      style={[
                        styles.freeTextInput,
                        {
                          color: colors.text,
                          backgroundColor: isDark ? Colors.whiteAlpha10 : '#f8fafc',
                          borderColor: isDark ? Colors.whiteAlpha20 : Colors.borderLight,
                        },
                      ]}
                      placeholder={t('describe_symptoms_placeholder')}
                      placeholderTextColor={colors.textSecondary}
                      value={freeTextSymptoms}
                      onChangeText={setFreeTextSymptoms}
                      multiline
                      numberOfLines={3}
                    />
                    <Text style={[styles.freeTextNote, { color: colors.textSecondary }]}>
                      {t('freetext_not_used_note')}
                    </Text>
                  </View>

                  <Button
                    title={t('submit_checkin')}
                    onPress={handleSubmitCheckin}
                    loading={submitting}
                  />
                </View>
              ) : (
                // Show start button
                <Button
                  title={t('start_daily_checkin')}
                  onPress={() => setShowCheckinForm(true)}
                />
              )}
            </GlassCard>
          </Animated.View>

          {/* ============================================================== */}
          {/* STREAK + COMMUNITY TRENDS */}
          {/* ============================================================== */}

          {/* Full streak card (shown after at least one check-in) */}
          {streak && streak.currentStreak > 0 && (
            <Animated.View entering={FadeInUp.delay(180).duration(450)}>
              <StreakBadge
                currentStreak={streak.currentStreak}
                longestStreak={streak.longestStreak}
              />
              <View style={{ height: Spacing.base }} />
            </Animated.View>
          )}

          {/* Community trends (always render — component handles empty state) */}
          <Animated.View entering={FadeInUp.delay(200).duration(450)}>
            <CommunityTrendCard
              trend={communityTrends.length > 0 ? communityTrends[0] : null}
              message={trendMessage}
              state={user?.state || 'your area'}
            />
          </Animated.View>

          {/* Health Tip (card structure closer to web) */}
          <Animated.View entering={FadeInUp.delay(250).duration(450)}>
            <GlassCard style={styles.tipCard}>
              <View style={styles.tipHeaderRow}>
                <View style={styles.tipBadgeIcon}>
                  <HeartIcon size={18} color={Colors.textLight} />
                </View>
                <Text style={[styles.tipHeaderTitle, { color: colors.text }]}>{t('todays_health_tip')}</Text>
              </View>
              <View style={styles.tipRow}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1559839914-17aae19cec71?auto=format&fit=crop&w=200&q=80' }}
                  style={styles.tipImage}
                />
                <View style={styles.tipContent}>
                  <Text style={[styles.tipTitle, { color: colors.text }]}>{t('tip_stay_hydrated_title')}</Text>
                  <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                    {t('tip_stay_hydrated_body')}
                  </Text>
                  <Text style={[styles.tipHint, { color: colors.primary }]}>{t('tip_stay_hydrated_hint')}</Text>
                </View>
              </View>
            </GlassCard>
          </Animated.View>

          {/* Nearby Clinics */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('nearby_clinics')}</Text>
              <Pressable style={styles.seeAllBtn} onPress={handleOpenMap}>
                <Text style={[styles.seeAllText, { color: colors.primary }]}>{t('see_all')}</Text>
                <ArrowRightIcon size={16} color={colors.primary} />
              </Pressable>
            </View>

            {facilitiesLoading ? (
              <GlassCard style={styles.facilityStateCard}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.facilityStateText, { color: colors.textSecondary }]}>
                  Searching for clinics near {geocoded?.city || geocoded?.state || 'your location'}...
                </Text>
              </GlassCard>
            ) : facilitiesError ? (
              <GlassCard style={styles.facilityStateCard}>
                <Text style={[styles.facilityStateTitle, { color: colors.text }]}>Nearby clinics unavailable</Text>
                <Text style={[styles.facilityStateText, { color: colors.textSecondary }]}>{facilitiesError}</Text>
                <View style={styles.facilityActions}>
                  <Pressable style={[styles.facilityActionBtn, { borderColor: colors.border }]} onPress={handleRetryFacilities}>
                    <Text style={[styles.facilityActionText, { color: colors.primary }]}>Retry</Text>
                  </Pressable>
                  <Pressable style={[styles.facilityActionBtn, styles.facilityPrimaryAction]} onPress={handleOpenMap}>
                    <Text style={styles.facilityPrimaryActionText}>Open Map</Text>
                  </Pressable>
                </View>
              </GlassCard>
            ) : nearbyFacilities.length > 0 ? (
              nearbyFacilities.slice(0, 3).map((facility, index) => (
                <Animated.View
                  key={facility.id}
                  entering={FadeInUp.delay(500 + index * 80).duration(500)}
                >
                  <ClinicCard
                    name={facility.name}
                    address={facility.address || `${facility.kind === 'pharmacy' ? 'Pharmacy' : 'Clinic'} near ${geocoded?.city || geocoded?.state || 'your area'}`}
                    distance={formatDistance(facility.distanceMeters)}
                    status={facility.kind === 'pharmacy' ? 'Pharmacy' : 'Clinic'}
                    colors={colors}
                  />
                </Animated.View>
              ))
            ) : (
              <GlassCard style={styles.facilityStateCard}>
                <Text style={[styles.facilityStateTitle, { color: colors.text }]}>
                  {location ? 'No nearby clinics found yet' : 'Location needed for nearby clinics'}
                </Text>
                <Text style={[styles.facilityStateText, { color: colors.textSecondary }]}>
                  {location
                    ? `We checked up to ${Math.round((facilitiesRadiusUsed || 15000) / 1000)} km from your location. Try the map to search a different area.`
                    : 'Turn on location or open the map to search for clinics around you.'}
                </Text>
                <View style={styles.facilityActions}>
                  <Pressable style={[styles.facilityActionBtn, { borderColor: colors.border }]} onPress={handleRetryFacilities}>
                    <Text style={[styles.facilityActionText, { color: colors.primary }]}>
                      {location ? 'Retry' : 'Use location'}
                    </Text>
                  </Pressable>
                  <Pressable style={[styles.facilityActionBtn, styles.facilityPrimaryAction]} onPress={handleOpenMap}>
                    <Text style={styles.facilityPrimaryActionText}>Open Map</Text>
                  </Pressable>
                </View>
              </GlassCard>
            )}
          </View>

          {/* Health Disclaimer */}
          <Animated.View entering={FadeIn.delay(700).duration(400)}>
            <View style={[styles.disclaimer, { backgroundColor: isDark ? Colors.whiteAlpha10 : Colors.blackAlpha10 }]}>
              <ShieldIcon size={16} color={colors.textSecondary} />
              <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>
                {t('health_disclaimer')}
              </Text>
            </View>
          </Animated.View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

// Clinic Card Component
interface ClinicCardProps {
  name: string;
  address: string;
  distance: string;
  status: 'Clinic' | 'Pharmacy';
  colors: {
    text: string;
    textSecondary: string;
    primary: string;
    primaryLight: string;
  };
}

const ClinicCard: React.FC<ClinicCardProps> = ({ name, address, distance, status, colors }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 150 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 150 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
    >
      <GlassCard style={styles.clinicCard}>
        <Image
          source={{ uri: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=200&q=80' }}
          style={styles.clinicImage}
        />
        <View style={styles.clinicContent}>
          <Text style={[styles.clinicName, { color: colors.text }]}>{name}</Text>
          <View style={styles.clinicAddress}>
            <LocationIcon size={14} color={colors.textSecondary} />
            <Text style={[styles.clinicAddressText, { color: colors.textSecondary }]}>{address}</Text>
          </View>
          <View style={styles.clinicMeta}>
            <Text style={[styles.clinicDistance, { color: colors.primary }]}>{distance}</Text>
            <View style={[styles.statusBadge, styles.statusOpen]}>
              <Text style={[styles.statusText, styles.statusTextOpen]}>
                {status}
              </Text>
            </View>
          </View>
        </View>
        <View style={[styles.clinicArrow, { backgroundColor: colors.primaryLight }]}>
          <ArrowRightIcon size={16} color={colors.primary} />
        </View>
      </GlassCard>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
  },
  header: {
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: 'hidden',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing['2xl'],
    ...Shadows.lg,
  },
  headerImage: {
    resizeMode: 'cover',
    opacity: 0.14,
  },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['3xl'],
    color: Colors.textLight,
  },
  userChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userName: {
    maxWidth: 160,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha90,
  },
  userAvatarWrap: {
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.whiteAlpha50,
    overflow: 'hidden',
  },
  scoreWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  scorePulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(17,180,212,0.16)',
  },
  scoreCard: {
    width: '100%',
    borderRadius: 28,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha30,
    ...Shadows.md,
  },
  scoreMeta: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha90,
  },
  scoreValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['4xl'],
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },
  scoreDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha90,
    marginTop: Spacing.sm,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.45,
  },
  scoreStatusPill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginTop: Spacing.xs,
  },
  scoreStatusText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  // Check-in styles
  checkinCard: {
    marginBottom: Spacing['2xl'],
    borderRadius: 24,
  },
  checkinHeader: {
    marginBottom: Spacing.lg,
  },
  checkinTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  checkinResult: {
    marginTop: Spacing.sm,
  },
  checkinForm: {
    gap: Spacing.base,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: Spacing.xs,
  },
  progressSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.borderLight,
  },
  progressText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  riskPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  riskPreviewLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  riskPreviewValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
  },
  freeTextWrap: {
    marginTop: Spacing.base,
    marginBottom: Spacing.base,
  },
  freeTextLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  freeTextInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  freeTextNote: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  // Tip card styles
  tipCard: {
    marginBottom: Spacing.xl,
    borderRadius: 24,
  },
  tipHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.base,
  },
  tipBadgeIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipHeaderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
  },
  tipImage: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.borderLight,
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  tipText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.5,
    marginTop: 4,
  },
  tipHint: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.sm,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  sectionSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.base,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  seeAllText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  facilityStateCard: {
    borderRadius: 22,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  facilityStateTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
  },
  facilityStateText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.45,
  },
  facilityActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  facilityActionBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  facilityPrimaryAction: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  facilityActionText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  facilityPrimaryActionText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  clinicCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
    marginBottom: Spacing.md,
    borderRadius: 22,
  },
  clinicImage: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.borderLight,
  },
  clinicContent: {
    flex: 1,
  },
  clinicArrow: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  clinicAddress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  clinicAddressText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    flex: 1,
  },
  clinicMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  clinicDistance: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderLight,
  },
  statusOpen: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  statusText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  statusTextOpen: {
    color: Colors.emerald,
  },
  disclaimer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  disclaimerText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.5,
  },
});

export default MyHealthScreen;
