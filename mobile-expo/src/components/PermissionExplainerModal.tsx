import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '../../theme';
import Icon, { type IconName } from './Icon';

interface PermissionExplainerModalProps {
  visible: boolean;
  icon: IconName;
  title: string;
  description: string;
  primaryLabel?: string;
  busy?: boolean;
  onContinue: () => void | Promise<void>;
  onClose: () => void;
}

/** Calm, non-blocking context shown immediately before an optional OS prompt. */
const PermissionExplainerModal: React.FC<PermissionExplainerModalProps> = ({
  visible,
  icon,
  title,
  description,
  primaryLabel = 'Continue',
  busy = false,
  onContinue,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={[styles.icon, { backgroundColor: colors.primaryTint }]}>
            <Icon name={icon} size={25} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>

          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void onContinue()}
            style={[styles.primary, { backgroundColor: colors.primary }, busy && styles.disabled]}
          >
            {busy ? <ActivityIndicator color={Colors.textLight} /> : <Text style={styles.primaryText}>{primaryLabel}</Text>}
          </Pressable>
          <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.secondary}>
            <Text style={[styles.secondaryText, { color: colors.textSecondary }]}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(3,15,20,0.64)' },
  card: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  icon: { width: 54, height: 54, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, marginBottom: Spacing.xs },
  description: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 21, marginBottom: Spacing.xl },
  primary: { minHeight: 52, borderRadius: BorderRadius.xl, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: Colors.textLight, fontFamily: FontFamily.semibold, fontSize: FontSize.base },
  secondary: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  secondaryText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm },
  disabled: { opacity: 0.6 },
});

export default PermissionExplainerModal;
