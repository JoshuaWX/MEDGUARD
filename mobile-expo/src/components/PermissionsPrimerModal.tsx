/**
 * PermissionsPrimerModal
 *
 * A one-time, in-context primer that asks the user to grant the core
 * permissions MedGuard relies on — location (area health alerts, nearby
 * clinics) and notifications (outbreak alerts, check-in reminders).
 *
 * Design notes:
 * - Self-contained: it decides whether to show itself based on live permission
 *   status + a "seen" flag in AsyncStorage, so callers just render it once.
 * - Honest + non-coercive: explains WHY each permission is used and offers a
 *   clear "Maybe later". It never blocks the app.
 * - Only the OS dialog grants access; this screen just primes and triggers it.
 * - Camera/photos and activity/steps stay contextual (requested where used),
 *   per platform guidance — this primer covers only the always-relevant two.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useLocationContext } from '../hooks/LocationContext';
import { useNotifications } from '../hooks/useNotifications';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '../../theme';

/** AsyncStorage flag marking that the permission primer has been shown/handled. */
export const PERMISSIONS_PRIMED_KEY = 'mg_perms_primed_v1';
const SEEN_KEY = PERMISSIONS_PRIMED_KEY;

const PermissionsPrimerModal: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { isGuest, user } = useAuth();
  const { permissionStatus, requestPermission: requestLocation } = useLocationContext();
  const { permissionAsked, permissionGranted, requestPermission: requestNotifications } = useNotifications();

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  // Undetermined = we can still surface the OS dialog. If already granted or
  // explicitly denied, we don't nag here (Settings/Profile handle those).
  const needsLocation = permissionStatus === 'undetermined';
  const needsNotifications = !permissionAsked && !permissionGranted;

  useEffect(() => {
    let cancelled = false;
    // Only prime authenticated users, and only if something is actually needed.
    if (isGuest || !user?.id) return;
    if (!needsLocation && !needsNotifications) return;

    (async () => {
      const seen = await AsyncStorage.getItem(SEEN_KEY).catch(() => null);
      if (!cancelled && seen !== '1') {
        // Small delay so it doesn't collide with first paint / auth settling.
        setTimeout(() => {
          if (!cancelled) setVisible(true);
        }, 900);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isGuest, user?.id, needsLocation, needsNotifications]);

  const markSeen = useCallback(async () => {
    await AsyncStorage.setItem(SEEN_KEY, '1').catch(() => undefined);
  }, []);

  const handleEnable = useCallback(async () => {
    setBusy(true);
    try {
      // Request sequentially so the OS dialogs don't overlap.
      if (needsLocation) await requestLocation().catch(() => false);
      if (needsNotifications) await requestNotifications().catch(() => false);
    } finally {
      await markSeen();
      setBusy(false);
      setVisible(false);
    }
  }, [needsLocation, needsNotifications, requestLocation, requestNotifications, markSeen]);

  const handleLater = useCallback(async () => {
    await markSeen();
    setVisible(false);
  }, [markSeen]);

  if (!visible) return null;

  const items: Array<{ icon: keyof typeof Ionicons.glyphMap; title: string; body: string; show: boolean }> = [
    {
      icon: 'location',
      title: 'Location',
      body: 'Personalises disease alerts for your state and finds clinics and pharmacies near you.',
      show: needsLocation,
    },
    {
      icon: 'notifications',
      title: 'Notifications',
      body: 'Sends outbreak alerts for your area and gentle daily check-in reminders.',
      show: needsNotifications,
    },
  ];

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={handleLater}>
      <View style={styles.backdrop}>
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surfaceElevated,
              borderColor: colors.border,
              paddingBottom: insets.bottom + Spacing.xl,
            },
          ]}
        >
          <View style={styles.headerIcon}>
            <Ionicons name="shield-checkmark" size={26} color={Colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>Stay protected</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            MedGuard works best with a couple of permissions. You can change these any time in Settings.
          </Text>

          <View style={styles.list}>
            {items.filter((i) => i.show).map((item) => (
              <View key={item.title} style={styles.row}>
                <View style={[styles.rowIcon, { backgroundColor: 'rgba(17,180,212,0.12)' }]}>
                  <Ionicons name={item.icon} size={20} color={Colors.primary} />
                </View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.rowBody, { color: colors.textSecondary }]}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <Pressable
            onPress={handleEnable}
            disabled={busy}
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            accessibilityRole="button"
          >
            <Text style={styles.primaryBtnText}>{busy ? 'Requesting…' : 'Allow access'}</Text>
          </Pressable>
          <Pressable onPress={handleLater} disabled={busy} style={styles.laterBtn} accessibilityRole="button">
            <Text style={[styles.laterText, { color: colors.textSecondary }]}>Maybe later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,15,20,0.64)',
    justifyContent: 'flex-end',
  },
  card: {
    borderTopLeftRadius: BorderRadius['2xl'],
    borderTopRightRadius: BorderRadius['2xl'],
    borderWidth: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  headerIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(17,180,212,0.12)',
    marginBottom: Spacing.md,
  },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.xl, marginBottom: Spacing.xs },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 20, marginBottom: Spacing.lg },
  list: { gap: Spacing.base, marginBottom: Spacing.xl },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: FontFamily.semibold, fontSize: FontSize.base },
  rowBody: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 19, marginTop: 2 },
  primaryBtn: {
    minHeight: 52,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontFamily: FontFamily.semibold, fontSize: FontSize.base, color: Colors.textLight },
  laterBtn: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.xs },
  laterText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm },
});

export default PermissionsPrimerModal;
