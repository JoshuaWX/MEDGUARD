/**
 * AuthGateModal
 * Soft blocker modal shown when guest users attempt to access restricted features.
 * Provides sign-in/sign-up CTAs without crashing or navigating away.
 *
 * Usage:
 * <AuthGateModal
 *   visible={showModal}
 *   onClose={() => setShowModal(false)}
 *   feature="personalized health tracking"
 * />
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, CommonActions } from '@react-navigation/native';
import Svg, { Path, Circle, G } from 'react-native-svg';

import { useTheme } from '../hooks/useTheme';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  useThemedColors,
} from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// TYPES
// ============================================================================

interface AuthGateModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Feature name being accessed (for customized messaging) */
  feature?: string;
  /** Custom title override */
  title?: string;
  /** Custom message override */
  message?: string;
}

// ============================================================================
// ICON COMPONENT
// ============================================================================

const LockIcon: React.FC<{ size?: number; color?: string }> = ({
  size = 64,
  color = Colors.primary,
}) => (
  <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
    {/* Background circle */}
    <Circle cx="32" cy="32" r="30" fill="rgba(17, 180, 212, 0.12)" />
    {/* Lock body */}
    <G transform="translate(16, 18)">
      <Path
        d="M4 14V12C4 7.58172 7.58172 4 12 4H20C24.4183 4 28 7.58172 28 12V14"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M2 14H30C31.1046 14 32 14.8954 32 16V26C32 27.1046 31.1046 28 30 28H2C0.895431 28 0 27.1046 0 26V16C0 14.8954 0.895431 14 2 14Z"
        fill={color}
        opacity={0.9}
      />
      {/* Keyhole */}
      <Circle cx="16" cy="20" r="3" fill="white" />
      <Path d="M16 22V25" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </G>
  </Svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AuthGateModal: React.FC<AuthGateModalProps> = ({
  visible,
  onClose,
  feature = 'this feature',
  title,
  message,
}) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const colors = useThemedColors(isDark);

  // Animation values
  const overlayOpacity = useSharedValue(0);
  const cardScale = useSharedValue(0.9);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 200 });
      cardScale.value = withSpring(1, { damping: 15, stiffness: 150 });
    } else {
      overlayOpacity.value = withTiming(0, { duration: 150 });
      cardScale.value = withTiming(0.9, { duration: 150 });
    }
  }, [visible]);

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cardScale.value }],
  }));

  const handleSignIn = () => {
    onClose();
    // Navigate to sign in screen
    navigation.dispatch(
      CommonActions.navigate({
        name: 'SignIn',
      })
    );
  };

  const handleCreateAccount = () => {
    onClose();
    // Navigate to sign up screen
    navigation.dispatch(
      CommonActions.navigate({
        name: 'SignUp',
      })
    );
  };

  const displayTitle = title || 'Sign in required';
  const displayMessage =
    message ||
    `Sign in to unlock ${feature} for your location.`;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={[styles.overlay, overlayStyle]}>
        <Pressable style={styles.overlayPressable} onPress={onClose} />
      </Animated.View>

      {/* Modal content */}
      <View style={styles.container} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.card,
            cardStyle,
            {
              backgroundColor: isDark ? colors.surface : '#ffffff',
              paddingBottom: Math.max(insets.bottom, Spacing.xl),
            },
          ]}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <LockIcon size={80} color={Colors.primary} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {displayTitle}
          </Text>

          {/* Message */}
          <Text style={[styles.message, { color: colors.textSecondary }]}>
            {displayMessage}
          </Text>

          {/* Primary CTA: Sign In */}
          <Pressable
            onPress={handleSignIn}
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
            <Text style={styles.primaryButtonText}>Sign In</Text>
          </Pressable>

          {/* Secondary CTA: Create Account */}
          <Pressable
            onPress={handleCreateAccount}
            style={({ pressed }) => [
              styles.secondaryButton,
              { borderColor: colors.border },
              pressed && styles.buttonPressed,
            ]}
          >
            <Text style={[styles.secondaryButtonText, { color: Colors.primary }]}>
              Create Account
            </Text>
          </Pressable>

          {/* Dismiss link */}
          <Pressable onPress={onClose} style={styles.dismissButton}>
            <Text style={[styles.dismissText, { color: colors.textMuted }]}>
              Maybe later
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayPressable: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    paddingTop: Spacing['2xl'],
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    ...Shadows.large,
  },
  iconContainer: {
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.xl,
    maxWidth: SCREEN_WIDTH * 0.8,
  },
  primaryButton: {
    width: '100%',
    height: 52,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: Spacing.md,
    ...Shadows.primaryGlow,
  },
  primaryButtonText: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.semibold,
    color: '#ffffff',
  },
  secondaryButton: {
    width: '100%',
    height: 52,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    marginBottom: Spacing.md,
  },
  secondaryButtonText: {
    fontSize: FontSize.base,
    fontFamily: FontFamily.semibold,
  },
  dismissButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  dismissText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});

export default AuthGateModal;
