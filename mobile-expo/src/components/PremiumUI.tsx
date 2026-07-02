import React from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, FontFamily, FontSize, Shadows, Spacing } from '../../theme';
import { useTheme } from '../hooks/useTheme';
import Button from './Button';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function PremiumCard({
  children,
  style,
  accent = false,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: boolean;
}) {
  const { isDark, colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: accent ? colors.primaryTint : colors.surface,
          borderColor: accent ? (isDark ? colors.border : colors.primaryTint) : colors.border,
          shadowColor: isDark ? '#000' : colors.shadow,
        },
        style,
      ]}
    >
      <View style={styles.cardContent}>{children}</View>
    </View>
  );
}

export function SectionTitle({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.sectionTitleRow}>
      <View style={styles.sectionTitleLeft}>
        {icon && (
          <View style={[styles.sectionIcon, { backgroundColor: colors.primaryLight }]}>
            <Ionicons name={icon} size={16} color={colors.primary} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          {!!subtitle && (
            <Text style={[styles.sectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          )}
        </View>
      </View>
      {action}
    </View>
  );
}

export function MetricTile({
  icon,
  label,
  value,
  hint,
  tone = 'primary',
  style,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint?: string;
  tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  style?: ViewStyle;
}) {
  const { isDark, colors } = useTheme();
  const toneColor =
    tone === 'success' ? Colors.success :
    tone === 'warning' ? Colors.warning :
    tone === 'danger' ? Colors.danger :
    tone === 'info' ? Colors.info :
    colors.primary;

  return (
    <View
      style={[
        styles.metricTile,
        {
          backgroundColor: isDark ? colors.surface : '#ffffff',
          borderColor: isDark ? colors.border : '#e2eef0',
        },
        style,
      ]}
    >
      <View style={[styles.metricIcon, { backgroundColor: `${toneColor}18` }]}>
        <Ionicons name={icon} size={18} color={toneColor} />
      </View>
      <Text style={[styles.metricLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.metricValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
      {!!hint && (
        <Text style={[styles.metricHint, { color: colors.textMuted }]} numberOfLines={1}>
          {hint}
        </Text>
      )}
    </View>
  );
}

export function ErrorBanner({
  message,
  title = 'Something needs attention',
  onRetry,
}: {
  message: string;
  title?: string;
  onRetry?: () => void;
}) {
  const { isDark, colors } = useTheme();

  return (
    <View
      style={[
        styles.errorBanner,
        {
          backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#fff1f2',
          borderColor: isDark ? 'rgba(248,113,113,0.28)' : '#fecdd3',
        },
      ]}
    >
      <View style={styles.errorIcon}>
        <Ionicons name="alert-circle-outline" size={18} color={Colors.danger} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.errorMessage, { color: colors.textSecondary }]}>{message}</Text>
      </View>
      {onRetry && (
        <Pressable onPress={onRetry} style={styles.retryBtn}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

export function PremiumEmptyState({
  icon,
  title,
  message,
  loading,
}: {
  icon: IconName;
  title: string;
  message: string;
  loading?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <PremiumCard style={styles.emptyCard}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons name={icon} size={28} color={colors.primary} />
        )}
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyMessage, { color: colors.textSecondary }]}>{message}</Text>
    </PremiumCard>
  );
}

export function ForceUpdateView({
  message,
  updateUrl,
  latestBuild,
}: {
  message: string;
  updateUrl?: string | null;
  latestBuild?: number | null;
}) {
  const { colors, isDark } = useTheme();

  const handleUpdate = () => {
    if (updateUrl) Linking.openURL(updateUrl).catch(() => {});
  };

  return (
    <LinearGradient
      colors={
        isDark
          ? ['#07131a', '#0b222b', '#102f34']
          : ['#eefbfc', '#f6fffb', '#ffffff']
      }
      style={styles.forceRoot}
    >
      <PremiumCard accent style={styles.forceCard}>
        <View style={[styles.forceMark, { backgroundColor: colors.primaryLight }]}>
          <Ionicons name="shield-checkmark" size={34} color={colors.primary} />
        </View>
        <Text style={[styles.forceTitle, { color: colors.text }]}>Update MedGuard</Text>
        <Text style={[styles.forceMessage, { color: colors.textSecondary }]}>
          {message || 'A newer MedGuard version is required to keep health alerts and safety guidance working correctly.'}
        </Text>
        {!!latestBuild && (
          <Text style={[styles.forceMeta, { color: colors.textMuted }]}>
            Latest build: {latestBuild}
          </Text>
        )}
        <Button
          title="Update now"
          onPress={handleUpdate}
          disabled={!updateUrl}
          icon={<Ionicons name="open-outline" size={18} color={Colors.textLight} />}
        />
      </PremiumCard>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardContent: {
    padding: Spacing.lg,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    gap: Spacing.base,
  },
  sectionTitleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.lg,
    letterSpacing: -0.2,
  },
  sectionSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  metricTile: {
    flex: 1,
    minHeight: 132,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    padding: Spacing.base,
    ...Shadows.sm,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  metricLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
  },
  metricValue: {
    fontFamily: FontFamily.displayBold,
    fontSize: 24,
    letterSpacing: -0.4,
    marginTop: 4,
  },
  metricHint: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    marginTop: 4,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.base,
  },
  errorIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.sm,
  },
  errorMessage: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    marginTop: 2,
    lineHeight: 19,
  },
  retryBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  retryText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.danger,
  },
  emptyCard: {
    alignItems: 'center',
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.base,
  },
  emptyTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  emptyMessage: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  forceRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  forceCard: {
    width: '100%',
  },
  forceMark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  forceTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 30,
    lineHeight: 36,
  },
  forceMessage: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: 24,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  forceMeta: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    marginBottom: Spacing.base,
  },
});
