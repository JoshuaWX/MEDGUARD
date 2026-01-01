/**
 * AlertsScreen
 * Health alerts and notifications
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
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
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AlertCard,
  GlassCard,
  BellIcon,
  InfoCircleIcon,
  FloatingShape,
} from '../components';
import { useAlerts } from '../hooks/useAlerts';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Duration,
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
  const { alerts, loading, refresh } = useAlerts();
  const [refreshing, setRefreshing] = useState(false);

  // Floating shape animations
  const float1 = useSharedValue(0);
  const float2 = useSharedValue(0);

  // Badge pulse animation
  const badgePulse = useSharedValue(1);

  useEffect(() => {
    // Floating animations
    float1.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 3000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    float2.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

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

  const floatStyle1 = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float1.value, [0, 1], [0, -15]) },
      { translateX: interpolate(float1.value, [0, 1], [0, 10]) },
    ],
  }));

  const floatStyle2 = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(float2.value, [0, 1], [0, -20]) },
      { translateX: interpolate(float2.value, [0, 1], [0, -15]) },
    ],
  }));

  const badgePulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgePulse.value }],
  }));

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // Sample alerts for demo
  const sampleAlerts: Alert[] = alerts.length > 0 ? alerts : [
    {
      id: '1',
      title: '⚠️ Malaria Outbreak Alert',
      message: 'Increased malaria cases reported in Lagos State. Use mosquito nets and apply repellent.',
      severity: 'urgent',
      source: 'Nigeria CDC',
      timestamp: '2 hours ago',
    },
    {
      id: '2',
      title: '💧 Water Safety Advisory',
      message: 'Boil water before drinking due to reported contamination in some areas.',
      severity: 'caution',
      source: 'State Water Board',
      timestamp: '5 hours ago',
    },
    {
      id: '3',
      title: '🌡️ Heatwave Warning',
      message: 'High temperatures expected this week. Stay hydrated and avoid direct sunlight.',
      severity: 'info',
      source: 'Weather Service',
      timestamp: '1 day ago',
    },
    {
      id: '4',
      title: '💉 Vaccination Reminder',
      message: 'COVID-19 booster shots now available at local health centers.',
      severity: 'info',
      source: 'Ministry of Health',
      timestamp: '2 days ago',
    },
  ];

  const urgentAlerts = sampleAlerts.filter(a => a.severity === 'urgent');
  const cautionAlerts = sampleAlerts.filter(a => a.severity === 'caution');
  const infoAlerts = sampleAlerts.filter(a => a.severity === 'info');

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(500)}>
          <LinearGradient
            colors={[Colors.primary, Colors.cyan]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* Floating Shapes */}
            <Animated.View style={[styles.floatingShape1, floatStyle1]}>
              <FloatingShape color="rgba(255, 255, 255, 0.08)" size={60} />
            </Animated.View>
            <Animated.View style={[styles.floatingShape2, floatStyle2]}>
              <FloatingShape color="rgba(255, 255, 255, 0.06)" size={100} />
            </Animated.View>

            <View style={styles.headerIcon}>
              <BellIcon size={32} color={Colors.textLight} />
            </View>
            <Text style={styles.headerTitle}>Health Alerts</Text>
            <Text style={styles.headerSubtitle}>Stay informed about your area</Text>

            {/* Active Alerts Badge */}
            <Animated.View style={[styles.alertBadge, badgePulseStyle]}>
              <Text style={styles.alertBadgeText}>
                {sampleAlerts.length} Active Alert{sampleAlerts.length !== 1 ? 's' : ''}
              </Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>

        {/* Urgent Alerts */}
        {urgentAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.severityDot, { backgroundColor: Colors.danger }]} />
              <Text style={styles.sectionTitle}>Urgent</Text>
            </View>
            {urgentAlerts.map((alert, index) => (
              <Animated.View
                key={alert.id}
                entering={FadeInUp.delay(100 + index * 100).duration(500)}
              >
                <AlertCard
                  title={alert.title}
                  message={alert.message}
                  severity={alert.severity}
                  source={alert.source}
                  timestamp={alert.timestamp}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {/* Caution Alerts */}
        {cautionAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.severityDot, { backgroundColor: '#f59e0b' }]} />
              <Text style={styles.sectionTitle}>Caution</Text>
            </View>
            {cautionAlerts.map((alert, index) => (
              <Animated.View
                key={alert.id}
                entering={FadeInUp.delay(200 + index * 100).duration(500)}
              >
                <AlertCard
                  title={alert.title}
                  message={alert.message}
                  severity={alert.severity}
                  source={alert.source}
                  timestamp={alert.timestamp}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {/* Info Alerts */}
        {infoAlerts.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.severityDot, { backgroundColor: Colors.primary }]} />
              <Text style={styles.sectionTitle}>Information</Text>
            </View>
            {infoAlerts.map((alert, index) => (
              <Animated.View
                key={alert.id}
                entering={FadeInUp.delay(300 + index * 100).duration(500)}
              >
                <AlertCard
                  title={alert.title}
                  message={alert.message}
                  severity={alert.severity}
                  source={alert.source}
                  timestamp={alert.timestamp}
                />
              </Animated.View>
            ))}
          </View>
        )}

        {/* Personal Reminders */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Reminders</Text>
          <Animated.View entering={FadeInUp.delay(400).duration(500)}>
            <GlassCard style={styles.reminderCard}>
              <View style={styles.reminderIcon}>
                <InfoCircleIcon size={24} color={Colors.primary} />
              </View>
              <View style={styles.reminderContent}>
                <Text style={styles.reminderTitle}>Enable Notifications</Text>
                <Text style={styles.reminderText}>
                  Turn on notifications to receive important health alerts for your area.
                </Text>
              </View>
            </GlassCard>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
  },
  header: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    paddingTop: Spacing['3xl'],
    marginBottom: Spacing.xl,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  floatingShape1: {
    position: 'absolute',
    top: 10,
    right: -10,
  },
  floatingShape2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['3xl'],
    color: Colors.textLight,
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  alertBadge: {
    marginTop: Spacing.base,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BorderRadius.full,
  },
  alertBadgeText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  severityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
  },
  reminderIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderContent: {
    flex: 1,
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
