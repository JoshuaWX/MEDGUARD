/**
 * SignUpScreen
 * Step 1 of 2 - Profile creation
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
} from '../components';
import { useAuth } from '../hooks/useAuth';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
} from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp'>;

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Gombe', 'Imo', 'Jigawa',
  'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger',
  'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe',
  'Zamfara', 'Federal Capital Territory'
];

const SignUpScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { signUp, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [gender, setGender] = useState('');
  const [age, setAge] = useState('');
  const [state, setState] = useState('');
  const [locationAccess, setLocationAccess] = useState(false);
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);

  const genderOptions = [
    { label: 'Male', value: 'male' },
    { label: 'Female', value: 'female' },
    { label: 'Other', value: 'other' },
  ];

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Welcome');
    }
  };

  const handleContinue = async () => {
    setError(null);
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    const result = await signUp({
      name: fullName,
      email,
      password,
      gender,
      age: parseInt(age, 10),
      state,
      useLocation: locationAccess,
    });

    if (result) {
      navigation.navigate('SignUp2');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.base }]}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowBackIcon size={24} color={Colors.primary} />
          </Pressable>

          {/* Progress indicator */}
          <View style={styles.progressRow}>
            <Text style={styles.stepText}>Step 1 of 2</Text>
            <View style={styles.progressBars}>
              <LinearGradient
                colors={[Colors.primary, Colors.cyan]}
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
              colors={['rgba(17, 180, 212, 0.8)', 'rgba(16, 185, 129, 0.7)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.heroContent}>
              <Text style={styles.heroTitle}>Create Your Profile</Text>
              <Text style={styles.heroSubtitle}>Help us personalize your health experience</Text>
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
              placeholder="Full Name"
              value={fullName}
              onChangeText={setFullName}
              icon={<PersonIcon size={24} color={Colors.primary} />}
            />

            <Input
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              icon={<EmailIcon size={24} color={Colors.primary} />}
            />

            <Input
              placeholder="Create password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              icon={<LockIcon size={24} color={Colors.primary} />}
            />

            <Input
              placeholder="Confirm password"
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
                    {gender ? genderOptions.find(g => g.value === gender)?.label : 'Gender'}
                  </Text>
                  <ChevronDownIcon size={20} color={Colors.textMuted} />
                </Pressable>
              </View>

              <View style={styles.halfInput}>
                <Input
                  placeholder="Age"
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
                {state || 'State'}
              </Text>
              <ChevronDownIcon size={20} color={Colors.textMuted} />
            </Pressable>

            {/* Sign in link */}
            <View style={styles.signinRow}>
              <Text style={styles.signinText}>Already have an account? </Text>
              <Pressable onPress={() => navigation.navigate('SignIn')}>
                <Text style={styles.signinLink}>Sign in</Text>
              </Pressable>
            </View>
          </View>

          {/* Location Access */}
          <Pressable
            style={styles.locationCard}
            onPress={() => setLocationAccess(!locationAccess)}
          >
            <LinearGradient
              colors={['rgba(17, 180, 212, 0.1)', 'rgba(16, 185, 129, 0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={[styles.checkbox, locationAccess && styles.checkboxChecked]}>
              {locationAccess && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <View style={styles.locationText}>
              <Text style={styles.locationTitle}>Enable location access</Text>
              <Text style={styles.locationSubtitle}>For personalized local health alerts</Text>
            </View>
          </Pressable>

          {/* Error display */}
          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          {/* Continue Button */}
          <Button
            title="Continue"
            onPress={handleContinue}
            loading={loading}
            icon={<ArrowRightIcon size={20} color={Colors.textLight} />}
            style={styles.continueButton}
          />
        </ScrollView>

        <Modal
          visible={showGenderPicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowGenderPicker(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setShowGenderPicker(false)}>
            <View style={styles.modalCard} onStartShouldSetResponder={() => true}>
              <Text style={styles.modalTitle}>Select gender</Text>
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
              <Text style={styles.modalTitle}>Select state</Text>
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
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
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
    paddingBottom: Spacing['3xl'],
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
  signinRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  signinText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
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
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
  },
  checkmark: {
    color: Colors.textLight,
    fontSize: 12,
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
  locationSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'center',
    marginTop: Spacing.base,
  },
  continueButton: {
    marginTop: Spacing.xl,
  },
});

export default SignUpScreen;
