/**
 * ProfileScreen
 * UI parity pass aligned to profile.html (hero header + stacked cards)
 * Keeps existing auth/profile logic unchanged.
 * 
 * GUEST GATED: Guests see sign-in required blocker.
 * 
 * ANDROID FIXES:
 * - Uses flexGrow for proper scrollable content
 * - Dynamic bottom padding for tab bar avoidance
 * - Removed fixed heights
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Image,
  ImageBackground,
  Modal,
  Platform,
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
import * as ImagePicker from 'expo-image-picker';

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
  FeatureBlockedScreen,
  ScreenLoader,
  Icon,
  useFeedback,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '../hooks/useUser';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../hooks/useTheme';
import { useAuthGate } from '../hooks/useAuthGate';
import { useLocationContext } from '../hooks/LocationContext';
import { useI18n } from '../i18n';
import { toUserMessage } from '../services/errorMessages';
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
  const { user, loading, refresh, updateProfile, updateAvatar } = useUser();
  const { alertArea, setManualAlertState } = useLocationContext();
  const { t } = useI18n();
  const { isDark, colors } = useTheme();
  const { isGuest } = useAuthGate();
  const { confirm, notify, toast } = useFeedback();
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreviewOpen, setAvatarPreviewOpen] = useState(false);
  const [avatarSourceOpen, setAvatarSourceOpen] = useState(false);

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
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Notification preferences (persisted via notification_preferences)
  const {
    reminderEnabled,
    communityAlertsEnabled,
    setReminderEnabled,
    setCommunityAlertsEnabled,
    saving: notifSaving,
  } = useNotifications();

  // Medical info (persisted to profiles.conditions/allergies/medications)
  const [medicalModalOpen, setMedicalModalOpen] = useState(false);
  const [conditions, setConditions] = useState<string[]>([]);
  const [allergies, setAllergies] = useState<string[]>([]);
  const [medications, setMedications] = useState<string[]>([]);
  const [conditionInput, setConditionInput] = useState('');
  const [allergyInput, setAllergyInput] = useState('');
  const [medicationInput, setMedicationInput] = useState('');

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
    setGender((user.gender as Gender) || '');
    setAge(user.age != null ? String(user.age) : '');
    setLga(user.lga || '');
    setHeight(user.heightCm != null ? String(user.heightCm) : '');
    setWeight(user.weightKg != null ? String(user.weightKg) : '');
    setConditions(user.conditions || []);
    setAllergies(user.allergies || []);
    setMedications(user.medications || []);
  }, [user]);

  const addEntry = useCallback(
    (list: string[], setList: (v: string[]) => void, value: string, clearInput: () => void) => {
      const v = value.trim();
      if (!v) return;
      if (!list.some((x) => x.toLowerCase() === v.toLowerCase())) setList([...list, v]);
      clearInput();
    },
    []
  );

  const removeEntry = useCallback(
    (list: string[], setList: (v: string[]) => void, value: string) => {
      setList(list.filter((x) => x !== value));
    },
    []
  );

  const handleSaveMedical = useCallback(async () => {
    try {
      await updateProfile({ conditions, allergies, medications });
      setMedicalModalOpen(false);
      toast({ tone: 'success', title: 'Medical info saved', message: 'Your changes have been saved.' });
    } catch (e) {
      await notify({ tone: 'danger', title: 'Save failed', message: toUserMessage(e, 'profile') });
    }
  }, [conditions, allergies, medications, updateProfile, toast, notify]);

  const handleCancelMedical = useCallback(() => {
    // Revert local edits to the saved profile values.
    setConditions(user?.conditions || []);
    setAllergies(user?.allergies || []);
    setMedications(user?.medications || []);
    setConditionInput('');
    setAllergyInput('');
    setMedicationInput('');
    setMedicalModalOpen(false);
  }, [user]);

  const renderMedSection = (
    label: string,
    list: string[],
    setList: (v: string[]) => void,
    input: string,
    setInput: (v: string) => void,
    placeholder: string
  ) => (
    <View style={styles.medSection}>
      <Text style={styles.medSectionLabel}>{label}</Text>
      <View style={styles.medChipWrap}>
        {list.length === 0 ? (
          <Text style={styles.medEmptyText}>{t('none')}</Text>
        ) : (
          list.map((entry) => (
            <Pressable
              key={entry}
              onPress={() => removeEntry(list, setList, entry)}
              style={[styles.medChip, { borderColor: colors.border }]}
              hitSlop={6}
            >
              <Text style={[styles.medChipText, { color: colors.text }]}>{entry}</Text>
              <Icon name="close" size={14} color={colors.textSecondary} />
            </Pressable>
          ))
        )}
      </View>
      <View style={styles.medAddRow}>
        <Input
          value={input}
          onChangeText={setInput}
          placeholder={placeholder}
          containerStyle={styles.medAddInput}
          onSubmitEditing={() => addEntry(list, setList, input, () => setInput(''))}
          returnKeyType="done"
        />
        <Pressable
          onPress={() => addEntry(list, setList, input, () => setInput(''))}
          style={[styles.medAddBtn, { backgroundColor: colors.primary }]}
          hitSlop={6}
        >
          <Icon name="plus" size={20} color={Colors.textLight} />
        </Pressable>
      </View>
    </View>
  );

  const handleOpenSettings = useCallback(() => {
    const parent: any = (navigation as any).getParent?.();
    if (parent?.navigate) {
      parent.navigate('Settings');
      return;
    }
    (navigation as any).navigate('Settings');
  }, [navigation]);

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
    () => isDark
      ? [colors.gradientFrom, colors.gradientVia, colors.gradientTo] as unknown as [string, string, string]
      : Gradients.background.colors as unknown as [string, string, string],
    [isDark, colors]
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

  const handleSignOut = async () => {
    const accepted = await confirm({
      tone: 'danger',
      title: 'Sign out?',
      message: 'You will need to sign in again to access your personal health information.',
      confirmLabel: 'Sign out',
    });
    if (!accepted) return;

    try {
      await signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'SignIn' }],
      });
    } catch (e) {
      await notify({ tone: 'danger', title: 'Sign out failed', message: toUserMessage(e, 'auth') });
    }
  };

  const handleSaveProfile = async () => {
    try {
      const ageNum = age ? Number(age) : null;
      const heightNum = height ? Number(height) : null;
      const weightNum = weight ? Number(weight) : null;
      const { state: manualState, ...profileData } = formData;
      await updateProfile({
        ...profileData,
        lga: lga.trim() || null,
        gender: gender || null,
        age: Number.isFinite(ageNum) ? ageNum : null,
        heightCm: heightNum && Number.isFinite(heightNum) ? heightNum : null,
        weightKg: weightNum && Number.isFinite(weightNum) ? weightNum : null,
      });
      if (!(await setManualAlertState(manualState))) throw new Error('Unable to save your home state.');
      setEditMode(false);
      toast({ tone: 'success', title: 'Profile updated', message: 'Your changes have been saved.' });
    } catch (e) {
      await notify({ tone: 'danger', title: 'Profile update failed', message: toUserMessage(e, 'profile') });
    }
  };

  const handleAvatarSelection = useCallback(async (source: 'camera' | 'library') => {
      setAvatarSourceOpen(false);
      try {
        let result: ImagePicker.ImagePickerResult;

        if (source === 'camera') {
          // Take photo
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            await notify({
              tone: 'warning',
              title: 'Camera permission needed',
              message: 'Allow camera access in your device settings to take a profile photo.',
            });
            return;
          }
          result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
        } else {
          // Choose from library
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            await notify({
              tone: 'warning',
              title: 'Photo access needed',
              message: 'Allow photo access in your device settings to choose a profile picture.',
            });
            return;
          }
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
        }

        if (!result.canceled && result.assets && result.assets.length > 0) {
          const uri = result.assets[0].uri;
          setAvatarUploading(true);
          try {
            await updateAvatar(uri);
            toast({ tone: 'success', title: 'Photo updated', message: 'Your profile picture has been saved.' });
          } catch (err) {
            console.error('Avatar upload failed:', err);
            await notify({ tone: 'danger', title: 'Upload failed', message: toUserMessage(err, 'upload') });
          } finally {
            setAvatarUploading(false);
          }
        }
      } catch (err) {
        console.error('Image picker error:', err);
        await notify({ tone: 'danger', title: 'Photo picker unavailable', message: toUserMessage(err, 'upload') });
      }
  }, [notify, toast, updateAvatar]);

  const handleAvatarPress = useCallback(() => setAvatarSourceOpen(true), []);

  // Guest users see sign-in required blocker after all hooks are registered.
  if (isGuest) {
    return (
      <FeatureBlockedScreen
        title={t('profile')}
        description="Sign in to manage your profile, upload an avatar, and personalize your health experience."
        icon="generic"
        buttonText="Go Back"
        showHomeButton={true}
      />
    );
  }

  // While the profile is loading for the first time, show a loading screen
  // rather than rendering the hero with placeholder/stale details. Once `user`
  // is populated, subsequent saves (which also toggle `loading`) keep the UI.
  if (loading && !user) {
    return (
      <LinearGradient
        colors={gradientBgColors}
        start={Gradients.background.start}
        end={Gradients.background.end}
        style={styles.container}
      >
        <ScreenLoader label="Loading your profile…" />
      </LinearGradient>
    );
  }

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
          contentContainerStyle={[
            styles.scrollContent, 
            { 
              // ANDROID FIX: Dynamic bottom padding for tab bar and safe area
              paddingBottom: Math.max(insets.bottom, 12) + 120,
              // ANDROID FIX: flexGrow ensures proper scrolling on short screens
              flexGrow: 1,
            }
          ]}
          showsVerticalScrollIndicator={false}
          // ANDROID FIX: Improve scroll performance
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.primary} />}
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(400)} style={[styles.profHeader, { paddingTop: insets.top + Spacing.sm }]}>
            <View style={styles.profTopRow}>
              <Pressable onPress={handleBack} style={[styles.profIconBtn, { backgroundColor: colors.surface, borderColor: colors.border }]} hitSlop={10}>
                <Icon name="chevron-left" size={22} color={colors.text} />
              </Pressable>
              <Text style={[styles.profHeaderTitle, { color: colors.text }]}>{t('my_profile')}</Text>
              <Pressable onPress={handleSignOut} style={[styles.profSignOut, { borderColor: colors.border, backgroundColor: colors.surface }]} hitSlop={10}>
                <Text style={[styles.profSignOutText, { color: colors.danger }]}>{t('sign_out')}</Text>
              </Pressable>
            </View>

            <View style={styles.profIdentity}>
              <View style={styles.avatarContainer}>
                <Pressable
                  onPress={() => setAvatarPreviewOpen(true)}
                  disabled={!user?.avatarUrl}
                  style={[styles.profAvatarRing, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  hitSlop={10}
                >
                  <Avatar source={user?.avatarUrl} size={92} />
                </Pressable>
                <Pressable
                  onPress={handleAvatarPress}
                  style={[styles.profAvatarEditBtn, { backgroundColor: colors.primary, borderColor: colors.surface }, avatarUploading && styles.avatarEditBtnDisabled]}
                  hitSlop={10}
                  disabled={avatarUploading}
                >
                  <Icon name="camera" size={16} color={Colors.textLight} />
                </Pressable>
              </View>
              <Text style={[styles.profName, { color: colors.text }]}>{user?.name || 'Loading…'}</Text>
              <Text style={[styles.profEmail, { color: colors.textSecondary }]}>{user?.email || ''}</Text>
            </View>
          </Animated.View>

          <Modal
            visible={avatarPreviewOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setAvatarPreviewOpen(false)}
          >
            <Pressable style={styles.avatarModalBackdrop} onPress={() => setAvatarPreviewOpen(false)}>
              <Pressable style={styles.avatarModalCard} onPress={(e) => e.stopPropagation()}>
                <Image
                  source={{ uri: user?.avatarUrl || undefined }}
                  style={styles.avatarModalImage}
                />
                <Pressable onPress={() => setAvatarPreviewOpen(false)} style={styles.avatarModalClose} hitSlop={10}>
                  <Text style={styles.avatarModalCloseText}>×</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal
            visible={avatarSourceOpen}
            transparent
            statusBarTranslucent
            animationType="fade"
            onRequestClose={() => setAvatarSourceOpen(false)}
          >
            <Pressable style={styles.avatarSourceBackdrop} onPress={() => setAvatarSourceOpen(false)}>
              <Pressable
                accessibilityViewIsModal
                style={[
                  styles.avatarSourceCard,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    paddingBottom: insets.bottom + Spacing.xl,
                  },
                ]}
                onPress={(event) => event.stopPropagation()}
              >
                <Text style={[styles.avatarSourceTitle, { color: colors.text }]}>Change profile picture</Text>
                <Text style={[styles.avatarSourceMessage, { color: colors.textSecondary }]}>Choose where your new photo should come from.</Text>
                <Pressable
                  onPress={() => void handleAvatarSelection('camera')}
                  style={[styles.avatarSourceOption, { borderColor: colors.border }]}
                >
                  <Icon name="camera" size={22} color={colors.primary} />
                  <Text style={[styles.avatarSourceOptionText, { color: colors.text }]}>Take a photo</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleAvatarSelection('library')}
                  style={[styles.avatarSourceOption, { borderColor: colors.border }]}
                >
                  <Icon name="image" size={22} color={colors.primary} />
                  <Text style={[styles.avatarSourceOptionText, { color: colors.text }]}>Choose from photos</Text>
                </Pressable>
                <Pressable onPress={() => setAvatarSourceOpen(false)} style={styles.avatarSourceCancel}>
                  <Text style={[styles.avatarSourceCancelText, { color: colors.textSecondary }]}>Cancel</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          <Modal
            visible={medicalModalOpen}
            transparent
            statusBarTranslucent
            animationType="slide"
            onRequestClose={handleCancelMedical}
          >
            <Pressable style={styles.avatarSourceBackdrop} onPress={handleCancelMedical}>
              <Pressable
                accessibilityViewIsModal
                style={[
                  styles.medModalCard,
                  {
                    backgroundColor: colors.surfaceElevated,
                    borderColor: colors.border,
                    paddingBottom: insets.bottom + Spacing.xl,
                  },
                ]}
                onPress={(event) => event.stopPropagation()}
              >
                <Text style={[styles.avatarSourceTitle, { color: colors.text }]}>{t('medical_info')}</Text>
                <Text style={[styles.avatarSourceMessage, { color: colors.textSecondary }]}>
                  This helps the assistant give safer, more relevant guidance. It is private to you.
                </Text>
                <ScrollView style={styles.medModalScroll} keyboardShouldPersistTaps="handled">
                  {renderMedSection(t('conditions'), conditions, setConditions, conditionInput, setConditionInput, 'e.g. Asthma')}
                  {renderMedSection(t('allergies'), allergies, setAllergies, allergyInput, setAllergyInput, 'e.g. Penicillin')}
                  {renderMedSection(t('medications'), medications, setMedications, medicationInput, setMedicationInput, 'e.g. Ventolin')}
                </ScrollView>
                <View style={styles.medModalActions}>
                  <Pressable onPress={handleCancelMedical} style={styles.medCancelBtn}>
                    <Text style={[styles.medCancelText, { color: colors.textSecondary }]}>{t('cancel') || 'Cancel'}</Text>
                  </Pressable>
                  <View style={styles.medSaveBtnWrap}>
                    <Button title={t('save_changes')} onPress={handleSaveMedical} loading={loading} />
                  </View>
                </View>
              </Pressable>
            </Pressable>
          </Modal>

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
                      <Text style={styles.cardTitle}>{t('personal_details')}</Text>
                      <Text style={styles.cardSubtitle}>{t('keep_details_updated')}</Text>
                    </View>
                    {!editMode && (
                      <Pressable
                        onPress={() => setEditMode(true)}
                        style={styles.editPill}
                        accessibilityRole="button"
                        accessibilityLabel={t('edit_profile')}
                        hitSlop={8}
                      >
                        <Icon name="pencil" size={13} color={Colors.primary} />
                        <Text style={styles.editPillText}>{t('edit')}</Text>
                      </Pressable>
                    )}
                  </View>

                  <View style={styles.formGroup}>
                    <View style={styles.fieldGroup}>
                      <Text style={styles.inputLabel}>{t('full_name')}</Text>
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
                        <Text style={styles.inputLabel}>{t('gender')}</Text>
                        <Input
                          value={gender}
                          onChangeText={(text) => setGender(text as Gender)}
                          placeholder="Select"
                          editable={editMode}
                          containerStyle={styles.compactInput}
                        />
                      </View>
                      <View style={styles.twoCol}>
                        <Text style={styles.inputLabel}>{t('age')}</Text>
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
                        <Text style={styles.inputLabel}>Home state (used when sharing is off)</Text>
                        <Input
                          value={formData.state}
                          onChangeText={(text) => setFormData({ ...formData, state: text })}
                          placeholder="Home state"
                          editable={editMode}
                          containerStyle={styles.compactInput}
                        />
                      </View>
                      <View style={styles.twoCol}>
                        <Text style={styles.inputLabel}>{t('lga')}</Text>
                        <Input
                          value={lga}
                          onChangeText={setLga}
                          placeholder="LGA"
                          editable={editMode}
                          containerStyle={styles.compactInput}
                        />
                      </View>
                    </View>
                    {alertArea ? <Text style={styles.cardSubtitle}>Current alert area: {alertArea.state}{alertArea.source === 'gps' ? ' (GPS verified)' : ' (home state)'}</Text> : null}

                    <View style={styles.twoColRow}>
                      <View style={styles.twoCol}>
                        <Text style={styles.inputLabel}>{t('height_cm')}</Text>
                        <Input
                          value={height}
                          onChangeText={setHeight}
                          placeholder="cm"
                          editable={editMode}
                          keyboardType="number-pad"
                          containerStyle={styles.compactInput}
                        />
                      </View>
                      <View style={styles.twoCol}>
                        <Text style={styles.inputLabel}>{t('weight_kg')}</Text>
                        <Input
                          value={weight}
                          onChangeText={setWeight}
                          placeholder="kg"
                          editable={editMode}
                          keyboardType="number-pad"
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
                      <Text style={styles.cardTitle}>{t('health_preferences')}</Text>
                      <Text style={styles.cardSubtitle}>{t('notifications_privacy')}</Text>
                    </View>
                  </View>

                  <View style={styles.prefRow}>
                    <View style={styles.prefLeft}>
                      <BellIcon size={18} color={Colors.primary} />
                      <Text style={styles.prefLabel}>{t('health_alerts')}</Text>
                    </View>
                    <Switch
                      value={communityAlertsEnabled}
                      onValueChange={(v) => void setCommunityAlertsEnabled(v)}
                      disabled={notifSaving}
                      trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
                      thumbColor={communityAlertsEnabled ? Colors.primary : Colors.textMuted}
                    />
                  </View>

                  <View style={styles.prefRow}>
                    <View style={styles.prefLeft}>
                      <InfoCircleIcon size={18} color={Colors.primary} />
                      <Text style={styles.prefLabel}>{t('daily_tips')}</Text>
                    </View>
                    <Switch
                      value={reminderEnabled}
                      onValueChange={(v) => void setReminderEnabled(v)}
                      disabled={notifSaving}
                      trackColor={{ false: Colors.borderLight, true: Colors.primaryLight }}
                      thumbColor={reminderEnabled ? Colors.primary : Colors.textMuted}
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
                      <Text style={styles.cardTitle}>{t('medical_info')}</Text>
                      <Text style={styles.cardSubtitle}>{t('conditions')} & {t('allergies')}</Text>
                    </View>
                  </View>

                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>{t('conditions')}</Text>
                    <View style={styles.kvValueWrap}>
                      {conditions.length === 0 ? (
                        <View style={styles.kvPill}><Text style={styles.kvPillText}>{t('none')}</Text></View>
                      ) : (
                        conditions.map((c) => (
                          <View key={c} style={styles.kvPill}><Text style={styles.kvPillText}>{c}</Text></View>
                        ))
                      )}
                    </View>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>{t('allergies')}</Text>
                    <View style={styles.kvValueWrap}>
                      {allergies.length === 0 ? (
                        <View style={styles.kvPill}><Text style={styles.kvPillText}>{t('none')}</Text></View>
                      ) : (
                        allergies.map((a) => (
                          <View key={a} style={styles.kvPill}><Text style={styles.kvPillText}>{a}</Text></View>
                        ))
                      )}
                    </View>
                  </View>
                  <View style={styles.kvRow}>
                    <Text style={styles.kvLabel}>{t('medications')}</Text>
                    <View style={styles.kvValueWrap}>
                      {medications.length === 0 ? (
                        <View style={styles.kvPill}><Text style={styles.kvPillText}>{t('none')}</Text></View>
                      ) : (
                        medications.map((m) => (
                          <View key={m} style={styles.kvPill}><Text style={styles.kvPillText}>{m}</Text></View>
                        ))
                      )}
                    </View>
                  </View>

                  <Pressable onPress={() => setMedicalModalOpen(true)} style={styles.editMedicalBtn}>
                    <Text style={styles.editMedicalText}>{t('edit_medical_info')}</Text>
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
                      <Text style={styles.quickLinkText}>{t('alerts_notifications')}</Text>
                    </View>
                    <Text style={styles.quickLinkArrow}>›</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable onPress={handleOpenSettings} style={styles.quickLinkBtn}>
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
                      <Text style={styles.quickLinkText}>{t('settings_support')}</Text>
                    </View>
                    <Text style={styles.quickLinkArrow}>›</Text>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>

            {/* Actions */}
            <Animated.View entering={FadeInUp.delay(430).duration(450)}>
              <View style={styles.actions}>
                <Pressable onPress={handleSignOut} style={styles.logoutBtn}>
                  <LogoutIcon size={18} color={Colors.danger} />
                  <Text style={styles.logoutText}>{t('log_out')}</Text>
                </Pressable>
              </View>
            </Animated.View>

            {editMode ? (
              <View style={styles.saveChangesWrap}>
                <Button title={t('save_changes')} onPress={handleSaveProfile} loading={loading} />
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
  profHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
  },
  profTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  profHeaderTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
  },
  profSignOut: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: BorderRadius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  profSignOutText: { fontFamily: FontFamily.semibold, fontSize: FontSize.xs },
  profIdentity: { alignItems: 'center', gap: 4 },
  profAvatarRing: {
    width: 104,
    height: 104,
    borderRadius: 32,
    padding: 5,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  profAvatarEditBtn: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  profName: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize['2xl'],
    letterSpacing: -0.3,
    marginTop: Spacing.md,
  },
  profEmail: { fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  hero: {
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    overflow: 'hidden',
    paddingBottom: Spacing['2xl'],
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
    borderRadius: 34,
    backgroundColor: 'rgba(255,255,255,0.18)',
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha30,
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
  avatarEditBtnDisabled: {
    opacity: 0.5,
  },
  avatarModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
  },
  avatarModalCard: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 1,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.surfaceLight,
    overflow: 'hidden',
  },
  avatarModalImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
    backgroundColor: Colors.surfaceLight,
  },
  avatarModalClose: {
    position: 'absolute',
    top: Spacing.sm,
    right: Spacing.sm,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.whiteAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarModalCloseText: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    color: Colors.textLight,
    lineHeight: 28,
    marginTop: -2,
  },
  avatarSourceBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,15,20,0.64)',
    justifyContent: 'flex-end',
  },
  avatarSourceCard: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing['2xl'],
  },
  avatarSourceTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    marginBottom: Spacing.xs,
  },
  avatarSourceMessage: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  avatarSourceOption: {
    minHeight: 54,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginBottom: Spacing.sm,
  },
  avatarSourceOptionText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  avatarSourceCancel: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  avatarSourceCancelText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
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
    borderRadius: 24,
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
  kvValueWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 6,
    marginLeft: Spacing.sm,
  },
  medSection: {
    marginBottom: Spacing.lg,
  },
  medSectionLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  medChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: Spacing.sm,
  },
  medEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  medChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  medChipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  medAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  medAddInput: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.xl,
  },
  medAddBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medModalCard: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    maxHeight: '85%',
  },
  medModalScroll: {
    marginTop: Spacing.md,
  },
  medModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  medCancelBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.base,
  },
  medCancelText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  medSaveBtnWrap: {
    flex: 1,
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
    borderRadius: 22,
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
  editPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: 'rgba(17,180,212,0.08)',
  },
  editPillText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    color: Colors.primary,
  },
  logoutBtn: {
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: 18,
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
