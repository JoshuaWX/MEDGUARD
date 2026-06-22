import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../hooks/useTheme';
import { BorderRadius, Colors, FontFamily, FontSize, Shadows, Spacing } from '../../theme';

export type FeedbackTone = 'info' | 'success' | 'warning' | 'danger';

export interface ToastOptions {
  tone?: FeedbackTone;
  title?: string;
  message: string;
  duration?: number;
}

export interface NotifyOptions {
  tone?: FeedbackTone;
  title: string;
  message: string;
  actionLabel?: string;
}

export interface ConfirmOptions {
  tone?: FeedbackTone;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}

interface DialogState {
  kind: 'notify' | 'confirm';
  tone: FeedbackTone;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
}

interface FeedbackContextValue {
  toast: (options: ToastOptions) => void;
  notify: (options: NotifyOptions) => Promise<void>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

const toneConfig: Record<FeedbackTone, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  info: { color: Colors.primary, icon: 'information-circle-outline' },
  success: { color: Colors.emerald, icon: 'checkmark-circle-outline' },
  warning: { color: Colors.warning, icon: 'warning-outline' },
  danger: { color: Colors.danger, icon: 'alert-circle-outline' },
};

export const FeedbackProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [toastState, setToastState] = useState<(ToastOptions & { id: number }) | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const dialogResolver = useRef<((result: boolean) => void) | null>(null);

  useEffect(() => {
    if (!toastState) return;
    const timer = setTimeout(() => setToastState(null), toastState.duration ?? 3000);
    return () => clearTimeout(timer);
  }, [toastState]);

  const settleDialog = useCallback((result: boolean) => {
    dialogResolver.current?.(result);
    dialogResolver.current = null;
    setDialog(null);
  }, []);

  const toast = useCallback((options: ToastOptions) => {
    setToastState({ ...options, tone: options.tone ?? 'info', id: Date.now() });
  }, []);

  const notify = useCallback((options: NotifyOptions) => {
    dialogResolver.current?.(false);
    return new Promise<void>((resolve) => {
      dialogResolver.current = () => resolve();
      setDialog({
        kind: 'notify',
        tone: options.tone ?? 'info',
        title: options.title,
        message: options.message,
        confirmLabel: options.actionLabel ?? 'OK',
      });
    });
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    dialogResolver.current?.(false);
    return new Promise<boolean>((resolve) => {
      dialogResolver.current = resolve;
      setDialog({
        kind: 'confirm',
        tone: options.tone ?? 'danger',
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel ?? 'Cancel',
      });
    });
  }, []);

  const value = useMemo(() => ({ toast, notify, confirm }), [toast, notify, confirm]);
  const toastTone = toneConfig[toastState?.tone ?? 'info'];
  const dialogTone = toneConfig[dialog?.tone ?? 'info'];

  return (
    <FeedbackContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {toastState ? (
          <View
            pointerEvents="box-none"
            style={[styles.toastHost, { top: insets.top + Spacing.sm }]}
          >
            <View
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              style={[
                styles.toast,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: isDark ? `${toastTone.color}70` : `${toastTone.color}45`,
                },
              ]}
            >
              <Ionicons name={toastTone.icon} size={22} color={toastTone.color} />
              <View style={styles.toastCopy}>
                {toastState.title ? (
                  <Text style={[styles.toastTitle, { color: colors.text }]}>{toastState.title}</Text>
                ) : null}
                <Text style={[styles.toastMessage, { color: colors.textSecondary }]}>
                  {toastState.message}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Dismiss message"
                hitSlop={10}
                onPress={() => setToastState(null)}
                style={styles.toastClose}
              >
                <Ionicons name="close" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <Modal
        visible={Boolean(dialog)}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => settleDialog(false)}
      >
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => settleDialog(false)} />
          {dialog ? (
            <View
              accessibilityViewIsModal
              style={[
                styles.dialog,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
              ]}
            >
              <View style={[styles.dialogIcon, { backgroundColor: `${dialogTone.color}18` }]}>
                <Ionicons name={dialogTone.icon} size={26} color={dialogTone.color} />
              </View>
              <Text style={[styles.dialogTitle, { color: colors.text }]}>{dialog.title}</Text>
              <Text style={[styles.dialogMessage, { color: colors.textSecondary }]}>
                {dialog.message}
              </Text>
              <View style={styles.dialogActions}>
                {dialog.kind === 'confirm' ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => settleDialog(false)}
                    style={[styles.dialogButton, styles.cancelButton, { borderColor: colors.border }]}
                  >
                    <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
                      {dialog.cancelLabel}
                    </Text>
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  onPress={() => settleDialog(true)}
                  style={[styles.dialogButton, { backgroundColor: dialogTone.color }]}
                >
                  <Text style={styles.confirmText}>{dialog.confirmLabel}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </Modal>
    </FeedbackContext.Provider>
  );
};

export function useFeedback(): FeedbackContextValue {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used within FeedbackProvider');
  return context;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toastHost: {
    position: 'absolute',
    left: Spacing.base,
    right: Spacing.base,
    zIndex: 1000,
    alignItems: 'center',
  },
  toast: {
    width: '100%',
    maxWidth: 440,
    minHeight: 58,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    ...Shadows.lg,
  },
  toastCopy: { flex: 1 },
  toastTitle: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm, marginBottom: 2 },
  toastMessage: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, lineHeight: 18 },
  toastClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3, 15, 20, 0.64)',
  },
  dialog: {
    width: '100%',
    maxWidth: 380,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.xl,
    ...Shadows.lg,
  },
  dialogIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  dialogTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, marginBottom: Spacing.sm },
  dialogMessage: { fontFamily: FontFamily.regular, fontSize: FontSize.base, lineHeight: 24 },
  dialogActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm, marginTop: Spacing.xl },
  dialogButton: {
    minHeight: 48,
    minWidth: 104,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.base,
  },
  cancelButton: { borderWidth: 1, backgroundColor: 'transparent' },
  cancelText: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  confirmText: { color: Colors.textLight, fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
});
