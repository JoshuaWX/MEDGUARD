/**
 * AlertsScreen
 * Health alerts, disease risks, and AQI
 * 
 * ANDROID FIXES:
 * - Uses flexGrow for proper scrollable content
 * - Dynamic bottom padding for tab bar avoidance
 * - Removed fixed heights
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ImageBackground,
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
import { Ionicons } from '@expo/vector-icons';

import {
  AlertCard,
  ErrorBanner,
  GlassCard,
  RiskCard,
  AQICard,
  BrainCard,
  BellIcon,
  InfoCircleIcon,
  ArrowBackIcon,
  WarningIcon,
  DiseaseRisk,
} from '../components';
import { useAlerts } from '../hooks/useAlerts';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Duration,
  Gradients,
  Shadows,
} from '../../theme';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'urgent' | 'caution' | 'info';
  source?: string;
  timestamp: string;
}

const AlertsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { 
    alerts, 
    loading,
    error,
    refresh, 
    riskAssessment, 
    brain,
    airQuality, 
    weather, 
    season, 
    location 
  } = useAlerts();
  const { t } = useI18n();
  const { isDark, colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedRisk, setExpandedRisk] = useState<string | null>(null);

  // Badge pulse animation
  const badgePulse = useSharedValue(1);

  useEffect(() => {
    // Badge pulse
    badgePulse.value = withRepeat(
      withSequence(
        withTiming(1.1, { duration: Duration.pulse / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: Duration.pulse / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const badgePulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePulse.value }],
  }));

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const communityAlerts = alerts;
  const visibleRiskAdvisories = (riskAssessment?.diseases || [])
    .filter((risk) => risk.isActive && risk.riskLevel !== 'low');
  const activeAlertCount = communityAlerts.length + visibleRiskAdvisories.length;

  const gradientColors = isDark
    ? [colors.gradientFrom, colors.gradientVia, colors.gradientTo] as unknown as [string, string, string]
    : Gradients.background.colors as unknown as [string, string, string];

  return (
    <LinearGradient
      colors={gradientColors}
      start={Gradients.background.start}
      end={Gradients.background.end}
      style={styles.container}
    >
      <View style={styles.page}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { 
              paddingTop: insets.top, 
              // ANDROID FIX: Dynamic bottom padding to account for safe area and tab bar
              paddingBottom: Math.max(insets.bottom, 12) + 120,
              // ANDROID FIX: flexGrow ensures proper scrolling on short screens
              flexGrow: 1,
            },
          ]}
          showsVerticalScrollIndicator={false}
          // ANDROID FIX: Improve scroll performance
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
          }
        >
          {/* Hero Header (matches alerts.html) */}
          <Animated.View entering={FadeIn.duration(500)}>
            <ImageBackground
              source={{ uri: 'https://images.unsplash.com/photo-1584036561566-baf8f5f1b144?auto=format&fit=crop&w=800&q=80' }}
              style={styles.hero}
              imageStyle={styles.heroImage}
            >
              <LinearGradient
                colors={Gradients.alertsHero.colors as unknown as [string, string]}
                start={Gradients.alertsHero.start}
                end={Gradients.alertsHero.end}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.2)']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />

              <View style={styles.heroHeader}>
                <View style={styles.heroTopRow}>
                  <Pressable onPress={() => navigation.goBack()} style={styles.heroBackBtn} hitSlop={10}>
                    <ArrowBackIcon size={22} color={Colors.textLight} />
                  </Pressable>
                  <Text style={styles.heroTitle}>{t('alerts_notifications')}</Text>
                  <View style={styles.heroRightSpacer} />
                </View>

                <View style={styles.heroBadgeRow}>
                  <Animated.View style={[styles.activeBadge, badgePulseStyle]}>
                    <View style={styles.activeDot} />
                    <Text style={styles.activeBadgeText}>{activeAlertCount} {t('active_alerts')}</Text>
                  </Animated.View>
                </View>
              </View>
            </ImageBackground>
          </Animated.View>

          {/* Community Alerts */}
          <View style={styles.contentWrap}>
            {/* MedGuard Brain v1: area health signal summary */}
          {brain && (
            <View style={{ marginBottom: Spacing.md }}>
              <BrainCard brain={brain} />
            </View>
          )}

          {/* Risk Assessment Section */}
            {riskAssessment && visibleRiskAdvisories.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    {t('disease_risks') || 'Disease Risk Assessment'}
                  </Text>
                  {riskAssessment.overallRiskLevel !== 'low' && (
                    <View style={[
                      styles.overallRiskBadge,
                      { backgroundColor: riskAssessment.overallRiskLevel === 'high' ? Colors.danger : Colors.warning }
                    ]}>
                      <Text style={styles.overallRiskText}>
                        {riskAssessment.overallRiskLevel.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                
                {/* Location & Season Info */}
                {(location || season) && (
                  <View style={styles.contextRow}>
                    {location && (
                      <View style={styles.contextBadge}>
                        <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                          {location.state}{location.region ? ` (${location.region})` : ''}
                        </Text>
                      </View>
                    )}
                    {season && (
                      <View style={styles.contextBadge}>
                        <Ionicons 
                          name={season.label === 'rainy' ? 'rainy-outline' : season.label === 'harmattan' ? 'leaf-outline' : 'sunny-outline'} 
                          size={14} 
                          color={colors.textSecondary} 
                        />
                        <Text style={[styles.contextText, { color: colors.textSecondary }]}>
                          {season.label.charAt(0).toUpperCase() + season.label.slice(1)} Season
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Weather Summary */}
                {weather && (
                  <Animated.View entering={FadeInUp.delay(50).duration(400)} style={styles.weatherRow}>
                    <View style={styles.weatherItem}>
                      <Ionicons name="thermometer-outline" size={16} color={Colors.primary} />
                      <Text style={[styles.weatherValue, { color: colors.text }]}>{weather.temp}°C</Text>
                    </View>
                    <View style={styles.weatherItem}>
                      <Ionicons name="water-outline" size={16} color={Colors.primary} />
                      <Text style={[styles.weatherValue, { color: colors.text }]}>{weather.humidity}%</Text>
                    </View>
                    {weather.precipitation > 0 && (
                      <View style={styles.weatherItem}>
                        <Ionicons name="rainy-outline" size={16} color={Colors.primary} />
                        <Text style={[styles.weatherValue, { color: colors.text }]}>{weather.precipitation}mm</Text>
                      </View>
                    )}
                  </Animated.View>
                )}

                {/* Active Disease Risks */}
                <View style={styles.cardStack}>
                  {visibleRiskAdvisories
                    .slice(0, 5)
                    .map((risk, index) => (
                      <Animated.View
                        key={risk.diseaseKey}
                        entering={FadeInUp.delay(100 + index * 60).duration(400)}
                      >
                        <RiskCard
                          risk={risk}
                          expanded={expandedRisk === risk.diseaseKey}
                          onPress={() => setExpandedRisk(
                            expandedRisk === risk.diseaseKey ? null : risk.diseaseKey
                          )}
                        />
                      </Animated.View>
                    ))}
                </View>

                {/* Disclaimer */}
                <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
                  {riskAssessment.disclaimer}
                </Text>
              </>
            )}

            {/* Air Quality Section */}
            {airQuality && airQuality.insight && (
              <>
                <View style={[styles.sectionHeaderRow, { marginTop: Spacing.xl }]}>
                  <Ionicons name="cloud-outline" size={18} color={colors.primary} />
                  <Text style={[styles.sectionHeading, { color: colors.text }]}>
                    {t('air_quality') || 'Air Quality'}
                  </Text>
                </View>
                <Animated.View entering={FadeInUp.delay(200).duration(400)}>
                  <AQICard
                    aqi={airQuality.aqi}
                    insight={airQuality.insight}
                    compact={false}
                  />
                </Animated.View>
              </>
            )}

            {/* Community Alerts Section */}
            <View style={[styles.sectionHeaderRow, { marginTop: Spacing.xl }]}>
              <InfoCircleIcon size={18} color={colors.primary} />
              <Text style={[styles.sectionHeading, { color: colors.text }]}>{t('community_alerts')}</Text>
            </View>
            <View style={styles.cardStack}>
              {error && !loading && (
                <ErrorBanner
                  title="Alerts unavailable"
                  message="MedGuard could not refresh community alerts right now. Pull down to try again."
                  onRetry={handleRefresh}
                />
              )}
              {communityAlerts.length > 0 ? (
                communityAlerts.map((alert, index) => (
                  <Animated.View
                    key={alert.id}
                    entering={FadeInUp.delay(100 + index * 80).duration(450)}
                  >
                    <AlertCard
                      title={alert.title}
                      message={alert.message}
                      severity={alert.severity}
                      source={alert.source}
                      timestamp={alert.timestamp}
                      icon={
                        alert.severity === 'info'
                          ? <InfoCircleIcon size={22} color={Colors.textLight} />
                          : <WarningIcon size={22} color={Colors.textLight} />
                      }
                    />
                  </Animated.View>
                ))
              ) : (
                <GlassCard style={styles.emptyAlertCard}>
                  <InfoCircleIcon size={22} color={colors.primary} />
                  <View style={styles.emptyAlertCopy}>
                    <Text style={[styles.emptyAlertTitle, { color: colors.text }]}>
                      No active community alerts
                    </Text>
                    <Text style={[styles.emptyAlertText, { color: colors.textSecondary }]}>
                      MedGuard will update this area when verified health signals are available.
                    </Text>
                  </View>
                </GlassCard>
              )}
            </View>

            {/* Personal Reminders */}
            <View style={styles.sectionHeaderRow}>
              <BellIcon size={18} color={colors.primary} />
              <Text style={[styles.sectionHeading, { color: colors.text }]}>{t('personal_reminders')}</Text>
            </View>
            <GlassCard style={styles.reminderCard}>
              <View style={styles.reminderIcon}>
                <LinearGradient
                  colors={Gradients.primary.colors as unknown as [string, string]}
                  start={Gradients.primary.start}
                  end={Gradients.primary.end}
                  style={styles.reminderIconBg}
                >
                  <BellIcon size={20} color={Colors.textLight} />
                </LinearGradient>
              </View>
              <View style={styles.reminderContent}>
                <Text style={[styles.reminderMeta, { color: colors.textMuted }]}>Reminder preview</Text>
                <Text style={[styles.reminderTitle, { color: colors.text }]}>Daily check-in reminder</Text>
                <Text style={[styles.reminderText, { color: colors.textSecondary }]}>Enable reminders in Settings to receive personal health check-in notifications.</Text>
              </View>
            </GlassCard>
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
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
  },
  hero: {
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textLight,
  },
  heroRightSpacer: {
    width: 40,
    height: 40,
  },
  heroBadgeRow: {
    alignItems: 'center',
    marginTop: Spacing.base,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha30,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fb7185',
  },
  activeBadgeText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  contentWrap: {
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.base,
    marginTop: -Spacing.base,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    flex: 1,
  },
  overallRiskBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  overallRiskText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  contextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
    backgroundColor: 'rgba(17, 180, 212, 0.1)',
  },
  contextText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  weatherRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    marginBottom: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  weatherItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  weatherValue: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  disclaimer: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    fontStyle: 'italic',
    marginTop: -Spacing.md,
    marginBottom: Spacing.md,
  },
  cardStack: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
    borderRadius: 24,
  },
  emptyAlertCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  emptyAlertCopy: {
    flex: 1,
  },
  emptyAlertTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    marginBottom: 4,
  },
  emptyAlertText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.45,
  },
  reminderIcon: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  reminderIconBg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderContent: {
    flex: 1,
  },
  reminderMeta: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  reminderTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  reminderText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.5,
  },
});

export default AlertsScreen;
