/**
 * ScreenLoader
 * Branded, centered loading state for full screens.
 *
 * Used to avoid flashing placeholder/stale data while a screen's primary data
 * (e.g. the signed-in user's profile) is still loading. Render it in place of
 * the screen body until the real data is confirmed ready.
 */

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Colors, FontFamily, FontSize, Spacing } from '../../theme';

interface ScreenLoaderProps {
  /** Optional label shown under the pulsing mark. */
  label?: string;
}

const ScreenLoader: React.FC<ScreenLoaderProps> = ({ label }) => {
  const { colors } = useTheme();
  const pulse = useSharedValue(1);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.12, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, [pulse]);

  const markStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mark, markStyle]}>
        <Ionicons name="pulse" size={30} color={Colors.primary} />
      </Animated.View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {label ?? 'Loading…'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  mark: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,180,212,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(17,180,212,0.25)',
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
});

export default ScreenLoader;
