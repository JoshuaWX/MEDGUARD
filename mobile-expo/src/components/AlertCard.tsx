/**
 * AlertCard Component
 * Recreates alert cards with severity styling
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Colors, BorderRadius, Spacing, Shadows, FontFamily, FontSize } from '../../theme';

type AlertSeverity = 'urgent' | 'caution' | 'info' | 'reminder';

interface AlertCardProps {
  title: string;
  description?: string;
  message?: string;
  severity: AlertSeverity;
  source?: string;
  timestamp?: string;
  location?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const severityConfig: Record<AlertCardProps['severity'], {
  colors: readonly [string, string];
  borderColor: string;
  badgeColor: string;
  badgeText: string;
}> = {
  urgent: {
    colors: ['#ef4444', '#dc2626'] as const,
    borderColor: Colors.danger,
    badgeColor: Colors.danger,
    badgeText: 'URGENT',
  },
  caution: {
    colors: ['#fbbf24', '#f97316'] as const,
    borderColor: Colors.warning,
    badgeColor: Colors.warning,
    badgeText: 'CAUTION',
  },
  info: {
    colors: ['#10b981', '#14b8a6'] as const,
    borderColor: Colors.success,
    badgeColor: Colors.success,
    badgeText: 'HEALTH TIP',
  },
  reminder: {
    colors: [Colors.primary, '#06b6d4'] as const,
    borderColor: Colors.primary,
    badgeColor: Colors.primary,
    badgeText: 'REMINDER',
  },
};

const AlertCard: React.FC<AlertCardProps> = ({
  title,
  description,
  message,
  severity,
  source,
  timestamp,
  location,
  icon,
  onPress,
  style,
}) => {
  const displayMessage = message || description || '';
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);

  const config = severityConfig[severity];

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 15 });
    translateY.value = withSpring(2, { damping: 15 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
    translateY.value = withSpring(-2, { damping: 15 });
    setTimeout(() => {
      translateY.value = withSpring(0, { damping: 15 });
    }, 150);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.container, animatedStyle, style]}
    >
      <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill}>
        <View style={styles.glassBg} />
      </BlurView>
      <View style={[styles.borderLeft, { backgroundColor: config.borderColor }]} />
      <View style={styles.content}>
        <View style={styles.row}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={config.colors}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconGradient}
            >
              {icon}
            </LinearGradient>
          </View>

          {/* Content */}
          <View style={styles.textContent}>
            <View style={styles.header}>
              <View style={[styles.badge, { backgroundColor: config.badgeColor }]}>
                <Text style={styles.badgeText}>{config.badgeText}</Text>
              </View>
              {location && (
                <View style={styles.locationRow}>
                  <Text style={styles.locationText}>📍 {location}</Text>
                </View>
              )}
            </View>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description}>{displayMessage}</Text>
            {source && <Text style={styles.source}>Source: {source}</Text>}
            {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    ...Shadows.lg,
  },
  glassBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.glassLight,
  },
  borderLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  content: {
    padding: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.base,
  },
  iconContainer: {
    flexShrink: 0,
  },
  iconGradient: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  textContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  badgeText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textLight,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  description: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.5,
  },
  source: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.primary,
    marginTop: Spacing.xs,
    opacity: 0.7,
  },
  timestamp: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

export default AlertCard;
