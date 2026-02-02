/**
 * FloatingShape Component
 * Recreates the floating decorative shapes with parallax animation
 * Optimized for low-end Android devices
 */

import React, { useEffect, memo, useMemo } from 'react';
import { StyleSheet, ViewStyle, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Duration, Delay } from '../../theme';

// Detect low-end Android devices (API level < 28 = Android 9)
const isLowEndDevice = Platform.OS === 'android' && Platform.Version < 28;

interface FloatingShapeProps {
  size: number;
  color?: string;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  delay?: number;
  duration?: number;
  style?: ViewStyle;
}

const FloatingShape: React.FC<FloatingShapeProps> = memo(({
  size,
  color,
  top,
  bottom,
  left,
  right,
  delay = Delay.floatingShapes,
  duration = Duration.float,
  style,
}) => {
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const scale = useSharedValue(0.5);
  const opacity = useSharedValue(0);

  // On low-end devices, use longer duration for smoother animations
  const effectiveDuration = isLowEndDevice ? duration * 1.5 : duration;
  // Reduce translation amount on low-end devices
  const translateAmount = isLowEndDevice ? 10 : 20;
  // Reduce rotation on low-end devices
  const rotateAmount = isLowEndDevice ? 2 : 5;

  useEffect(() => {
    // Fade in animation
    opacity.value = withDelay(
      delay,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) })
    );
    scale.value = withDelay(
      delay,
      withTiming(1, { duration: 800, easing: Easing.out(Easing.ease) })
    );

    // Continuous floating animation - simplified for low-end
    if (isLowEndDevice) {
      // Simpler 2-step animation for low-end devices
      translateY.value = withDelay(
        delay,
        withRepeat(
          withTiming(-translateAmount, { duration: effectiveDuration / 2, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        )
      );
      rotate.value = withDelay(
        delay,
        withRepeat(
          withTiming(rotateAmount, { duration: effectiveDuration / 2, easing: Easing.inOut(Easing.ease) }),
          -1,
          true
        )
      );
    } else {
      // Full 3-step animation for capable devices
      translateY.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(-translateAmount, { duration: effectiveDuration / 3, easing: Easing.inOut(Easing.ease) }),
            withTiming(-translateAmount / 2, { duration: effectiveDuration / 3, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: effectiveDuration / 3, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
      rotate.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(rotateAmount, { duration: effectiveDuration / 3, easing: Easing.inOut(Easing.ease) }),
            withTiming(-rotateAmount * 0.6, { duration: effectiveDuration / 3, easing: Easing.inOut(Easing.ease) }),
            withTiming(0, { duration: effectiveDuration / 3, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          true
        )
      );
    }
  }, [delay, effectiveDuration, translateAmount, rotateAmount, opacity, scale, translateY, rotate]);

  const animatedStyle = useAnimatedStyle(() => {
    'worklet';
    return {
      opacity: opacity.value,
      transform: [
        { translateY: translateY.value },
        { rotate: `${rotate.value}deg` },
        { scale: scale.value },
      ],
    };
  });

  // Memoize the position styles
  const positionStyle = useMemo(() => ({
    width: size,
    height: size,
    borderRadius: size / 2,
    top,
    bottom,
    left,
    right,
  }), [size, top, bottom, left, right]);

  // Memoize gradient colors
  const gradientColors = useMemo(
    () => color ? [color, color] as const : [Colors.whiteAlpha20, Colors.whiteAlpha10] as const,
    [color]
  );

  return (
    <Animated.View
      style={[
        styles.shape,
        positionStyle,
        animatedStyle,
        style,
      ]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { borderRadius: size / 2 }]}
      />
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  shape: {
    position: 'absolute',
    overflow: 'hidden',
  },
  gradient: {
    flex: 1,
  },
});

export default FloatingShape;
