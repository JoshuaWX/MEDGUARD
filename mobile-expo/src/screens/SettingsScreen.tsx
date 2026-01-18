/**
 * SettingsScreen
 * UI scaffold aligned to settings.html (Settings & Support)
 */

import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { GlassCard, ArrowBackIcon, MoonIcon, ThemeModeSelector } from '../components';
import { RootStackParamList } from '../navigation/types';
import { LangCode, useI18n } from '../i18n';
import { useTheme } from '../hooks/useTheme';
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

  const [locationSharing, setLocationSharing] = useState(true);

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
          contentContainerStyle={[styles.content, { paddingBottom: bottomPadding }]}
        >
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
                    value={locationSharing}
                    onValueChange={setLocationSharing}
                    trackColor={{ false: isDark ? Colors.blackAlpha20 : Colors.whiteAlpha30, true: Colors.primary }}
                    thumbColor={Colors.surfaceLight}
                  />
                </View>
                <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
                  {t('share_location_desc')}
                </Text>
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
    paddingBottom: Spacing.base,
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
    paddingTop: Spacing.base,
    gap: Spacing.sectionGap,
  },
  card: {
    width: '100%',
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
    borderRadius: 999,
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
});

export default SettingsScreen;
