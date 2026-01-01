/**
 * HomeScreen
 * Main dashboard with health alerts and intel
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  FadeInUp,
  FadeIn,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import {
  GlassCard,
  Avatar,
  SkeletonLoader,
  FloatingActionButton,
  ShieldIcon,
  BellIcon,
  LocationIcon,
  InfoCircleIcon,
  ArrowRightIcon,
} from '../components';
import { useUser } from '../hooks/useUser';
import { useIntel } from '../hooks/useIntel';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  Duration,
} from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'MainTabs'>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user, loading: userLoading } = useUser();
  const { intel, loading: intelLoading, refresh } = useIntel();

  const [refreshing, setRefreshing] = useState(false);

  // Pulse animation for alert icon
  const alertPulse = useSharedValue(1);

  useEffect(() => {
    alertPulse.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: Duration.pulse / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: Duration.pulse / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const alertPulseStyle = useAnimatedStyle(() => ({
    opacity: alertPulse.value,
  }));

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleNotifications = () => {
    navigation.navigate('Alerts');
  };

  const handleChatbot = () => {
    navigation.navigate('Chatbot');
  };

  const firstName = user?.name?.split(' ')[0] || 'User';
  const location = user?.state || 'Nigeria';

  const isLoading = userLoading || intelLoading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <BlurView intensity={80} tint="light" style={[styles.header, { paddingTop: insets.top + Spacing.base }]}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <LinearGradient
              colors={[Colors.primary, Colors.emerald]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoContainer}
            >
              <ShieldIcon size={24} color={Colors.textLight} />
            </LinearGradient>
            <Text style={styles.logoText}>MedGuard</Text>
          </View>

          <View style={styles.headerRight}>
            <Pressable onPress={handleNotifications} style={styles.notificationBtn}>
              <BellIcon size={24} color={Colors.textSecondary} />
              <View style={styles.notificationBadge} />
            </Pressable>
            <Avatar source={user?.avatarUrl} size={40} />
          </View>
        </View>
      </BlurView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Loading State */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <SkeletonLoader width={128} height={24} borderRadius={BorderRadius.base} />
            <SkeletonLoader width={192} height={16} borderRadius={BorderRadius.base} style={{ marginTop: Spacing.sm }} />
            <SkeletonLoader width="100%" height={128} borderRadius={BorderRadius.xl} style={{ marginTop: Spacing.base }} />
          </View>
        )}

        {/* Content */}
        {!isLoading && (
          <Animated.View entering={FadeIn.duration(500)}>
            {/* Greeting */}
            <Animated.View entering={FadeInUp.delay(100).duration(500)}>
              <View style={styles.greeting}>
                <Text style={styles.welcomeText}>Welcome</Text>
                <Text style={styles.nameText}>{firstName}</Text>
              </View>
            </Animated.View>

            {/* Location */}
            <View style={styles.locationRow}>
              <LocationIcon size={24} color={Colors.textSecondary} />
              <Text style={styles.locationText}>{location}, Nigeria</Text>
            </View>

            {/* Alert Card */}
            <Animated.View entering={FadeInUp.delay(200).duration(500)}>
              <AnimatedPressable onPress={() => navigation.navigate('Alerts')}>
                <GlassCard style={styles.alertCard}>
                  <LinearGradient
                    colors={['rgba(17, 180, 212, 0.15)', 'rgba(251, 191, 36, 0.1)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.alertContent}>
                    <Animated.View style={alertPulseStyle}>
                      <LinearGradient
                        colors={[Colors.primary, '#fbbf24']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.alertIconContainer}
                      >
                        <InfoCircleIcon size={28} color={Colors.textLight} />
                      </LinearGradient>
                    </Animated.View>

                    <View style={styles.alertTextContent}>
                      <Text style={styles.alertTitle}>
                        {intel?.advisory?.emoji || '⚠️'} {intel?.advisory?.title || 'Seasonal Disease Alert'}
                      </Text>
                      <Text style={styles.alertBody}>
                        {intel?.advisory?.message || 'Malaria risk is high this week.'}
                      </Text>
                      {intel?.advisory?.source && (
                        <Text style={styles.alertSource}>Source: {intel.advisory.source}</Text>
                      )}
                      <View style={styles.alertLink}>
                        <Text style={styles.alertLinkText}>View all alerts</Text>
                        <ArrowRightIcon size={16} color={Colors.primary} />
                      </View>
                    </View>
                  </View>
                </GlassCard>
              </AnimatedPressable>
            </Animated.View>

            {/* Quick Tips Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Tips & Prevention</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.tipsContainer}
              >
                <TipCard
                  image="https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?auto=format&fit=crop&w=300&q=80"
                  label="Use mosquito nets"
                  delay={0}
                />
                <TipCard
                  image="https://images.unsplash.com/photo-1576086213369-97a306d36557?auto=format&fit=crop&w=300&q=80"
                  label="Apply insect repellent"
                  delay={100}
                />
                <TipCard
                  image="https://images.unsplash.com/photo-1559825481-12a05cc00344?auto=format&fit=crop&w=300&q=80"
                  label="Eliminate stagnant water"
                  delay={200}
                />
              </ScrollView>
            </View>

            {/* Weather & Health Section */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Weather & Health</Text>
              <Animated.View entering={FadeInUp.delay(300).duration(500)}>
                <View style={styles.weatherCard}>
                  <View style={styles.weatherContent}>
                    <Text style={styles.weatherTitle}>{intel?.season?.label || 'Rainy Season'}</Text>
                    <Text style={styles.weatherDescription}>
                      {intel?.season?.description || 'Increased mosquito activity.'}
                    </Text>
                    {intel?.weather && (
                      <Text style={styles.weatherInfo}>
                        {intel.weather.temp}°C • {intel.weather.humidity}% humidity
                      </Text>
                    )}
                  </View>
                  <FloatingSeason />
                </View>
              </Animated.View>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Floating Chatbot Button */}
      <FloatingActionButton onPress={handleChatbot} />
    </View>
  );
};

// Tip Card Component
interface TipCardProps {
  image: string;
  label: string;
  delay: number;
}

const TipCard: React.FC<TipCardProps> = ({ image, label, delay }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withTiming(1.03, { duration: 200 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 200 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(500)}>
      <AnimatedPressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.tipCard, animatedStyle]}
      >
        <Image source={{ uri: image }} style={styles.tipImage} />
        <Text style={styles.tipLabel}>{label}</Text>
      </AnimatedPressable>
    </Animated.View>
  );
};

// Floating Season Icon
const FloatingSeason: React.FC = () => {
  const translateY = useSharedValue(0);

  useEffect(() => {
    translateY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?auto=format&fit=crop&w=200&q=80' }}
        style={styles.seasonImage}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  notificationBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.backgroundLight,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.danger,
    borderWidth: 2,
    borderColor: Colors.surfaceLight,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 120,
    paddingHorizontal: Spacing.base,
  },
  loadingContainer: {
    gap: Spacing.sm,
  },
  greeting: {
    marginBottom: Spacing.xl,
  },
  welcomeText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  nameText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  locationText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  alertCard: {
    marginBottom: Spacing['3xl'],
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  alertContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
  },
  alertIconContainer: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  alertTextContent: {
    flex: 1,
  },
  alertTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  alertBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
    lineHeight: FontSize.base * 1.5,
  },
  alertSource: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.sm,
    opacity: 0.7,
  },
  alertLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
  },
  alertLinkText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  section: {
    marginBottom: Spacing['3xl'],
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
  },
  tipsContainer: {
    gap: Spacing.base,
    paddingRight: Spacing.base,
  },
  tipCard: {
    width: 160,
    gap: Spacing.md,
  },
  tipImage: {
    width: 160,
    height: 160,
    borderRadius: BorderRadius.lg,
    ...Shadows.md,
  },
  tipLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  weatherCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  weatherContent: {
    flex: 1,
    gap: Spacing.xs,
  },
  weatherTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
  },
  weatherDescription: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  weatherInfo: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.xs,
  },
  seasonImage: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.lg,
  },
});

export default HomeScreen;
