/**
 * FeatureBlockedScreen
 * Professional placeholder for features under development.
 * Clean, medical-grade design with subtle animations.
 * 
 * Usage:
 * <FeatureBlockedScreen
 *   title="Disease Map"
 *   description="Real-time disease tracking is coming soon"
 *   icon="map"
 * />
 * 
 * To remove later:
 * 1. Remove this component wrapper from the target screen
 * 2. Delete this file when no longer needed
 * 3. Remove export from components/index.ts
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeInDown,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Svg, { Path, Circle, G, Defs, ClipPath, Rect } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  Duration,
  useThemedColors,
} from '../../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// TYPES
// ============================================================================

export type FeatureIconType = 'map' | 'health' | 'chart' | 'settings' | 'generic';

interface FeatureBlockedScreenProps {
  /** Title of the blocked feature */
  title: string;
  /** Description explaining the feature is in development */
  description?: string;
  /** Icon type to display */
  icon?: FeatureIconType;
  /** Custom primary button text */
  buttonText?: string;
  /** Custom action for primary button (defaults to go back) */
  onButtonPress?: () => void;
  /** Show secondary "Return Home" option */
  showHomeButton?: boolean;
}

// ============================================================================
// ICON COMPONENTS
// ============================================================================

interface IconProps {
  size?: number;
  color?: string;
  secondaryColor?: string;
}

const MapBlockedIcon: React.FC<IconProps> = ({ 
  size = 120, 
  color = Colors.primary,
  secondaryColor = 'rgba(17, 180, 212, 0.2)',
}) => (
  <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    {/* Background circle */}
    <Circle cx="60" cy="60" r="56" fill={secondaryColor} />
    {/* Map pin with construction indicator */}
    <Path
      d="M60 20C44.536 20 32 32.536 32 48c0 22 28 52 28 52s28-30 28-52c0-15.464-12.536-28-28-28z"
      fill={color}
      opacity={0.9}
    />
    <Circle cx="60" cy="48" r="12" fill="white" />
    {/* Construction gear overlay */}
    <G transform="translate(70, 65)">
      <Circle cx="12" cy="12" r="12" fill="white" />
      <Path
        d="M12 6V8M12 16V18M6 12H8M16 12H18M7.76 7.76L9.17 9.17M14.83 14.83L16.24 16.24M7.76 16.24L9.17 14.83M14.83 9.17L16.24 7.76"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" fill="none" />
    </G>
  </Svg>
);

const HealthBlockedIcon: React.FC<IconProps> = ({ 
  size = 120, 
  color = Colors.primary,
  secondaryColor = 'rgba(16, 185, 129, 0.2)',
}) => (
  <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    {/* Background circle */}
    <Circle cx="60" cy="60" r="56" fill={secondaryColor} />
    {/* Heart with pulse line */}
    <Path
      d="M60 95S25 70 25 48c0-15 12-25 25-25 8 0 15 4 20 10 5-6 12-10 20-10 13 0 25 10 25 25 0 22-35 47-35 47z"
      fill="#ef4444"
      opacity={0.85}
    />
    {/* Pulse line */}
    <Path
      d="M30 58H45L50 48L55 68L60 53L65 63L70 58H90"
      stroke="white"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Construction indicator */}
    <G transform="translate(75, 70)">
      <Circle cx="10" cy="10" r="10" fill="white" />
      <Path
        d="M10 5V7M10 13V15M5 10H7M13 10H15"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx="10" cy="10" r="2.5" stroke={color} strokeWidth="1.5" fill="none" />
    </G>
  </Svg>
);

const ChartBlockedIcon: React.FC<IconProps> = ({ 
  size = 120, 
  color = Colors.primary,
  secondaryColor = 'rgba(17, 180, 212, 0.2)',
}) => (
  <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    <Circle cx="60" cy="60" r="56" fill={secondaryColor} />
    {/* Chart bars */}
    <Rect x="28" y="70" width="14" height="30" rx="4" fill={color} opacity={0.6} />
    <Rect x="48" y="50" width="14" height="50" rx="4" fill={color} opacity={0.8} />
    <Rect x="68" y="35" width="14" height="65" rx="4" fill={color} />
    {/* Construction overlay */}
    <G transform="translate(75, 20)">
      <Circle cx="12" cy="12" r="12" fill="white" />
      <Path
        d="M12 6V8M12 16V18M6 12H8M16 12H18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" fill="none" />
    </G>
  </Svg>
);

const GenericBlockedIcon: React.FC<IconProps> = ({ 
  size = 120, 
  color = Colors.primary,
  secondaryColor = 'rgba(17, 180, 212, 0.2)',
}) => (
  <Svg width={size} height={size} viewBox="0 0 120 120" fill="none">
    <Circle cx="60" cy="60" r="56" fill={secondaryColor} />
    {/* Shield with gear */}
    <Path
      d="M60 20L30 35v25c0 22.5 12.75 43.5 30 50 17.25-6.5 30-27.5 30-50V35L60 20z"
      fill={color}
      opacity={0.9}
    />
    {/* Gear in center */}
    <Path
      d="M60 45v4M60 71v4M45 60h4M71 60h4M48.2 48.2l2.83 2.83M68.97 68.97l2.83 2.83M48.2 71.8l2.83-2.83M68.97 51.03l2.83-2.83"
      stroke="white"
      strokeWidth="3"
      strokeLinecap="round"
    />
    <Circle cx="60" cy="60" r="8" stroke="white" strokeWidth="3" fill="none" />
  </Svg>
);

const getIcon = (iconType: FeatureIconType): React.FC<IconProps> => {
  switch (iconType) {
    case 'map':
      return MapBlockedIcon;
    case 'health':
      return HealthBlockedIcon;
    case 'chart':
      return ChartBlockedIcon;
    default:
      return GenericBlockedIcon;
  }
};

// ============================================================================
// PROGRESS BAR COMPONENT
// ============================================================================

const AnimatedProgressBar: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const progress = useSharedValue(0);

  useEffect(() => {
    // Subtle repeating animation to show activity
    progress.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 2000, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );
  }, []);

  const animatedWidth = useAnimatedStyle(() => ({
    width: `${interpolate(progress.value, [0, 1], [20, 100])}%`,
  }));

  return (
    <View style={[styles.progressContainer, isDark && styles.progressContainerDark]}>
      <Animated.View 
        style={[
          styles.progressBar,
          animatedWidth,
        ]}
      >
        <LinearGradient
          colors={['#11b4d4', '#10b981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const FeatureBlockedScreen: React.FC<FeatureBlockedScreenProps> = ({
  title,
  description = "We're working hard to bring this feature to you soon.",
  icon = 'generic',
  buttonText = 'Go Back',
  onButtonPress,
  showHomeButton = true,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const colors = useThemedColors(isDark);

  // Animations
  const iconScale = useSharedValue(0.8);
  const iconOpacity = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    // Entrance animation for icon
    iconOpacity.value = withDelay(200, withTiming(1, { duration: 600 }));
    iconScale.value = withDelay(200, withTiming(1, { duration: 600, easing: Easing.out(Easing.back(1.2)) }));
    
    // Subtle pulse animation
    pulseScale.value = withDelay(
      800,
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const iconAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: iconScale.value * pulseScale.value }],
    opacity: iconOpacity.value,
  }));

  const handleGoBack = () => {
    if (onButtonPress) {
      onButtonPress();
      return;
    }
    
    const nav = navigation as any;
    if (typeof nav?.canGoBack === 'function' && nav.canGoBack()) {
      nav.goBack();
    }
  };

  const handleGoHome = () => {
    const nav = navigation as any;
    if (typeof nav?.navigate === 'function') {
      nav.navigate('Home');
    }
  };

  const IconComponent = getIcon(icon);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={isDark 
          ? ['#0f1419', '#152028', '#1a2632'] 
          : ['#f8fafc', 'rgba(236, 254, 255, 0.5)', 'rgba(240, 253, 250, 0.3)']
        }
        style={StyleSheet.absoluteFill}
      />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + Spacing['3xl'] }]}>
        {/* Animated Icon */}
        <Animated.View style={[styles.iconContainer, iconAnimatedStyle]}>
          <IconComponent 
            size={140} 
            color={Colors.primary}
            secondaryColor={isDark ? 'rgba(17, 180, 212, 0.15)' : 'rgba(17, 180, 212, 0.2)'}
          />
        </Animated.View>

        {/* Title */}
        <Animated.Text 
          entering={FadeInDown.delay(300).duration(500)}
          style={[styles.title, { color: colors.text }]}
        >
          {title}
        </Animated.Text>

        {/* Status Badge */}
        <Animated.View 
          entering={FadeInDown.delay(400).duration(500)}
          style={[styles.statusBadge, isDark && styles.statusBadgeDark]}
        >
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Under Development</Text>
        </Animated.View>

        {/* Description */}
        <Animated.Text 
          entering={FadeInDown.delay(500).duration(500)}
          style={[styles.description, { color: colors.textSecondary }]}
        >
          {description}
        </Animated.Text>

        {/* Progress indicator */}
        <Animated.View 
          entering={FadeIn.delay(600).duration(500)}
          style={styles.progressSection}
        >
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
            Development in progress
          </Text>
          <AnimatedProgressBar isDark={isDark} />
        </Animated.View>

        {/* Buttons */}
        <Animated.View 
          entering={FadeInDown.delay(700).duration(500)}
          style={styles.buttonContainer}
        >
          {/* Primary button */}
          <Pressable
            onPress={handleGoBack}
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <LinearGradient
              colors={['#11b4d4', '#10b981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.primaryButtonText}>{buttonText}</Text>
          </Pressable>

          {/* Secondary button */}
          {showHomeButton && (
            <Pressable
              onPress={handleGoHome}
              style={({ pressed }) => [
                styles.secondaryButton,
                { borderColor: colors.border },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                Return Home
              </Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Footer message */}
        <Animated.View 
          entering={FadeIn.delay(900).duration(500)}
          style={styles.footer}
        >
          <Text style={[styles.footerText, { color: colors.textMuted }]}>
            Thank you for your patience
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  iconContainer: {
    marginBottom: Spacing['2xl'],
  },
  title: {
    fontSize: FontSize['2xl'],
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.base,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17, 180, 212, 0.1)',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.lg,
  },
  statusBadgeDark: {
    backgroundColor: 'rgba(17, 180, 212, 0.15)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginRight: Spacing.sm,
  },
  statusText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: Colors.primary,
  },
  description: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing['2xl'],
    maxWidth: 300,
  },
  progressSection: {
    width: '100%',
    maxWidth: 280,
    marginBottom: Spacing['3xl'],
  },
  progressLabel: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  progressContainer: {
    height: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressContainerDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
  },
  buttonContainer: {
    width: '100%',
    maxWidth: 280,
    gap: Spacing.md,
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Shadows.primaryGlow,
  },
  primaryButtonText: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.semibold,
    color: '#ffffff',
  },
  secondaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  secondaryButtonText: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.semibold,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  footer: {
    position: 'absolute',
    bottom: Spacing['4xl'],
  },
  footerText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
  },
});

export default FeatureBlockedScreen;
