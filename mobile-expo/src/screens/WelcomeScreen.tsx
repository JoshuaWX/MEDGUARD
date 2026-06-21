/**
 * WelcomeScreen
 *
 * A mobile-first onboarding carousel for MedGuard. It keeps the brand palette
 * and health-shield identity while removing the busier generated-looking effects.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  ImageBackground,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { ShieldIcon } from '../components';
import { useAuth } from '../hooks/useAuth';
import { LangCode, useI18n } from '../i18n';
import { RootStackParamList } from '../navigation/types';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '../../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Welcome'>;

type WelcomeSlide = {
  id: string;
  title: string;
  subtitle: string;
  image: string;
  accent: string;
};

const IMAGE_WIDTH = Platform.OS === 'android' ? 900 : 1100;

const WELCOME_SLIDES: WelcomeSlide[] = [
  {
    id: 'aware',
    title: 'Stay aware of health risks near you',
    subtitle: 'MedGuard brings local health signals into one clear, calm daily view.',
    image: `https://images.unsplash.com/photo-1584515933487-779824d29309?auto=format&fit=crop&w=${IMAGE_WIDTH}&q=82`,
    accent: Colors.primary,
  },
  {
    id: 'alerts',
    title: 'Get early alerts for your location',
    subtitle: 'See weather, air quality, season, and outbreak-aware guidance before risks spread.',
    image: `https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=${IMAGE_WIDTH}&q=82`,
    accent: Colors.emerald,
  },
  {
    id: 'checkins',
    title: 'Track how you are feeling each day',
    subtitle: 'Simple check-ins help you notice patterns and support community health awareness.',
    image: `https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=${IMAGE_WIDTH}&q=82`,
    accent: Colors.cyan,
  },
  {
    id: 'facilities',
    title: 'Find nearby clinics and pharmacies',
    subtitle: 'Use your location to quickly discover care options around you when it matters.',
    image: `https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=${IMAGE_WIDTH}&q=82`,
    accent: Colors.info,
  },
  {
    id: 'ai',
    title: 'Ask MedGuard AI for safe guidance',
    subtitle: 'Get practical health information with reminders to seek professional care when needed.',
    image: `https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=${IMAGE_WIDTH}&q=82`,
    accent: Colors.primaryDark,
  },
];

const LANGUAGES = [
  { code: 'en' as LangCode, label: 'EN' },
  { code: 'yo' as LangCode, label: 'YO' },
  { code: 'ha' as LangCode, label: 'HA' },
  { code: 'ig' as LangCode, label: 'IG' },
];

const WelcomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView | null>(null);
  const autoTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const { continueAsGuest } = useAuth();
  const { lang, setLang, t } = useI18n();

  const handleSignUp = useCallback(() => navigation.navigate('SignUp'), [navigation]);
  const handleSignIn = useCallback(() => navigation.navigate('SignIn'), [navigation]);
  const handleGuest = useCallback(async () => {
    await continueAsGuest();
    navigation.navigate('MainTabs');
  }, [continueAsGuest, navigation]);

  const cycleLanguage = useCallback(() => {
    const current = LANGUAGES.findIndex((item) => item.code === lang);
    const next = LANGUAGES[(current + 1) % LANGUAGES.length];
    void setLang(next.code);
  }, [lang, setLang]);

  const scrollToIndex = useCallback((index: number, animated = true) => {
    scrollRef.current?.scrollTo({ x: SCREEN_WIDTH * index, y: 0, animated });
  }, []);

  const handleMomentumEnd = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(Math.max(0, Math.min(WELCOME_SLIDES.length - 1, nextIndex)));
  }, []);

  useEffect(() => {
    autoTimerRef.current = setInterval(() => {
      setActiveIndex((current) => {
        const next = (current + 1) % WELCOME_SLIDES.length;
        scrollToIndex(next);
        return next;
      });
    }, 5200);

    return () => {
      if (autoTimerRef.current) clearInterval(autoTimerRef.current);
    };
  }, [scrollToIndex]);

  const langLabel = useMemo(() => LANGUAGES.find((item) => item.code === lang)?.label || 'EN', [lang]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.backgroundDark, '#0f2a35', Colors.primaryDark]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        ref={(ref) => {
          scrollRef.current = ref;
        }}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={handleMomentumEnd}
        style={styles.carousel}
      >
        {WELCOME_SLIDES.map((slide) => {
          const imageFailed = failedImages[slide.id];
          return (
            <View key={slide.id} style={styles.slide}>
              {!imageFailed ? (
                <ImageBackground
                  source={{ uri: slide.image }}
                  style={StyleSheet.absoluteFill}
                  imageStyle={styles.image}
                  onError={() => setFailedImages((prev) => ({ ...prev, [slide.id]: true }))}
                  accessibilityLabel={`${slide.title} background image`}
                />
              ) : null}

              <LinearGradient
                colors={[
                  'rgba(15,20,25,0.08)',
                  'rgba(15,20,25,0.16)',
                  'rgba(15,20,25,0.68)',
                  Colors.backgroundDark,
                ]}
                locations={[0, 0.38, 0.68, 1]}
                style={StyleSheet.absoluteFill}
              />

              <View style={[styles.slideCopy, { paddingBottom: insets.bottom + 184 }]}>
                <View style={[styles.accentLine, { backgroundColor: slide.accent }]} />
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.subtitle}>{slide.subtitle}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.header, { paddingTop: insets.top + Spacing.base }]}>
        <View style={styles.brandPill}>
          <LinearGradient
            colors={[Colors.primary, Colors.emerald]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.brandIcon}
          >
            <ShieldIcon size={18} color={Colors.textLight} />
          </LinearGradient>
          <Text style={styles.brandText}>MedGuard</Text>
        </View>

        <Pressable
          onPress={cycleLanguage}
          style={styles.languagePill}
          accessibilityRole="button"
          accessibilityLabel="Change language"
        >
          <Text style={styles.languageText}>{langLabel}</Text>
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.dotsRow} accessibilityRole="adjustable">
          {WELCOME_SLIDES.map((slide, index) => {
            const isActive = activeIndex === index;
            return (
              <Pressable
                key={slide.id}
                onPress={() => {
                  setActiveIndex(index);
                  scrollToIndex(index);
                }}
                style={[styles.dotHitArea, isActive && styles.dotHitAreaActive]}
                accessibilityRole="button"
                accessibilityLabel={`Show slide ${index + 1}`}
              >
                <View style={[styles.dot, isActive && styles.dotActive]} />
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={handleSignUp}
          style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryButtonPressed]}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[Colors.primary, Colors.emerald]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.primaryButtonGradient}
          >
            <Text style={styles.primaryButtonText}>{t('get_started')}</Text>
          </LinearGradient>
        </Pressable>

        <View style={styles.secondaryRow}>
          <Pressable onPress={handleSignIn} hitSlop={10} accessibilityRole="button">
            <Text style={styles.secondaryText}>{t('login')}</Text>
          </Pressable>
          <View style={styles.secondaryDivider} />
          <Pressable onPress={handleGuest} hitSlop={10} accessibilityRole="button">
            <Text style={styles.secondaryText}>{t('guest_continue')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  carousel: {
    flex: 1,
  },
  slide: {
    width: SCREEN_WIDTH,
    flex: 1,
    backgroundColor: Colors.backgroundDark,
  },
  image: {
    resizeMode: 'cover',
  },
  header: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    zIndex: 4,
    paddingHorizontal: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
    paddingRight: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(15,20,25,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  brandIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 3,
  },
  brandText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textLight,
    letterSpacing: 0,
  },
  languagePill: {
    minWidth: 44,
    height: 36,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,20,25,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  languageText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xs,
    color: Colors.textLight,
    letterSpacing: 0,
  },
  slideCopy: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.xl,
  },
  accentLine: {
    width: 52,
    height: 5,
    borderRadius: 3,
    marginBottom: Spacing.base,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 34,
    lineHeight: 40,
    color: Colors.textLight,
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.28)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  subtitle: {
    marginTop: Spacing.md,
    maxWidth: 336,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.base,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.82)',
    letterSpacing: 0,
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 5,
    paddingHorizontal: Spacing.lg,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  dotHitArea: {
    width: 28,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotHitAreaActive: {
    width: 38,
  },
  dot: {
    width: 22,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.36)',
  },
  dotActive: {
    width: 34,
    backgroundColor: Colors.textLight,
  },
  primaryButton: {
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    shadowColor: Colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 7,
  },
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: Colors.textLight,
    letterSpacing: 0,
  },
  secondaryRow: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  secondaryText: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 0,
  },
  secondaryDivider: {
    width: 1,
    height: 14,
    backgroundColor: 'rgba(255,255,255,0.24)',
  },
});

export default WelcomeScreen;
