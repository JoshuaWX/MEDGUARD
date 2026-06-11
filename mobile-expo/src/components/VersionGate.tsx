import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ForceUpdateView, PremiumCard } from './PremiumUI';
import { checkVersionPolicy, VersionGateResult } from '../services/versionPolicy';
import { useTheme } from '../hooks/useTheme';
import { FontFamily, FontSize, Spacing } from '../../theme';

export default function VersionGate({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  const [result, setResult] = React.useState<VersionGateResult | null>(null);

  React.useEffect(() => {
    let mounted = true;
    checkVersionPolicy().then((next) => {
      if (mounted) setResult(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!result) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: colors.background }]}>
        <PremiumCard style={styles.loadingCard}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingTitle, { color: colors.text }]}>Checking MedGuard</Text>
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
            Making sure your app version is ready for health alerts.
          </Text>
        </PremiumCard>
      </View>
    );
  }

  if (result.status === 'blocked') {
    return (
      <ForceUpdateView
        message={result.policy.message}
        updateUrl={result.policy.update_url}
        latestBuild={result.policy.latest_build}
      />
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  loadingCard: {
    alignItems: 'center',
  },
  loadingTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    marginTop: Spacing.base,
  },
  loadingText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
});
