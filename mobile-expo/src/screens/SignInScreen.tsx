/**
 * SignInScreen
 * Recreates the sign-in page with animations
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
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { Button, Input, GlassCard, ArrowBackIcon, EmailIcon, LockIcon, ShieldIcon, ArrowRightIcon } from '../components';
import { useAuth } from '../hooks/useAuth';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  Duration,
} from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

const SignInScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, loading } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Floating animation for decorative elements
  const float1Y = useSharedValue(0);
  const float2Y = useSharedValue(0);

  useEffect(() => {
    float1Y.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
    float2Y.value = withRepeat(
      withSequence(
        withTiming(-10, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const float1Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float1Y.value }],
  }));

  const float2Style = useAnimatedStyle(() => ({
    transform: [{ translateY: float2Y.value }],
  }));

  const handleSignIn = async () => {
    setError(null);
    const result = await signIn(email, password);
    if (result.error) {
      setError(result.error.message);
    } else {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  };

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
  };

  const handleGuest = () => {
    navigation.navigate('MainTabs');
  };

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Welcome');
    }
  };

  return (
    <View style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={['rgba(17, 180, 212, 0.9)', 'rgba(16, 185, 129, 0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.hero}
        >
          {/* Floating decorative elements */}
          <Animated.View style={[styles.floatingCircle1, float1Style]} />
          <Animated.View style={[styles.floatingCircle2, float2Style]} />

          {/* Back button */}
          <View style={[styles.heroContent, { paddingTop: insets.top + Spacing.base }]}>
            <Pressable onPress={handleBack} style={styles.backButton}>
              <ArrowBackIcon size={24} color={Colors.whiteAlpha90} />
            </Pressable>

            {/* Logo and title */}
            <View style={styles.heroCenter}>
              <View style={styles.logoContainer}>
                <ShieldIcon size={32} color={Colors.textLight} />
              </View>
              <Text style={styles.heroTitle}>Welcome Back</Text>
              <Text style={styles.heroSubtitle}>Sign in to access your health dashboard</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Form Section */}
        <ScrollView
          style={styles.formContainer}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <Input
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              icon={<EmailIcon size={24} color={Colors.primary} />}
            />

            <Input
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              icon={<LockIcon size={24} color={Colors.primary} />}
            />

            {/* Remember me & Forgot password */}
            <View style={styles.optionsRow}>
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.rememberText}>Remember me</Text>
              </Pressable>
              <Pressable>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </Pressable>
            </View>

            {/* Sign In Button */}
            <Button
              title="Sign In"
              onPress={handleSignIn}
              loading={loading}
              icon={<ArrowRightIcon size={20} color={Colors.textLight} />}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign In */}
            <Button
              title="Continue with Google"
              onPress={handleGoogleSignIn}
              variant="google"
              icon={
                <Image
                  source={{ uri: 'https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg' }}
                  style={styles.googleIcon}
                />
              }
              iconPosition="left"
              textStyle={{ color: Colors.textPrimary, fontFamily: FontFamily.medium }}
            />

            {/* Sign up link */}
            <View style={styles.signupRow}>
              <Text style={styles.signupText}>Don't have an account? </Text>
              <Pressable onPress={() => navigation.navigate('SignUp')}>
                <Text style={styles.signupLink}>Create one</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

        {/* Guest button footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.base }]}>
          <Button
            title="Continue as Guest"
            onPress={handleGuest}
            variant="outline"
            icon={<Text style={styles.eyeIcon}>👁</Text>}
            iconPosition="left"
            textStyle={{ color: Colors.textSecondary }}
            style={styles.guestButton}
          />
        </View>
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
  hero: {
    paddingBottom: Spacing['3xl'],
    position: 'relative',
    overflow: 'hidden',
  },
  heroContent: {
    paddingHorizontal: Spacing.xl,
  },
  floatingCircle1: {
    position: 'absolute',
    top: 40,
    right: 40,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.whiteAlpha10,
  },
  floatingCircle2: {
    position: 'absolute',
    bottom: 64,
    left: 20,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.whiteAlpha10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    padding: Spacing.sm,
    marginLeft: -Spacing.sm,
  },
  heroCenter: {
    alignItems: 'center',
  },
  logoContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: Colors.whiteAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textLight,
  },
  heroSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha80,
    marginTop: Spacing.sm,
  },
  errorContainer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.danger,
  },
  formContainer: {
    flex: 1,
    marginTop: -Spacing.base,
    backgroundColor: Colors.surfaceLight,
    borderTopLeftRadius: BorderRadius['3xl'],
    borderTopRightRadius: BorderRadius['3xl'],
    ...Shadows.lg,
  },
  formContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xl,
  },
  form: {
    gap: Spacing.base,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    color: Colors.textLight,
    fontSize: 10,
    fontWeight: 'bold',
  },
  rememberText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  forgotText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.base,
    marginVertical: Spacing.base,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.borderLight,
  },
  dividerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  signupRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: Spacing.xl,
  },
  signupText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  signupLink: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.base,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    backgroundColor: Colors.surfaceLight,
  },
  guestButton: {
    backgroundColor: Colors.backgroundLight,
    borderColor: Colors.borderLight,
  },
  eyeIcon: {
    fontSize: 18,
  },
});

export default SignInScreen;
