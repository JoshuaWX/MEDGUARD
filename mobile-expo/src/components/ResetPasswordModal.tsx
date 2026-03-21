/**
 * ResetPasswordModal
 *
 * Minimal modal overlay shown on the SignIn screen when a password-recovery
 * deep link has been verified. Asks the user to set a new password, validates
 * locally, then calls supabase.auth.updateUser({ password }).
 *
 * Constraints: no new screens, no navigation changes, no animation removals.
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Input from './Input';
import { LockIcon } from './Icons';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
} from '../../theme';

interface Props {
  visible: boolean;
  onSubmit: (password: string) => Promise<{ error: any | null }>;
  onDismiss: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

const ResetPasswordModal: React.FC<Props> = ({ visible, onSubmit, onDismiss }) => {
  const { isDark, colors } = useTheme();
  const { t } = useI18n();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setError(null);

    // Local validation
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const result = await onSubmit(newPassword);
    setLoading(false);

    if (result.error) {
      setError(result.error.message || 'Failed to update password.');
    } else {
      setSuccess(true);
    }
  };

  const handleClose = () => {
    // Reset local state
    setNewPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(false);
    setLoading(false);
    onDismiss();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backdropTouch} onPress={handleClose} />

        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.08)' }]}>
              <Ionicons name="lock-closed-outline" size={28} color="#3b82f6" />
            </View>
            <Text style={[styles.title, { color: colors.text }]}>
              {success ? 'Password Updated' : 'Set New Password'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {success
                ? 'Your password has been changed successfully. You can now sign in with your new password.'
                : 'Choose a strong password for your MedGuard account.'}
            </Text>
          </View>

          {success ? (
            /* Success state */
            <View style={styles.successContainer}>
              <View style={styles.successBadge}>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
              </View>
              <Pressable
                style={[styles.button, { backgroundColor: colors.primary }]}
                onPress={handleClose}
              >
                <Text style={styles.buttonText}>Continue to Sign In</Text>
              </Pressable>
            </View>
          ) : (
            /* Form state */
            <View style={styles.form}>
              <Input
                placeholder="New password"
                secureTextEntry
                enablePasswordToggle
                value={newPassword}
                onChangeText={setNewPassword}
                icon={<LockIcon size={24} color={colors.primary} />}
              />
              <Input
                placeholder="Confirm password"
                secureTextEntry
                enablePasswordToggle
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                icon={<LockIcon size={24} color={colors.primary} />}
              />

              {error ? (
                <Text style={styles.errorText}>{error}</Text>
              ) : null}

              <Pressable
                style={[
                  styles.button,
                  { backgroundColor: '#3b82f6' },
                  loading && styles.buttonDisabled,
                ]}
                onPress={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Reset Password</Text>
                )}
              </Pressable>

              <Pressable onPress={handleClose} style={styles.cancelRow}>
                <Text style={[styles.cancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdropTouch: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width: '88%',
    maxWidth: 400,
    borderRadius: BorderRadius['2xl'],
    padding: Spacing.xl,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  form: {
    gap: Spacing.base,
  },
  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.danger,
    textAlign: 'center',
  },
  button: {
    height: 48,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: '#ffffff',
  },
  cancelRow: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  cancelText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  successContainer: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  successBadge: {
    marginBottom: Spacing.sm,
  },
});

export default ResetPasswordModal;
