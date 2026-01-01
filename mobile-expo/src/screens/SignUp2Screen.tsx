/**
 * SignUp2Screen
 * Step 2 of 2 - Personalization welcome
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { Button, GlassCard, ArrowRightIcon } from '../components';
import { useUser } from '../hooks/useUser';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
} from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp2'>;

interface FeatureCardProps {
  number: string;
  title: string;
  description: string;
  delay: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ number, title, description, delay }) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 500 }));
    translateY.value = withDelay(delay, withTiming(0, { duration: 500, easing: Easing.out(Easing.ease) }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View style={styles.featureCard}>
        <LinearGradient
          colors={['rgba(17, 180, 212, 0.2)', 'rgba(17, 180, 212, 0.05)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.featureNumber}>
          <Text style={styles.featureNumberText}>{number}</Text>
        </View>
        <View style={styles.featureContent}>
          <Text style={styles.featureTitle}>{title}</Text>
          <Text style={styles.featureDescription}>{description}</Text>
        </View>
      </View>
    </Animated.View>
  );
};

const SignUp2Screen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useUser();

  const [notifications, setNotifications] = useState(true);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const location = user?.state || 'your area';

  const handleFinish = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.progressRow}>
          <Text style={styles.stepText}>Step 2 of 2</Text>
          <View style={styles.progressBars}>
            <View style={styles.progressBarFilled} />
            <View style={styles.progressBarFilled} />
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Message */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>
            Hi {firstName}! 👋 Welcome to MedGuard
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Here's how we'll help protect your health in {location}.
          </Text>
        </View>

        {/* Feature Cards */}
        <View style={styles.featuresContainer}>
          <FeatureCard
            number="1️⃣"
            title="Seasonal Health Alerts"
            description="Receive timely updates on seasonal health risks and preventive measures."
            delay={100}
          />
          <FeatureCard
            number="2️⃣"
            title="AI Chatbot"
            description="Get instant answers to your health questions with our AI-powered chatbot."
            delay={200}
          />
          <FeatureCard
            number="3️⃣"
            title="Daily Health Feed"
            description="Access a curated feed of health tips, news, and local resources."
            delay={300}
          />
        </View>

        {/* Notifications Toggle */}
        <View style={styles.notificationCard}>
          <Text style={styles.notificationText}>Send me important notifications</Text>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ false: Colors.borderLight, true: Colors.primary }}
            thumbColor={Colors.surfaceLight}
          />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
        <Button
          title="Finish Setup"
          onPress={handleFinish}
          icon={<ArrowRightIcon size={20} color={Colors.textLight} />}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  header: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  progressBars: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  progressBarFilled: {
    width: 40,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.xl,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  welcomeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  welcomeSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  featuresContainer: {
    gap: Spacing.base,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    gap: Spacing.base,
  },
  featureNumber: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureNumberText: {
    fontSize: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  featureDescription: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.5,
  },
  notificationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    marginTop: Spacing['3xl'],
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
  },
  notificationText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
  },
});

export default SignUp2Screen;
