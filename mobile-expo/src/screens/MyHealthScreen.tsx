/**
 * MyHealthScreen
 * Health tracking with symptom logging
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
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
} from '../components';
import { useUser } from '../hooks/useUser';
import { useSymptoms } from '../hooks/useSymptoms';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  Duration,
} from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SYMPTOMS = [
  { id: 'fever', label: 'Fever', emoji: '🤒' },
  { id: 'headache', label: 'Headache', emoji: '🤕' },
  { id: 'fatigue', label: 'Fatigue', emoji: '😩' },
  { id: 'cough', label: 'Cough', emoji: '🤧' },
  { id: 'bodyPain', label: 'Body Pain', emoji: '💪' },
  { id: 'nausea', label: 'Nausea', emoji: '🤢' },
  { id: 'dizziness', label: 'Dizziness', emoji: '😵' },
  { id: 'chills', label: 'Chills', emoji: '🥶' },
];

const MyHealthScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { logSymptoms, loading } = useSymptoms();

  const [selectedSymptoms, setSelectedSymptoms] = useState<string[]>([]);
  const healthScore = user?.healthScore ?? 85;

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

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + Spacing.base, paddingBottom: 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)}>
          <LinearGradient
            colors={[Colors.primary, Colors.emerald]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <Text style={styles.headerTitle}>My Health</Text>
            <Text style={styles.headerSubtitle}>Track your wellness journey</Text>

            {/* Health Score */}
            <View style={styles.scoreContainer}>
              <View style={styles.scoreCircleOuter}>
                {/* Pulse Ring */}
                <Animated.View style={[styles.pulseRing, pulseStyle]} />
                
                {/* Score Circle */}
                <View style={[styles.scoreCircle, { borderColor: getScoreColor(healthScore) }]}>
                  <Text style={styles.scoreValue}>{healthScore}</Text>
                  <Text style={styles.scoreLabel}>Health Score</Text>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Health Tip */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)}>
          <GlassCard style={styles.tipCard}>
            <View style={styles.tipIcon}>
              <HeartIcon size={24} color={Colors.danger} />
            </View>
            <View style={styles.tipContent}>
              <Text style={styles.tipTitle}>Daily Tip</Text>
              <Text style={styles.tipText}>
                Stay hydrated! Drink at least 8 glasses of water daily to boost your immune system.
              </Text>
            </View>
          </GlassCard>
        </Animated.View>

        {/* Symptom Logging */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How are you feeling today?</Text>
          <Text style={styles.sectionSubtitle}>Select any symptoms you're experiencing</Text>

          <View style={styles.symptomsGrid}>
            {SYMPTOMS.map((symptom, index) => (
              <Animated.View
                key={symptom.id}
                entering={FadeInUp.delay(300 + index * 50).duration(400)}
              >
                <SymptomButton
                  label={symptom.label}
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
                title={`Log ${selectedSymptoms.length} Symptom${selectedSymptoms.length > 1 ? 's' : ''}`}
                onPress={handleLogSymptoms}
                loading={loading}
              />
            </Animated.View>
          )}
        </View>

        {/* Nearby Clinics */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Nearby Clinics</Text>
            <Pressable style={styles.seeAllBtn}>
              <Text style={styles.seeAllText}>See all</Text>
              <ArrowRightIcon size={16} color={Colors.primary} />
            </Pressable>
          </View>

          <Animated.View entering={FadeInUp.delay(500).duration(500)}>
            <ClinicCard
              name="General Hospital Lagos"
              address="123 Marina Road, Lagos Island"
              distance="2.3 km"
              status="Open"
            />
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(600).duration(500)}>
            <ClinicCard
              name="St. Nicholas Hospital"
              address="57 Campbell Street, Lagos"
              distance="3.1 km"
              status="Open"
            />
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
};

// Clinic Card Component
interface ClinicCardProps {
  name: string;
  address: string;
  distance: string;
  status: 'Open' | 'Closed';
}

const ClinicCard: React.FC<ClinicCardProps> = ({ name, address, distance, status }) => {
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
        <View style={styles.clinicIcon}>
          <ShieldIcon size={24} color={Colors.primary} />
        </View>
        <View style={styles.clinicContent}>
          <Text style={styles.clinicName}>{name}</Text>
          <View style={styles.clinicAddress}>
            <LocationIcon size={14} color={Colors.textSecondary} />
            <Text style={styles.clinicAddressText}>{address}</Text>
          </View>
          <View style={styles.clinicMeta}>
            <Text style={styles.clinicDistance}>{distance}</Text>
            <View style={[styles.statusBadge, status === 'Open' && styles.statusOpen]}>
              <Text style={[styles.statusText, status === 'Open' && styles.statusTextOpen]}>
                {status}
              </Text>
            </View>
          </View>
        </View>
      </GlassCard>
    </AnimatedPressable>
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
  scoreContainer: {
    marginTop: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreCircleOuter: {
    width: 140,
    height: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.textLight,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.textLight,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.lg,
  },
  scoreValue: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['4xl'],
    color: Colors.textPrimary,
  },
  scoreLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.base,
    marginBottom: Spacing.xl,
  },
  tipIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  tipText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.5,
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
  clinicIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clinicContent: {
    flex: 1,
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
