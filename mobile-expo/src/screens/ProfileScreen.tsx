/**
 * ProfileScreen
 * User profile with avatar and settings
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
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
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import {
  GlassCard,
  Button,
  Input,
  Avatar,
  FloatingShape,
  UserIcon,
  MailIcon,
  LocationIcon,
  SettingsIcon,
  LogoutIcon,
  ChevronDownIcon,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '../hooks/useUser';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  Duration,
} from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { signOut } = useAuth();
  const { user, loading, refresh, updateProfile } = useUser();

  const [refreshing, setRefreshing] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    state: '',
  });

  // Floating shape animations
  const float1 = useSharedValue(0);
  const float2 = useSharedValue(0);

  // Avatar pulse ring animation
  const avatarPulse = useSharedValue(1);

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
    float2.value = withDelay(
      1500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 4000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );

    // Avatar pulse
    avatarPulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: Duration.pulse, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 0 })
      ),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        state: user.state || '',
      });
    }
  }, [user]);

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

  const avatarPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: avatarPulse.value }],
    opacity: interpolate(avatarPulse.value, [1, 1.15], [0.5, 0]),
  }));

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              navigation.reset({
                index: 0,
                routes: [{ name: 'Welcome' }],
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(formData);
      setEditMode(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

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
        {/* Header with Avatar */}
        <Animated.View entering={FadeIn.duration(500)}>
          <LinearGradient
            colors={[Colors.primary, Colors.emerald]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* Floating Shapes */}
            <Animated.View style={[styles.floatingShape1, floatStyle1]}>
              <FloatingShape color="rgba(255, 255, 255, 0.08)" size={80} />
            </Animated.View>
            <Animated.View style={[styles.floatingShape2, floatStyle2]}>
              <FloatingShape color="rgba(255, 255, 255, 0.06)" size={120} />
            </Animated.View>

            <View style={styles.avatarContainer}>
              {/* Pulse Ring */}
              <Animated.View style={[styles.avatarPulse, avatarPulseStyle]} />
              
              {/* Avatar */}
              <Avatar source={user?.avatarUrl} size={100} />
            </View>

            <Text style={styles.userName}>{user?.name || 'User'}</Text>
            <Text style={styles.userEmail}>{user?.email || ''}</Text>

            {user?.state && (
              <View style={styles.locationBadge}>
                <LocationIcon size={14} color={Colors.textLight} />
                <Text style={styles.locationText}>{user.state}, Nigeria</Text>
              </View>
            )}
          </LinearGradient>
        </Animated.View>

        {/* Personal Details */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Personal Details</Text>
            <Pressable onPress={() => setEditMode(!editMode)}>
              <Text style={styles.editBtn}>{editMode ? 'Cancel' : 'Edit'}</Text>
            </Pressable>
          </View>

          <GlassCard style={styles.detailsCard}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <Input
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Enter your name"
                editable={editMode}
                icon={<UserIcon size={20} color={Colors.textSecondary} />}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Email</Text>
              <Input
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="Enter your email"
                editable={false}
                icon={<MailIcon size={20} color={Colors.textSecondary} />}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>State</Text>
              <Input
                value={formData.state}
                onChangeText={(text) => setFormData({ ...formData, state: text })}
                placeholder="Select your state"
                editable={editMode}
                icon={<LocationIcon size={20} color={Colors.textSecondary} />}
              />
            </View>

            {editMode && (
              <Animated.View entering={FadeIn.duration(300)} style={styles.saveButtonContainer}>
                <Button
                  title="Save Changes"
                  onPress={handleSaveProfile}
                  loading={loading}
                />
              </Animated.View>
            )}
          </GlassCard>
        </Animated.View>

        {/* Settings Section */}
        <Animated.View entering={FadeInUp.delay(300).duration(500)}>
          <Text style={styles.sectionTitle}>Settings</Text>

          <GlassCard style={styles.settingsCard}>
            <SettingsRow
              icon={<SettingsIcon size={20} color={Colors.textSecondary} />}
              label="App Settings"
              onPress={() => navigation.navigate('Settings')}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon={<LocationIcon size={20} color={Colors.textSecondary} />}
              label="Location Preferences"
              onPress={() => {}}
            />
            <View style={styles.divider} />
            <SettingsRow
              icon={<LogoutIcon size={20} color={Colors.danger} />}
              label="Sign Out"
              labelStyle={{ color: Colors.danger }}
              onPress={handleSignOut}
            />
          </GlassCard>
        </Animated.View>
      </ScrollView>
    </View>
  );
};

// Settings Row Component
interface SettingsRowProps {
  icon: React.ReactNode;
  label: string;
  labelStyle?: object;
  onPress: () => void;
}

const SettingsRow: React.FC<SettingsRowProps> = ({ icon, label, labelStyle, onPress }) => {
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
      <View style={styles.settingsRow}>
        <View style={styles.settingsRowLeft}>
          {icon}
          <Text style={[styles.settingsLabel, labelStyle]}>{label}</Text>
        </View>
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
    top: 20,
    right: -20,
  },
  floatingShape2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.base,
  },
  avatarPulse: {
    position: 'absolute',
    top: -5,
    left: -5,
    right: -5,
    bottom: -5,
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.textLight,
  },
  userName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textLight,
    marginBottom: Spacing.xs,
  },
  userEmail: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: BorderRadius.full,
  },
  locationText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textLight,
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
    marginBottom: Spacing.md,
  },
  editBtn: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  detailsCard: {
    marginBottom: Spacing.xl,
    gap: Spacing.base,
  },
  inputGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginLeft: Spacing.xs,
  },
  saveButtonContainer: {
    marginTop: Spacing.md,
  },
  settingsCard: {
    padding: 0,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
  },
  settingsRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  settingsLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginHorizontal: Spacing.base,
  },
});

export default ProfileScreen;
