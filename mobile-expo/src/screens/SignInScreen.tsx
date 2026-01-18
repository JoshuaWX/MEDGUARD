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
  ImageBackground,
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
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  Duration,
  Gradients,
} from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignIn'>;

const HERO_BG_URI =
  'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=800&q=80';

const SignInScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, loading } = useAuth();
  const { t } = useI18n();
  const { isDark, colors } = useTheme();
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
      const msg = (result.error as any)?.hint || result.error.message;
      setError(msg);
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

  const gradientColors = isDark
    ? [colors.gradientFrom, colors.gradientVia, colors.gradientTo] as unknown as [string, string, string]
    : Gradients.background.colors as unknown as [string, string, string];

  return (
    <LinearGradient
      colors={gradientColors}
      start={Gradients.background.start}
      end={Gradients.background.end}
      style={styles.container}
    >
      <View style={[styles.page, { backgroundColor: isDark ? colors.surface : Colors.whiteAlpha50 }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
        >
          {/* Hero Section */}
          <ImageBackground
            source={{ uri: HERO_BG_URI }}
            style={styles.hero}
            imageStyle={styles.heroImage}
          >
            <LinearGradient
              colors={Gradients.signinHero.colors as unknown as [string, string]}
              start={Gradients.signinHero.start}
              end={Gradients.signinHero.end}
              style={[StyleSheet.absoluteFill, styles.heroOverlay]}
            />

            {/* Floating decorative elements */}
            <Animated.View style={[styles.floatingCircle1, float1Style]} />
            <Animated.View style={[styles.floatingCircle2, float2Style]} />

            {/* Back button */}
            <View style={[styles.heroContent, { paddingTop: insets.top + Spacing.base }]}>
              <Pressable onPress={handleBack} style={styles.backButton} hitSlop={10}>
                <ArrowBackIcon size={24} color={Colors.whiteAlpha90} />
              </Pressable>

              {/* Logo and title */}
              <View style={styles.heroCenter}>
                <View style={styles.logoContainer}>
                  <ShieldIcon size={32} color={Colors.textLight} />
                </View>
                <Text style={styles.heroTitle}>{t('welcome_back')}</Text>
                <Text style={styles.heroSubtitle}>{t('signin_subtitle')}</Text>
              </View>
            </View>
          </ImageBackground>

        {/* Error message */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Form Section */}
        <ScrollView
          style={[styles.formContainer, { backgroundColor: colors.surface }]}
          contentContainerStyle={styles.formContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.form}>
            <Input
              placeholder={t('email_address')}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
              icon={<EmailIcon size={24} color={colors.primary} />}
            />

            <Input
              placeholder={t('password_label')}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              icon={<LockIcon size={24} color={colors.primary} />}
            />

            {/* Remember me & Forgot password */}
            <View style={styles.optionsRow}>
              <Pressable
                style={styles.rememberRow}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, { borderColor: isDark ? colors.border : Colors.borderLight }, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.rememberText, { color: colors.textSecondary }]}>{t('remember_me')}</Text>
              </Pressable>
              <Pressable>
                <Text style={[styles.forgotText, { color: colors.primary }]}>{t('forgot_password')}</Text>
              </Pressable>
            </View>

            {/* Sign In Button */}
            <Button
              title={t('login')}
              onPress={handleSignIn}
              loading={loading}
              icon={<ArrowRightIcon size={20} color={Colors.textLight} />}
            />

            {/* Divider */}
            <View style={styles.divider}>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? colors.border : Colors.borderLight }]} />
              <Text style={[styles.dividerText, { color: colors.textMuted }]}>{t('or_continue_with')}</Text>
              <View style={[styles.dividerLine, { backgroundColor: isDark ? colors.border : Colors.borderLight }]} />
            </View>

            {/* Google Sign In */}
            <Button
              title={t('continue_with_google')}
              onPress={handleGoogleSignIn}
              variant="google"
              icon={
                // React Native Image can't render remote SVGs.
                // Use a lightweight text mark so the button still renders correctly.
                <Text style={[styles.googleMark, { color: colors.text }]}>G</Text>
              }
              iconPosition="left"
              textStyle={{ color: colors.text, fontFamily: FontFamily.medium }}
            />

            {/* Sign up link */}
            <View style={styles.signupRow}>
              <Text style={[styles.signupText, { color: colors.textSecondary }]}>{t('dont_have_account')} </Text>
              <Pressable onPress={() => navigation.navigate('SignUp')}>
                <Text style={[styles.signupLink, { color: colors.primary }]}>{t('create_one')}</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>

          {/* Guest button footer */}
          <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.base, backgroundColor: colors.surface, borderTopColor: isDark ? colors.border : Colors.borderLight }]}>
            <Button
              title={t('guest_continue')}
              onPress={handleGuest}
              variant="outline"
              icon={<Text style={styles.eyeIcon}>👁</Text>}
              iconPosition="left"
              textStyle={{ color: colors.textSecondary }}
              style={{ ...styles.guestButton, backgroundColor: colors.background, borderColor: isDark ? colors.border : Colors.borderLight }}
            />
          </View>
        </KeyboardAvoidingView>
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
    backgroundColor: Colors.whiteAlpha50,
  },
  flex: {
    flex: 1,
  },
  hero: {
    paddingBottom: Spacing['3xl'],
    position: 'relative',
    overflow: 'hidden',
  },
  heroImage: {
    resizeMode: 'cover',
  },
  heroOverlay: {
    opacity: 1,
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
  googleMark: {
    width: 20,
    height: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    fontSize: 14,
    lineHeight: 20,
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
