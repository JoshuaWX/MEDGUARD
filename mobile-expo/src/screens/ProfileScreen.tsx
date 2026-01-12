/**
 * ProfileScreen
 * UI parity pass aligned to profile.html (hero header + stacked cards)
 * Keeps existing auth/profile logic unchanged.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInUp,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import {
  ArrowBackIcon,
  Avatar,
  BellIcon,
  Button,
  CameraIcon,
  FloatingShape,
  GlassCard,
  InfoCircleIcon,
  Input,
  LogoutIcon,
  SettingsIcon,
  UserIcon,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '../hooks/useUser';
import {
  BorderRadius,
  Colors,
  Duration,
  FontFamily,
  FontSize,
  Gradients,
  Spacing,
} from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

type Gender = 'Male' | 'Female' | 'Other' | '';

const HERO_BG_URI =
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=800&q=80';

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

  // UI-only fields to match web layout (not persisted)
  const [gender, setGender] = useState<Gender>('');
  const [age, setAge] = useState('');
  const [lga, setLga] = useState('');
  const [prefHealthAlerts, setPrefHealthAlerts] = useState(true);
  const [prefDailyTips, setPrefDailyTips] = useState(false);

  // Floating shape animations
  const float1 = useSharedValue(0);
  const float2 = useSharedValue(0);

  // Avatar pulse ring animation
  const avatarPulse = useSharedValue(1);

  useEffect(() => {
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

    avatarPulse.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: Duration.pulse, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 0 })
      ),
      -1,
      false
    );
  }, [avatarPulse, float1, float2]);

  useEffect(() => {
    if (!user) return;
    setFormData({
      name: user.name || '',
      email: user.email || '',
      state: user.state || '',
    });
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

  const gradientBgColors = useMemo(
    () => Gradients.background.colors as unknown as [string, string, string],
    []
  );
  const primaryColors = useMemo(
    () => Gradients.primary.colors as unknown as [string, string],
    []
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const handleBack = useCallback(() => {
    try {
      if (navigation.canGoBack()) {
        navigation.goBack();
      } else {
        navigation.navigate('MainTabs');
      }
    } catch {
      navigation.navigate('MainTabs');
    }
  }, [navigation]);

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
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
          } catch {
            Alert.alert('Error', 'Failed to sign out. Please try again.');
          }
        },
      },
    ]);
  };

  const handleSaveProfile = async () => {
    try {
      await updateProfile(formData);
      setEditMode(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  return (
    <LinearGradient
      colors={gradientBgColors}
      start={Gradients.background.start}
      end={Gradients.background.end}
      style={styles.container}
    >
      <View style={styles.page}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: 120 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        >
          {/* Hero */}
          <Animated.View entering={FadeIn.duration(500)}>
            <ImageBackground source={{ uri: HERO_BG_URI }} style={styles.hero} imageStyle={styles.heroImage}>
              <LinearGradient
                colors={primaryColors}
                start={Gradients.primary.start}
                end={Gradients.primary.end}
                style={[StyleSheet.absoluteFill, styles.heroOverlay]}
              />

              <Animated.View style={[styles.floatingShape1, floatStyle1]}>
                <FloatingShape color={Colors.whiteAlpha20} size={80} />
              </Animated.View>
              <Animated.View style={[styles.floatingShape2, floatStyle2]}>
                <FloatingShape color={Colors.whiteAlpha20} size={48} />
              </Animated.View>
              <Animated.View style={[styles.floatingShape3, floatStyle1]}>
                <FloatingShape color={Colors.whiteAlpha10} size={32} />
              </Animated.View>

              <View style={[styles.heroTopRow, { paddingTop: insets.top + Spacing.base }]}>
                <Pressable onPress={handleBack} style={styles.heroIconBtn} hitSlop={10}>
                  <ArrowBackIcon size={24} color={Colors.textLight} />
                </Pressable>
                <Text style={styles.heroTitle}>My Profile</Text>
                <Pressable onPress={handleSignOut} style={styles.signOutPill} hitSlop={10}>
                  <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
              </View>

              <View style={styles.heroProfile}>
                <View style={styles.avatarContainer}>
                  <Animated.View style={[styles.avatarPulse, avatarPulseStyle]} />
                  <View style={styles.avatarRing}>
                    <Avatar source={user?.avatarUrl} size={96} />
                  </View>
                  <Pressable onPress={() => setEditMode(true)} style={styles.avatarEditBtn} hitSlop={10}>
                    <CameraIcon size={18} color={Colors.primary} />
                  </Pressable>
                </View>
                <Text style={styles.userName}>{user?.name || 'Loading…'}</Text>
                <Text style={styles.userSub}>{user?.email || ''}</Text>
              </View>
            </ImageBackground>
          </Animated.View>

          {/* Main */}
          <View style={styles.main}>
            {/* Personal Details */}
            <Animated.View entering={FadeInUp.delay(150).duration(450)}>
              <GlassCard style={styles.card}>
                <View style={styles.cardInner}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.iconContainer}>
                      <UserIcon size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>Personal Details</Text>
                      <Text style={styles.cardSubtitle}>Keep your details updated</Text>
                    </View>
                  </View>

                  <View style={styles.formGroup}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.inputLabel}>Full Name</Text>
                      <Input
                        value={formData.name}
                        onChangeText={(text) => setFormData({ ...formData, name: text })}
                        placeholder="Your full name"
                        editable={editMode}
                        containerStyle={styles.compactInput}
                      />
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={styles.twoCol}>
                        <Text style={styles.inputLabel}>Gender</Text>
                        <Input
                          value={gender}
                          onChangeText={(text) => setGender(text as Gender)}
                          placeholder="Select"
                          editable={editMode}
                          containerStyle={styles.compactInput}
                        />
                      </View>
                      <View style={styles.twoCol}>
                        <Text style={styles.inputLabel}>Age</Text>
                        <Input
                          value={age}
                          onChangeText={setAge}
                          placeholder="Age"
                          editable={editMode}
                          keyboardType="number-pad"
                          containerStyle={styles.compactInput}
                        />
                      </View>
                    </View>

                    <View style={styles.twoColRow}>
                      <View style={styles.twoCol}>
                        <Text style={styles.inputLabel}>State</Text>
                        <Input
                          value={formData.state}
                          onChangeText={(text) => setFormData({ ...formData, state: text })}
                          placeholder="State"
                          editable={editMode}
                          containerStyle={styles.compactInput}
                        />
                      </View>
                      <View style={styles.twoCol}>
                        <Text style={styles.inputLabel}>LGA</Text>
                        <Input
                          value={lga}
                          onChangeText={setLga}
                          placeholder="LGA"
                          editable={editMode}
                          containerStyle={styles.compactInput}
                        />
                      </View>
                    </View>
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {/* Health Preferences */}
            <Animated.View entering={FadeInUp.delay(220).duration(450)}>
              <GlassCard style={styles.card}>
                <View style={styles.cardInner}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.iconContainer}>
                      <SettingsIcon size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>Health Preferences</Text>
                      <Text style={styles.cardSubtitle}>Notifications & privacy</Text>
                    </View>
                  </View>

                  <View style={styles.prefRow}>
                    <View style={styles.prefLeft}>
                      <BellIcon size={18} color={Colors.primary} />
                      <Text style={styles.prefLabel}>Health alerts</Text>
                    </View>
                    <Switch
                      value={prefHealthAlerts}
                      onValueChange={setPrefHealthAlerts}
                      trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
                      thumbColor={prefHealthAlerts ? Colors.primary : Colors.textMuted}
                    />
                  </View>

                  <View style={styles.prefRow}>
                    <View style={styles.prefLeft}>
                      <InfoCircleIcon size={18} color={Colors.primary} />
                      <Text style={styles.prefLabel}>Daily tips</Text>
                    </View>
                    <Switch
                      value={prefDailyTips}
                      onValueChange={setPrefDailyTips}
                      trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
                      thumbColor={prefDailyTips ? Colors.primary : Colors.textMuted}
                    />
                  </View>
                </View>
              </GlassCard>
            </Animated.View>

            {/* Medical Info */}
            <Animated.View entering={FadeInUp.delay(290).duration(450)}>
              <GlassCard style={styles.card}>
                <View style={styles.cardInner}>
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.iconContainer}>
                      <InfoCircleIcon size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.cardHeaderText}>
                      <Text style={styles.cardTitle}>Medical Info</Text>
                      <Text style={styles.cardSubtitle}>Conditions & allergies</Text>
                    </View>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Conditions</Text>
                    <View style={styles.kvPill}>
                      <Text style={styles.kvPillText}>None</Text>
                    </View>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>Allergies</Text>
                    <View style={styles.kvPill}>
                      <Text style={styles.kvPillText}>None</Text>
                    </View>
                  </View>

                  <Pressable onPress={() => {}} style={styles.editMedicalBtn}>
                    <Text style={styles.editMedicalText}>Edit Medical Info</Text>
                  </Pressable>
                </View>
              </GlassCard>
            </Animated.View>

            {/* Quick Links */}
            <Animated.View entering={FadeInUp.delay(360).duration(450)}>
              <View style={styles.quickLinks}>
                <Pressable onPress={() => navigation.navigate('Alerts')} style={styles.quickLinkBtn}>
                  <LinearGradient
                    colors={primaryColors}
                    start={Gradients.primary.start}
                    end={Gradients.primary.end}
                    style={styles.quickLinkGradient}
                  >
                    <View style={styles.quickLinkLeft}>
                      <View style={styles.quickLinkIconWrap}>
                        <BellIcon size={20} color={Colors.textLight} />
                      </View>
                      <Text style={styles.quickLinkText}>Alerts & Notifications</Text>
                    </View>
                    <Text style={styles.quickLinkArrow}>›</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={() => navigation.navigate('Settings')} style={styles.quickLinkBtn}>
                  <LinearGradient
                    colors={[Colors.emerald, Colors.cyan] as unknown as [string, string]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.quickLinkGradient}
                  >
                    <View style={styles.quickLinkLeft}>
                      <View style={styles.quickLinkIconWrap}>
                        <SettingsIcon size={20} color={Colors.textLight} />
                      </View>
                      <Text style={styles.quickLinkText}>Settings & Support</Text>
                    </View>
                    <Text style={styles.quickLinkArrow}>›</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>

            {/* Actions */}
            <Animated.View entering={FadeInUp.delay(430).duration(450)}>
              <View style={styles.actions}>
                <Pressable onPress={() => setEditMode(true)} style={styles.editProfileBtn}>
                  <Text style={styles.editProfileText}>Edit Profile</Text>
                </Pressable>
                <Pressable onPress={handleSignOut} style={styles.logoutBtn}>
                  <LogoutIcon size={18} color={Colors.danger} />
                  <Text style={styles.logoutText}>Log Out</Text>
                </Pressable>
              </View>
            </Animated.View>

            {editMode ? (
              <View style={styles.saveChangesWrap}>
                <Button title="Save Changes" onPress={handleSaveProfile} loading={loading} />
              </View>
            ) : null}
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
    paddingBottom: Spacing.xl,
  },
  hero: {
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    overflow: 'hidden',
    paddingBottom: Spacing.xl,
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    opacity: 0.92,
  },
  floatingShape1: {
    position: 'absolute',
    top: 16,
    right: -24,
  },
  floatingShape2: {
    position: 'absolute',
    top: 64,
    left: 32,
  },
  floatingShape3: {
    position: 'absolute',
    bottom: 80,
    right: 48,
  },
  heroTopRow: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroIconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: Colors.whiteAlpha10,
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textLight,
  },
  signOutPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha40,
    backgroundColor: Colors.whiteAlpha10,
  },
  signOutText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  heroProfile: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.md,
  },
  avatarPulse: {
    position: 'absolute',
    top: -6,
    left: -6,
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: Colors.whiteAlpha50,
  },
  avatarRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: Colors.whiteAlpha20,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textLight,
    marginBottom: 2,
  },
  userSub: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha80,
  },
  main: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
    marginTop: -Spacing.base,
    gap: Spacing.base,
  },
  card: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  cardInner: {
    padding: Spacing.base,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  cardSubtitle: {
    marginTop: 2,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  formGroup: {
    gap: Spacing.sm,
  },
  fieldGroup: {
    gap: Spacing.xs,
  },
  inputLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginLeft: 2,
  },
  compactInput: {
    height: 44,
    borderRadius: BorderRadius.xl,
  },
  twoColRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  twoCol: {
    flex: 1,
  },
  prefRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.gradientFromLight,
    marginTop: Spacing.sm,
  },
  prefLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  prefLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  kvRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.gradientFromLight,
    marginTop: Spacing.sm,
  },
  kvLabel: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  kvPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    backgroundColor: Colors.whiteAlpha90,
  },
  kvPillText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textPrimary,
  },
  editMedicalBtn: {
    marginTop: Spacing.base,
    width: '100%',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editMedicalText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  quickLinks: {
    gap: Spacing.sm,
  },
  quickLinkBtn: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  quickLinkGradient: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  quickLinkLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  quickLinkIconWrap: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.whiteAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLinkText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  quickLinkArrow: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.textLight,
  },
  actions: {
    gap: Spacing.sm,
    paddingBottom: Spacing.base,
  },
  editProfileBtn: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  logoutBtn: {
    borderWidth: 2,
    borderColor: Colors.danger,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  logoutText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.danger,
  },
  saveChangesWrap: {
    marginTop: Spacing.sm,
  },
});

export default ProfileScreen;
