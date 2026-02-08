/**
 * HomeScreen
 * Clean, human-designed dashboard with health alerts and intel
 * 
 * Design principles:
 * - Clear visual hierarchy (one primary focus at a time)
 * - Consistent spacing rhythm (16/24 base units)
 * - Subtle, purposeful color usage
 * - Obvious reading flow (top → bottom)
 * - Mobile-first with thumb-friendly targets
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
import Animated, { FadeIn, FadeInDown, SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { RootStackParamList } from '../navigation/types';
import {
  Avatar,
  SkeletonLoader,
  FloatingActionButton,
} from '../components';
import { EnvironmentModal } from '../components/EnvironmentModal';

import { useUser } from '../hooks/useUser';
import { useIntel } from '../hooks/useIntel';
import { useLocationContext } from '../hooks/LocationContext';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import {
  Colors,
  FontFamily,
  FontSize,
  Shadows,
} from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Simple AQI label helper
const getAqiLabel = (aqi: number): { label: string; color: string } => {
  const levels: Record<number, { label: string; color: string }> = {
    1: { label: 'Good', color: '#10b981' },
    2: { label: 'Fair', color: '#22c55e' },
    3: { label: 'Moderate', color: '#f59e0b' },
    4: { label: 'Poor', color: '#ef4444' },
    5: { label: 'Very Poor', color: '#7c3aed' },
  };
  return levels[aqi] || levels[3];
};

// Risk level config
const getRiskConfig = (level: string) => {
  const config: Record<string, { bg: string; text: string; icon: string }> = {
    high: { bg: '#fef2f2', text: '#dc2626', icon: 'warning' },
    medium: { bg: '#fffbeb', text: '#d97706', icon: 'alert-circle' },
    low: { bg: '#f0fdf4', text: '#16a34a', icon: 'checkmark-circle' },
  };
  return config[level] || config.low;
};

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { intel, loading: intelLoading, refresh } = useIntel();
  const {
    geocoded,
    refreshLocation,
    requestPermission,
    permissionStatus,
  } = useLocationContext();
  const { t } = useI18n();
  const { isDark, colors } = useTheme();

  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTab, setModalTab] = useState<'aqi' | 'weather'>('aqi');

  // Urgent alert - only show truly critical conditions
  const urgentAlert = useMemo(() => {
    if (!intel) return null;
    
    // Critical air quality (Poor or Very Poor)
    if (intel.airQuality?.aqi && intel.airQuality.aqi >= 4) {
      const label = intel.airQuality.aqi === 5 ? 'Very Poor' : 'Poor';
      return {
        icon: 'cloud' as const,
        title: `Air Quality: ${label}`,
        message: 'Limit outdoor activities. Wear a mask if going outside.',
        actionLabel: 'View Details',
        action: () => openModal('aqi'),
      };
    }

    // Severe flooding risk
    const precip = intel.weather?.current?.precipitation || 0;
    if (precip >= 50) {
      return {
        icon: 'water' as const,
        title: 'Flood Warning',
        message: 'Heavy rainfall detected. Stay away from low-lying areas.',
        actionLabel: 'View Details',
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
    if (permissionStatus === 'denied') {
      Linking.openSettings();
    } else {
      requestPermission();
    }
  };

  const location = geocoded?.city || geocoded?.region || user?.state || 'Nigeria';
  const showLocationPrompt = permissionStatus !== 'granted' && permissionStatus !== 'denied';
  const overallRisk = intel?.riskAssessment?.overallRiskLevel || 'low';
  const riskConfig = getRiskConfig(overallRisk);
  const activeRisks = intel?.riskAssessment?.diseases?.filter(d => d.isActive) || [];
  const topRecommendation = activeRisks[0]?.actions?.[0];

  // ANDROID FIX: Calculate proper bottom padding to account for floating tab bar
  // This ensures content doesn't get hidden behind the absolute positioned tab navigator
  const bottomPadding = Math.max(insets.bottom, 12) + 100; // 100 accounts for tab bar + spacing

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          // ANDROID FIX: Use flexGrow for proper content sizing on short screens
          { paddingTop: insets.top + 16, paddingBottom: bottomPadding, flexGrow: 1 }
        ]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        // ANDROID FIX: Improve scroll performance
        removeClippedSubviews={Platform.OS === 'android'}
      >
        {/* Loading State */}
        {intelLoading && !intel ? (
          <View style={styles.loadingContainer}>
            <SkeletonLoader height={80} style={{ borderRadius: 16 }} />
            <View style={{ height: 16 }} />
            <SkeletonLoader height={120} style={{ borderRadius: 16 }} />
            <View style={{ height: 16 }} />
            <SkeletonLoader height={100} style={{ borderRadius: 16 }} />
          </View>
        ) : (
          <Animated.View entering={FadeIn.duration(400)}>
            
            {/* Header - Simple, no blur overlay */}
            <View style={styles.header}>
              <View style={styles.userSection}>
                <Avatar size={44} source={user?.avatarUrl} />
                <View style={styles.userInfo}>
                  <Text style={[styles.greeting, { color: colors.textSecondary }]}>
                    {t('welcome_back')}
                  </Text>
                  <Text style={[styles.userName, { color: colors.text }]}>
                    {user?.name?.split(' ')[0] || 'there'}
                  </Text>
                </View>
              </View>

              <View style={styles.headerActions}>
                <Pressable 
                  style={[styles.locationChip, { backgroundColor: colors.surface }]}
                  onPress={() => {}}
                >
                  <Ionicons name="location" size={14} color={Colors.primary} />
                  <Text style={[styles.locationText, { color: colors.text }]} numberOfLines={1}>
                    {location}
                  </Text>
                </Pressable>

                <Pressable 
                  style={[styles.iconButton, { backgroundColor: colors.surface }]}
                  onPress={() => navigation.navigate('Alerts')}
                >
                  <Ionicons name="notifications-outline" size={20} color={colors.text} />
                  {overallRisk === 'high' && <View style={styles.badge} />}
                </Pressable>
              </View>
            </View>

            {/* Urgent Alert Banner - Only when critical */}
            {urgentAlert && (
              <Animated.View 
                entering={FadeInDown.duration(400)}
                style={styles.alertBanner}
              >
                <View style={styles.alertIconContainer}>
                  <Ionicons name={urgentAlert.icon} size={20} color="#fff" />
                </View>
                <View style={styles.alertContent}>
                  <Text style={styles.alertTitle}>{urgentAlert.title}</Text>
                  <Text style={styles.alertMessage}>{urgentAlert.message}</Text>
                </View>
                <Pressable 
                  style={styles.alertAction}
                  onPress={urgentAlert.action}
                >
                  <Text style={styles.alertActionText}>{urgentAlert.actionLabel}</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Status Summary Card */}
            <View style={[
              styles.statusCard, 
              { backgroundColor: riskConfig.bg }
            ]}>
              <View style={styles.statusHeader}>
                <View style={[styles.statusIcon, { backgroundColor: `${riskConfig.text}15` }]}>
                  <Ionicons 
                    name={riskConfig.icon as any} 
                    size={24} 
                    color={riskConfig.text} 
                  />
                </View>
                <View style={styles.statusInfo}>
                  <Text style={[styles.statusTitle, { color: colors.text }]}>
                    {overallRisk === 'high' ? 'High Risk Area' : 
                     overallRisk === 'medium' ? 'Moderate Risk' : 
                     'Low Risk Area'}
                  </Text>
                  <Text style={[styles.statusSubtitle, { color: colors.textSecondary }]}>
                    Based on your location & conditions
                  </Text>
                </View>
              </View>
              
              {topRecommendation && (
                <View style={styles.tipContainer}>
                  <Ionicons name="bulb-outline" size={16} color={colors.textSecondary} />
                  <Text style={[styles.tipText, { color: colors.textSecondary }]}>
                    {topRecommendation}
                  </Text>
                </View>
              )}
            </View>

            {/* Environment Row - AQI & Weather side by side */}
            <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
              Current Conditions
            </Text>
            
            <View style={styles.envRow}>
              {/* AQI Card */}
              {intel?.airQuality && (
                <Pressable 
                  style={[styles.envCard, { backgroundColor: colors.surface }]}
                  onPress={() => openModal('aqi')}
                >
                  {(() => {
                    const aqiData = getAqiLabel(intel.airQuality.aqi);
                    const dominant = intel.airQuality.insight?.dominantPollutant;
                    return (
                      <>
                        <View style={styles.envCardHeader}>
                          <Ionicons name="leaf" size={18} color={aqiData.color} />
                          <Text style={[styles.envCardLabel, { color: colors.textSecondary }]}>
                            Air Quality
                          </Text>
                        </View>
                        <Text style={[styles.envCardValue, { color: aqiData.color }]}>
                          {aqiData.label}
                        </Text>
                        {!!dominant && (
                          <Text style={[styles.envCardHint, { color: colors.textMuted }]} numberOfLines={1}>
                            Primary: {dominant}
                          </Text>
                        )}
                        <Text style={[styles.envCardHint, { color: colors.textMuted }]}>
                          Tap for details
                        </Text>
                      </>
                    );
                  })()}
                </Pressable>
              )}

              {/* Weather Card */}
              {intel?.weather && (
                <Pressable 
                  style={[styles.envCard, { backgroundColor: colors.surface }]}
                  onPress={() => openModal('weather')}
                >
                  <View style={styles.envCardHeader}>
                    <Ionicons 
                      name={intel.weather.current.precipitation > 0 ? "rainy" : "sunny"} 
                      size={18} 
                      color={Colors.primary} 
                    />
                    <Text style={[styles.envCardLabel, { color: colors.textSecondary }]}>
                      Weather
                    </Text>
                  </View>
                  <Text style={[styles.envCardValue, { color: colors.text }]}>
                    {Math.round(intel.weather.current.temp)}°C
                  </Text>
                  <Text style={[styles.envCardHint, { color: colors.textMuted }]}>
                    {intel.season?.label || 'Clear'}
                  </Text>
                </Pressable>
              )}
            </View>

            {/* Disease Risks Section */}
            {activeRisks.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
                  Health Risks in Your Area
                </Text>
                
                <View style={styles.riskList}>
                  {activeRisks.slice(0, 3).map((risk, idx) => {
                    const cfg = getRiskConfig(risk.riskLevel);
                    return (
                      <Animated.View 
                        key={risk.diseaseKey}
                        entering={SlideInRight.delay(idx * 80).duration(300)}
                      >
                        <View style={[
                          styles.riskItem, 
                          { backgroundColor: colors.surface }
                        ]}>
                          <View style={[styles.riskIndicator, { backgroundColor: cfg.text }]} />
                          <View style={styles.riskContent}>
                            <View style={styles.riskHeader}>
                              <Text style={[styles.riskName, { color: colors.text }]}>
                                {risk.disease}
                              </Text>
                              <View style={[styles.riskBadge, { backgroundColor: cfg.bg }]}>
                                <Text style={[styles.riskBadgeText, { color: cfg.text }]}>
                                  {risk.riskLevel.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                            <Text 
                              style={[styles.riskReason, { color: colors.textSecondary }]}
                              numberOfLines={2}
                            >
                              {risk.reasons[0]}
                            </Text>
                          </View>
                          <Ionicons 
                            name="chevron-forward" 
                            size={16} 
                            color={colors.textMuted} 
                          />
                        </View>
                      </Animated.View>
                    );
                  })}
                </View>

                {activeRisks.length > 3 && (
                  <Pressable 
                    style={styles.viewAllBtn}
                    onPress={() => navigation.navigate('Alerts')}
                  >
                    <Text style={[styles.viewAllText, { color: Colors.primary }]}>
                      View all {activeRisks.length} risks
                    </Text>
                    <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                  </Pressable>
                )}
              </>
            )}

            {/* Location Permission Prompt */}
            {showLocationPrompt && (
              <Pressable 
                style={[styles.locationPrompt, { backgroundColor: colors.surface }]}
                onPress={handleEnableLocation}
              >
                <View style={styles.locationPromptIcon}>
                  <Ionicons name="navigate" size={20} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.locationPromptTitle, { color: colors.text }]}>
                    Enable precise location
                  </Text>
                  <Text style={[styles.locationPromptDesc, { color: colors.textSecondary }]}>
                    Get more accurate health alerts for your area
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
              </Pressable>
            )}

            {/* Disclaimer */}
            <Text style={[styles.disclaimer, { color: colors.textMuted }]}>
              {intel?.riskAssessment?.disclaimer || 
               'For awareness only. Consult a clinician for symptoms.'}
            </Text>

          </Animated.View>
        )}
      </ScrollView>

      {/* Floating Chatbot Button */}
      <FloatingActionButton onPress={() => navigation.navigate('Chatbot')} />

      {/* Environment Details Modal */}
      <EnvironmentModal 
        visible={modalVisible} 
        onClose={() => setModalVisible(false)} 
        data={intel}
        initialTab={modalTab}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userInfo: {
    gap: 2,
  },
  greeting: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
  },
  userName: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    maxWidth: 120,
  },
  locationText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
  },
  
  // Loading
  loadingContainer: {
    marginTop: 20,
  },
  
  // Alert Banner
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 16,
    padding: 14,
    marginBottom: 20,
    gap: 12,
  },
  alertIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: '#fff',
  },
  alertMessage: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 2,
  },
  alertAction: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 8,
  },
  alertActionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: '#fff',
  },
  
  // Status Card
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
  },
  statusSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  tipContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  tipText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  
  // Section Labels
  sectionLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  
  // Environment Row
  envRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  envCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    ...Shadows.sm,
  },
  envCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  envCardLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  envCardValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    marginBottom: 4,
  },
  envCardHint: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
  },
  
  // Risk List
  riskList: {
    gap: 10,
    marginBottom: 16,
  },
  riskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    ...Shadows.sm,
  },
  riskIndicator: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  riskContent: {
    flex: 1,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  riskName: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  riskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  riskBadgeText: {
    fontFamily: FontFamily.semibold,
    fontSize: 10,
  },
  riskReason: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  
  // View All
  viewAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  viewAllText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  
  // Location Prompt
  locationPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
    ...Shadows.sm,
  },
  locationPromptIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(17, 180, 212, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPromptTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  locationPromptDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  
  // Disclaimer
  disclaimer: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20,
    lineHeight: 16,
  },
});

export default HomeScreen;
