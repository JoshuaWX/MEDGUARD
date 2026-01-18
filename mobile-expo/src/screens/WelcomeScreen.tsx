/**
 * WelcomeScreen
 * Premium welcome experience with creative splash animation and modern UI
 */

import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  StatusBar,
  ImageBackground,
  Pressable,
} from 'react-native';
import Svg, { Path, Circle, Defs, RadialGradient, Stop, G } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
  withSpring,
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  FadeIn,
  FadeInUp,
  FadeInDown,
  SlideInUp,
  ZoomIn,
  FadeOut,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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

// Rotating background images - health/medical themed
const HERO_IMAGES = [
  'https://images.unsplash.com/photo-1584982751601-97dcc096659c?auto=format&fit=crop&w=1200&q=80', // Medical professional
  'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1200&q=80', // Doctor with stethoscope
  'https://images.unsplash.com/photo-1631217868264-e5b90bb7e133?auto=format&fit=crop&w=1200&q=80', // Healthcare technology
  'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1200&q=80', // Medical equipment
  'https://images.unsplash.com/photo-1530026405186-ed1f139313f8?auto=format&fit=crop&w=1200&q=80', // Health monitoring
  'https://images.unsplash.com/photo-1551190822-a9333d879b1f?auto=format&fit=crop&w=1200&q=80', // Medical team
];

const IMAGE_CHANGE_INTERVAL = 5000; // Change image every 5 seconds

const AnimatedImageBackground = Animated.createAnimatedComponent(ImageBackground);
const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);
const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Language options
const LANGUAGES = [
  { code: 'en' as LangCode, label: '🌐 English' },
  { code: 'yo' as LangCode, label: '🌐 Yorùbá' },
  { code: 'ha' as LangCode, label: '🌐 Hausa' },
  { code: 'ig' as LangCode, label: '🌐 Igbo' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SPLASH LOADING ANIMATION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

interface SplashLoaderProps {
  onFinish: () => void;
}

const SplashLoader: React.FC<SplashLoaderProps> = ({ onFinish }) => {
  // Main animation progress
  const progress = useSharedValue(0);
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const ringScale1 = useSharedValue(0.5);
  const ringScale2 = useSharedValue(0.5);
  const ringScale3 = useSharedValue(0.5);
  const ringOpacity = useSharedValue(0);
  const heartbeatScale = useSharedValue(1);
  const textOpacity = useSharedValue(0);
  const textTranslateY = useSharedValue(20);
  const exitOpacity = useSharedValue(1);
  const exitScale = useSharedValue(1);
  
  // Heartbeat line animation
  const heartbeatProgress = useSharedValue(0);
  
  // DNA helix rotation
  const helixRotation = useSharedValue(0);
  
  // Particle positions
  const particleAngles = Array.from({ length: 8 }, () => useSharedValue(0));
  const particleOpacities = Array.from({ length: 8 }, () => useSharedValue(0));

  const finishAnimation = useCallback(() => {
    onFinish();
  }, [onFinish]);

  useEffect(() => {
    // Phase 1: Logo entrance with bounce (0-600ms)
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withDelay(100, withSpring(1, { damping: 12, stiffness: 100 }));
    
    // Phase 2: Heartbeat effect (400-1200ms)
    heartbeatScale.value = withDelay(400, withSequence(
      withTiming(1.15, { duration: 150, easing: Easing.out(Easing.ease) }),
      withTiming(0.95, { duration: 100, easing: Easing.in(Easing.ease) }),
      withTiming(1.1, { duration: 120, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 150, easing: Easing.inOut(Easing.ease) })
    ));
    
    // Phase 3: Expanding rings (500-1500ms)
    ringOpacity.value = withDelay(500, withTiming(0.8, { duration: 300 }));
    
    ringScale1.value = withDelay(500, withSequence(
      withTiming(1.8, { duration: 800, easing: Easing.out(Easing.ease) }),
      withTiming(1.8, { duration: 200 })
    ));
    
    ringScale2.value = withDelay(650, withSequence(
      withTiming(2.2, { duration: 800, easing: Easing.out(Easing.ease) }),
      withTiming(2.2, { duration: 200 })
    ));
    
    ringScale3.value = withDelay(800, withSequence(
      withTiming(2.6, { duration: 800, easing: Easing.out(Easing.ease) }),
      withTiming(2.6, { duration: 200 })
    ));
    
    // Ring fade out
    ringOpacity.value = withDelay(1100, withTiming(0, { duration: 400 }));
    
    // Phase 4: Heartbeat line animation (600-1400ms)
    heartbeatProgress.value = withDelay(600, withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }));
    
    // Phase 5: DNA helix rotation (continuous from 800ms)
    helixRotation.value = withDelay(800, withRepeat(
      withTiming(360, { duration: 3000, easing: Easing.linear }),
      -1,
      false
    ));
    
    // Phase 6: Orbiting particles (800-1800ms)
    particleAngles.forEach((angle, index) => {
      const startAngle = (index / 8) * 360;
      angle.value = withDelay(800 + index * 50, withRepeat(
        withTiming(startAngle + 360, { duration: 2000, easing: Easing.linear }),
        -1,
        false
      ));
    });
    
    particleOpacities.forEach((opacity, index) => {
      opacity.value = withDelay(800 + index * 50, withSequence(
        withTiming(1, { duration: 200 }),
        withTiming(1, { duration: 600 }),
        withTiming(0, { duration: 200 })
      ));
    });
    
    // Phase 7: Text reveal (1000-1400ms)
    textOpacity.value = withDelay(1000, withTiming(1, { duration: 400 }));
    textTranslateY.value = withDelay(1000, withSpring(0, { damping: 15, stiffness: 100 }));
    
    // Phase 8: Second heartbeat (1400-1700ms)
    heartbeatScale.value = withDelay(1400, withSequence(
      withTiming(1.12, { duration: 120, easing: Easing.out(Easing.ease) }),
      withTiming(0.97, { duration: 80, easing: Easing.in(Easing.ease) }),
      withTiming(1.08, { duration: 100, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 120, easing: Easing.inOut(Easing.ease) })
    ));
    
    // Phase 9: Exit animation (2200-2800ms)
    exitScale.value = withDelay(2200, withTiming(1.1, { duration: 300, easing: Easing.out(Easing.ease) }));
    exitOpacity.value = withDelay(2400, withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }));
    
    // Trigger finish callback
    const timer = setTimeout(() => {
      finishAnimation();
    }, 2800);
    
    return () => clearTimeout(timer);
  }, []);

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [{ scale: exitScale.value }],
  }));

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value * heartbeatScale.value },
    ],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: interpolate(ringOpacity.value, [0, 0.8], [0, 0.6]),
    transform: [{ scale: ringScale1.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: interpolate(ringOpacity.value, [0, 0.8], [0, 0.4]),
    transform: [{ scale: ringScale2.value }],
  }));

  const ring3Style = useAnimatedStyle(() => ({
    opacity: interpolate(ringOpacity.value, [0, 0.8], [0, 0.2]),
    transform: [{ scale: ringScale3.value }],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const helixStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${helixRotation.value}deg` }],
  }));

  // Generate particle styles
  const particleStyles = particleAngles.map((angle, index) => 
    useAnimatedStyle(() => {
      const radius = 70;
      const x = Math.cos((angle.value * Math.PI) / 180) * radius;
      const y = Math.sin((angle.value * Math.PI) / 180) * radius;
      return {
        opacity: particleOpacities[index].value,
        transform: [
          { translateX: x },
          { translateY: y },
          { scale: interpolate(particleOpacities[index].value, [0, 1], [0.5, 1]) },
        ],
      };
    })
  );

  return (
    <Animated.View style={[splashStyles.container, containerStyle]}>
      <LinearGradient
        colors={['#0f172a', '#0d9488', '#10b981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      
      {/* Background glow */}
      <View style={splashStyles.glowContainer}>
        <LinearGradient
          colors={['rgba(16, 185, 129, 0.3)', 'rgba(17, 180, 212, 0.2)', 'transparent']}
          style={splashStyles.backgroundGlow}
        />
      </View>

      {/* Center content */}
      <View style={splashStyles.centerContent}>
        {/* Expanding rings */}
        <Animated.View style={[splashStyles.ring, ring1Style]} />
        <Animated.View style={[splashStyles.ring, ring2Style]} />
        <Animated.View style={[splashStyles.ring, ring3Style]} />

        {/* Orbiting particles */}
        {particleStyles.map((style, index) => (
          <Animated.View key={index} style={[splashStyles.particle, style]} />
        ))}

        {/* DNA Helix decoration */}
        <Animated.View style={[splashStyles.helixContainer, helixStyle]}>
          <Svg width={180} height={180} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="helixGrad" cx="50%" cy="50%" r="50%">
                <Stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
                <Stop offset="100%" stopColor="transparent" />
              </RadialGradient>
            </Defs>
            <Circle cx="50" cy="50" r="45" fill="url(#helixGrad)" />
            {/* Helix strands */}
            <G opacity={0.4}>
              <Circle cx="50" cy="15" r="3" fill="#10b981" />
              <Circle cx="85" cy="50" r="3" fill="#0d9488" />
              <Circle cx="50" cy="85" r="3" fill="#10b981" />
              <Circle cx="15" cy="50" r="3" fill="#0d9488" />
            </G>
          </Svg>
        </Animated.View>

        {/* Main Logo */}
        <Animated.View style={[splashStyles.logoContainer, logoStyle]}>
          <LinearGradient
            colors={['#10b981', '#0d9488', '#11b4d4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={splashStyles.logoGradient}
          >
            <View style={splashStyles.logoInner}>
              <ShieldIcon size={50} color="#fff" />
            </View>
          </LinearGradient>
          
          {/* Logo shine effect */}
          <View style={splashStyles.logoShine} />
        </Animated.View>

        {/* Heartbeat line */}
        <View style={splashStyles.heartbeatContainer}>
          <Svg width={200} height={40} viewBox="0 0 200 40">
            <Path
              d="M0 20 L30 20 L40 20 L50 8 L60 32 L70 12 L80 28 L90 20 L100 20 L200 20"
              stroke="rgba(16, 185, 129, 0.6)"
              strokeWidth={2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>

      {/* App name and tagline */}
      <Animated.View style={[splashStyles.textContainer, textStyle]}>
        <Text style={splashStyles.appName}>MEDGUARD</Text>
        <Text style={splashStyles.tagline}>Your Health Guardian</Text>
        
        {/* Loading dots */}
        <View style={splashStyles.loadingDots}>
          <LoadingDot delay={0} />
          <LoadingDot delay={150} />
          <LoadingDot delay={300} />
        </View>
      </Animated.View>
    </Animated.View>
  );
};

// Loading dot component
const LoadingDot: React.FC<{ delay: number }> = ({ delay }) => {
  const opacity = useSharedValue(0.3);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration: 400 }),
        withTiming(0.3, { duration: 400 })
      ),
      -1,
      true
    ));
    
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1.2, { duration: 400 }),
        withTiming(0.8, { duration: 400 })
      ),
      -1,
      true
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={[splashStyles.dot, style]} />;
};

const splashStyles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backgroundGlow: {
    width: SCREEN_WIDTH * 1.5,
    height: SCREEN_WIDTH * 1.5,
    borderRadius: SCREEN_WIDTH * 0.75,
  },
  centerContent: {
    width: 200,
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  helixContainer: {
    position: 'absolute',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoGradient: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoShine: {
    position: 'absolute',
    top: 8,
    left: 20,
    width: 30,
    height: 15,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    transform: [{ rotate: '-20deg' }],
  },
  heartbeatContainer: {
    position: 'absolute',
    bottom: -60,
    opacity: 0.6,
  },
  textContainer: {
    position: 'absolute',
    bottom: SCREEN_HEIGHT * 0.18,
    alignItems: 'center',
  },
  appName: {
    fontFamily: FontFamily.bold,
    fontSize: 32,
    color: '#fff',
    letterSpacing: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
    letterSpacing: 1,
  },
  loadingDots: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
});

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED COMPONENTS FOR WELCOME SCREEN
// ═══════════════════════════════════════════════════════════════════════════════

// Animated Pulse Ring Component
const PulseRing: React.FC<{ delay: number; size: number }> = ({ delay, size }) => {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const startAnimation = () => {
      scale.value = 0.8;
      opacity.value = 0.6;
      
      scale.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(1.5, { duration: 2000, easing: Easing.out(Easing.ease) }),
          withTiming(0.8, { duration: 0 })
        ),
        -1,
        false
      ));
      
      opacity.value = withDelay(delay, withRepeat(
        withSequence(
          withTiming(0, { duration: 2000, easing: Easing.out(Easing.ease) }),
          withTiming(0.6, { duration: 0 })
        ),
        -1,
        false
      ));
    };
    
    startAnimation();
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: size / 2,
      borderWidth: 2,
      borderColor: 'rgba(255, 255, 255, 0.4)',
    }, style]} />
  );
};

// Animated Floating Particle
const FloatingParticle: React.FC<{ delay: number; startX: number; startY: number }> = ({ delay, startX, startY }) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-100, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    ));
    
    translateX.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(Math.random() * 40 - 20, { duration: 4000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    ));
    
    opacity.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(0.8, { duration: 500 }),
        withTiming(0.8, { duration: 3000 }),
        withTiming(0, { duration: 500 }),
        withTiming(0, { duration: 0 })
      ),
      -1,
      false
    ));
    
    scale.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(1, { duration: 500 }),
        withTiming(0.5, { duration: 3500 }),
        withTiming(0.5, { duration: 0 })
      ),
      -1,
      false
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[{
      position: 'absolute',
      left: startX,
      top: startY,
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: 'rgba(255, 255, 255, 0.6)',
    }, style]} />
  );
};

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { lang, setLang, t } = useI18n();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  
  // Background image carousel state - using refs to avoid stale closure issues
  const [image1Index, setImage1Index] = useState(0);
  const [image2Index, setImage2Index] = useState(1);
  const imageOpacity1 = useSharedValue(1);
  const imageOpacity2 = useSharedValue(0);
  const currentImageIndexRef = useRef(0);
  const activeLayerRef = useRef<1 | 2>(1);
  const isTransitioningRef = useRef(false);

  // Handle splash finish
  const handleSplashFinish = useCallback(() => {
    setShowSplash(false);
  }, []);

  // Background image rotation effect - single interval, no dependencies on changing state
  useEffect(() => {
    if (showSplash) return;
    
    const rotateImages = () => {
      // Prevent overlapping transitions
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;
      
      // Calculate next image index
      const nextIdx = (currentImageIndexRef.current + 1) % HERO_IMAGES.length;
      currentImageIndexRef.current = nextIdx;
      
      if (activeLayerRef.current === 1) {
        // Layer 1 is visible, prepare layer 2 with next image and fade it in
        setImage2Index(nextIdx);
        
        // Small delay to ensure image is set before fading
        setTimeout(() => {
          imageOpacity2.value = withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) });
          imageOpacity1.value = withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) });
          
          // After fade completes, switch active layer
          setTimeout(() => {
            activeLayerRef.current = 2;
            isTransitioningRef.current = false;
          }, 1600);
        }, 100);
      } else {
        // Layer 2 is visible, prepare layer 1 with next image and fade it in
        setImage1Index(nextIdx);
        
        // Small delay to ensure image is set before fading
        setTimeout(() => {
          imageOpacity1.value = withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) });
          imageOpacity2.value = withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) });
          
          // After fade completes, switch active layer
          setTimeout(() => {
            activeLayerRef.current = 1;
            isTransitioningRef.current = false;
          }, 1600);
        }, 100);
      }
    };
    
    const interval = setInterval(rotateImages, IMAGE_CHANGE_INTERVAL);
    
    return () => clearInterval(interval);
  }, [showSplash]); // Only depends on showSplash

  // Intro animation values
  const logoScale = useSharedValue(0);
  const logoRotate = useSharedValue(-15);
  const contentOpacity = useSharedValue(0);
  
  // Background animation
  const bgZoom = useSharedValue(1);
  const bgOpacity = useSharedValue(0);
  
  // Logo glow pulse
  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    // Only start animations after splash finishes
    if (showSplash) return;
    
    // Phase 1: Background fade in with zoom
    bgOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) });
    
    // Continuous slow zoom
    bgZoom.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 15000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 15000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Phase 2: Logo entrance with spring bounce
    logoScale.value = withDelay(200, withSpring(1, { 
      damping: 12, 
      stiffness: 100,
      mass: 1 
    }));
    
    logoRotate.value = withDelay(200, withSequence(
      withTiming(8, { duration: 300 }),
      withTiming(-4, { duration: 200 }),
      withTiming(0, { duration: 150 })
    ));

    // Phase 3: Show content
    contentOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    
    setTimeout(() => setShowContent(true), 400);

    // Continuous glow pulse
    glowScale.value = withDelay(600, withRepeat(
      withSequence(
        withTiming(1.3, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
    
    glowOpacity.value = withDelay(600, withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    ));
  }, [showSplash]);

  // Animated styles
  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
    transform: [{ scale: bgZoom.value }],
  }));

  // Crossfade image styles
  const image1Style = useAnimatedStyle(() => ({
    opacity: imageOpacity1.value,
  }));

  const image2Style = useAnimatedStyle(() => ({
    opacity: imageOpacity2.value,
  }));

  const logoContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: logoScale.value },
      { rotate: `${logoRotate.value}deg` },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const handleSignUp = () => navigation.navigate('SignUp');
  const handleSignIn = () => navigation.navigate('SignIn');
  const handleGuest = () => navigation.navigate('MainTabs');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      
      {/* Splash Loading Animation */}
      {showSplash && <SplashLoader onFinish={handleSplashFinish} />}
      
      {/* Dual Background Images for Crossfade Effect */}
      <Animated.View style={[StyleSheet.absoluteFill, bgStyle]}>
        {/* First Image Layer */}
        <AnimatedImageBackground
          source={{ uri: HERO_IMAGES[image1Index] }}
          style={[StyleSheet.absoluteFill, image1Style]}
          imageStyle={styles.heroImage}
        />
        
        {/* Second Image Layer */}
        <AnimatedImageBackground
          source={{ uri: HERO_IMAGES[image2Index] }}
          style={[StyleSheet.absoluteFill, image2Style]}
          imageStyle={styles.heroImage}
        />
        
        {/* Gradient Overlay */}
        <LinearGradient
          colors={['rgba(15, 23, 42, 0.4)', 'rgba(17, 180, 212, 0.55)', 'rgba(16, 185, 129, 0.8)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* Floating Particles */}
      <View style={styles.particlesContainer} pointerEvents="none">
        <FloatingParticle delay={0} startX={SCREEN_WIDTH * 0.2} startY={SCREEN_HEIGHT * 0.6} />
        <FloatingParticle delay={500} startX={SCREEN_WIDTH * 0.5} startY={SCREEN_HEIGHT * 0.7} />
        <FloatingParticle delay={1000} startX={SCREEN_WIDTH * 0.8} startY={SCREEN_HEIGHT * 0.5} />
        <FloatingParticle delay={1500} startX={SCREEN_WIDTH * 0.3} startY={SCREEN_HEIGHT * 0.8} />
        <FloatingParticle delay={2000} startX={SCREEN_WIDTH * 0.7} startY={SCREEN_HEIGHT * 0.65} />
        <FloatingParticle delay={2500} startX={SCREEN_WIDTH * 0.1} startY={SCREEN_HEIGHT * 0.75} />
      </View>

      {/* Floating Shapes */}
      <FloatingShape size={100} top={100} left={-30} delay={200} duration={8000} />
      <FloatingShape size={70} top={180} right={20} delay={400} duration={6000} />
      <FloatingShape size={50} bottom={280} left={40} delay={600} duration={7000} />

      {/* Main Content */}
      <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
        {/* Header Section */}
        <View style={styles.header}>
          {/* Logo with Pulse Rings */}
          <View style={styles.logoWrapper}>
            <PulseRing delay={0} size={160} />
            <PulseRing delay={700} size={160} />
            <PulseRing delay={1400} size={160} />
            
            {/* Glow Effect */}
            <Animated.View style={[styles.logoGlow, glowStyle]}>
              <LinearGradient
                colors={['rgba(16, 185, 129, 0.5)', 'rgba(17, 180, 212, 0.4)', 'transparent']}
                style={styles.glowGradient}
              />
            </Animated.View>

            {/* Main Logo */}
            <Animated.View style={[styles.logoContainer, logoContainerStyle]}>
              <BlurView intensity={20} tint="light" style={styles.logoBlur}>
                <LinearGradient
                  colors={[Colors.primary, Colors.emerald]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.logoGradient}
                >
                  <ShieldIcon size={44} color={Colors.textLight} />
                </LinearGradient>
              </BlurView>
            </Animated.View>
          </View>

          {/* Text Content */}
          <Animated.View style={contentStyle}>
            {showContent && (
              <>
                <Animated.Text 
                  entering={FadeInUp.delay(0).duration(600).springify()}
                  style={styles.title}
                >
                  {t('app_name')}
                </Animated.Text>

                <Animated.Text 
                  entering={FadeInUp.delay(100).duration(600).springify()}
                  style={styles.subtitle}
                >
                  {t('tagline')}
                </Animated.Text>

                <Animated.Text 
                  entering={FadeInUp.delay(200).duration(600).springify()}
                  style={styles.description}
                >
                  Stay informed with real-time health alerts tailored to your location
                </Animated.Text>

                {/* Language Selector */}
                <Animated.View 
                  entering={FadeInUp.delay(300).duration(600)}
                  style={styles.langContainer}
                >
                  <Pressable
                    style={styles.langSelector}
                    onPress={() => setShowLangPicker(!showLangPicker)}
                  >
                    <Text style={styles.langText}>
                      {LANGUAGES.find(l => l.code === lang)?.label || '🌐 English'}
                    </Text>
                    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5}>
                      <Path d="M6 9l6 6 6-6" />
                    </Svg>
                  </Pressable>
                  
                  {showLangPicker && (
                    <View style={styles.langDropdown}>
                      {LANGUAGES.map(opt => (
                        <Pressable
                          key={opt.code}
                          style={[styles.langOption, opt.code === lang && styles.langOptionSelected]}
                          onPress={() => {
                            void setLang(opt.code);
                            setShowLangPicker(false);
                          }}
                        >
                          <Text style={[styles.langOptionText, opt.code === lang && styles.langOptionActive]}>
                            {opt.label}
                          </Text>
                          {opt.code === lang && <Text style={styles.langCheck}>✓</Text>}
                        </Pressable>
                      ))}
                    </View>
                  )}
                </Animated.View>
              </>
            )}
          </Animated.View>
        </View>

        {/* Footer Section */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
          {showContent && (
            <>
              {/* Feature Cards */}
              <Animated.View 
                entering={FadeInUp.delay(400).duration(600).springify()}
                style={styles.featureCardContainer}
              >
                <BlurView intensity={25} tint="light" style={styles.featureCard}>
                  <View style={styles.featureRow}>
                    <FeatureIconSvg type="bell" label={t('feature_realtime_alerts')} index={0} />
                    <FeatureIconSvg type="location" label={t('feature_location_based')} index={1} />
                    <FeatureIconSvg type="heart" label={t('feature_health_tracking')} index={2} />
                  </View>
                </BlurView>
              </Animated.View>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                <Animated.View entering={FadeInUp.delay(500).duration(500).springify()}>
                  <Pressable 
                    onPress={handleSignUp} 
                    style={({ pressed }) => [
                      styles.getStartedBtn,
                      pressed && styles.btnPressed
                    ]}
                  >
                    <LinearGradient
                      colors={['#ffffff', '#f8fafc']}
                      style={styles.getStartedGradient}
                    >
                      <Text style={styles.getStartedText}>{t('get_started')}</Text>
                      <View style={styles.arrowContainer}>
                        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={Colors.primary} strokeWidth={2.5}>
                          <Path d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </Svg>
                      </View>
                    </LinearGradient>
                  </Pressable>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(600).duration(500).springify()}>
                  <Pressable 
                    onPress={handleSignIn} 
                    style={({ pressed }) => [
                      styles.signInBtn,
                      pressed && styles.btnPressedGlass
                    ]}
                  >
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
                      <Path d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </Svg>
                    <Text style={styles.signInText}>{t('login')}</Text>
                  </Pressable>
                </Animated.View>

                <Animated.View entering={FadeInUp.delay(700).duration(500)}>
                  <Pressable onPress={handleGuest} style={styles.guestBtn}>
                    <Text style={styles.guestBtnText}>{t('guest_continue')}</Text>
                    <Text style={styles.guestArrow}>→</Text>
                  </Pressable>
                </Animated.View>
              </View>

              {/* Terms */}
              <Animated.Text 
                entering={FadeIn.delay(800).duration(500)}
                style={styles.terms}
              >
                {t('terms_privacy')}
              </Animated.Text>
            </>
          )}
        </View>
      </View>
    </View>
  );
};

// SVG Feature Icon Component with smooth animation
interface FeatureIconSvgProps {
  type: 'bell' | 'location' | 'heart';
  label: string;
  index: number;
}

const FeatureIconSvg: React.FC<FeatureIconSvgProps> = ({ type, label, index }) => {
  const scale = useSharedValue(0.8);
  const opacity = useSharedValue(0);

  useEffect(() => {
    const delay = 500 + index * 120;
    scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 100 }));
    opacity.value = withDelay(delay, withTiming(1, { duration: 400 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const renderIcon = () => {
    switch (type) {
      case 'bell':
        return (
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
            <Path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </Svg>
        );
      case 'location':
        return (
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
            <Path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <Path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </Svg>
        );
      case 'heart':
        return (
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2}>
            <Path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </Svg>
        );
    }
  };

  return (
    <Animated.View style={[styles.featureItem, animatedStyle]}>
      <LinearGradient
        colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.1)']}
        style={styles.featureIconCircle}
      >
        {renderIcon()}
      </LinearGradient>
      <Text style={styles.featureLabel}>{label}</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.primary,
  },
  heroImage: {
    resizeMode: 'cover',
  },
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
  },
  header: {
    alignItems: 'center',
    paddingTop: Spacing['2xl'],
  },

  /* ─── Logo Section ─── */
  logoWrapper: {
    width: 160,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  logoGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
  },
  glowGradient: {
    flex: 1,
    borderRadius: 90,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBlur: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  logoGradient: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.primaryLg,
  },

  /* ─── Text Content ─── */
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['4xl'],
    color: Colors.textLight,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.25)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.whiteAlpha90,
    marginTop: Spacing.sm,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.15)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  description: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.75)',
    marginTop: Spacing.md,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 22,
  },

  /* ─── Language Selector ─── */
  langContainer: {
    marginTop: Spacing.xl,
    zIndex: 10,
  },
  langSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  langText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textLight,
  },
  langDropdown: {
    position: 'absolute',
    top: 48,
    left: -20,
    right: -20,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    ...Shadows.xl,
    overflow: 'hidden',
    paddingVertical: Spacing.xs,
  },
  langOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    marginHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
  },
  langOptionSelected: {
    backgroundColor: 'rgba(17, 180, 212, 0.1)',
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
  langCheck: {
    color: Colors.primary,
    fontWeight: 'bold',
  },

  /* ─── Footer ─── */
  footer: {
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
  },
  featureCardContainer: {
    marginBottom: Spacing.lg,
    overflow: 'hidden',
    borderRadius: BorderRadius.xl,
  },
  featureCard: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  featureRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  featureLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
  },

  /* ─── Buttons ─── */
  buttonContainer: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  getStartedBtn: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.xl,
  },
  getStartedGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    paddingHorizontal: Spacing.xl,
  },
  getStartedText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.primary,
  },
  arrowContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(17, 180, 212, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
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
    gap: 6,
    height: 44,
    backgroundColor: 'transparent',
  },
  guestBtnText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  guestArrow: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  btnPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  btnPressedGlass: {
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
  },

  /* ─── Terms ─── */
  terms: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
    lineHeight: 18,
  },
});

export default WelcomeScreen;
