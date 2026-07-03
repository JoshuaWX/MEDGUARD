/**
 * SplashScreen - fast branded MedGuard loader.
 *
 * A short health-tech intro for mobile startup: shield, pulse, ECG line,
 * wordmark, then a smooth handoff to the app.
 */

import React, { memo, useEffect } from 'react';
import { Dimensions, Platform, StatusBar, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { ShieldIcon } from '../components';
import { Colors, FontFamily, FontSize, Spacing } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const SPLASH_DURATION = 2100;

const LOGO_SIZE = 76;
const ECG_WIDTH = Math.min(SCREEN_WIDTH - 72, 360);
const ECG_HEIGHT = 42;
const isLowEndDevice = Platform.OS === 'android' && Platform.Version < 28;

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const ECGLine = memo(() => {
  const segment = ECG_WIDTH / 4;
  const y = ECG_HEIGHT / 2;
  const path = [
    `M0 ${y}`,
    `L${segment * 0.45} ${y}`,
    `L${segment * 0.55} ${y - 8}`,
    `L${segment * 0.64} ${y + 9}`,
    `L${segment * 0.74} ${y - 14}`,
    `L${segment * 0.88} ${y}`,
    `L${segment * 1.55} ${y}`,
    `L${segment * 1.66} ${y + 8}`,
    `L${segment * 1.78} ${y - 10}`,
    `L${segment * 1.9} ${y}`,
    `L${ECG_WIDTH} ${y}`,
  ].join(' ');

  return (
    <Svg width={ECG_WIDTH} height={ECG_HEIGHT} viewBox={`0 0 ${ECG_WIDTH} ${ECG_HEIGHT}`}>
      <Path
        d={path}
        stroke="rgba(255,255,255,0.78)"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
});

ECGLine.displayName = 'ECGLine';

const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  const screenOpacity = useSharedValue(1);
  const markOpacity = useSharedValue(0);
  const markScale = useSharedValue(0.92);
  const ringScale = useSharedValue(0.82);
  const ringOpacity = useSharedValue(0.55);
  const ecgProgress = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const textTranslate = useSharedValue(10);

  useEffect(() => {
    markOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    markScale.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });

    ringScale.value = withRepeat(
      withSequence(
        withTiming(1.18, { duration: isLowEndDevice ? 1200 : 950, easing: Easing.out(Easing.cubic) }),
        withTiming(0.92, { duration: 0 })
      ),
      -1,
      false
    );
    ringOpacity.value = withRepeat(
      withSequence(
        withTiming(0.08, { duration: isLowEndDevice ? 1200 : 950, easing: Easing.out(Easing.cubic) }),
        withTiming(0.52, { duration: 0 })
      ),
      -1,
      false
    );

    ecgProgress.value = withDelay(360, withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) }));
    textOpacity.value = withDelay(680, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));
    textTranslate.value = withDelay(680, withTiming(0, { duration: 420, easing: Easing.out(Easing.cubic) }));
    screenOpacity.value = withDelay(1780, withTiming(0, { duration: 260, easing: Easing.inOut(Easing.cubic) }));

    const timer = setTimeout(onAnimationComplete, SPLASH_DURATION);
    return () => clearTimeout(timer);
  }, [ecgProgress, markOpacity, markScale, onAnimationComplete, ringOpacity, ringScale, screenOpacity, textOpacity, textTranslate]);

  const screenStyle = useAnimatedStyle(() => ({
    opacity: screenOpacity.value,
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  const ecgMaskStyle = useAnimatedStyle(() => ({
    width: interpolate(ecgProgress.value, [0, 1], [0, ECG_WIDTH]),
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslate.value }],
  }));

  return (
    <Animated.View style={[styles.container, screenStyle]}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.backgroundDark, '#102d38', '#073f4d']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center}>
        <View style={styles.markWrap}>
          <Animated.View style={[styles.pulseRing, ringStyle]} />
          <Animated.View style={[styles.logoPlate, logoStyle]}>
            <LinearGradient
              colors={[Colors.primary, Colors.emerald]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoGradient}
            >
              <ShieldIcon size={42} color={Colors.textLight} />
            </LinearGradient>
          </Animated.View>
        </View>

        <View style={styles.ecgTrack}>
          <Animated.View style={[styles.ecgMask, ecgMaskStyle]}>
            <ECGLine />
          </Animated.View>
        </View>

        <Animated.View style={[styles.copy, textStyle]}>
          <Text style={styles.brand}>MedGuard</Text>
          <Text style={styles.tagline}>Health awareness, closer to home</Text>
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  markWrap: {
    width: 132,
    height: 132,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 124,
    height: 124,
    borderRadius: 62,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.42)',
    backgroundColor: 'rgba(17,180,212,0.08)',
  },
  logoPlate: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOpacity: 0.32,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  logoGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ecgTrack: {
    width: ECG_WIDTH,
    height: ECG_HEIGHT,
    marginTop: Spacing.lg,
    overflow: 'hidden',
  },
  ecgMask: {
    height: ECG_HEIGHT,
    overflow: 'hidden',
  },
  copy: {
    alignItems: 'center',
    marginTop: Spacing.base,
  },
  brand: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize['3xl'],
    color: Colors.textLight,
    letterSpacing: -0.4,
  },
  tagline: {
    marginTop: Spacing.xs,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.74)',
    letterSpacing: 0,
  },
});

export default SplashScreen;
