/**
 * SettingsScreen
 * UI scaffold aligned to settings.html (Settings & Support)
 * 
 * GUEST GATED: Location sharing toggle disabled for guests.
 * 
 * ANDROID FIXES:
 * - Uses flexGrow for proper scrollable content
 * - Dynamic bottom padding for safe area
 * - Removed fixed heights
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Platform, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ErrorBanner, GlassCard, MoonIcon, ThemeModeSelector, Icon, PermissionExplainerModal, useFeedback, type IconName } from '../components';
import { RootStackParamList } from '../navigation/types';
import { LangCode, useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';
import { useAuthGate } from '../hooks/useAuthGate';
import { useNotifications } from '../hooks/useNotifications';
import { useLocationContext } from '../hooks/LocationContext';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize, Gradients } from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const LANGS: Array<{ code: LangCode; label: string }> = [
  { code: 'en', label: 'English' },
  { code: 'yo', label: 'Yorùbá' },
  { code: 'ha', label: 'Hausa' },
  { code: 'ig', label: 'Igbo' },
];

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { lang, setLang, t } = useI18n();
  const { isDark, colors, mode } = useTheme();
  const { isGuest, requireAuth, AuthGateModalComponent } = useAuthGate();
  const { toast } = useFeedback();
  
  // Notification settings
  const {
    loading: notifLoading,
    saving: notifSaving,
    error: notificationError,
    permissionGranted,
    permissionStatus: notificationPermissionStatus,
    permissionCanAskAgain: notificationCanAskAgain,
    reminderEnabled,
    reminderTime,
    reminderTimeDisplay,
    featureEnabled: notificationsFeatureEnabled,
    setReminderEnabled,
    setReminderTime,
    sendTestNotification,
    requestPermission: requestNotificationPermission,
  } = useNotifications();

  const {
    locationSharingEnabled,
    backgroundLocationEnabled,
    permissionStatus: locationPermissionStatus,
    permissionCanAskAgain: locationCanAskAgain,
    backgroundPermissionStatus,
    backgroundPermissionCanAskAgain,
    requestPermission: requestLocationPermission,
    setLocationSharing,
    setBackgroundLocationEnabled,
  } = useLocationContext();
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [backgroundPrimerOpen, setBackgroundPrimerOpen] = useState(false);
  const [backgroundPermissionBusy, setBackgroundPermissionBusy] = useState(false);

  // Handler for location sharing toggle - requires auth for guests
  const handleLocationToggle = async (value: boolean) => {
    if (isGuest) {
      // Show auth gate modal instead of toggling
      requireAuth('location sharing and personalized alerts');
      return;
    }
    const saved = await setLocationSharing(value);
    if (!saved) toast({ tone: 'danger', title: 'Location setting not saved', message: 'Please try again.' });
  };

  // Handler for notification toggle
  const handleNotificationToggle = async (value: boolean) => {
    if (isGuest) {
      requireAuth('notification reminders');
      return;
    }
    await setReminderEnabled(value);
  };

  const handleBackgroundToggle = async (value: boolean) => {
    if (isGuest) return requireAuth('background location updates');
    if (!value) {
      await setBackgroundLocationEnabled(false);
      return;
    }
    setBackgroundPrimerOpen(true);
  };

  const handleEnableBackgroundLocation = async () => {
    if (!backgroundPermissionCanAskAgain && backgroundPermissionStatus !== 'granted') {
      setBackgroundPrimerOpen(false);
      await Linking.openSettings().catch(() => undefined);
      return;
    }
    setBackgroundPermissionBusy(true);
    const result = await setBackgroundLocationEnabled(true);
    setBackgroundPermissionBusy(false);
    setBackgroundPrimerOpen(false);
    if (!result.ok) {
      const message = result.reason === 'task_manager_unavailable'
        ? 'Background tasks are unavailable in this app environment. Use the installed MedGuard test build, not Expo Go.'
        : result.reason === 'background_location_unavailable'
          ? 'This device does not support background location for MedGuard.'
          : result.reason === 'task_definition_missing'
            ? 'This build is missing the background task. Install the next MedGuard test build.'
            : 'Background updates could not start. Confirm “Allow all the time” and try again.';
      toast({ tone: 'warning', title: 'Background location stays off', message });
    }
  };

  const handleCorePermission = async (kind: 'location' | 'notifications') => {
    const blocked = kind === 'location'
      ? !locationCanAskAgain && locationPermissionStatus !== 'granted'
      : !notificationCanAskAgain && notificationPermissionStatus !== 'granted';
    if (blocked) {
      await Linking.openSettings().catch(() => undefined);
      return;
    }
    if (kind === 'location') await requestLocationPermission();
    else await requestNotificationPermission();
  };

  const handleSendTest = async () => {
    if (isGuest) return requireAuth('notification testing');
    try {
      const accepted = await sendTestNotification();
      toast({ tone: accepted ? 'success' : 'danger', title: accepted ? 'Test sent' : 'Test not sent', message: accepted ? 'Expo accepted a test for this device. It may take a moment to appear.' : 'Enable device notifications and try again.' });
    } catch {
      toast({ tone: 'danger', title: 'Test not sent', message: 'Please check your connection and notification permission.' });
    }
  };

  const handleSendHealthNewsTest = async () => {
    if (isGuest) return requireAuth('Health News notification testing');
    try {
      const accepted = await sendTestNotification('health_news');
      toast({
        tone: accepted ? 'success' : 'danger',
        title: accepted ? 'Health News test sent' : 'Health News test not sent',
        message: accepted ? 'Tap the notification to verify that the exact official post opens.' : 'Enable device notifications and try again.',
      });
    } catch {
      toast({ tone: 'danger', title: 'Health News test not sent', message: 'Please check your connection and try again.' });
    }
  };

  // Handler for time picker
  const handleTimeChange = async (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      await setReminderTime(`${hours}:${minutes}:00`);
    }
  };

  // Parse reminder time for picker
  const getReminderDate = () => {
    const [hours, minutes] = reminderTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const bottomPadding = useMemo(() => {
    const min = 24;
    return Math.max(insets.bottom + Spacing.xl, min);
  }, [insets.bottom]);

  const gradientColors = isDark
    ? [colors.gradientFrom, colors.gradientTo] as [string, string]
    : Gradients.primaryVertical.colors as unknown as [string, string];

  return (
    <View style={[styles.gradient, { backgroundColor: colors.background }]}>
      <View style={styles.page}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.base }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={[styles.headerBtn, styles.headerTile, { backgroundColor: colors.surface, borderColor: colors.border }]}
            hitSlop={10}
          >
            <Icon name="chevron-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('settings_support')}</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          // ANDROID FIX: flexGrow ensures proper scrolling on short screens
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding, flexGrow: 1 }]}
          // ANDROID FIX: Improve scroll performance
          removeClippedSubviews={Platform.OS === 'android'}
        >
          {notificationError ? (
            <ErrorBanner message={notificationError} title="Settings need attention" />
          ) : null}

          {/* Appearance / Theme Section */}
          <GlassCard padding={Spacing.cardPadding} style={styles.card}>
            <View style={styles.cardRowCenter}>
              <View style={styles.iconWrap}>
                <MoonIcon size={24} color={Colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('appearance')}</Text>
            </View>
            <Text style={[styles.cardDescription, { color: colors.textSecondary, marginBottom: Spacing.base }]}>
              {t('appearance_desc')}
            </Text>
            <ThemeModeSelector />
          </GlassCard>

          {/* Location sharing */}
          <GlassCard padding={Spacing.cardPadding} style={styles.card}>
            <View style={styles.cardRowTop}>
              <View style={styles.iconWrap}>
                <ShieldOutlineIcon size={24} color={Colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.toggleHeaderRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>{t('share_location_toggle')}</Text>
                  <Switch
                    value={isGuest ? false : locationSharingEnabled}
                    onValueChange={(value) => void handleLocationToggle(value)}
                    trackColor={{ false: isDark ? Colors.blackAlpha20 : Colors.whiteAlpha30, true: Colors.primary }}
                    thumbColor={Colors.surfaceLight}
                    disabled={isGuest}
                  />
                </View>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {isGuest ? 'Sign in to enable location sharing for personalized alerts.' : t('share_location_desc')}
                </Text>
              </View>
            </View>
          </GlassCard>

          <GlassCard padding={Spacing.cardPadding} style={styles.card}>
            <View style={styles.cardRowTop}>
              <View style={styles.iconWrap}><BellIcon size={24} color={Colors.primary} /></View>
              <View style={styles.cardBody}>
                <Text style={[styles.toggleLabel, { color: colors.text }]}>Test notifications</Text>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>Sends one clearly labelled test only to this signed-in device.</Text>
                <Pressable onPress={() => void handleSendTest()} disabled={isGuest || notifSaving || !notificationsFeatureEnabled} style={styles.supportBtn}>
                  <Text style={styles.supportBtnText}>Send test notification</Text>
                </Pressable>
                <Pressable onPress={() => void handleSendHealthNewsTest()} disabled={isGuest || notifSaving || !notificationsFeatureEnabled} style={styles.supportBtn}>
                  <Text style={styles.supportBtnText}>Send Health News test</Text>
                </Pressable>
              </View>
            </View>
          </GlassCard>

          {/* Live permission centre. Optional permissions remain contextual. */}
          <GlassCard padding={Spacing.cardPadding} style={styles.card}>
            <View style={styles.cardRowCenter}>
              <View style={styles.iconWrap}><Icon name="shield-check" size={24} color={Colors.primary} /></View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Permissions</Text>
            </View>
            <Text style={[styles.cardDescription, { color: colors.textSecondary, marginBottom: Spacing.md }]}>
              MedGuard asks only when a feature needs access. You can keep using the app if you decline.
            </Text>
            <View style={[styles.permissionList, { borderColor: colors.border }]}>
              <PermissionRow
                icon="map-pin"
                title="Foreground location"
                description="Alert area and nearby facilities"
                status={locationPermissionStatus === 'granted' ? 'Allowed' : 'Not allowed'}
                actionLabel={locationPermissionStatus === 'granted' ? undefined : (!locationCanAskAgain ? 'Open Settings' : 'Allow')}
                onAction={() => void handleCorePermission('location')}
                colors={colors}
              />
              <PermissionRow
                icon="bell"
                title="Notifications"
                description="Official alerts and reminders"
                status={notificationPermissionStatus === 'granted' ? 'Allowed' : 'Not allowed'}
                actionLabel={notificationPermissionStatus === 'granted' ? undefined : (!notificationCanAskAgain ? 'Open Settings' : 'Allow')}
                onAction={() => void handleCorePermission('notifications')}
                colors={colors}
              />
              <PermissionRow
                icon="navigation"
                title="Background location"
                description="Optional · managed below"
                status={backgroundPermissionStatus === 'granted' && backgroundLocationEnabled ? 'Allowed' : 'Off'}
                colors={colors}
              />
              <PermissionRow
                icon="footprints"
                title="Step tracking"
                description="Optional · requested in My Health"
                status="Ask when used"
                actionLabel="Open My Health"
                onAction={() => navigation.navigate('MainTabs', { screen: 'MyHealth' })}
                colors={colors}
              />
              <PermissionRow
                icon="camera"
                title="Camera and photos"
                description="Optional · requested when changing your photo"
                status="Ask when used"
                colors={colors}
              />
            </View>
          </GlassCard>

          <GlassCard padding={Spacing.cardPadding} style={styles.card}>
            <View style={styles.cardRowTop}>
              <View style={styles.iconWrap}><ShieldOutlineIcon size={24} color={Colors.primary} /></View>
              <View style={styles.cardBody}>
                <View style={styles.toggleHeaderRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Background location updates</Text>
                  <Switch
                    value={isGuest ? false : backgroundLocationEnabled}
                    onValueChange={(value) => void handleBackgroundToggle(value)}
                    trackColor={{ false: isDark ? Colors.blackAlpha20 : Colors.whiteAlpha30, true: Colors.primary }}
                    thumbColor={Colors.surfaceLight}
                    disabled={isGuest || !locationSharingEnabled}
                  />
                </View>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>Optional. Updates your alert area about every 15 minutes or 1 km while the app is closed. This can use more battery.</Text>
              </View>
            </View>
          </GlassCard>

          {/* Daily Check-in Reminder */}
          <GlassCard padding={Spacing.cardPadding} style={styles.card}>
            <View style={styles.cardRowTop}>
              <View style={styles.iconWrap}>
                <BellIcon size={24} color={Colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <View style={styles.toggleHeaderRow}>
                  <Text style={[styles.toggleLabel, { color: colors.text }]}>Daily Check-in Reminder</Text>
                  <Switch
                    value={isGuest ? false : reminderEnabled}
                    onValueChange={handleNotificationToggle}
                    trackColor={{ false: isDark ? Colors.blackAlpha20 : Colors.whiteAlpha30, true: Colors.primary }}
                    thumbColor={Colors.surfaceLight}
                    disabled={isGuest || notifSaving}
                  />
                </View>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {isGuest 
                    ? 'Sign in to receive gentle daily reminders to check in on your health.'
                    : 'Get a friendly reminder to complete your daily health check-in.'}
                </Text>

                {/* Time Picker - only show when enabled */}
                {reminderEnabled && !isGuest && (
                  <View style={styles.timePickerSection}>
                    <Text style={[styles.timeLabel, { color: colors.text }]}>Reminder Time</Text>
                    <Pressable 
                      onPress={() => setShowTimePicker(true)}
                      style={[styles.timeButton, { backgroundColor: isDark ? colors.surface : Colors.whiteAlpha90 }]}
                    >
                      <ClockIcon size={18} color={colors.textSecondary} />
                      <Text style={[styles.timeButtonText, { color: colors.text }]}>
                        {reminderTimeDisplay}
                      </Text>
                    </Pressable>
                    
                    {showTimePicker && (
                      <DateTimePicker
                        value={getReminderDate()}
                        mode="time"
                        is24Hour={false}
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handleTimeChange}
                      />
                    )}
                  </View>
                )}

                {/* Permission note */}
                {!permissionGranted && reminderEnabled && !isGuest && (
                  <Text style={[styles.permissionNote, { color: Colors.warning }]}>
                    ⚠️ Please enable notifications in your device settings
                  </Text>
                )}
              </View>
            </View>
          </GlassCard>

          {/* Language */}
          <GlassCard padding={Spacing.cardPadding} style={styles.card}>
            <View style={styles.cardRowCenter}>
              <View style={styles.iconWrap}>
                <GlobeIcon size={24} color={Colors.primary} />
              </View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>{t('language')}</Text>
            </View>

            <View style={styles.chipsWrap}>
              {LANGS.map(({ code, label }) => {
                const active = code === lang;
                return (
                  <Pressable
                    key={code}
                    onPress={() => void setLang(code)}
                    style={[
                      styles.chip,
                      active
                        ? { backgroundColor: colors.primary, borderColor: colors.primary }
                        : { backgroundColor: colors.surface, borderColor: colors.border },
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        { color: active ? Colors.textLight : colors.text },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </GlassCard>

          {/* Support */}
          <GlassCard padding={Spacing.cardPadding} style={styles.card}>
            <View style={styles.cardRowTop}>
              <View style={styles.iconWrap}>
                <ChatHeartIcon size={24} color={Colors.primary} />
              </View>
              <View style={styles.cardBody}>
                <Text style={[styles.supportTitle, { color: colors.text }]}>{t('need_help')}</Text>
                <Pressable
                  onPress={() => navigation.navigate('Chatbot')}
                  style={styles.supportBtn}
                >
                  <Text style={styles.supportBtnText}>{t('start_chat')}</Text>
                </Pressable>
              </View>
            </View>
          </GlassCard>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>v1.0.0</Text>
            <Pressable onPress={() => {}}>
              <Text style={[styles.footerText, styles.footerLink, { color: colors.textMuted }]}>
                {t('terms_privacy_short')}
              </Text>
            </Pressable>
            <Text style={[styles.footerStrong, { color: colors.textMuted }]}>
              {t('powered_by')}
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Auth gate modal for guests trying to access restricted features */}
      <AuthGateModalComponent />
      <PermissionExplainerModal
        visible={backgroundPrimerOpen}
        icon="navigation"
        title="Allow background location?"
        description="If you opt in, MedGuard can update your alert state after a verified move while the app is closed. Updates are conservative and may use more battery. This stays off unless you enable it."
        primaryLabel={!backgroundPermissionCanAskAgain && backgroundPermissionStatus !== 'granted' ? 'Open Settings' : 'Allow background access'}
        busy={backgroundPermissionBusy}
        onContinue={handleEnableBackgroundLocation}
        onClose={() => setBackgroundPrimerOpen(false)}
      />
    </View>
  );
};

const PermissionRow: React.FC<{
  icon: IconName;
  title: string;
  description: string;
  status: string;
  actionLabel?: string;
  onAction?: () => void;
  colors: any;
}> = ({ icon, title, description, status, actionLabel, onAction, colors }) => (
  <View style={[styles.permissionRow, { borderBottomColor: colors.border }]}>
    <Icon name={icon} size={19} color={colors.primary} />
    <View style={styles.permissionRowBody}>
      <Text style={[styles.permissionRowTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.permissionRowDescription, { color: colors.textSecondary }]}>{description}</Text>
    </View>
    <View style={styles.permissionRowAction}>
      <Text style={[styles.permissionStatus, { color: status === 'Allowed' ? Colors.success : colors.textMuted }]}>{status}</Text>
      {actionLabel && onAction && (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={6}>
          <Text style={[styles.permissionActionText, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  </View>
);

function ShieldOutlineIcon({ size = 24, color = Colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  );
}

function BellIcon({ size = 24, color = Colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  );
}

function ClockIcon({ size = 24, color = Colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 6v6l4 2" />
    </Svg>
  );
}

function GlobeIcon({ size = 24, color = Colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Line x1={2} y1={12} x2={22} y2={12} />
      <Path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </Svg>
  );
}

function ChatHeartIcon({ size = 24, color = Colors.primary }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 21.2a10 10 0 1 0-10-10v10h10z" />
      <Path d="M15.5 9.5c.3-.9.1-1.8-.5-2.5-.8-.8-2-1-3-1-.9 0-1.8.3-2.5.8-.7.7-.9 1.7-.5 2.5l3.5 3.5Z" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTile: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    paddingRight: 40,
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    letterSpacing: -0.2,
  },
  content: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.lg,
    gap: Spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: 24,
  },
  cardRowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.lg,
  },
  cardRowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    marginBottom: Spacing.base,
  },
  iconWrap: {
    marginTop: 2,
  },
  cardBody: {
    flex: 1,
  },
  toggleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.base,
  },
  toggleLabel: {
    flex: 1,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  cardDescription: {
    marginTop: Spacing.xs,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  cardTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
    color: Colors.textPrimary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  chip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(17,180,212,0.14)',
  },
  chipActive: {
    backgroundColor: Colors.primary,
  },
  chipInactive: {
    backgroundColor: Colors.whiteAlpha90,
  },
  chipText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
  },
  chipTextActive: {
    color: Colors.textLight,
  },
  chipTextInactive: {
    color: Colors.textPrimary,
  },
  supportTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  supportBtn: {
    marginTop: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  supportBtnText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textLight,
  },
  footer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    paddingBottom: Spacing.base,
    gap: Spacing.sm,
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.whiteAlpha80,
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
  footerStrong: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.xs,
    color: Colors.whiteAlpha80,
  },
  timePickerSection: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.whiteAlpha10,
    gap: Spacing.sm,
  },
  timeLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.whiteAlpha10,
    borderRadius: 16,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(17,180,212,0.14)',
  },
  timeButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  permissionNote: {
    marginTop: Spacing.sm,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontStyle: 'italic',
  },
  permissionList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  permissionRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
  },
  permissionRowBody: { flex: 1 },
  permissionRowTitle: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  permissionRowDescription: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, lineHeight: 17, marginTop: 1 },
  permissionRowAction: { maxWidth: 104, alignItems: 'flex-end', gap: 3 },
  permissionStatus: { fontFamily: FontFamily.medium, fontSize: FontSize.xs },
  permissionActionText: { fontFamily: FontFamily.semibold, fontSize: FontSize.xs, textAlign: 'right' },
});

export default SettingsScreen;
