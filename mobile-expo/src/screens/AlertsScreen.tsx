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
  Pressable,
  ImageBackground,
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
  AlertCard,
  GlassCard,
  BellIcon,
  InfoCircleIcon,
  ArrowBackIcon,
  WarningIcon,
} from '../components';
import { useAlerts } from '../hooks/useAlerts';
import { useI18n } from '../i18n';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Duration,
  Gradients,
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
  const { alerts, loading, refresh } = useAlerts();
  const { t } = useI18n();
  const [refreshing, setRefreshing] = useState(false);

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

  // Sample alerts for demo (kept aligned to alerts.html structure/content)
  const sampleAlerts: Alert[] = alerts.length > 0 ? alerts : [
    {
      id: '1',
      title: 'Cholera cases rising in Ogun',
      message: 'Recent reports indicate a surge in cholera cases. Stay vigilant and follow health guidelines.',
      severity: 'urgent',
      source: 'Community Health',
      timestamp: '2 hours ago',
    },
    {
      id: '2',
      title: 'Malaria risk in Lagos',
      message: 'Lagos is experiencing a moderate risk of malaria transmission. Consider preventive measures.',
      severity: 'caution',
      source: 'Community Health',
      timestamp: '5 hours ago',
    },
    {
      id: '3',
      title: 'Dengue fever prevention tips',
      message: 'Learn how to protect yourself and your family from dengue fever. Simple steps can make a big difference.',
      severity: 'info',
      source: 'Health Tips',
      timestamp: '1 day ago',
    },
  ];

  const communityAlerts = sampleAlerts;

  return (
    <LinearGradient
      colors={Gradients.background.colors as unknown as [string, string, string]}
      start={Gradients.background.start}
      end={Gradients.background.end}
      style={styles.container}
    >
      <View style={styles.page}>
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
                    <Text style={styles.activeBadgeText}>{sampleAlerts.length} {t('active_alerts')}</Text>
                  </Animated.View>
                </View>
              </View>
            </ImageBackground>
          </Animated.View>

          {/* Community Alerts */}
          <View style={styles.contentWrap}>
            <View style={styles.sectionHeaderRow}>
              <InfoCircleIcon size={18} color={Colors.primary} />
              <Text style={styles.sectionHeading}>{t('community_alerts')}</Text>
            </View>
            <View style={styles.cardStack}>
              {communityAlerts.map((alert, index) => (
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
              ))}
            </View>

            {/* Personal Reminders */}
            <View style={styles.sectionHeaderRow}>
              <BellIcon size={18} color={Colors.primary} />
              <Text style={styles.sectionHeading}>{t('personal_reminders')}</Text>
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
                <Text style={styles.reminderMeta}>Today, 8:00 PM</Text>
                <Text style={styles.reminderTitle}>Take malaria meds at 8PM</Text>
                <Text style={styles.reminderText}>Don't forget your malaria medication tonight.</Text>
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
    borderBottomLeftRadius: BorderRadius['3xl'],
    borderBottomRightRadius: BorderRadius['3xl'],
    overflow: 'hidden',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroHeader: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.lg,
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
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
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
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.base,
    marginTop: -Spacing.base,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionHeading: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  cardStack: {
    gap: Spacing.base,
    marginBottom: Spacing.xl,
  },
  reminderCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
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
