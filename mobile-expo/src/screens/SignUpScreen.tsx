/**
 * SignUpScreen
 * Step 1 of 2 - Profile creation with optional location verification
 * Modern glassmorphism design with hero image
 * 
 * ANDROID FIXES:
 * - Proper KeyboardAvoidingView behavior for Android
 * - ScrollView with flexGrow for proper content sizing
 * - keyboardShouldPersistTaps for better input handling
 * - Removed Dimensions.get usage for responsive layouts
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  KeyboardAvoidingView,
  Platform,
  ImageBackground,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import {
  Button,
  Input,
  ArrowBackIcon,
  PersonIcon,
  EmailIcon,
  LockIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  LocationIcon,
  ShieldIcon,
  PasswordStrengthIndicator,
  ErrorBanner,
  useFeedback,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  Gradients,
} from '../../theme';
import { invokeEdgeFunction } from '../services/edge';
import { toUserMessage } from '../services/errorMessages';

// ANDROID FIX: Removed Dimensions.get('window') which can cause layout issues
// Using percentage-based height instead for hero section

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

const HERO_IMAGE = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80';

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe',
  'Zamfara', 'Federal Capital Territory'
];

// Normalize state names for comparison
function normalizeStateName(s: string): string {
  return s.toLowerCase()
    .replace(/\s*(state)?\s*$/i, '')
    .replace(/federal capital territory/i, 'fct')
    .replace(/abuja/i, 'fct')
    .trim();
}

// Check if two state names match (with tolerance for variations)
function statesMatch(detected: string, selected: string): boolean {
  const normDetected = normalizeStateName(detected);
  const normSelected = normalizeStateName(selected);
  
  // Direct match
  if (normDetected === normSelected) return true;
  
  // Partial match (one contains the other)
  if (normDetected.includes(normSelected) || normSelected.includes(normDetected)) return true;
  
  // FCT special case
  if ((normDetected === 'fct' || normDetected.includes('abuja')) && 
      (normSelected === 'fct' || normSelected.includes('federal capital'))) return true;
  
  return false;
}

interface VerifiedLocation {
  latitude: number;
  longitude: number;
  detectedState: string;
  address: string;
  verified: boolean;
}

const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { signUp, loading } = useAuth();
  const { t } = useI18n();
  const { isDark, colors } = useTheme();
  const { notify } = useFeedback();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [state, setState] = useState('');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [isPasswordStrong, setIsPasswordStrong] = useState(false);

  // Optional and off until the user explicitly chooses it. Otherwise the
  // post-sign-in primer explains location before the OS prompt.
  const [useLocation, setUseLocation] = useState(false);
  
  // Location verification state (optional)
  const [locationVerifying, setLocationVerifying] = useState(false);
  const [verifiedLocation, setVerifiedLocation] = useState<VerifiedLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const genderOptions = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
  ];

  // Verify location when enabled
  useEffect(() => {
    if (useLocation) {
      verifyLocation();
    } else {
      setVerifiedLocation(null);
      setLocationError(null);
      setPermissionDenied(false);
    }
  }, [useLocation]);

  // Core location verification function
  const verifyLocation = async () => {
    setLocationVerifying(true);
    setLocationError(null);
    setPermissionDenied(false);

    try {
      // Step 1: Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setPermissionDenied(true);
        setLocationError('Location access was not enabled. Turn off this option to continue with your saved home state, or try again.');
        setLocationVerifying(false);
        return;
      }

      // Step 2: Get current GPS coordinates
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const { latitude, longitude } = position.coords;

      // Step 3: Reverse geocode server-side (production-safe)
      const { data: verified, error: verifyErr } = await invokeEdgeFunction<{
        detectedState: string;
        address: string | null;
      }>('verify-location', { latitude, longitude });

      if (verifyErr || !verified) {
        throw new Error(toUserMessage(verifyErr || 'Could not determine your location', 'location'));
      }

      const detectedState = verified.detectedState || '';
      const address = verified.address || '';

      // Step 4: Auto-select state based on GPS
      const matchedState = NIGERIAN_STATES.find(s => statesMatch(detectedState, s));
      
      if (matchedState) {
        setState(matchedState);
      }

      setVerifiedLocation({
        latitude,
        longitude,
        detectedState,
        address,
        verified: true,
      });

    } catch (err) {
      console.error('Location verification failed:', err);
      setLocationError(toUserMessage(err, 'location'));
    } finally {
      setLocationVerifying(false);
    }
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Welcome');
    }
  };

  const handleContinue = async () => {
    setError(null);

    // If the user opted into location, require verification.
    if (useLocation) {
      if (permissionDenied) {
        const msg =
          'Location permission was denied. Enable it in settings, or turn off “Use my location” to continue.';
        setError(msg);
        return;
      }

      if (!verifiedLocation?.verified) {
        const msg = 'Location verification failed. Tap Retry, or turn off “Use my location” to continue.';
        setError(msg);
        return;
      }
    }

    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }
    if (!password) {
      setError('Please enter a password');
      return;
    }
    if (password.length < 10) {
      setError('Use at least 10 characters for your password');
      return;
    }
    if (!confirmPassword) {
      setError('Please confirm your password');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!isPasswordStrong) {
      setError('Please choose a stronger password');
      return;
    }

    if (!gender) {
      setError('Please select your gender');
      return;
    }

    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum <= 0) {
      setError('Please enter a valid age');
      return;
    }

    if (!state) {
      setError('Please select your state');
      return;
    }

    // If using location, validate selected state matches detected state.
    if (useLocation && verifiedLocation?.detectedState && !statesMatch(verifiedLocation.detectedState, state)) {
      setError(`Your GPS shows you're in ${verifiedLocation.detectedState}, but you selected ${state}. Please select your actual location or re-verify your location.`);
      return;
    }

    const result = await signUp({
      name: fullName,
      email,
      password,
      gender,
      age: ageNum,
      state,
      useLocation,
      latitude: useLocation ? verifiedLocation?.latitude : undefined,
      longitude: useLocation ? verifiedLocation?.longitude : undefined,
    });

    if (result.outcome === 'confirmation_required') {
      await notify({
        tone: 'success',
        title: 'Check your email',
        message: 'If this address can be registered, we sent a confirmation link. Open it on this device, then sign in.',
        actionLabel: 'Go to sign in',
      });
      navigation.navigate('SignIn');
      return;
    }

    if (result.error) {
      const msg = toUserMessage(result.error, 'signup');
      setError(msg);
      return;
    }

    if (result.nextRoute === 'SignUp2') {
      navigation.navigate('SignUp2');
    } else {
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    }
  };

  return (
    <View style={styles.container}>
      {/* Hero — branded gradient (no stock photo) */}
      <View style={styles.heroBg}>
        <LinearGradient
          colors={isDark
            ? ['#0E2A33', '#0A0F13'] as unknown as [string, string]
            : ['#0B7C8C', '#086876'] as unknown as [string, string]
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
          <Pressable onPress={handleBack} style={styles.backButton} hitSlop={10}>
            <BlurView intensity={40} tint={isDark ? 'dark' : 'light'} style={styles.backButtonBlur}>
              <ArrowBackIcon size={20} color={Colors.textLight} />
            </BlurView>
          </Pressable>

          {/* Progress indicator */}
          <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.progressContainer}>
            <View style={styles.progressBars}>
              <View style={[styles.progressBarActive, { backgroundColor: Colors.textLight }]} />
              <View style={[styles.progressBarInactive, { backgroundColor: 'rgba(255,255,255,0.3)' }]} />
            </View>
            <Text style={styles.stepText}>{t('step_1_of_2')}</Text>
          </Animated.View>
        </View>

        {/* Hero Content */}
        <Animated.View entering={FadeInUp.delay(200).duration(500)} style={styles.heroContent}>
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
              style={styles.logoGradient}
            >
              <ShieldIcon size={32} color={Colors.textLight} />
            </LinearGradient>
          </View>
          <Text style={styles.heroTitle}>{t('create_profile_title')}</Text>
          <Text style={styles.heroSubtitle}>{t('create_profile_subtitle')}</Text>
        </Animated.View>
      </View>

      {/* Form Card */}
      {/* ANDROID FIX: Use behavior="height" on Android with proper offset */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formWrapper}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -100 : 20}
      >
        <Animated.View 
          entering={FadeInUp.delay(300).duration(500)} 
          style={[styles.formCard, { backgroundColor: isDark ? colors.surface : Colors.surfaceLight }]}
        >
          <ScrollView
            // ANDROID FIX: flexGrow ensures proper scrolling on short screens
            contentContainerStyle={[
              styles.formContent,
              { flexGrow: 1, paddingBottom: insets.bottom + 112 },
            ]}
            // ANDROID FIX: Prevents keyboard dismissal when tapping inputs
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Personal Info Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Personal Information</Text>
              
              <View style={styles.inputGroup}>
                <Input
                  placeholder={t('full_name')}
                  value={fullName}
                  onChangeText={setFullName}
                  icon={<PersonIcon size={20} color={colors.primary} />}
                />

                <Input
                  placeholder={t('email_address')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                  icon={<EmailIcon size={20} color={colors.primary} />}
                />
              </View>
            </View>

            {/* Security Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Security</Text>
              
              <View style={styles.inputGroup}>
                <Input
                  placeholder={t('create_password')}
                  secureTextEntry
                  enablePasswordToggle
                  value={password}
                  onChangeText={setPassword}
                  icon={<LockIcon size={20} color={colors.primary} />}
                />

                <PasswordStrengthIndicator
                  password={password}
                  userInputs={[fullName, email]}
                  minScore={2}
                  onScoreChange={(score, isValid) => setIsPasswordStrong(isValid)}
                />

                <Input
                  placeholder={t('confirm_password')}
                  secureTextEntry
                  enablePasswordToggle
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  icon={<LockIcon size={20} color={colors.primary} />}
                />
              </View>
            </View>

            {/* Demographics Section */}
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Demographics</Text>
              
              <View style={styles.inputGroup}>
                {/* Gender and Age Row */}
                <View style={styles.row}>
                  <View style={styles.halfInput}>
                    <Pressable
                      style={[styles.selectContainer, { 
                        backgroundColor: isDark ? colors.glass : Colors.whiteAlpha90,
                        borderColor: isDark ? colors.border : Colors.borderLight 
                      }]}
                      onPress={() => setShowGenderPicker(true)}
                    >
                      <Ionicons name="male-female-outline" size={20} color={colors.primary} />
                      <Text style={[styles.selectText, { color: colors.text }, !gender && { color: colors.textMuted }]}>
                        {gender ? genderOptions.find(g => g.value === gender)?.label : t('gender')}
                      </Text>
                      <ChevronDownIcon size={18} color={colors.textMuted} />
                    </Pressable>
                  </View>

                  <View style={styles.halfInput}>
                    <Input
                      placeholder={t('age')}
                      keyboardType="numeric"
                      value={age}
                      onChangeText={setAge}
                      icon={<Ionicons name="calendar-outline" size={20} color={colors.primary} />}
                    />
                  </View>
                </View>

                {/* State Picker */}
                <Pressable
                  style={[styles.selectContainer, { 
                    backgroundColor: isDark ? colors.glass : Colors.whiteAlpha90,
                    borderColor: isDark ? colors.border : Colors.borderLight 
                  }]}
                  onPress={() => setShowStatePicker(true)}
                >
                  <Ionicons name="location-outline" size={20} color={colors.primary} />
                  <Text style={[styles.selectText, { color: colors.text }, !state && { color: colors.textMuted }]}>
                    {state || t('state')}
                  </Text>
                  <ChevronDownIcon size={18} color={colors.textMuted} />
                </Pressable>
              </View>
            </View>

            {/* Location Section */}
            <View style={styles.section}>
              <View style={styles.locationHeader}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Location</Text>
                <Switch
                  value={useLocation}
                  onValueChange={setUseLocation}
                  trackColor={{ false: isDark ? colors.border : Colors.borderLight, true: Colors.primaryLight }}
                  thumbColor={useLocation ? Colors.primary : colors.surface}
                  style={styles.locationSwitch}
                />
              </View>

              {/* Location Verification Card */}
              {useLocation && (
                <View style={[
                  styles.locationCard,
                  { backgroundColor: isDark ? colors.glass : 'rgba(17, 180, 212, 0.08)' },
                  verifiedLocation?.verified && styles.locationCardVerified,
                  (locationError || permissionDenied) && styles.locationCardError,
                ]}>
                  {locationVerifying ? (
                    <>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <View style={styles.locationText}>
                        <Text style={[styles.locationTitle, { color: colors.text }]}>Verifying location...</Text>
                        <Text style={[styles.locationSubtitle, { color: colors.textSecondary }]}>Getting GPS coordinates</Text>
                      </View>
                    </>
                  ) : verifiedLocation?.verified ? (
                    <>
                      <View style={[styles.locationStatusIcon, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
                        <Ionicons name="checkmark" size={22} color={Colors.emerald} />
                      </View>
                      <View style={styles.locationText}>
                        <Text style={[styles.locationTitle, { color: Colors.emerald }]}>Location Verified</Text>
                        <Text style={[styles.locationSubtitle, { color: colors.textSecondary }]} numberOfLines={2}>
                          {verifiedLocation.address || verifiedLocation.detectedState}
                        </Text>
                      </View>
                      <Pressable onPress={verifyLocation} style={[styles.locationActionBtn, { backgroundColor: isDark ? colors.glass : 'rgba(17, 180, 212, 0.1)' }]}>
                        <Ionicons name="refresh" size={20} color={colors.primary} />
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={[styles.locationStatusIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                        <Ionicons name="alert" size={20} color={Colors.danger} />
                      </View>
                      <View style={styles.locationText}>
                        <Text style={[styles.locationTitle, { color: Colors.danger }]}>
                          {permissionDenied ? 'Permission Required' : 'Verification Failed'}
                        </Text>
                        <Text style={[styles.locationSubtitle, { color: colors.textSecondary }]} numberOfLines={3}>
                          {locationError || 'Tap retry to verify'}
                        </Text>
                      </View>
                      <Pressable onPress={verifyLocation} style={[styles.locationActionBtn, { backgroundColor: Colors.primary }]}>
                        <Text style={[styles.locationActionText, { color: Colors.textLight }]}>Retry</Text>
                      </Pressable>
                    </>
                  )}
                </View>
              )}

              <View style={styles.locationNoticeRow}>
                <Ionicons name="information-circle-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.locationNoticeText, { color: colors.textMuted }]}>
                  Location helps personalize health alerts for your area
                </Text>
              </View>
            </View>

            {/* Error display */}
            {error && (
              <View style={styles.errorContainer}>
                <ErrorBanner message={error} title="Check your details" />
              </View>
            )}

            {/* Sign In Link */}
            <View style={styles.signinContainer}>
              <Text style={[styles.signinText, { color: colors.textSecondary }]}>
                {t('already_have_account')}{' '}
              </Text>
              <Pressable onPress={() => navigation.navigate('SignIn')}>
                <Text style={[styles.signinLink, { color: colors.primary }]}>{t('sign_in')}</Text>
              </Pressable>
            </View>
          </ScrollView>

          {/* Fixed Footer Button */}
          <View style={[styles.footer, { 
            paddingBottom: insets.bottom + Spacing.sm,
            borderTopColor: isDark ? colors.border : Colors.borderLight,
            backgroundColor: isDark ? colors.surface : Colors.surfaceLight,
          }]}>
            <Button
              title={t('continue')}
              onPress={handleContinue}
              loading={loading}
              icon={<ArrowRightIcon size={20} color={Colors.textLight} />}
            />
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Gender Picker Modal */}
      <Modal
        visible={showGenderPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowGenderPicker(false)}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('select_gender')}</Text>
            {genderOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[styles.modalOption, { backgroundColor: gender === option.value ? colors.primaryLight : 'transparent' }]}
                onPress={() => {
                  setGender(option.value);
                  setShowGenderPicker(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: colors.text }]}>{option.label}</Text>
                {gender === option.value && <Text style={{ color: colors.primary }}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* State Picker Modal */}
      <Modal
        visible={showStatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowStatePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowStatePicker(false)}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]} onStartShouldSetResponder={() => true}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{t('select_state')}</Text>
            <FlatList
              data={NIGERIAN_STATES}
              keyExtractor={(item) => item}
              style={styles.modalList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modalOption, { backgroundColor: state === item ? colors.primaryLight : 'transparent' }]}
                  onPress={() => {
                    setState(item);
                    setShowStatePicker(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.text }]}>{item}</Text>
                  {state === item && <Text style={{ color: colors.primary }}>✓</Text>}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  /* ─── Container & Layout ─── */
  container: {
    flex: 1,
  },
  heroBg: {
    // ANDROID FIX: Use minHeight instead of fixed percentage-based height
    // This allows the hero to adapt to content while maintaining visual consistency
    minHeight: 236,
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    marginRight: Spacing.sm,
  },
  backButtonBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  progressContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  progressBars: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginBottom: 4,
  },
  progressBarActive: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  progressBarInactive: {
    width: 32,
    height: 4,
    borderRadius: 2,
  },
  stepText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.whiteAlpha90,
  },

  /* ─── Hero Content ─── */
  heroContent: {
    alignItems: 'center',
    paddingBottom: Spacing['2xl'],
  },
  logoContainer: {
    marginBottom: Spacing.sm,
  },
  logoGradient: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.whiteAlpha30,
  },
  heroTitle: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize['2xl'],
    letterSpacing: -0.3,
    color: Colors.textLight,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha90,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 21,
    paddingHorizontal: Spacing.xl,
  },

  /* ─── Form Card ─── */
  formWrapper: {
    flex: 1,
    marginTop: -Spacing.base,
  },
  formCard: {
    flex: 1,
    marginTop: 0,
    borderTopLeftRadius: BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    ...Shadows.lg,
  },
  formContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },

  /* ─── Sections ─── */
  section: {
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputGroup: {
    gap: Spacing.sm,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  halfInput: {
    flex: 1,
  },

  /* ─── Select / Picker ─── */
  selectContainer: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    gap: Spacing.sm,
  },
  selectText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  /* ─── Location Section ─── */
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  locationSwitch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(17,180,212,0.14)',
    gap: Spacing.sm,
    minHeight: 64,
  },
  locationCardVerified: {
    borderColor: Colors.emerald,
  },
  locationCardError: {
    borderColor: Colors.danger,
  },
  locationStatusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: {
    flex: 1,
  },
  locationTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  locationSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  locationActionBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 48,
  },
  locationActionText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },
  locationNoticeText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  locationNoticeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },

  /* ─── Error ─── */
  errorContainer: {
    marginBottom: Spacing.sm,
  },
  errorText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'center',
  },

  /* ─── Sign In Link ─── */
  signinContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  signinText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  signinLink: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
  },

  /* ─── Footer ─── */
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },

  /* ─── Modal ─── */
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlayDark,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  modalCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    maxHeight: '70%',
    ...Shadows.lg,
  },
  modalTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.base,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 320,
  },
  modalOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
    marginBottom: 4,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalOptionText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
});

export default SignUpScreen;
