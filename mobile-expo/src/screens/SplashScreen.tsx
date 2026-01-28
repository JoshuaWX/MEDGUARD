/**
 * SplashScreen - MedGuard Animated Loading Screen
 * 
 * Animation Timeline (~5.5 seconds total):
 * ─────────────────────────────────────────────────────────────
 * 0ms        - Screen starts pure white
 * 0-200ms    - Logo + circle fade in on the RIGHT side
 * 200-2000ms - Logo + circle spin VERY FAST in place (5+ rotations)
 * 2000-2500ms - ECG "road" fades/eases in beneath
 * 2500-4000ms - Logo rolls LEFT over the road, rotation gradually slows
 * 4000-4500ms - "MedGuard" text appears
 * 4500-5300ms - Checkmark draws slowly
 * 5300-5500ms - Brief hold, then transition to app
 * ─────────────────────────────────────────────────────────────
 */

import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, Text } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle as SvgCircle } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withDelay,
  withSpring,
  withSequence,
  withRepeat,
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { FontFamily, Colors } from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Animation duration constants
export const SPLASH_DURATION = 5500;

const LOGO_SIZE = 72;
const CIRCLE_SIZE = LOGO_SIZE + 24; // Circle is larger than logo

// Logo starts on the RIGHT, rolls to final position on the LEFT
const LOGO_START_X = SCREEN_WIDTH * 0.28;  // Start position (right of center)
const LOGO_END_X = -65;                     // End position (left of center)

// ECG line configuration
const ECG_WIDTH = SCREEN_WIDTH * 2.5;
const ECG_HEIGHT = 40;

interface SplashScreenProps {
  onAnimationComplete: () => void;
}

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedSvgCircle = Animated.createAnimatedComponent(SvgCircle);

// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD LOGO WITH CIRCLE (without checkmark)
// ═══════════════════════════════════════════════════════════════════════════════
interface ShieldLogoProps {
  size: number;
  circleOpacity: SharedValue<number>;
}

const ShieldLogoWithCircle: React.FC<ShieldLogoProps> = ({ size, circleOpacity }) => {
  const circleRadius = (size + 20) / 2;
  const circumference = 2 * Math.PI * circleRadius;
  // Dashed pattern: 85% solid, 15% gap - creates a visible "notch" so rotation is visible
  const dashLength = circumference * 0.85;
  const gapLength = circumference * 0.15;
  
  const animatedCircleProps = useAnimatedProps(() => ({
    strokeOpacity: circleOpacity.value,
  }));

  return (
    <View style={{ width: size + 24, height: size + 24, alignItems: 'center', justifyContent: 'center' }}>
      {/* Outer circle with dash pattern so rotation is visible */}
      <Svg 
        width={size + 24} 
        height={size + 24} 
        viewBox={`0 0 ${size + 24} ${size + 24}`}
        style={StyleSheet.absoluteFill}
      >
        <AnimatedSvgCircle
          cx={(size + 24) / 2}
          cy={(size + 24) / 2}
          r={circleRadius}
          stroke={Colors.primary}
          strokeWidth={2.5}
          fill="none"
          strokeDasharray={`${dashLength} ${gapLength}`}
          strokeLinecap="round"
          animatedProps={animatedCircleProps}
        />
      </Svg>
      
      {/* Shield logo centered inside */}
      <Svg width={size} height={size} viewBox="0 0 256 256">
        <Defs>
          <LinearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={Colors.primary} />
            <Stop offset="100%" stopColor={Colors.emerald} />
          </LinearGradient>
        </Defs>
        <Path
          d="M208,40H48A16,16,0,0,0,32,56v58.78c0,89.61,75.82,119.34,91,124.39a15.53,15.53,0,0,0,10,0c15.2-5.05,91-34.78,91-124.39V56A16,16,0,0,0,208,40Zm0,74.79c0,78.42-66.35,104.62-80,109.18-13.53-4.52-80-30.69-80-109.18V56H208Z"
          fill="url(#shieldGrad)"
        />
      </Svg>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ANIMATED CHECKMARK (draws slowly like handwriting)
// ═══════════════════════════════════════════════════════════════════════════════
interface AnimatedCheckmarkProps {
  size: number;
  progress: SharedValue<number>;
}

const AnimatedCheckmark: React.FC<AnimatedCheckmarkProps> = ({ size, progress }) => {
  const STROKE_LENGTH = 50;
  const checkSize = size * 0.45;
  
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: STROKE_LENGTH * (1 - progress.value),
  }));

  // Centered absolutely within the logoContainer
  return (
    <View style={{
      position: 'absolute',
      width: checkSize,
      height: checkSize,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <Svg 
        width={checkSize} 
        height={checkSize} 
        viewBox="0 0 24 24"
      >
        <AnimatedPath
          d="M5 12 L10 17 L19 7"
          stroke={Colors.emerald}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          strokeDasharray={STROKE_LENGTH}
          animatedProps={animatedProps}
        />
      </Svg>
    </View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// ECG LINE (animated heartbeat "road") - LIVE continuous scrolling
// ═══════════════════════════════════════════════════════════════════════════════
interface ECGLineProps {
  scrollProgress: SharedValue<number>;
  drawProgress: SharedValue<number>;
  isLive: SharedValue<number>;  // Controls continuous animation
}

const ECGLine: React.FC<ECGLineProps> = ({ scrollProgress, drawProgress, isLive }) => {
  // Create a repeating ECG pattern - longer for seamless looping
  const SEGMENT_WIDTH = 80;
  const createECGPath = () => {
    const segments = Math.ceil(ECG_WIDTH / SEGMENT_WIDTH) + 2;
    let path = 'M0,20 ';
    
    for (let i = 0; i < segments; i++) {
      const x = i * SEGMENT_WIDTH;
      // Flat line → small bump → big spike → recovery → flat
      path += `L${x + 15},20 `;
      path += `L${x + 20},16 `;
      path += `L${x + 25},20 `;
      path += `L${x + 35},20 `;
      path += `L${x + 40},8 `;   // Peak up
      path += `L${x + 45},32 `;  // Deep down
      path += `L${x + 50},14 `;  // Recovery up
      path += `L${x + 55},20 `;
      path += `L${x + 80},20 `;
    }
    
    return path;
  };

  const ecgStyle = useAnimatedStyle(() => {
    // Base scroll from logo rolling
    const baseScroll = interpolate(scrollProgress.value, [0, 1], [0, -ECG_WIDTH * 0.2]);
    
    // Continuous "live" scroll - loops one segment width
    const liveScroll = interpolate(isLive.value, [0, 1], [0, -SEGMENT_WIDTH]);
    
    return {
      opacity: drawProgress.value,
      transform: [
        { translateX: baseScroll + liveScroll },
      ],
    };
  });

  return (
    <Animated.View style={[styles.ecgContainer, ecgStyle]}>
      <Svg width={ECG_WIDTH} height={ECG_HEIGHT} viewBox={`0 0 ${ECG_WIDTH} ${ECG_HEIGHT}`}>
        <Path
          d={createECGPath()}
          stroke={Colors.primary}
          strokeWidth={2}
          strokeOpacity={0.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Animated.View>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN SPLASH SCREEN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const SplashScreen: React.FC<SplashScreenProps> = ({ onAnimationComplete }) => {
  // Animation values
  const logoOpacity = useSharedValue(0);
  const circleOpacity = useSharedValue(0);         // Circle around logo
  const logoRotation = useSharedValue(0);          // Spinning rotation (degrees)
  const logoTranslateX = useSharedValue(LOGO_START_X);  // Starts on RIGHT
  const logoShadow = useSharedValue(0);            // Shadow intensity for logo
  const ecgDrawProgress = useSharedValue(0);       // ECG line fade in
  const ecgScrollProgress = useSharedValue(0);     // ECG line scroll
  const ecgLiveProgress = useSharedValue(0);       // Continuous live animation
  const textOpacity = useSharedValue(0);
  const textTranslateX = useSharedValue(30);       // Text slides in from right
  const textTranslateY = useSharedValue(-15);      // Text bounces down
  const textScale = useSharedValue(0.8);           // Text scales up
  const textShadow = useSharedValue(0);            // Shadow intensity for text
  const checkmarkProgress = useSharedValue(0);     // Checkmark draw progress

  const triggerComplete = () => {
    onAnimationComplete();
  };

  useEffect(() => {
    // ═══════════════════════════════════════════════════════════════
    // PHASE 1: Logo + Circle fade in on the RIGHT (0-200ms)
    // ═══════════════════════════════════════════════════════════════
    logoOpacity.value = withTiming(1, { 
      duration: 200, 
      easing: Easing.out(Easing.cubic) 
    });
    
    circleOpacity.value = withTiming(1, { 
      duration: 200, 
      easing: Easing.out(Easing.cubic) 
    });

    // ═══════════════════════════════════════════════════════════════
    // FULL ROTATION SEQUENCE - Combined into one withSequence
    // Phase 2: Fast spin in place (0-2000ms) ~8 rotations (FASTER!)
    // Phase 4: Continue spinning while rolling left (2000-4000ms)
    // ═══════════════════════════════════════════════════════════════
    const FAST_SPIN_ROTATIONS = 8;  // Increased from 6 for faster spin
    const ROLL_ROTATIONS = 5;
    const TOTAL_ROTATIONS = FAST_SPIN_ROTATIONS + ROLL_ROTATIONS;
    const nearestUpright = Math.round(-TOTAL_ROTATIONS) * 360;
    
    // Single combined rotation animation - NO PAUSE between phases
    logoRotation.value = withSequence(
      // Phase 2: Fast spin in place (0-2000ms)
      withTiming(-360 * FAST_SPIN_ROTATIONS, { 
        duration: 2000, 
        easing: Easing.linear // Constant high speed
      }),
      // Phase 4: Continue spinning while rolling left - decelerating (2000-4000ms)
      // This runs in parallel with the ECG fade and movement
      withTiming(-360 * TOTAL_ROTATIONS, { 
        duration: 2000, 
        easing: Easing.out(Easing.cubic) // Gradually slows down
      }),
      // Settle to upright with spring
      withSpring(nearestUpright, {
        damping: 20,
        stiffness: 180,
        mass: 0.6,
      })
    );

    // ═══════════════════════════════════════════════════════════════
    // PHASE 3: ECG "road" fades/eases in (2000-2500ms)
    // Road appears while logo is still spinning, then becomes LIVE
    // ═══════════════════════════════════════════════════════════════
    ecgDrawProgress.value = withDelay(2000, withTiming(1, { 
      duration: 500, 
      easing: Easing.out(Easing.cubic) 
    }));

    // Start continuous live ECG animation - loops forever
    // Each loop takes 800ms (matches ~75 BPM heartbeat)
    ecgLiveProgress.value = withDelay(2000, withRepeat(
      withTiming(1, { 
        duration: 800, 
        easing: Easing.linear 
      }),
      -1,  // Infinite repeats
      false // Don't reverse
    ));

    // ═══════════════════════════════════════════════════════════════
    // PHASE 4: Move LEFT over the road (2000-4000ms)
    // Starts immediately after fast spin - no delay
    // ═══════════════════════════════════════════════════════════════
    logoTranslateX.value = withDelay(2000, withTiming(LOGO_END_X, { 
      duration: 2000, 
      easing: Easing.out(Easing.cubic)
    }));

    // ECG scrolls as logo rolls across
    ecgScrollProgress.value = withDelay(2000, withTiming(1, { 
      duration: 2000, 
      easing: Easing.out(Easing.cubic)
    }));

    // Logo shadow fades in as it settles
    logoShadow.value = withDelay(3500, withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic)
    }));

    // ═══════════════════════════════════════════════════════════════
    // PHASE 5: Text appears with BOUNCY animation (4000-4500ms)
    // "MedGuard" bounces in with scale and shadow
    // ═══════════════════════════════════════════════════════════════
    textOpacity.value = withDelay(4000, withTiming(1, { 
      duration: 400, 
      easing: Easing.out(Easing.cubic) 
    }));
    
    // Bouncy horizontal slide
    textTranslateX.value = withDelay(4000, withSpring(0, {
      damping: 12,      // Lower damping = more bounce
      stiffness: 150,
      mass: 0.8,
    }));
    
    // Bouncy vertical drop
    textTranslateY.value = withDelay(4000, withSpring(0, {
      damping: 10,      // Even lower = more vertical bounce
      stiffness: 200,
      mass: 0.6,
    }));
    
    // Scale bounce
    textScale.value = withDelay(4000, withSpring(1, {
      damping: 8,       // Very bouncy scale
      stiffness: 180,
      mass: 0.5,
    }));
    
    // Text shadow fades in after bounce settles
    textShadow.value = withDelay(4300, withTiming(1, {
      duration: 400,
      easing: Easing.out(Easing.cubic)
    }));

    // ═══════════════════════════════════════════════════════════════
    // PHASE 6: Checkmark draws slowly (4500-5300ms)
    // Slow, deliberate stroke like handwriting
    // ═══════════════════════════════════════════════════════════════
    checkmarkProgress.value = withDelay(4500, withTiming(1, { 
      duration: 800, 
      easing: Easing.bezier(0.4, 0, 0.2, 1)
    }));

    // ═══════════════════════════════════════════════════════════════
    // PHASE 7: Complete and transition
    // ═══════════════════════════════════════════════════════════════
    const timer = setTimeout(() => {
      runOnJS(triggerComplete)();
    }, SPLASH_DURATION);

    return () => clearTimeout(timer);
  }, []);

  // Animated styles
  const logoContainerStyle = useAnimatedStyle(() => {
    // Calculate shadow based on animation progress
    const shadowOpacity = logoShadow.value * 0.25;
    const shadowRadius = logoShadow.value * 12;
    const elevation = logoShadow.value * 8;
    
    return {
      opacity: logoOpacity.value,
      transform: [
        { translateX: logoTranslateX.value },
        { rotate: `${logoRotation.value}deg` },
      ],
      // Shadow properties
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: shadowOpacity,
      shadowRadius: shadowRadius,
      elevation: elevation,
    };
  });

  const textStyle = useAnimatedStyle(() => {
    const shadowOpacity = textShadow.value * 0.2;
    const shadowRadius = textShadow.value * 8;
    const elevation = textShadow.value * 6;
    
    return {
      opacity: textOpacity.value,
      transform: [
        { translateX: textTranslateX.value },
        { translateY: textTranslateY.value },
        { scale: textScale.value },
      ],
      // Shadow properties
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: shadowOpacity,
      shadowRadius: shadowRadius,
      elevation: elevation,
    };
  });

  return (
    <View style={styles.container}>
      {/* Pure white background */}
      <View style={styles.background} />

      {/* ECG "road" line - positioned below center, LIVE animation */}
      <View style={styles.ecgWrapper}>
        <ECGLine 
          scrollProgress={ecgScrollProgress} 
          drawProgress={ecgDrawProgress} 
          isLive={ecgLiveProgress}
        />
      </View>

      {/* Main content - absolutely positioned for precise control */}
      <View style={styles.contentWrapper}>
        {/* Logo container - starts at center, animates left */}
        <Animated.View style={[styles.logoContainer, logoContainerStyle]}>
          <ShieldLogoWithCircle size={LOGO_SIZE} circleOpacity={circleOpacity} />
          {/* Checkmark overlaid on logo, draws in slowly at the end */}
          <AnimatedCheckmark size={LOGO_SIZE} progress={checkmarkProgress} />
        </Animated.View>

        {/* Text appears to the right of logo's final position */}
        <Animated.View style={[styles.textContainer, textStyle]}>
          <Text style={styles.brandText}>MedGuard</Text>
          <Text style={styles.taglineText}>Your Health Guardian</Text>
        </Animated.View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#ffffff',
  },
  contentWrapper: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    position: 'absolute',
    // Position text just to the right of logo's final position
    left: SCREEN_WIDTH / 2 + LOGO_END_X + CIRCLE_SIZE / 2 + 10,
    alignItems: 'flex-start',
  },
  brandText: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  taglineText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.textSecondary || '#6b7280',
    marginTop: 2,
    letterSpacing: 0.3,
  },
  ecgWrapper: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.53,
    left: 0,
    right: 0,
    height: ECG_HEIGHT,
    overflow: 'hidden',
  },
  ecgContainer: {
    position: 'absolute',
    left: 0,
  },
});

export default SplashScreen;
