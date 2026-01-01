/**
 * SettingsScreen
 * App settings and preferences
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeInUp,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import {
  GlassCard,
  SettingsIcon,
  BellIcon,
  LocationIcon,
  ChevronDownIcon,
} from '../components';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
} from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [notifications, setNotifications] = useState(true);
  const [locationTracking, setLocationTracking] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

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
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronDownIcon size={24} color={Colors.textPrimary} style={{ transform: [{ rotate: '90deg' }] }} />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Notifications Section */}
        <Animated.View entering={FadeInUp.delay(100).duration(500)}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <GlassCard style={styles.settingsCard}>
            <SettingsToggle
              icon={<BellIcon size={20} color={Colors.primary} />}
              label="Push Notifications"
              description="Receive health alerts and reminders"
              value={notifications}
              onValueChange={setNotifications}
            />
          </GlassCard>
        </Animated.View>

        {/* Privacy Section */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)}>
          <Text style={styles.sectionTitle}>Privacy</Text>
          <GlassCard style={styles.settingsCard}>
            <SettingsToggle
              icon={<LocationIcon size={20} color={Colors.emerald} />}
              label="Location Tracking"
              description="Get alerts based on your location"
              value={locationTracking}
              onValueChange={setLocationTracking}
            />
          </GlassCard>
        </Animated.View>

        {/* Appearance Section */}
        <Animated.View entering={FadeInUp.delay(300).duration(500)}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <GlassCard style={styles.settingsCard}>
            <SettingsToggle
              icon={<SettingsIcon size={20} color={Colors.textSecondary} />}
              label="Dark Mode"
              description="Use dark theme"
              value={darkMode}
              onValueChange={setDarkMode}
            />
          </GlassCard>
        </Animated.View>

        {/* About Section */}
        <Animated.View entering={FadeInUp.delay(400).duration(500)}>
          <Text style={styles.sectionTitle}>About</Text>
          <GlassCard style={styles.settingsCard}>
            <View style={styles.aboutRow}>
              <Text style={styles.aboutLabel}>Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
            <View style={styles.divider} />
            <SettingsLink label="Privacy Policy" onPress={() => {}} />
            <View style={styles.divider} />
            <SettingsLink label="Terms of Service" onPress={() => {}} />
            <View style={styles.divider} />
            <SettingsLink label="Contact Support" onPress={() => {}} />
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

// Settings Toggle Component
interface SettingsToggleProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}

const SettingsToggle: React.FC<SettingsToggleProps> = ({
  icon,
  label,
  description,
  value,
  onValueChange,
}) => {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleIcon}>{icon}</View>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
        thumbColor={value ? Colors.primary : Colors.textSecondary}
      />
    </View>
  );
};

// Settings Link Component
interface SettingsLinkProps {
  label: string;
  onPress: () => void;
}

const SettingsLink: React.FC<SettingsLinkProps> = ({ label, onPress }) => {
  const scale = useSharedValue(1);

  const handlePressIn = () => {
    scale.value = withTiming(0.98, { duration: 100 });
  };

  const handlePressOut = () => {
    scale.value = withTiming(1, { duration: 100 });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={animatedStyle}
    >
      <View style={styles.linkRow}>
        <Text style={styles.linkLabel}>{label}</Text>
        <ChevronDownIcon size={20} color={Colors.textSecondary} style={{ transform: [{ rotate: '-90deg' }] }} />
      </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textPrimary,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.base,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: Spacing.md,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleContent: {
    flex: 1,
  },
  toggleLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  toggleDescription: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.base,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
  },
  aboutLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  aboutValue: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
  },
  linkRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
  },
  linkLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.primary,
  },
});

export default SettingsScreen;
