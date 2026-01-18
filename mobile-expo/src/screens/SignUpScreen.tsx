/**
 * SignUpScreen
 * Step 1 of 2 - Profile creation with optional location verification
 * Modern glassmorphism design with hero image
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
  Alert,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

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

  const [useLocation, setUseLocation] = useState(true);
  
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
        setLocationError('Location permission is required to create an account. MedGuard needs your location to provide personalized health alerts for your area.');
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
        throw new Error(verifyErr?.message || 'Could not determine your location');
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
      setLocationError('Failed to verify your location. Please check your GPS settings and try again.');
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
        Alert.alert('Location', msg);
        return;
      }

      if (!verifiedLocation?.verified) {
        const msg = 'Location verification failed. Tap Retry, or turn off “Use my location” to continue.';
        setError(msg);
        Alert.alert('Location', msg);
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
    if (!confirmPassword) {
      setError('Please confirm your password');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
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

    if (result.error) {
      const msg = (result.error as any)?.hint || result.error.message || 'Sign up failed';
      if (result.needsEmailConfirmation || (result.error as any)?.code === 'email_not_confirmed') {
        Alert.alert('Confirm your email', msg);
        navigation.navigate('SignIn');
        return;
      }
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
      {/* Hero Background */}
      <ImageBackground
        source={{ uri: HERO_IMAGE }}
        style={styles.heroBg}
        resizeMode="cover"
      >
        <LinearGradient
          colors={isDark 
            ? ['rgba(15, 23, 42, 0.7)', 'rgba(15, 23, 42, 0.95)'] as unknown as [string, string]
            : ['rgba(17, 180, 212, 0.75)', 'rgba(16, 185, 129, 0.85)'] as unknown as [string, string]
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
      </ImageBackground>

      {/* Form Card */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.formWrapper}
        keyboardVerticalOffset={Platform.OS === 'ios' ? -100 : 0}
      >
        <Animated.View 
          entering={FadeInUp.delay(300).duration(500)} 
          style={[styles.formCard, { backgroundColor: isDark ? colors.surface : Colors.surfaceLight }]}
        >
          <ScrollView
            contentContainerStyle={styles.formContent}
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
                  value={password}
                  onChangeText={setPassword}
                  icon={<LockIcon size={20} color={colors.primary} />}
                />

                <Input
                  placeholder={t('confirm_password')}
                  secureTextEntry
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
                      <Text style={styles.selectIcon}>⚥</Text>
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
                      icon={<Text style={styles.inputIcon}>🎂</Text>}
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
                  <Text style={styles.selectIcon}>📍</Text>
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
                        <Text style={styles.locationStatusEmoji}>✓</Text>
                      </View>
                      <View style={styles.locationText}>
                        <Text style={[styles.locationTitle, { color: Colors.emerald }]}>Location Verified</Text>
                        <Text style={[styles.locationSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
                          {verifiedLocation.address || verifiedLocation.detectedState}
                        </Text>
                      </View>
                      <Pressable onPress={verifyLocation} style={[styles.locationActionBtn, { backgroundColor: isDark ? colors.glass : 'rgba(17, 180, 212, 0.1)' }]}>
                        <Text style={[styles.locationActionText, { color: colors.primary }]}>↻</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <View style={[styles.locationStatusIcon, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                        <Text style={styles.locationStatusEmoji}>!</Text>
                      </View>
                      <View style={styles.locationText}>
                        <Text style={[styles.locationTitle, { color: Colors.danger }]}>
                          {permissionDenied ? 'Permission Required' : 'Verification Failed'}
                        </Text>
                        <Text style={[styles.locationSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
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

              <Text style={[styles.locationNoticeText, { color: colors.textMuted }]}>
                ℹ️ Location helps personalize health alerts for your area
              </Text>
            </View>

            {/* Error display */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
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
    height: SCREEN_HEIGHT * 0.32,
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
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textLight,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha90,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },

  /* ─── Form Card ─── */
  formWrapper: {
    flex: 1,
    marginTop: -Spacing.xl,
  },
  formCard: {
    flex: 1,
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
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
  selectIcon: {
    fontSize: 18,
  },
  selectText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },
  inputIcon: {
    fontSize: 18,
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
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'transparent',
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
  locationStatusEmoji: {
    fontSize: 18,
    fontWeight: 'bold',
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
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },

  /* ─── Error ─── */
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
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
