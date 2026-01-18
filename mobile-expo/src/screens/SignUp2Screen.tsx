/**
 * SignUp2Screen
 * Step 2 of 2 - Personalization welcome
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { RootStackParamList } from '../navigation/types';
import { Button, GlassCard, ArrowRightIcon } from '../components';
import { useUser } from '../hooks/useUser';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { useI18n } from '../i18n';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
} from '../../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'SignUp2'>;

interface FeatureCardProps {
  number: string;
  title: string;
  description: string;
  colors: {
    text: string;
    textSecondary: string;
    primaryLight: string;
  };
}

const FeatureCard: React.FC<FeatureCardProps> = ({ number, title, description, colors }) => {
  return (
    <View style={[styles.featureCard, { backgroundColor: colors.primaryLight }]}>
      <View style={[styles.featureNumber, { backgroundColor: colors.primaryLight }]}>
        <Text style={styles.featureNumberText}>{number}</Text>
      </View>
      <View style={styles.featureContent}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.featureDescription, { color: colors.textSecondary }]}>{description}</Text>
      </View>
    </View>
  );
};

const SignUp2Screen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { completeOnboarding, loading } = useAuth();
  const { t } = useI18n();
  const { isDark, colors } = useTheme();

  const [notifications, setNotifications] = useState(true);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const location = user?.state || 'your area';

  const handleFinish = async () => {
    try {
      await completeOnboarding();
    } finally {
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' }],
      });
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.progressRow}>
            <Text style={[styles.stepText, { color: colors.textSecondary }]}>{t('step_2_of_2')}</Text>
            <View style={styles.progressBars}>
              <View style={styles.progressBarFilled} />
              <View style={styles.progressBarFilled} />
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Welcome Message */}
          <View style={styles.welcomeSection}>
            <Text style={[styles.welcomeTitle, { color: colors.text }]}>
              {t('signup2_welcome_title', { name: firstName, app: t('app_name') })}
            </Text>
            <Text style={[styles.welcomeSubtitle, { color: colors.textSecondary }]}>
              {t('signup2_welcome_subtitle', { location })}
            </Text>
          </View>

          {/* Feature Cards */}
          <View style={styles.featuresContainer}>
            <FeatureCard
              number="1️⃣"
              title={t('seasonal_health_alerts')}
              description={t('feature_seasonal_desc')}
              colors={colors}
            />
            <FeatureCard
              number="2️⃣"
              title={t('ai_chatbot')}
              description={t('feature_chatbot_desc')}
              colors={colors}
            />
            <FeatureCard
              number="3️⃣"
              title={t('daily_health_feed')}
              description={t('feature_feed_desc')}
              colors={colors}
            />
          </View>

          {/* Notifications Toggle (web-like) */}
          <View style={[styles.notificationCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.notificationText, { color: colors.text }]}>{t('notifications_opt_in')}</Text>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: notifications }}
              onPress={() => setNotifications((v) => !v)}
              style={[styles.toggleTrack, { backgroundColor: colors.primaryLight }, notifications && styles.toggleTrackOn]}
              hitSlop={10}
            >
              <View style={[styles.toggleThumbWrap, notifications && styles.toggleThumbWrapOn]}>
                <View style={styles.toggleThumb} />
              </View>
            </Pressable>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.xl }]}>
          <Button
            title={t('finish_setup')}
            onPress={handleFinish}
            loading={loading}
            icon={<ArrowRightIcon size={20} color={Colors.textLight} />}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  page: {
    flex: 1,
    width: '100%',
    maxWidth: 448,
    alignSelf: 'center',
  },
  header: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  progressBars: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  progressBarFilled: {
    width: 40,
    height: 8,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.xl,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: Spacing['3xl'],
  },
  welcomeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  welcomeSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  featuresContainer: {
    gap: Spacing.base,
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: Spacing.base,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    gap: Spacing.base,
    backgroundColor: Colors.primaryLight,
  },
  featureNumber: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureNumberText: {
    fontSize: 24,
  },
  featureContent: {
    flex: 1,
  },
  featureTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  featureDescription: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: FontSize.sm * 1.5,
  },
  notificationCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.base,
    marginTop: Spacing['3xl'],
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
  },
  notificationText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 999,
    backgroundColor: Colors.primaryLight,
    padding: 2,
    justifyContent: 'center',
  },
  toggleTrackOn: {
    backgroundColor: Colors.primary,
  },
  toggleThumbWrap: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  toggleThumbWrapOn: {
    justifyContent: 'flex-end',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.textLight,
  },
  footer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
  },
});

export default SignUp2Screen;
