/** Official reports and notification controls for the user's canonical area. */
import React, { useState } from 'react';
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorBanner, GlassCard, Icon, SkeletonLoader } from '../components';
import { useAlerts } from '../hooks/useAlerts';
import { useNotifications } from '../hooks/useNotifications';
import { useTheme } from '../hooks/useTheme';
import { BorderRadius, Colors, FontFamily, FontSize, Gradients, Spacing } from '../../theme';

const severityMeta = {
  urgent: { color: Colors.danger, label: 'Official alert', icon: 'alert-triangle' as const },
  caution: { color: Colors.warning, label: 'Official update', icon: 'alert-circle' as const },
  info: { color: Colors.primary, label: 'Verified report', icon: 'shield-check' as const },
};

function relativeTime(value: string): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 'Recently published';
  const hours = Math.max(0, Math.floor((Date.now() - time) / 3_600_000));
  if (hours < 1) return 'Published recently';
  if (hours < 24) return `Published ${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `Published ${days} day${days === 1 ? '' : 's'} ago`;
}

const AlertsScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();
  const { alerts: communityAlerts, loading, error, refresh, location, generatedAt } = useAlerts();
  const { reminderEnabled, communityAlertsEnabled, setReminderEnabled, setCommunityAlertsEnabled, saving } = useNotifications();
  const [refreshing, setRefreshing] = useState(false);
  const activeAlertCount = communityAlerts.length;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const gradient = isDark
    ? [colors.gradientFrom, colors.gradientVia, colors.gradientTo] as [string, string, string]
    : Gradients.background.colors as unknown as [string, string, string];

  return (
    <LinearGradient colors={gradient} start={Gradients.background.start} end={Gradients.background.end} style={styles.container}>
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={{ paddingTop: insets.top + Spacing.base, paddingBottom: Math.max(insets.bottom, 12) + 80, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={Platform.OS === 'android'}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        >
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Pressable
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Go back"
                hitSlop={10}
                style={({ pressed }) => [styles.back, { backgroundColor: colors.surface, borderColor: colors.border }, pressed && styles.pressed]}
              >
                <Icon name="chevron-left" size={22} color={colors.text} />
              </Pressable>
              {activeAlertCount > 0 && (
                <View style={[styles.badge, { backgroundColor: isDark ? 'rgba(220,59,59,0.16)' : Colors.dangerLight }]} accessibilityLabel={`${activeAlertCount} verified reports`}>
                  <View style={styles.badgeDot} />
                  <Text style={[styles.badgeText, { color: Colors.danger }]}>{activeAlertCount} verified</Text>
                </View>
              )}
            </View>
            <Text style={[styles.title, { color: colors.text }]}>Alerts & Notifications</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Official reports matched to {location?.state || 'your alert area'}</Text>
          </View>

          <View style={styles.content}>
            <View style={styles.sectionHeading}>
              <View style={[styles.sectionIcon, { backgroundColor: colors.primaryTint }]}><Icon name="shield-check" size={18} color={colors.primary} /></View>
              <View style={styles.sectionCopy}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Verified reports</Text>
                <Text style={[styles.sectionMeta, { color: colors.textMuted }]}>
                  NCDC, WHO and reviewed reports{generatedAt ? ` · checked ${new Date(generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                </Text>
              </View>
            </View>

            {error && <ErrorBanner title="Reports unavailable" message={error.message} onRetry={() => void refresh()} />}

            {loading && communityAlerts.length === 0 ? (
              <View style={styles.loadingStack}>
                <SkeletonLoader height={142} style={{ borderRadius: BorderRadius.card }} />
                <SkeletonLoader height={142} style={{ borderRadius: BorderRadius.card }} />
              </View>
            ) : communityAlerts.length > 0 ? (
              <View style={styles.reportStack}>
                {communityAlerts.map((alert, index) => {
                  const meta = severityMeta[alert.severity];
                  return (
                    <Animated.View key={alert.id} entering={FadeInUp.delay(Math.min(index * 70, 280)).duration(360)}>
                      <View style={[styles.reportCard, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: isDark ? '#000' : colors.shadow }]}>
                        <View style={[styles.reportAccent, { backgroundColor: meta.color }]} />
                        <View style={styles.reportHeader}>
                          <View style={[styles.reportIcon, { backgroundColor: `${meta.color}1F` }]}><Icon name={meta.icon} size={19} color={meta.color} /></View>
                          <View style={styles.reportHeading}>
                            <Text style={[styles.reportLabel, { color: meta.color }]}>{meta.label.toUpperCase()}</Text>
                            <Text style={[styles.reportTitle, { color: colors.text }]}>{alert.title}</Text>
                          </View>
                        </View>
                        <Text style={[styles.reportMessage, { color: colors.textSecondary }]}>{alert.message}</Text>
                        <View style={[styles.reportFooter, { borderTopColor: colors.border }]}>
                          <Text style={[styles.source, { color: colors.textMuted }]} numberOfLines={1}>{alert.source || 'Official source'}</Text>
                          <Text style={[styles.time, { color: colors.textMuted }]}>{relativeTime(alert.timestamp)}</Text>
                        </View>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>
            ) : !error ? (
              <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.emptyIcon, { backgroundColor: colors.primaryTint }]}><Icon name="shield-check" size={24} color={colors.primary} /></View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No active verified reports</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Risk estimates live in My Health. This page only shows official or reviewed reports, so the count cannot be confused with a projection.</Text>
              </View>
            ) : null}

            <Text style={[styles.controlsLabel, { color: colors.textMuted }]}>NOTIFICATION CONTROLS</Text>
            <GlassCard style={styles.controlsCard}>
              <NotificationRow
                icon="clock"
                title="Daily check-in reminder"
                description="A gentle reminder scheduled on this device"
                value={reminderEnabled}
                disabled={saving}
                onChange={(value) => void setReminderEnabled(value)}
                colors={colors}
              />
              <View style={[styles.divider, { backgroundColor: colors.border }]} />
              <NotificationRow
                icon="bell"
                title="Official alerts & Health News"
                description="State-matched alerts and new official NCDC/WHO updates"
                value={communityAlertsEnabled}
                disabled={saving}
                onChange={(value) => void setCommunityAlertsEnabled(value)}
                colors={colors}
              />
            </GlassCard>
          </View>
        </ScrollView>
      </View>
    </LinearGradient>
  );
};

const NotificationRow: React.FC<{
  icon: 'clock' | 'bell'; title: string; description: string; value: boolean; disabled: boolean;
  onChange: (value: boolean) => void; colors: any;
}> = ({ icon, title, description, value, disabled, onChange, colors }) => (
  <View style={styles.controlRow}>
    <View style={[styles.controlIcon, { backgroundColor: colors.primaryTint }]}><Icon name={icon} size={18} color={colors.primary} /></View>
    <View style={styles.controlCopy}>
      <Text style={[styles.controlTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.controlDescription, { color: colors.textSecondary }]}>{description}</Text>
    </View>
    <Switch value={value} onValueChange={onChange} disabled={disabled} trackColor={{ false: colors.border, true: Colors.primaryLight }} thumbColor={value ? Colors.primary : colors.textMuted} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: { flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  headerTop: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
  back: { width: 48, height: 48, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.72 },
  badge: { minHeight: 36, borderRadius: BorderRadius.pill, paddingHorizontal: Spacing.md, flexDirection: 'row', gap: 7, alignItems: 'center' },
  badgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.danger },
  badgeText: { fontFamily: FontFamily.semibold, fontSize: FontSize.xs },
  title: { fontFamily: FontFamily.displayBold, fontSize: FontSize['3xl'], letterSpacing: -0.8 },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.base, lineHeight: 23, marginTop: Spacing.sm },
  content: { paddingHorizontal: Spacing.lg },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.base },
  sectionIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  sectionCopy: { flex: 1 },
  sectionTitle: { fontFamily: FontFamily.display, fontSize: FontSize.lg },
  sectionMeta: { fontFamily: FontFamily.regular, fontSize: 10, lineHeight: 15, marginTop: 2 },
  loadingStack: { gap: Spacing.md, minHeight: 300 },
  reportStack: { gap: Spacing.md },
  reportCard: { borderRadius: BorderRadius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: Spacing.lg, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 14, elevation: 2 },
  reportAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 4 },
  reportHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  reportIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  reportHeading: { flex: 1 },
  reportLabel: { fontFamily: FontFamily.bold, fontSize: 9, letterSpacing: 0.8 },
  reportTitle: { fontFamily: FontFamily.display, fontSize: FontSize.base, lineHeight: 22, marginTop: 3 },
  reportMessage: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 21, marginTop: Spacing.md },
  reportFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.sm, marginTop: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  source: { flex: 1, fontFamily: FontFamily.medium, fontSize: 10 },
  time: { fontFamily: FontFamily.regular, fontSize: 10 },
  empty: { minHeight: 220, borderRadius: BorderRadius.card, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl, gap: Spacing.sm },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: FontFamily.display, fontSize: FontSize.lg, textAlign: 'center' },
  emptyText: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, lineHeight: 21, textAlign: 'center' },
  controlsLabel: { fontFamily: FontFamily.semibold, fontSize: 10, letterSpacing: 1, marginTop: Spacing.xl, marginBottom: Spacing.sm },
  controlsCard: { padding: Spacing.lg },
  controlRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  controlIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  controlCopy: { flex: 1 },
  controlTitle: { fontFamily: FontFamily.semibold, fontSize: FontSize.sm },
  controlDescription: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, lineHeight: 17, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: Spacing.xs },
});

export default AlertsScreen;
