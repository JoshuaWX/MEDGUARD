/**
 * ChatbotScreen
 * AI health assistant chat interface
 */

import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';

import {
  ShieldIcon,
  ChevronDownIcon,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '../hooks/useUser';
import { useI18n } from '../i18n';
import { buildChatbotUrl } from '../services/api';
import {
  Colors,
  Spacing,
  BorderRadius,
  FontFamily,
  FontSize,
  Shadows,
  Duration,
} from '../../theme';

// Dark theme colors matching Flask chatbot
const DarkTheme = {
  bgPrimary: '#212121',
  bgSecondary: '#171717',
  bgTertiary: '#2f2f2f',
  bgHover: '#3a3a3a',
  textPrimary: '#ececec',
  textSecondary: '#b4b4b4',
  textMuted: '#8e8e8e',
  borderColor: '#424242',
  accent: '#10a37f',
  userGradientFrom: '#6366f1',
  userGradientTo: '#8b5cf6',
};

const ChatbotScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user } = useUser();
  const { user: authUser } = useAuth();
  const { t } = useI18n();

  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const chatbotUrl = useMemo(() => {
    const meta: any = (authUser as any)?.user_metadata || {};
    const fullName = user?.name || meta.full_name || meta.name || '';
    const firstName = String(fullName).split(/\s+/)[0] || '';

    return buildChatbotUrl({
      first_name: firstName,
      location: user?.state || meta.state || '',
      age: meta.age != null ? String(meta.age) : '',
      gender: meta.gender != null ? String(meta.gender) : '',
      user_id: authUser?.id || '',
    });
  }, [authUser, user?.name, user?.state]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.headerLeft}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ChevronDownIcon size={24} color={DarkTheme.textSecondary} style={{ transform: [{ rotate: '90deg' }] }} />
          </Pressable>
          <View style={styles.headerLogo}>
            <LinearGradient
              colors={[DarkTheme.accent, '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.logoIcon}
            >
              <ShieldIcon size={20} color={Colors.textLight} />
            </LinearGradient>
            <Text style={styles.logoText}>{t('chatbot_title')}</Text>
          </View>
        </View>
      </View>

      {loadError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>{t('chatbot_unavailable')}</Text>
          <Text style={styles.errorBody}>{loadError}</Text>
          <Text style={styles.errorBody}>URL: {chatbotUrl}</Text>
        </View>
      ) : (
        <WebView
          source={{ uri: chatbotUrl }}
          originWhitelist={['*']}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          onLoadStart={() => {
            setShowLoadingOverlay(true);
            setLoadError(null);
          }}
          onLoadEnd={() => setShowLoadingOverlay(false)}
          onError={(e) => {
            setShowLoadingOverlay(false);
            setLoadError(e?.nativeEvent?.description || 'WebView load error');
          }}
          style={styles.webview}
        />
      )}

      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <LinearGradient
            colors={[Colors.primary, Colors.info]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.loadingGradient}
          >
            <ActivityIndicator size="large" color={Colors.textLight} />
            <Text style={styles.loadingText}>{t('chatbot_loading')}</Text>
          </LinearGradient>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.bgPrimary,
  },
  webview: {
    flex: 1,
    backgroundColor: DarkTheme.bgPrimary,
  },
  errorContainer: {
    flex: 1,
    padding: Spacing.base,
    justifyContent: 'center',
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: DarkTheme.textPrimary,
    marginBottom: Spacing.sm,
  },
  errorBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: DarkTheme.textSecondary,
    marginBottom: Spacing.sm,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 50,
  },
  loadingGradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 4,
    borderColor: Colors.whiteAlpha30,
    borderTopColor: Colors.textLight,
  },
  loadingText: {
    marginTop: Spacing.lg,
    fontFamily: FontFamily.medium,
    fontSize: FontSize.lg,
    color: Colors.textLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: DarkTheme.borderColor,
    backgroundColor: DarkTheme.bgPrimary,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: DarkTheme.accent,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    maxWidth: 768,
    alignSelf: 'center',
    width: '100%',
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  welcomeScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing.base,
  },
  welcomeLogo: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  welcomeTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    color: DarkTheme.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: DarkTheme.textSecondary,
    textAlign: 'center',
    lineHeight: FontSize.base * 1.6,
    maxWidth: 500,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    maxWidth: 600,
  },
  suggestionChip: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: DarkTheme.bgTertiary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: DarkTheme.borderColor,
  },
  suggestionChipText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: DarkTheme.textSecondary,
  },
  messageUser: {
    alignItems: 'flex-end',
    marginBottom: Spacing.sm,
    maxWidth: '80%',
    alignSelf: 'flex-end',
  },
  userBubbleGradient: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  userMessageText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textLight,
    lineHeight: FontSize.base * 1.45,
  },
  messageAssistant: {
    alignItems: 'flex-start',
    marginBottom: Spacing.sm,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  assistantBubble: {
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: DarkTheme.bgTertiary,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  assistantMessageText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: DarkTheme.textPrimary,
    lineHeight: FontSize.base * 1.45,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
  },
  typingBubble: {
    flexDirection: 'row',
    gap: 4,
    padding: Spacing.md,
    backgroundColor: DarkTheme.bgTertiary,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: DarkTheme.textMuted,
  },
  inputArea: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    backgroundColor: DarkTheme.bgPrimary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.md,
    backgroundColor: DarkTheme.bgTertiary,
    borderWidth: 1,
    borderColor: DarkTheme.borderColor,
    borderRadius: 24,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
    maxWidth: 768,
    alignSelf: 'center',
    width: '100%',
  },
  chatInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 200,
    paddingVertical: Spacing.sm,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: DarkTheme.textPrimary,
    lineHeight: FontSize.base * 1.5,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: DarkTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: DarkTheme.bgHover,
  },
  inputFooter: {
    textAlign: 'center',
    paddingVertical: Spacing.md,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: DarkTheme.textMuted,
  },
});

export default ChatbotScreen;
