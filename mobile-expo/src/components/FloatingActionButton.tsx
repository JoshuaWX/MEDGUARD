/**
 * FloatingActionButton Component
 * Recreates the FAB chatbot button with pulse animation
 * Optimized for low-end Android devices
 */

import React, { useEffect, memo, useCallback } from 'react';
import { StyleSheet, Pressable, View, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { Colors, Shadows, BorderRadius, Duration } from '../../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Detect low-end Android devices (API level < 28 = Android 9)
const isLowEndDevice = Platform.OS === 'android' && Platform.Version < 28;

interface FloatingActionButtonProps {
  onPress: () => void;
}

const FloatingActionButton: React.FC<FloatingActionButtonProps> = memo(({ onPress }) => {
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.3);

  // Use slower, simpler animation on low-end devices
  const pulseDuration = isLowEndDevice ? Duration.pulse * 1.5 : Duration.pulse;
  const pulseMaxScale = isLowEndDevice ? 1.1 : 1.15;

  useEffect(() => {
    // Continuous pulse animation for the ring
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(pulseMaxScale, { duration: pulseDuration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: pulseDuration / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: pulseDuration / 2, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: pulseDuration / 2, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [pulseDuration, pulseMaxScale, pulseScale, pulseOpacity]);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.95, { damping: 15 });
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1.1, { damping: 15 });
    setTimeout(() => {
      scale.value = withSpring(1, { damping: 15 });
    }, 100);
  }, [scale]);

  const buttonStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const pulseStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      transform: [{ scale: pulseScale.value }],
      opacity: pulseOpacity.value,
    };
  });

  return (
    <View style={styles.container}>
      {/* Pulse ring */}
      <Animated.View style={[styles.pulseRing, pulseStyle]}>
        <LinearGradient
          colors={[Colors.primary, Colors.emerald]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.pulseGradient}
        />
      </Animated.View>

      {/* Main button */}
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.button, buttonStyle]}
      >
        <LinearGradient
          colors={[Colors.primary, Colors.emerald]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <Svg
            width={26}
            height={26}
            viewBox="0 0 24 24"
            fill="none"
            stroke={Colors.textLight}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </Svg>
        </LinearGradient>
      </AnimatedPressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  pulseRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    overflow: 'hidden',
  },
  pulseGradient: {
    flex: 1,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
    ...Shadows.primaryLg,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default FloatingActionButton;
