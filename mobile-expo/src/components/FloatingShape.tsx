/**
 * FloatingShape Component
 * Recreates the floating decorative shapes with parallax animation
 */

import React, { useEffect } from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
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

const FloatingShape: React.FC<FloatingShapeProps> = ({
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

    // Continuous floating animation
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-20, { duration: duration / 3, easing: Easing.inOut(Easing.ease) }),
          withTiming(-10, { duration: duration / 3, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 3, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Infinite
        true // Reverse
      )
    );

    // Subtle rotation
    rotate.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(5, { duration: duration / 3, easing: Easing.inOut(Easing.ease) }),
          withTiming(-3, { duration: duration / 3, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: duration / 3, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.shape,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          top,
          bottom,
          left,
          right,
        },
        animatedStyle,
        style,
      ]}
    >
      <LinearGradient
        colors={color ? [color, color] : [Colors.whiteAlpha20, Colors.whiteAlpha10]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradient, { borderRadius: size / 2 }]}
      />
    </Animated.View>
  );
};

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
