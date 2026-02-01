/**
 * MyHealthScreen
 * Health tracking with symptom logging
 * 
 * FEATURE BLOCKED: This screen is under development.
 * To enable: Set FEATURE_ENABLED to true or remove the FeatureBlockedScreen wrapper.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Image,
  ImageBackground,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GlassCard,
  Button,
  SymptomButton,
  HeartIcon,
  ShieldIcon,
  ArrowRightIcon,
  LocationIcon,
  Avatar,
  FeatureBlockedScreen,
} from '../components';
import { useUser } from '../hooks/useUser';
import { useSymptoms } from '../hooks/useSymptoms';
import { useTheme } from '../hooks/useTheme';
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
const FEATURE_ENABLED = false;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SYMPTOMS = [
  { id: 'fever', key: 'symptom_fever', emoji: '🤒' },
  { id: 'headache', key: 'symptom_headache', emoji: '🤕' },
  { id: 'fatigue', key: 'symptom_fatigue', emoji: '😩' },
  { id: 'cough', key: 'symptom_cough', emoji: '🤧' },
  { id: 'bodyPain', key: 'symptom_body_pain', emoji: '💪' },
  { id: 'nausea', key: 'symptom_nausea', emoji: '🤢' },
  { id: 'dizziness', key: 'symptom_dizziness', emoji: '😵' },
  { id: 'chills', key: 'symptom_chills', emoji: '🥶' },
];

const MyHealthScreen: React.FC = () => {
  const { t } = useI18n();

  // Show feature blocked screen if feature is not enabled
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
  const { user } = useUser();
  const { logSymptoms, loading } = useSymptoms();
  const { t } = useI18n();
  const { isDark, colors } = useTheme();

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const healthScore = user?.healthScore ?? 85;
  const displayName = user?.name || 'User';

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

  const toggleSymptom = (id: string) => {
    setSelectedSymptoms(prev =>
      prev.includes(id)
        ? prev.filter(s => s !== id)
        : [...prev, id]
    );
  };

  const handleLogSymptoms = async () => {
    if (selectedSymptoms.length === 0) {
      Alert.alert('No Symptoms Selected', 'Please select at least one symptom to log.');
      return;
    }

    try {
      await logSymptoms(selectedSymptoms);
      setSelectedSymptoms([]);
      Alert.alert('Symptoms Logged', 'Your symptoms have been recorded. We\'ll analyze them for health insights.');
    } catch (error) {
      Alert.alert('Error', 'Failed to log symptoms. Please try again.');
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return Colors.emerald;
    if (score >= 60) return '#fbbf24';
    return Colors.danger;
  };

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
              <GlassCard style={styles.scoreCard} padding={Spacing.xl} intensity={22}>
                <Text style={styles.scoreMeta}>{t('health_score_label')}</Text>
                <Text style={styles.scoreValue}>{healthScore}</Text>
                <Text style={styles.scoreDesc}>{t('health_score_desc')}</Text>
              </GlassCard>
            </View>
          </ImageBackground>
        </Animated.View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Health Tip (card structure closer to web) */}
          <Animated.View entering={FadeInUp.delay(200).duration(450)}>
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

        {/* Symptom Logging */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('how_feeling_today')}</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{t('select_symptoms')}</Text>

          <View style={styles.symptomsGrid}>
            {SYMPTOMS.map((symptom, index) => (
              <Animated.View
                key={symptom.id}
                entering={FadeInUp.delay(300 + index * 50).duration(400)}
              >
                <SymptomButton
                  label={t(symptom.key)}
                  emoji={symptom.emoji}
                  selected={selectedSymptoms.includes(symptom.id)}
                  onPress={() => toggleSymptom(symptom.id)}
                />
              </Animated.View>
            ))}
          </View>

          {selectedSymptoms.length > 0 && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.logButtonContainer}>
              <Button
                title={`${t(selectedSymptoms.length > 1 ? 'log_symptoms' : 'log_symptom')}: ${selectedSymptoms.length}`}
                onPress={handleLogSymptoms}
                loading={loading}
              />
            </Animated.View>
          )}
        </View>

        {/* Nearby Clinics */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('nearby_clinics')}</Text>
            <Pressable style={styles.seeAllBtn}>
              <Text style={[styles.seeAllText, { color: colors.primary }]}>{t('see_all')}</Text>
              <ArrowRightIcon size={16} color={colors.primary} />
            </Pressable>
          </View>

          <Animated.View entering={FadeInUp.delay(500).duration(500)}>
            <ClinicCard
              name="General Hospital Lagos"
              address="123 Marina Road, Lagos Island"
              distance="2.3 km"
              status="Open"
              colors={colors}
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600).duration(500)}>
            <ClinicCard
              name="St. Nicholas Hospital"
              address="57 Campbell Street, Lagos"
              distance="3.1 km"
              status="Open"
              colors={colors}
            />
          </Animated.View>
        </View>
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
  status: 'Open' | 'Closed';
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
            <View style={[styles.statusBadge, status === 'Open' && styles.statusOpen]}>
              <Text style={[styles.statusText, status === 'Open' && styles.statusTextOpen]}>
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
    paddingTop: Spacing.base,
    marginTop: -Spacing.base,
  },
  header: {
    borderBottomLeftRadius: BorderRadius['3xl'],
    borderBottomRightRadius: BorderRadius['3xl'],
    overflow: 'hidden',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.xl,
    ...Shadows.lg,
  },
  headerImage: {
    resizeMode: 'cover',
    opacity: 0.2,
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
    backgroundColor: Colors.whiteAlpha50,
  },
  scoreCard: {
    width: '100%',
    borderRadius: BorderRadius['2xl'],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha20,
  },
  scoreMeta: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha80,
  },
  scoreValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['4xl'],
    color: Colors.textLight,
    marginTop: Spacing.xs,
  },
  scoreDesc: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.whiteAlpha80,
    marginTop: Spacing.sm,
  },
  tipCard: {
    marginBottom: Spacing.xl,
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
  symptomsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  logButtonContainer: {
    marginTop: Spacing.xl,
  },
  clinicCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
    marginBottom: Spacing.md,
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
});

export default MyHealthScreen;
