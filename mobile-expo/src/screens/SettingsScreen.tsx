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
import { View, Text, StyleSheet, ScrollView, Switch, Pressable, Platform, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DateTimePicker from '@react-native-community/datetimepicker';

import { ErrorBanner, GlassCard, ArrowBackIcon, MoonIcon, ThemeModeSelector, AuthGateModal } from '../components';
import { RootStackParamList } from '../navigation/types';
import { LangCode, useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';
import { useAuthGate } from '../hooks/useAuthGate';
import { useNotifications } from '../hooks/useNotifications';
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
  
  // Notification settings
  const {
    loading: notifLoading,
    saving: notifSaving,
    error: notificationError,
    permissionGranted,
    reminderEnabled,
    reminderTime,
    reminderTimeDisplay,
    featureEnabled: notificationsFeatureEnabled,
    setReminderEnabled,
    setReminderTime,
    sendTest,
  } = useNotifications();

  const [locationSharing, setLocationSharing] = useState(true);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Handler for location sharing toggle - requires auth for guests
  const handleLocationToggle = (value: boolean) => {
    if (isGuest) {
      // Show auth gate modal instead of toggling
      requireAuth('location sharing and personalized alerts');
      return;
    }
    setLocationSharing(value);
  };

  // Handler for notification toggle
  const handleNotificationToggle = async (value: boolean) => {
    if (isGuest) {
      requireAuth('notification reminders');
      return;
    }
    await setReminderEnabled(value);
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

  // Handler for test notification
  const handleTestNotification = async () => {
    await sendTest();
    Alert.alert('Test Sent', 'Check your notifications!');
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
    <LinearGradient
      colors={gradientColors}
      start={Gradients.primaryVertical.start}
      end={Gradients.primaryVertical.end}
      style={styles.gradient}
    >
      <View style={styles.page}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + Spacing.base }]}>
          <Pressable onPress={() => navigation.goBack()} style={styles.headerBtn} hitSlop={10}>
            <ArrowBackIcon size={24} color={isDark ? colors.text : Colors.textLight} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: isDark ? colors.text : Colors.textLight }]}>
            {t('settings_support')}
          </Text>
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
                    value={isGuest ? false : locationSharing}
                    onValueChange={handleLocationToggle}
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
                    
                    {/* Test notification button */}
                    <Pressable 
                      onPress={handleTestNotification}
                      style={styles.testButton}
                    >
                      <Text style={styles.testButtonText}>Send Test Notification</Text>
                    </Pressable>
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
                      active ? styles.chipActive : { backgroundColor: isDark ? colors.surface : Colors.whiteAlpha90 },
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
            <Text style={[styles.footerText, { color: isDark ? colors.textMuted : Colors.whiteAlpha80 }]}>v1.0.0</Text>
            <Pressable onPress={() => {}}>
              <Text style={[styles.footerText, styles.footerLink, { color: isDark ? colors.textMuted : Colors.whiteAlpha80 }]}>
                {t('terms_privacy_short')}
              </Text>
            </Pressable>
            <Text style={[styles.footerStrong, { color: isDark ? colors.textMuted : Colors.whiteAlpha80 }]}>
              {t('powered_by')}
            </Text>
          </View>
        </ScrollView>
      </View>

      {/* Auth gate modal for guests trying to access restricted features */}
      <AuthGateModalComponent />
    </LinearGradient>
  );
};

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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    paddingRight: 44,
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    color: Colors.textLight,
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
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
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
  testButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    backgroundColor: Colors.whiteAlpha10,
    borderRadius: BorderRadius.md,
    alignSelf: 'flex-start',
  },
  testButtonText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  permissionNote: {
    marginTop: Spacing.sm,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontStyle: 'italic',
  },
});

export default SettingsScreen;
