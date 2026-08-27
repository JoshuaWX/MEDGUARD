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
  Switch,
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
  WarningIcon,
  Icon,
  DiseaseRisk,
} from '../components';
import { useAlerts } from '../hooks/useAlerts';
import { useNotifications } from '../hooks/useNotifications';
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
  const {
    reminderEnabled,
    communityAlertsEnabled,
    setReminderEnabled,
    setCommunityAlertsEnabled,
    saving: notifSaving,
  } = useNotifications();
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
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Pressable onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} hitSlop={10}>
                <Icon name="chevron-left" size={22} color={colors.text} />
              </Pressable>
              {activeAlertCount > 0 && (
                <Animated.View style={[styles.activeBadge, { backgroundColor: isDark ? 'rgba(220,59,59,0.16)' : Colors.dangerLight }, badgePulseStyle]}>
                  <View style={styles.activeDot} />
                  <Text style={[styles.activeBadgeText, { color: Colors.danger }]}>{activeAlertCount} {t('active_alerts')}</Text>
                </Animated.View>
              )}
            </View>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{t('alerts_notifications')}</Text>
            <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
              Verified signals and risks for your area
            </Text>
          </View>

          {/* Community Alerts */}
          <View style={styles.contentWrap}>
            {/* MedGuard Brain v1: area health signal summary */}
          {brain && (
            <View style={{ marginBottom: Spacing.md }}>
              <BrainCard brain={brain} onPress={() => (navigation as any).navigate('BrainReport', { scope: 'area' })} />
            </View>
          )}

          {/* Risk Assessment Section */}
            {riskAssessment && visibleRiskAdvisories.length > 0 && (
              <>
                <View style={styles.sectionHeaderRow}>
                  <Icon name="shield-check" size={18} color={colors.primary} />
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
                  <Icon name="cloud" size={18} color={colors.primary} />
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
              <View style={styles.notifRow}>
                <View style={styles.notifLeft}>
                  <Icon name="clock" size={20} color={colors.primary} />
                  <View style={styles.notifTextWrap}>
                    <Text style={[styles.reminderTitle, { color: colors.text }]}>Daily check-in reminder</Text>
                    <Text style={[styles.reminderText, { color: colors.textSecondary }]}>A gentle nudge to check in on how you feel.</Text>
                  </View>
                </View>
                <Switch
                  value={reminderEnabled}
                  onValueChange={(v) => void setReminderEnabled(v)}
                  disabled={notifSaving}
                  trackColor={{ false: colors.border, true: Colors.primaryLight }}
                  thumbColor={reminderEnabled ? Colors.primary : colors.textMuted}
                />
              </View>
              <View style={[styles.notifRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
                <View style={styles.notifLeft}>
                  <Icon name="shield-check" size={20} color={colors.primary} />
                  <View style={styles.notifTextWrap}>
                    <Text style={[styles.reminderTitle, { color: colors.text }]}>Official health alerts</Text>
                    <Text style={[styles.reminderText, { color: colors.textSecondary }]}>Get notified when NCDC/WHO report an outbreak in your area.</Text>
                  </View>
                </View>
                <Switch
                  value={communityAlertsEnabled}
                  onValueChange={(v) => void setCommunityAlertsEnabled(v)}
                  disabled={notifSaving}
                  trackColor={{ false: colors.border, true: Colors.primaryLight }}
                  thumbColor={communityAlertsEnabled ? Colors.primary : colors.textMuted}
                />
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
    paddingHorizontal: Spacing.lg,
  },
  header: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize['3xl'],
    letterSpacing: -0.4,
  },
  headerSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: -6,
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
    gap: 7,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.pill,
  },
  activeDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.danger,
  },
  activeBadgeText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
  },
  contentWrap: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.base,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: 2,
  },
  sectionHeading: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
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
    borderRadius: 24,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.base,
    paddingVertical: Spacing.md,
  },
  notifLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  notifTextWrap: {
    flex: 1,
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
