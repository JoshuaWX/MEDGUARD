/**
 * WelcomeScreen
 * Recreates the welcome page with full intro animation sequence
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  ImageBackground,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  withSpring,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { Button, FloatingShape, GlassCard, ShieldIcon, ArrowRightIcon } from '../components';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Delay,
  Duration,
  CustomEasing,
  Shadows,
} from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Animation values
  const overlayOpacity = useSharedValue(1);
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(-30);
  const logoTranslateY = useSharedValue(SCREEN_HEIGHT * 0.35);
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.8);
  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(30);
  const titleScale = useSharedValue(0.9);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(25);
  const descOpacity = useSharedValue(0);
  const descTranslateY = useSharedValue(25);
  const langOpacity = useSharedValue(0);
  const langTranslateY = useSharedValue(25);
  const featureCardOpacity = useSharedValue(0);
  const featureCardTranslateY = useSharedValue(40);
  const signupOpacity = useSharedValue(0);
  const signupTranslateY = useSharedValue(40);
  const signinOpacity = useSharedValue(0);
  const signinTranslateY = useSharedValue(40);
  const guestOpacity = useSharedValue(0);
  const guestTranslateY = useSharedValue(40);
  const termsOpacity = useSharedValue(0);
  const termsTranslateY = useSharedValue(40);
  
  // Checkmark animation
  const checkmarkProgress = useSharedValue(0);
  const checkmarkFillOpacity = useSharedValue(0);
  const checkmarkFillScale = useSharedValue(0.8);
  
  // Celebration rings
  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0);

  useEffect(() => {
    // Stage 0: Overlay fade out
    overlayOpacity.value = withDelay(
      Delay.introOverlay,
      withTiming(0, { duration: Duration.overlayFadeOut, easing: Easing.out(Easing.ease) })
    );

    // Stage 1: Logo scale in with bounce
    logoScale.value = withDelay(
      Delay.logoScale,
      withTiming(1, { duration: Duration.logoScaleIn, easing: CustomEasing.springBounce })
    );
    logoRotate.value = withDelay(
      Delay.logoScale,
      withSequence(
        withTiming(5, { duration: Duration.logoScaleIn * 0.6 }),
        withTiming(-2, { duration: Duration.logoScaleIn * 0.2 }),
        withTiming(0, { duration: Duration.logoScaleIn * 0.2 })
      )
    );

    // Glow appear
    glowOpacity.value = withDelay(
      Delay.glowAppear,
      withTiming(1, { duration: Duration.glowAppear })
    );
    glowScale.value = withDelay(
      Delay.glowAppear,
      withTiming(1, { duration: Duration.glowAppear })
    );

    // Logo move up
    logoTranslateY.value = withDelay(
      Delay.logoMove,
      withTiming(0, { duration: Duration.logoMoveUp, easing: CustomEasing.springBounce })
    );

    // Title reveal
    titleOpacity.value = withDelay(Delay.titleReveal, withTiming(1, { duration: Duration.titleReveal }));
    titleTranslateY.value = withDelay(Delay.titleReveal, withTiming(0, { duration: Duration.titleReveal }));
    titleScale.value = withDelay(Delay.titleReveal, withTiming(1, { duration: Duration.titleReveal }));

    // Subtitle
    subtitleOpacity.value = withDelay(Delay.text2, withTiming(1, { duration: Duration.textSlideIn }));
    subtitleTranslateY.value = withDelay(Delay.text2, withTiming(0, { duration: Duration.textSlideIn }));

    // Description
    descOpacity.value = withDelay(Delay.text3, withTiming(1, { duration: Duration.textSlideIn }));
    descTranslateY.value = withDelay(Delay.text3, withTiming(0, { duration: Duration.textSlideIn }));

    // Language selector
    langOpacity.value = withDelay(Delay.text4, withTiming(1, { duration: Duration.textSlideIn }));
    langTranslateY.value = withDelay(Delay.text4, withTiming(0, { duration: Duration.textSlideIn }));

    // Checkmark draw
    checkmarkProgress.value = withDelay(
      Delay.checkmarkDraw,
      withTiming(1, { duration: Duration.drawCheckmark, easing: Easing.out(Easing.ease) })
    );

    // Checkmark fill
    checkmarkFillOpacity.value = withDelay(Delay.checkmarkFill, withTiming(1, { duration: Duration.checkmarkFill }));
    checkmarkFillScale.value = withDelay(
      Delay.checkmarkFill,
      withSequence(
        withTiming(1.1, { duration: Duration.checkmarkFill / 2 }),
        withTiming(1, { duration: Duration.checkmarkFill / 2 })
      )
    );

    // Celebration rings
    ring1Opacity.value = withDelay(Delay.celebrateRing1, withTiming(0, { duration: Duration.celebrateRing }));
    ring1Scale.value = withDelay(Delay.celebrateRing1, withTiming(1.8, { duration: Duration.celebrateRing }));
    ring2Opacity.value = withDelay(Delay.celebrateRing2, withTiming(0, { duration: Duration.celebrateRing }));
    ring2Scale.value = withDelay(Delay.celebrateRing2, withTiming(2.2, { duration: Duration.celebrateRing }));

    // Footer elements
    featureCardOpacity.value = withDelay(Delay.footer1, withTiming(1, { duration: Duration.footerSlideIn, easing: CustomEasing.springBounce }));
    featureCardTranslateY.value = withDelay(Delay.footer1, withTiming(0, { duration: Duration.footerSlideIn, easing: CustomEasing.springBounce }));

    signupOpacity.value = withDelay(Delay.footer2, withTiming(1, { duration: Duration.footerSlideIn, easing: CustomEasing.springBounce }));
    signupTranslateY.value = withDelay(Delay.footer2, withTiming(0, { duration: Duration.footerSlideIn, easing: CustomEasing.springBounce }));

    signinOpacity.value = withDelay(Delay.footer3, withTiming(1, { duration: Duration.footerSlideIn, easing: CustomEasing.springBounce }));
    signinTranslateY.value = withDelay(Delay.footer3, withTiming(0, { duration: Duration.footerSlideIn, easing: CustomEasing.springBounce }));

    guestOpacity.value = withDelay(Delay.footer4, withTiming(1, { duration: Duration.footerSlideIn, easing: CustomEasing.springBounce }));
    guestTranslateY.value = withDelay(Delay.footer4, withTiming(0, { duration: Duration.footerSlideIn, easing: CustomEasing.springBounce }));

    termsOpacity.value = withDelay(Delay.footer5, withTiming(1, { duration: Duration.footerSlideIn }));
    termsTranslateY.value = withDelay(Delay.footer5, withTiming(0, { duration: Duration.footerSlideIn }));

    // Continuous glow pulse after initial animation
    setTimeout(() => {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.9, { duration: Duration.glowPulse / 2 }),
          withTiming(0.6, { duration: Duration.glowPulse / 2 })
        ),
        -1,
        true
      );
      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: Duration.glowPulse / 2 }),
          withTiming(1, { duration: Duration.glowPulse / 2 })
        ),
        -1,
        true
      );
    }, Delay.footer1);
  }, []);

  // Animated styles
  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const logoContainerStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: logoTranslateY.value }],
  }));

  const logoInnerStyle = useAnimatedStyle(() => ({
    opacity: interpolate(logoScale.value, [0, 1], [0, 1]),
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [
      { translateY: titleTranslateY.value },
      { scale: titleScale.value },
    ],
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  const descStyle = useAnimatedStyle(() => ({
    opacity: descOpacity.value,
    transform: [{ translateY: descTranslateY.value }],
  }));

  const langStyle = useAnimatedStyle(() => ({
    opacity: langOpacity.value,
    transform: [{ translateY: langTranslateY.value }],
  }));

  const featureCardStyle = useAnimatedStyle(() => ({
    opacity: featureCardOpacity.value,
    transform: [{ translateY: featureCardTranslateY.value }, { scale: interpolate(featureCardOpacity.value, [0, 1], [0.95, 1]) }],
  }));

  const signupStyle = useAnimatedStyle(() => ({
    opacity: signupOpacity.value,
    transform: [{ translateY: signupTranslateY.value }, { scale: interpolate(signupOpacity.value, [0, 1], [0.95, 1]) }],
  }));

  const signinStyle = useAnimatedStyle(() => ({
    opacity: signinOpacity.value,
    transform: [{ translateY: signinTranslateY.value }, { scale: interpolate(signinOpacity.value, [0, 1], [0.95, 1]) }],
  }));

  const guestStyle = useAnimatedStyle(() => ({
    opacity: guestOpacity.value,
    transform: [{ translateY: guestTranslateY.value }],
  }));

  const termsStyle = useAnimatedStyle(() => ({
    opacity: termsOpacity.value,
    transform: [{ translateY: termsTranslateY.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Opacity.value,
    transform: [{ scale: ring1Scale.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }],
  }));

  const handleSignUp = () => navigation.navigate('SignUp');
  const handleSignIn = () => navigation.navigate('SignIn');
  const handleGuest = () => navigation.navigate('MainTabs');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Hero Background */}
      <LinearGradient
        colors={['rgba(17, 180, 212, 0.85)', 'rgba(16, 185, 129, 0.75)', 'rgba(246, 248, 248, 0.95)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Floating Shapes */}
      <FloatingShape size={128} top={80} left={-40} delay={Delay.floatingShapes} duration={6000} />
      <FloatingShape size={96} top={160} right={40} delay={Delay.floatingShapes + 100} duration={7000} />
      <FloatingShape size={64} bottom={240} left={80} delay={Delay.floatingShapes + 200} duration={5000} />
      <FloatingShape size={80} bottom={160} right={-20} delay={Delay.floatingShapes + 300} duration={8000} />

      {/* Intro Overlay */}
      <Animated.View style={[styles.overlay, overlayStyle]} pointerEvents="none">
        <LinearGradient
          colors={[Colors.primary, Colors.emerald]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
        {/* Header with Logo */}
        <View style={styles.header}>
          <Animated.View style={[styles.logoContainer, logoContainerStyle]}>
            {/* Glow */}
            <Animated.View style={[styles.glow, glowStyle]}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.4)', 'rgba(17, 180, 212, 0.3)', 'transparent']}
                style={styles.glowGradient}
              />
            </Animated.View>

            {/* Logo Inner with Glass Card */}
            <Animated.View style={[styles.logoInner, logoInnerStyle]}>
              {/* Celebration Rings */}
              <Animated.View style={[styles.celebrateRing, ring1Style]} />
              <Animated.View style={[styles.celebrateRing, ring2Style]} />
              
              <View style={styles.glassOuter}>
                <LinearGradient
                  colors={[Colors.primary, Colors.emerald]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoGradient}
                >
                  <ShieldIcon size={48} color={Colors.textLight} />
                </LinearGradient>
              </View>
            </Animated.View>
          </Animated.View>

          {/* Title */}
          <Animated.Text style={[styles.title, titleStyle]}>MedGuard</Animated.Text>
          
          {/* Subtitle */}
          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            Your Health, Simplified.
          </Animated.Text>

          {/* Description */}
          <Animated.Text style={[styles.description, descStyle]}>
            Stay informed with real-time health alerts tailored to your location
          </Animated.Text>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.base }]}>
          {/* Feature Highlights */}
          <Animated.View style={featureCardStyle}>
            <GlassCard style={styles.featureCard} padding={Spacing.base}>
              <View style={styles.featureRow}>
                <FeatureIcon emoji="🔔" label="Real-time Alerts" index={0} />
                <FeatureIcon emoji="📍" label="Location Based" index={1} />
                <FeatureIcon emoji="❤️" label="Health Tracking" index={2} />
              </View>
            </GlassCard>
          </Animated.View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Animated.View style={signupStyle}>
              <Button
                title="Get Started"
                onPress={handleSignUp}
                variant="outline"
                icon={<ArrowRightIcon size={20} color={Colors.primary} />}
                textStyle={{ color: Colors.primary }}
                style={styles.signupButton}
              />
            </Animated.View>

            <Animated.View style={signinStyle}>
              <Button
                title="Sign In"
                onPress={handleSignIn}
                variant="secondary"
                icon={<ArrowRightIcon size={20} color={Colors.textLight} />}
                iconPosition="left"
              />
            </Animated.View>

            <Animated.View style={guestStyle}>
              <Button
                title="Continue as Guest →"
                onPress={handleGuest}
                variant="ghost"
                style={styles.guestButton}
                textStyle={styles.guestText}
              />
            </Animated.View>
          </View>

          {/* Terms */}
          <Animated.Text style={[styles.terms, termsStyle]}>
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </Animated.Text>
        </View>
      </View>
    </View>
  );
};

// Feature Icon Component with bounce animation
interface FeatureIconProps {
  emoji: string;
  label: string;
  index: number;
}

const FeatureIcon: React.FC<FeatureIconProps> = ({ emoji, label, index }) => {
  const scale = useSharedValue(0);
  const rotate = useSharedValue(-10);

  useEffect(() => {
    const delay = Delay.footer1 + 100 + index * 100;
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.15, { duration: Duration.iconBounceIn * 0.6, easing: CustomEasing.springBounce }),
        withTiming(1, { duration: Duration.iconBounceIn * 0.4 })
      )
    );
    rotate.value = withDelay(
      delay,
      withSequence(
        withTiming(5, { duration: Duration.iconBounceIn * 0.6 }),
        withTiming(0, { duration: Duration.iconBounceIn * 0.4 })
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scale.value, [0, 1], [0, 1]),
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
  }));

  return (
    <Animated.View style={[styles.featureItem, animatedStyle]}>
      <View style={styles.featureIconCircle}>
        <Text style={styles.featureEmoji}>{emoji}</Text>
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
  },
  logoContainer: {
    marginBottom: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 70,
  },
  logoInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassOuter: {
    padding: Spacing.base,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.whiteAlpha20,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha30,
  },
  logoGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primaryLg,
  },
  celebrateRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.whiteAlpha80,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['4xl'],
    color: Colors.textLight,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.whiteAlpha90,
    marginTop: Spacing.md,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  description: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.whiteAlpha80,
    marginTop: Spacing.sm,
    textAlign: 'center',
    maxWidth: 280,
  },
  footer: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  featureCard: {
    marginBottom: Spacing.xl,
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  featureItem: {
    alignItems: 'center',
  },
  featureIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.whiteAlpha20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  featureEmoji: {
    fontSize: 24,
  },
  featureLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.whiteAlpha80,
  },
  buttonContainer: {
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  signupButton: {
    backgroundColor: Colors.textLight,
  },
  guestButton: {
    height: 48,
  },
  guestText: {
    color: Colors.whiteAlpha80,
    fontFamily: FontFamily.medium,
  },
  terms: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: Spacing.base,
  },
});

export default WelcomeScreen;
