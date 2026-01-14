/**
 * WelcomeScreen
 * Recreates the welcome page with full intro animation sequence
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  ImageBackground,
  Pressable,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
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
import { LangCode, useI18n } from '../i18n';
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
  Gradients,
} from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

const HERO_BG_URI =
  'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80';

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);

// Language options
const LANGUAGES = [
  { code: 'en' as LangCode, label: '🌐 English' },
  { code: 'yo' as LangCode, label: '🌐 Yorùbá' },
  { code: 'ha' as LangCode, label: '🌐 Hausa' },
  { code: 'ig' as LangCode, label: '🌐 Igbo' },
];

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { lang, setLang, t } = useI18n();
  const [showLangPicker, setShowLangPicker] = useState(false);

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

  // Slow background zoom (web: bgZoom keyframes)
  const bgZoom = useSharedValue(1);
  
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
    // Background slow zoom
    bgZoom.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 20000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 20000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

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

  const heroBgStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bgZoom.value }],
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
      <AnimatedImageBackground
        source={{ uri: HERO_BG_URI }}
        style={[StyleSheet.absoluteFill, heroBgStyle]}
        imageStyle={styles.heroImage}
      >
        <LinearGradient
          colors={Gradients.welcomeHero.colors as unknown as [string, string, string]}
          start={Gradients.welcomeHero.start}
          end={Gradients.welcomeHero.end}
          style={StyleSheet.absoluteFill}
        />
      </AnimatedImageBackground>

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
      <View style={styles.page}>
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
          <Animated.Text style={[styles.title, titleStyle]}>{t('app_name')}</Animated.Text>
          
          {/* Subtitle */}
          <Animated.Text style={[styles.subtitle, subtitleStyle]}>
            {t('tagline')}
          </Animated.Text>

          {/* Description */}
          <Animated.Text style={[styles.description, descStyle]}>
            Stay informed with real-time health alerts tailored to your location
          </Animated.Text>

          {/* Language Selector */}
          <Animated.View style={[styles.langContainer, langStyle]}>
            <Pressable
              style={styles.langSelector}
              onPress={() => setShowLangPicker(!showLangPicker)}
            >
              <Text style={styles.langText}>
                {LANGUAGES.find(l => l.code === lang)?.label || '🌐 English'}
              </Text>
              <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
                <Path d="M6 9l6 6 6-6" />
              </Svg>
            </Pressable>
            {showLangPicker && (
              <View style={styles.langDropdown}>
                {LANGUAGES.map(opt => (
                  <Pressable
                    key={opt.code}
                    style={styles.langOption}
                    onPress={() => {
                      void setLang(opt.code);
                      setShowLangPicker(false);
                    }}
                  >
                    <Text style={[styles.langOptionText, opt.code === lang && styles.langOptionActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Animated.View>
        </View>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.base }]}>
          {/* Feature Highlights */}
          <Animated.View style={featureCardStyle}>
            <View style={styles.featureCardGlass}>
              <View style={styles.featureRow}>
                <FeatureIconSvg type="bell" label={t('feature_realtime_alerts')} index={0} />
                <FeatureIconSvg type="location" label={t('feature_location_based')} index={1} />
                <FeatureIconSvg type="heart" label={t('feature_health_tracking')} index={2} />
              </View>
            </View>
          </Animated.View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <Animated.View style={signupStyle}>
              <Pressable onPress={handleSignUp} style={styles.getStartedBtn}>
                <Text style={styles.getStartedText}>{t('get_started')}</Text>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={Colors.primary} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </Svg>
              </Pressable>
            </Animated.View>

            <Animated.View style={signinStyle}>
              <Pressable onPress={handleSignIn} style={styles.signInBtn}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                </Svg>
                <Text style={styles.signInText}>{t('login')}</Text>
              </Pressable>
            </Animated.View>

            <Animated.View style={guestStyle}>
              <Pressable onPress={handleGuest} style={styles.guestBtn}>
                <Text style={styles.guestBtnText}>{t('guest_continue')}</Text>
                <Text style={styles.guestArrow}>→</Text>
              </Pressable>
            </Animated.View>
          </View>

          {/* Terms */}
          <Animated.Text style={[styles.terms, termsStyle]}>
            {t('terms_privacy')}
          </Animated.Text>
        </View>
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

// SVG Feature Icon Component matching welcome.html
interface FeatureIconSvgProps {
  type: 'bell' | 'location' | 'heart';
  label: string;
  index: number;
}

const FeatureIconSvg: React.FC<FeatureIconSvgProps> = ({ type, label, index }) => {
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

  const renderIcon = () => {
    switch (type) {
      case 'bell':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </Svg>
        );
      case 'location':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <Path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </Svg>
        );
      case 'heart':
        return (
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </Svg>
        );
    }
  };

  return (
    <Animated.View style={[styles.featureItem, animatedStyle]}>
      <View style={styles.featureIconCircle}>
        {renderIcon()}
      </View>
      <Text style={styles.featureLabel}>{label}</Text>
    </Animated.View>
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
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  heroImage: {
    resizeMode: 'cover',
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
  langContainer: {
    marginTop: Spacing.lg,
    zIndex: 10,
  },
  langSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha30,
    backgroundColor: Colors.whiteAlpha20,
  },
  langText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  langDropdown: {
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    ...Shadows.lg,
    overflow: 'hidden',
  },
  langOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
  },
  langOptionText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textPrimary,
  },
  langOptionActive: {
    fontFamily: FontFamily.semibold,
    color: Colors.primary,
  },
  footer: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
  },
  featureCard: {
    marginBottom: Spacing.xl,
  },
  featureCardGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.base,
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
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
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
  getStartedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    backgroundColor: Colors.textLight,
    borderRadius: BorderRadius.xl,
    ...Shadows.xl,
  },
  getStartedText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.primary,
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    backgroundColor: Colors.whiteAlpha20,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.whiteAlpha30,
  },
  signInText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textLight,
  },
  guestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 48,
    backgroundColor: 'transparent',
  },
  guestBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.whiteAlpha80,
  },
  guestArrow: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.whiteAlpha80,
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
