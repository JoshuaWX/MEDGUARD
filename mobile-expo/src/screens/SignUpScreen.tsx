/**
 * SignUpScreen
 * Step 1 of 2 - Profile creation with MANDATORY location verification
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
} from '../components';
import { useAuth } from '../hooks/useAuth';
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

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

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
  
  // Location verification state (MANDATORY)
  const [locationVerifying, setLocationVerifying] = useState(false);
  const [verifiedLocation, setVerifiedLocation] = useState<VerifiedLocation | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const genderOptions = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
  ];

  // Verify location on mount
  useEffect(() => {
    verifyLocation();
  }, []);

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

      // Step 3: Reverse geocode to get state/city
      const geoResults = await Location.reverseGeocodeAsync({ latitude, longitude });
      
      if (geoResults.length === 0) {
        setLocationError('Could not determine your location. Please ensure you have a stable GPS signal.');
        setLocationVerifying(false);
        return;
      }

      const result = geoResults[0];
      const detectedState = result.region || result.subregion || '';
      const addressParts = [result.street, result.city, result.region, result.country].filter(Boolean);
      const address = addressParts.join(', ');

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

    // MANDATORY: Location must be verified
    if (!verifiedLocation?.verified) {
      setError('Location verification is required. Please enable location access to continue.');
      return;
    }

    if (permissionDenied) {
      setError('Location permission was denied. Please enable it in your device settings to create an account.');
      return;
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

    // CRITICAL: Validate selected state matches GPS-detected state
    if (verifiedLocation.detectedState && !statesMatch(verifiedLocation.detectedState, state)) {
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
      useLocation: true, // Always true since location is mandatory
      latitude: verifiedLocation.latitude,
      longitude: verifiedLocation.longitude,
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
      <View style={styles.page}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + Spacing.base }]}>
            <Pressable onPress={handleBack} style={styles.backButton} hitSlop={10}>
              <ArrowBackIcon size={24} color={Colors.primary} />
            </Pressable>

            {/* Progress indicator */}
            <View style={styles.progressRow}>
              <Text style={styles.stepText}>{t('step_1_of_2')}</Text>
              <View style={styles.progressBars}>
                <LinearGradient
                  colors={[Colors.primary, Colors.cyan] as unknown as [string, string]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.progressBarActive}
                />
                <View style={styles.progressBarInactive} />
              </View>
            </View>

            {/* Hero Banner */}
            <View style={styles.heroBanner}>
              <Image
                source={{ uri: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80' }}
                style={styles.heroImage}
              />
              <LinearGradient
                colors={['rgba(17, 180, 212, 0.8)', 'rgba(16, 185, 129, 0.7)'] as unknown as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.heroContent}>
                <Text style={styles.heroTitle}>{t('create_profile_title')}</Text>
                <Text style={styles.heroSubtitle}>{t('create_profile_subtitle')}</Text>
              </View>
            </View>
          </View>

          {/* Form */}
          <ScrollView
            style={styles.formContainer}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.form}>
              <Input
                placeholder={t('full_name')}
                value={fullName}
                onChangeText={setFullName}
                icon={<PersonIcon size={24} color={Colors.primary} />}
              />

              <Input
                placeholder={t('email_address')}
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                icon={<EmailIcon size={24} color={Colors.primary} />}
              />

              <Input
                placeholder={t('create_password')}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                icon={<LockIcon size={24} color={Colors.primary} />}
              />

              <Input
                placeholder={t('confirm_password')}
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                icon={<LockIcon size={24} color={Colors.primary} />}
              />

              {/* Gender and Age Row */}
              <View style={styles.row}>
                <View style={styles.halfInput}>
                  <Pressable
                    style={styles.selectContainer}
                    onPress={() => setShowGenderPicker(true)}
                  >
                    <Text style={styles.selectIcon}>⚥</Text>
                    <Text style={[styles.selectText, !gender && styles.selectPlaceholder]}>
                      {gender ? genderOptions.find(g => g.value === gender)?.label : t('gender')}
                    </Text>
                    <ChevronDownIcon size={20} color={Colors.textMuted} style={{ transform: [{ rotate: '0deg' }] }} />
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
                style={styles.selectContainer}
                onPress={() => setShowStatePicker(true)}
              >
                <Text style={styles.selectIcon}>📍</Text>
                <Text style={[styles.selectText, !state && styles.selectPlaceholder]}>
                  {state || t('state')}
                </Text>
                <ChevronDownIcon size={20} color={Colors.textMuted} style={{ transform: [{ rotate: '0deg' }] }} />
              </Pressable>

              <Text style={styles.alreadyText}>
                {t('already_have_account')}{' '}
                <Text style={styles.signinLink} onPress={() => navigation.navigate('SignIn')}>
                  {t('sign_in')}
                </Text>
              </Text>
            </View>

            {/* Location Verification Card (MANDATORY) */}
            <View style={[
              styles.locationCard,
              verifiedLocation?.verified && styles.locationCardVerified,
              (locationError || permissionDenied) && styles.locationCardError,
            ]}>
              <LinearGradient
                colors={
                  verifiedLocation?.verified
                    ? ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.08)'] as unknown as [string, string]
                    : (locationError || permissionDenied)
                      ? ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.08)'] as unknown as [string, string]
                      : ['rgba(17, 180, 212, 0.1)', 'rgba(16, 185, 129, 0.1)'] as unknown as [string, string]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              
              {locationVerifying ? (
                <>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <View style={styles.locationText}>
                    <Text style={styles.locationTitle}>Verifying your location...</Text>
                    <Text style={styles.locationSubtitle}>Getting GPS coordinates and address</Text>
                  </View>
                </>
              ) : verifiedLocation?.verified ? (
                <>
                  <View style={[styles.checkbox, styles.checkboxChecked]}>
                    <Text style={styles.checkmark}>✓</Text>
                  </View>
                  <View style={styles.locationText}>
                    <Text style={styles.locationTitle}>Location Verified ✓</Text>
                    <Text style={styles.locationSubtitle} numberOfLines={2}>
                      {verifiedLocation.address || verifiedLocation.detectedState}
                    </Text>
                  </View>
                  <Pressable onPress={verifyLocation} style={styles.refreshBtn}>
                    <Text style={styles.refreshBtnText}>↻</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  <View style={[styles.checkbox, styles.checkboxError]}>
                    <Text style={styles.checkmarkError}>!</Text>
                  </View>
                  <View style={styles.locationText}>
                    <Text style={[styles.locationTitle, styles.locationTitleError]}>
                      {permissionDenied ? 'Location Required' : 'Location Not Verified'}
                    </Text>
                    <Text style={styles.locationSubtitle} numberOfLines={2}>
                      {locationError || 'Tap to retry location verification'}
                    </Text>
                  </View>
                  <Pressable onPress={verifyLocation} style={styles.retryBtn}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </Pressable>
                </>
              )}
            </View>

            {/* Location requirement notice */}
            <View style={styles.locationNotice}>
              <Text style={styles.locationNoticeIcon}>ℹ️</Text>
              <Text style={styles.locationNoticeText}>
                Location verification is required to provide personalized health alerts for your area.
              </Text>
            </View>

            {/* Error display */}
            {error && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </ScrollView>

          {/* Fixed footer Continue button */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.base }]}>
            <Button
              title={t('continue')}
              onPress={handleContinue}
              loading={loading}
              icon={<ArrowRightIcon size={20} color={Colors.textLight} />}
            />
          </View>

          <Modal
            visible={showGenderPicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowGenderPicker(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setShowGenderPicker(false)}>
              <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
                <Text style={styles.modalTitle}>{t('select_gender')}</Text>
                {genderOptions.map((option) => (
                  <Pressable
                    key={option.value}
                    style={styles.modalOption}
                    onPress={() => {
                      setGender(option.value);
                      setShowGenderPicker(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{option.label}</Text>
                  </Pressable>
                ))}
              </View>
            </Pressable>
          </Modal>

          <Modal
            visible={showStatePicker}
            transparent
            animationType="fade"
            onRequestClose={() => setShowStatePicker(false)}
          >
            <Pressable style={styles.modalOverlay} onPress={() => setShowStatePicker(false)}>
              <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
                <Text style={styles.modalTitle}>{t('select_state')}</Text>
                <FlatList
                  data={NIGERIAN_STATES}
                  keyExtractor={(item) => item}
                  style={styles.modalList}
                  renderItem={({ item }) => (
                    <Pressable
                      style={styles.modalOption}
                      onPress={() => {
                        setState(item);
                        setShowStatePicker(false);
                      }}
                    >
                      <Text style={styles.modalOptionText}>{item}</Text>
                    </Pressable>
                  )}
                />
              </View>
            </Pressable>
          </Modal>
        </KeyboardAvoidingView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
    backgroundColor: Colors.whiteAlpha50,
  },
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.base,
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
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
  progressBarActive: {
    width: 48,
    height: 10,
    borderRadius: BorderRadius.full,
  },
  progressBarInactive: {
    width: 48,
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.borderLight,
  },
  heroBanner: {
    height: 144,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.base,
    ...Shadows.lg,
  },
  heroImage: {
    ...StyleSheet.absoluteFillObject,
    resizeMode: 'cover',
  },
  heroContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.base,
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textLight,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  heroSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha90,
    marginTop: Spacing.xs,
  },
  formContainer: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['5xl'],
  },
  form: {
    gap: Spacing.md,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  halfInput: {
    flex: 1,
  },
  selectContainer: {
    height: Spacing.inputHeight,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.whiteAlpha90,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    paddingLeft: 44,
    paddingRight: Spacing.base,
  },
  selectIcon: {
    position: 'absolute',
    left: Spacing.base,
    fontSize: 20,
    color: Colors.primary,
    zIndex: 1,
  },
  selectText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  selectPlaceholder: {
    color: Colors.textMuted,
  },
  inputIcon: {
    fontSize: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlayDark,
    padding: Spacing.xl,
    justifyContent: 'center',
  },
  modalCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
    maxHeight: '80%',
    ...Shadows.lg,
  },
  modalTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.lg,
    color: Colors.textPrimary,
    marginBottom: Spacing.base,
  },
  modalList: {
    maxHeight: 360,
  },
  modalOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.lg,
  },
  modalOptionText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  alreadyText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  signinLink: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    marginTop: Spacing.xl,
    gap: Spacing.md,
    overflow: 'hidden',
    minHeight: 72,
  },
  locationCardVerified: {
    borderColor: Colors.emerald,
  },
  locationCardError: {
    borderColor: Colors.danger,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.emerald,
    borderColor: Colors.emerald,
  },
  checkboxError: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  checkmark: {
    color: Colors.textLight,
    fontSize: 14,
    fontWeight: 'bold',
  },
  checkmarkError: {
    color: Colors.textLight,
    fontSize: 16,
    fontWeight: 'bold',
  },
  locationText: {
    flex: 1,
  },
  locationTitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  locationTitleError: {
    color: Colors.danger,
  },
  locationSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  locationIcon: {
    fontSize: 18,
    color: Colors.primary,
  },
  refreshBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  refreshBtnText: {
    fontSize: 18,
    color: Colors.primary,
  },
  retryBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
  },
  retryBtnText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  locationNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.sm,
    backgroundColor: Colors.infoLight,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  locationNoticeIcon: {
    fontSize: 14,
  },
  locationNoticeText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.info,
    lineHeight: 16,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: Spacing.base,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surfaceLight,
  },
});

export default SignUpScreen;
