/**
 * ChatbotScreen
 * Native AI health assistant chat matching Flask chatbot.html UI
 * Features: sidebar chat history drawer, theme toggle, persisted memory
 * 
 * GUEST MODE:
 * - No chat history persistence
 * - No profile context/memory
 * - Limited requests per session
 * 
 * ANDROID FIXES (responsiveness & gestures):
 * - Proper KeyboardAvoidingView behavior for Android
 * - ScrollView with flexGrow for proper content sizing
 * - keyboardShouldPersistTaps for better input handling
 * - Safe area insets for proper bottom padding
 * - Sidebar uses transform instead of interfering with main content gestures
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated as RNAnimated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import {
  ShieldIcon,
  MenuIcon,
  PlusIcon,
  ArrowBackIcon,
  SunIcon,
  MoonIcon,
  PencilIcon,
  TrashIcon,
  AuthGateModal,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useUser } from '../hooks/useUser';
import { useTheme } from '../hooks/useTheme';
import { useAuthGate } from '../hooks/useAuthGate';
import { useI18n } from '../i18n';
import { supabase } from '../services/supabase';
import { invokeEdgeFunction } from '../services/edge';
import { toUserMessage } from '../services/errorMessages';
import { BorderRadius, Colors, FontFamily, FontSize, Spacing } from '../../theme';

// ANDROID FIX: Removed Dimensions.get('window') for SIDEBAR_WIDTH
// Using a fixed value is acceptable here as sidebar is a overlay drawer
const SIDEBAR_WIDTH = 280;

// Guest mode limits
const GUEST_MAX_REQUESTS_PER_SESSION = 10;
const GUEST_SESSION_STORAGE_KEY = 'mg_guest_chat_session_id';

// Theme colors matching Flask chatbot
const DarkTheme = {
  bgPrimary: '#212121',
  bgSecondary: '#171717',
  bgTertiary: '#2f2f2f',
  bgHover: '#3a3a3a',
  textPrimary: '#ececec',
  textSecondary: '#b4b4b4',
  textMuted: '#8e8e8e',
  borderColor: '#424242',
  accent: Colors.primary,
  accentHover: '#1a7f64',
  userGradientFrom: '#11b4d4',
  userGradientTo: '#0d8fa9',
};

const LightTheme = {
  bgPrimary: '#ffffff',
  bgSecondary: '#f7f7f8',
  bgTertiary: '#ececec',
  bgHover: '#e5e5e5',
  textPrimary: '#1a1a1a',
  textSecondary: '#4a4a4a',
  textMuted: '#6e6e6e',
  borderColor: '#e5e5e5',
  accent: Colors.primary,
  accentHover: '#1a7f64',
  userGradientFrom: '#11b4d4',
  userGradientTo: '#0d8fa9',
};

interface Conversation {
  id: string;
  title: string;
  updated_at: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

function deriveConversationTitle(text: string) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return 'New Chat';
  const maxLen = 42;
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned;
}

function createGuestSessionId() {
  const randomPart = `${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
  return `guest_${Date.now().toString(36)}_${randomPart}`.slice(0, 72);
}

const ChatbotScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user: authUser, isGuest } = useAuth();
  const { user } = useUser();
  const { t } = useI18n();
  const { showAuthGate, AuthGateModalComponent } = useAuthGate();

  const scrollRef = useRef<ScrollView | null>(null);
  const sidebarAnim = useRef(new RNAnimated.Value(-SIDEBAR_WIDTH)).current;
  
  // ============================================================================
  // PERFORMANCE: AbortController for cancelling pending requests on unmount
  // ============================================================================
  const abortControllerRef = useRef<AbortController | null>(null);

  const [guestRemaining, setGuestRemaining] = useState(GUEST_MAX_REQUESTS_PER_SESSION);

  // Theme state - synced with global app theme
  const { isDark: isDarkMode, toggleTheme } = useTheme();
  const theme = isDarkMode ? DarkTheme : LightTheme;

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);

  const autoSelectedRef = useRef(false);

  // Current conversation
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rename modal state
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameConversationId, setRenameConversationId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState('');

  const updateConversationTitle = useCallback(
    async (convId: string, title: string) => {
      const nextTitle = title.trim();
      // Skip for guests (no history persistence)
      if (isGuest || !authUser?.id || !convId || !nextTitle) return;
      try {
        const { error: err } = await supabase
          .from('chat_conversations')
          .update({ title: nextTitle })
          .eq('id', convId)
          .eq('user_id', authUser.id);
        if (err) throw err;

        setConversations((prev) => prev.map((c) => (c.id === convId ? { ...c, title: nextTitle } : c)));
      } catch (e: any) {
        console.error('Failed to update chat title:', e?.message);
      }
    },
    [authUser?.id]
  );

  const suggestions = useMemo(
    () => [
      "I've been having headaches for the past few days",
      'What are the symptoms of malaria?',
      'How can I prevent cholera?',
      'When should I seek emergency care?',
    ],
    []
  );

  // ============================================================================
  // PERFORMANCE: Cancel pending requests when leaving the screen
  // ============================================================================
  useEffect(() => {
    return () => {
      // Abort any pending chat request when unmounting
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Toggle sidebar animation
  useEffect(() => {
    RNAnimated.timing(sidebarAnim, {
      toValue: sidebarOpen ? 0 : -SIDEBAR_WIDTH,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [sidebarOpen]);

  // Load conversations list (skip for guests - no history persistence)
  const loadConversations = useCallback(async () => {
    // Guests don't have persisted conversations
    if (isGuest) {
      setConversationsLoading(false);
      return;
    }

    if (!authUser?.id) {
      setConversationsLoading(false);
      return;
    }

    setConversationsLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('chat_conversations')
        .select('id, title, updated_at')
        .eq('user_id', authUser.id)
        .order('updated_at', { ascending: false })
        .limit(50);

      if (err) throw err;
      setConversations(data || []);
    } catch (e: any) {
      console.error('Failed to load conversations:', e?.message);
    } finally {
      setConversationsLoading(false);
    }
  }, [authUser?.id, isGuest]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages for a conversation
  const loadMessages = useCallback(async (convId: string | null) => {
    if (!convId) {
      setMessages([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('chat_messages')
        .select('id, role, content')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: true })
        .limit(100);

      if (err) throw err;
      setMessages(
        (data || [])
          .filter((m: any) => m?.role === 'user' || m?.role === 'assistant')
          .map((m: any) => ({ id: String(m.id), role: m.role, content: String(m.content || '') }))
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load messages');
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    }
  }, []);

  // Auto-load most recent conversation on mount
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (conversations.length > 0 && conversationId === null) {
      const recent = conversations[0];
      setConversationId(recent.id);
      loadMessages(recent.id);
      autoSelectedRef.current = true;
      return;
    }
    if (conversations.length > 0 && conversationId !== null) {
      autoSelectedRef.current = true;
    }
  }, [conversations, conversationId, loadMessages]);

  const selectConversation = useCallback(
    (conv: Conversation) => {
      autoSelectedRef.current = true;
      setConversationId(conv.id);
      loadMessages(conv.id);
      setSidebarOpen(false);
    },
    [loadMessages]
  );

  const resetChat = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setError(null);
    setDraft('');
  }, []);

  const startNewChat = useCallback(async () => {
    // If the current chat is empty, don't create a new conversation.
    // This prevents creating multiple empty chats by repeatedly tapping "New chat".
    if (messages.length === 0) {
      setSidebarOpen(false);
      return;
    }

    autoSelectedRef.current = true;
    resetChat();

    if (!authUser?.id) {
      setSidebarOpen(false);
      return;
    }

    try {
      const { data, error: err } = await supabase
        .from('chat_conversations')
        .insert({ user_id: authUser.id, title: '' })
        .select('id, title, updated_at')
        .single();

      if (err) throw err;
      if (data?.id) {
        setConversationId(data.id);
        setConversations((prev) => [data as Conversation, ...prev.filter((c) => c.id !== data.id)]);
      }
    } catch (e: any) {
      console.error('Failed to create new chat:', e?.message);
    } finally {
      setSidebarOpen(false);
    }
  }, [authUser?.id, messages.length, resetChat]);

  const deleteConversation = useCallback(
    async (convId: string) => {
      try {
        await supabase.from('chat_messages').delete().eq('conversation_id', convId);
        await supabase.from('chat_conversations').delete().eq('id', convId);
        setConversations((prev) => prev.filter((c) => c.id !== convId));
        if (conversationId === convId) {
          resetChat();
        }
      } catch (e: any) {
        console.error('Delete failed:', e?.message);
      }
    },
    [conversationId, resetChat]
  );

  const confirmDeleteConversation = useCallback(
    (convId: string) => {
      Alert.alert(
        'Delete chat?',
        'This will permanently delete this chat and all its messages.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => deleteConversation(convId) },
        ]
      );
    },
    [deleteConversation]
  );

  const openRename = useCallback((conv: Conversation) => {
    setRenameConversationId(conv.id);
    setRenameTitle(conv.title || 'New Chat');
    setRenameOpen(true);
  }, []);

  const saveRename = useCallback(async () => {
    const convId = renameConversationId;
    const nextTitle = renameTitle.trim();
    if (!convId || !nextTitle) {
      setRenameOpen(false);
      return;
    }

    try {
      await updateConversationTitle(convId, nextTitle);
    } catch (e: any) {
      console.error('Rename failed:', e?.message);
    } finally {
      setRenameOpen(false);
    }
  }, [renameConversationId, renameTitle, updateConversationTitle]);

  const getGuestSessionId = useCallback(async () => {
    let existing = await AsyncStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!existing) {
      existing = createGuestSessionId();
      await AsyncStorage.setItem(GUEST_SESSION_STORAGE_KEY, existing);
    }
    return existing;
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      let guestSessionId: string | null = null;
      if (isGuest) {
        if (guestRemaining <= 0) {
          showAuthGate({
            title: 'Chat limit reached',
            message: 'Sign in to continue chatting and unlock unlimited conversations with history.',
          });
          return;
        }
        guestSessionId = await getGuestSessionId();
      }

      // ========================================================================
      // PERFORMANCE: Cancel any previous pending request
      // ========================================================================
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();
      const signal = abortControllerRef.current.signal;

      setSending(true);
      setError(null);
      setDraft('');

      // Optimistic UI - show user message immediately for responsiveness
      const optimisticId = `local-${Date.now()}`;
      setMessages((prev) => [...prev, { id: optimisticId, role: 'user', content: trimmed }]);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);

      const wasFirstMessageInUI = messages.length === 0;

      // ========================================================================
      // PERFORMANCE: Pass AbortController signal for cancellation support
      // ========================================================================
      const sendStart = Date.now();
      const { data, error: invokeErr } = await invokeEdgeFunction<{
        conversation_id: string | null;
        answer: string;
        guest?: boolean;
        guest_remaining?: number;
      }>('chat', {
        conversation_id: conversationId || undefined,
        message: trimmed,
        guest_session_id: guestSessionId || undefined,
      }, {
        signal,
        timeout: 60000, // 60 second timeout
        retries: 1, // Retry once on transient errors
      });
      console.log(`[Chatbot] Edge function round-trip: ${Date.now() - sendStart}ms`);

      // Check if request was cancelled (user left screen or sent new message)
      if (signal.aborted) {
        return; // Don't update state if cancelled
      }

      if (invokeErr || !data?.answer) {
        let userMessage = toUserMessage(invokeErr || 'Chat request failed', 'chat');
        if (!userMessage || userMessage.includes('cancelled')) {
          return; // Don't show error for cancelled requests
        }
        setError(userMessage);
        setSending(false);
        return;
      }

      const resolvedConversationId = data.conversation_id || conversationId;
      if (typeof data.guest_remaining === 'number') {
        setGuestRemaining(Math.max(0, data.guest_remaining));
      }
      
      // Skip conversation tracking for guests (no history persistence)
      if (!isGuest && resolvedConversationId && !conversationId) {
        setConversationId(resolvedConversationId);
        // Refresh conversation list
        loadConversations();
      }

      // If this was the first message, use it as the chat title.
      // Skip for guests (no history persistence)
      if (!isGuest && resolvedConversationId && wasFirstMessageInUI) {
        const derivedTitle = deriveConversationTitle(trimmed);
        // Only set the title if it's currently empty or still the placeholder.
        const current = conversations.find((c) => c.id === resolvedConversationId);
        if (!current || !current.title || current.title === 'New Chat') {
          updateConversationTitle(resolvedConversationId, derivedTitle);
        }
      }

      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: data.answer },
      ]);
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    },
    [conversationId, conversations, getGuestSessionId, guestRemaining, isGuest, loadConversations, messages.length, sending, showAuthGate, updateConversationTitle]
  );

  const userInitial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || (isGuest ? 'G' : 'U');

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      {/* ANDROID FIX: Sidebar overlay only renders when open to prevent gesture interception
          This ensures the main chat area gestures work properly when sidebar is closed */}
      {sidebarOpen && (
        <Pressable 
          style={styles.sidebarOverlay} 
          onPress={() => setSidebarOpen(false)}
          // ANDROID FIX: Accessible label for screen readers
          accessibilityLabel="Close sidebar"
          accessibilityRole="button"
        />
      )}

      {/* Sidebar Drawer */}
      {/* ANDROID FIX: pointerEvents="box-none" allows touches to pass through when
          sidebar is hidden (translated off-screen), preventing gesture interception */}
      <RNAnimated.View
        pointerEvents={sidebarOpen ? 'auto' : 'box-none'}
        style={[
          styles.sidebar,
          {
            backgroundColor: theme.bgSecondary,
            borderRightColor: theme.borderColor,
            transform: [{ translateX: sidebarAnim }],
            paddingTop: insets.top,
          },
        ]}
      >
        {/* Sidebar Header */}
        <View style={[styles.sidebarHeader, { borderBottomColor: theme.borderColor }]}>
          <Pressable
            onPress={startNewChat}
            style={[styles.newChatBtn, { borderColor: theme.borderColor, backgroundColor: theme.bgPrimary }]}
          >
            <PlusIcon size={18} color={theme.textPrimary} />
            <Text style={[styles.newChatBtnText, { color: theme.textPrimary }]}>New chat</Text>
          </Pressable>
        </View>

        {/* Chat History */}
        <View style={styles.sidebarContent}>
          <Text style={[styles.sidebarSectionTitle, { color: theme.textMuted }]}>Recent Chats</Text>
          <ScrollView style={styles.chatHistoryList} showsVerticalScrollIndicator={false}>
            {isGuest ? (
              // Guest mode: show sign-in prompt instead of history
              <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
                <Text style={[styles.emptyState, { color: theme.textMuted, marginBottom: 12 }]}>
                  Chat history is not available in guest mode.
                </Text>
                <Pressable
                  onPress={() => {
                    setSidebarOpen(false);
                    showAuthGate({
                      feature: 'chat history and personalized conversations',
                    });
                  }}
                  style={{
                    backgroundColor: theme.accent,
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ color: Colors.textLight, fontFamily: FontFamily.semibold, fontSize: 14 }}>
                    Sign in to save chats
                  </Text>
                </Pressable>
              </View>
            ) : conversationsLoading ? (
              <ActivityIndicator color={theme.textMuted} style={{ marginTop: 20 }} />
            ) : conversations.length === 0 ? (
              <Text style={[styles.emptyState, { color: theme.textMuted }]}>No chats yet</Text>
            ) : (
              conversations.map((conv) => (
                <Pressable
                  key={conv.id}
                  onPress={() => selectConversation(conv)}
                  onLongPress={() => openRename(conv)}
                  style={[
                    styles.chatHistoryItem,
                    conv.id === conversationId && { backgroundColor: theme.bgTertiary },
                  ]}
                >
                  <Text
                    style={[
                      styles.chatTitle,
                      { color: conv.id === conversationId ? theme.textPrimary : theme.textSecondary },
                    ]}
                    numberOfLines={1}
                  >
                    {conv.title || 'New Chat'}
                  </Text>
                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      openRename(conv);
                    }}
                    style={styles.actionBtn}
                    hitSlop={8}
                  >
                    <PencilIcon size={16} color={theme.textMuted} />
                  </Pressable>
                  <Pressable
                    onPress={(e) => {
                      e?.stopPropagation?.();
                      confirmDeleteConversation(conv.id);
                    }}
                    style={styles.actionBtn}
                    hitSlop={8}
                  >
                    <TrashIcon size={16} color={theme.textMuted} />
                  </Pressable>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>

        {/* Sidebar Footer - User Menu */}
        <View style={[styles.sidebarFooter, { borderTopColor: theme.borderColor }]}>
          <View style={styles.userMenu}>
            <LinearGradient
              colors={isGuest ? ['#6b7280', '#4b5563'] : [theme.accent, '#3b82f6']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.userAvatar}
            >
              <Text style={styles.userAvatarText}>{userInitial}</Text>
            </LinearGradient>
            <Text style={[styles.userName, { color: theme.textPrimary }]} numberOfLines={1}>
              {isGuest ? 'Guest' : (user?.name || user?.email || 'User')}
            </Text>
          </View>
        </View>
      </RNAnimated.View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Modal
          visible={renameOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setRenameOpen(false)}
        >
          <Pressable style={styles.modalOverlay} onPress={() => setRenameOpen(false)}>
            <Pressable
              onPress={() => {}}
              style={[styles.modalCard, { backgroundColor: theme.bgSecondary, borderColor: theme.borderColor }]}
            >
              <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>Edit chat title</Text>
              <TextInput
                value={renameTitle}
                onChangeText={setRenameTitle}
                placeholder="Enter a title"
                placeholderTextColor={theme.textMuted}
                autoFocus
                style={[styles.modalInput, { color: theme.textPrimary, borderColor: theme.borderColor, backgroundColor: theme.bgTertiary }]}
              />
              <View style={styles.modalActionsRow}>
                <Pressable
                  onPress={() => setRenameOpen(false)}
                  style={[styles.modalBtn, { borderColor: theme.borderColor }]}
                >
                  <Text style={[styles.modalBtnText, { color: theme.textSecondary }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={saveRename}
                  style={[styles.modalBtnPrimary, { backgroundColor: theme.accent }]}
                >
                  <Text style={styles.modalBtnTextPrimary}>Save</Text>
                </Pressable>
              </View>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Header */}
        <View
          style={[
            styles.chatHeader,
            { paddingTop: insets.top + Spacing.sm, borderBottomColor: theme.borderColor, backgroundColor: theme.bgPrimary },
          ]}
        >
          <View style={styles.headerLeft}>
            <Pressable onPress={() => setSidebarOpen(true)} style={styles.iconBtn}>
              <MenuIcon size={22} color={theme.textPrimary} />
            </Pressable>
            <View style={styles.headerLogo}>
              <LinearGradient
                colors={[theme.accent, Colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoIcon}
              >
                <ShieldIcon size={18} color={Colors.textLight} />
              </LinearGradient>
              <Text style={[styles.logoText, { color: theme.accent }]}>MedGuard AI</Text>
            </View>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={toggleTheme} style={styles.iconBtn}>
              {isDarkMode ? (
                <SunIcon size={20} color={theme.textSecondary} />
              ) : (
                <MoonIcon size={20} color={theme.textSecondary} />
              )}
            </Pressable>
            <Pressable onPress={() => navigation.goBack()} style={styles.iconBtn}>
              <ArrowBackIcon size={20} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* ANDROID FIX: KeyboardAvoidingView with behavior="height" for Android
            This ensures the input field stays visible when keyboard appears */}
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.flex}
          // ANDROID FIX: Increased offset to account for header height
          keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 64 : 20}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator color={theme.textSecondary} />
            </View>
          ) : (
            <ScrollView
              ref={(r) => { scrollRef.current = r; }}
              style={styles.chatContainer}
              // ANDROID FIX: flexGrow: 1 ensures content fills available space and is scrollable
              contentContainerStyle={styles.messagesWrapper}
              // ANDROID FIX: keyboardShouldPersistTaps="handled" prevents keyboard dismissal
              // when tapping on interactive elements like suggestion chips
              keyboardShouldPersistTaps="handled"
              // ANDROID FIX: Disable horizontal scroll for better vertical gesture handling
              horizontal={false}
              showsVerticalScrollIndicator={true}
              // ANDROID FIX: Improve scroll performance on Android
              removeClippedSubviews={Platform.OS === 'android'}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
            >
              {error ? (
                <View style={styles.errorContainer}>
                  <Text style={[styles.errorTitle, { color: theme.textPrimary }]}>
                    {t('chatbot_unavailable')}
                  </Text>
                  <Text style={[styles.errorBody, { color: theme.textSecondary }]}>{error}</Text>
                </View>
              ) : null}

              {messages.length === 0 ? (
                <View style={styles.welcomeScreen}>
                  <LinearGradient
                    colors={[theme.accent, Colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.welcomeLogo}
                  >
                    <ShieldIcon size={32} color={Colors.textLight} />
                  </LinearGradient>
                  <Text style={[styles.welcomeTitle, { color: theme.textPrimary }]}>
                    How can I help you today?
                  </Text>
                  <Text style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
                    I'm MedGuard, your AI health assistant. Ask me about symptoms, medications,
                    conditions, or general health advice.
                  </Text>

                  <View style={styles.suggestionChips}>
                    {suggestions.map((s) => (
                      <Pressable
                        key={s}
                        onPress={() => sendMessage(s)}
                        style={[
                          styles.suggestionChip,
                          { backgroundColor: theme.bgTertiary, borderColor: theme.borderColor },
                        ]}
                      >
                        <Text style={[styles.suggestionChipText, { color: theme.textSecondary }]}>
                          {s}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : (
                <>
                  {messages.map((m) =>
                    m.role === 'user' ? (
                      <View key={m.id} style={styles.messageUser}>
                        <LinearGradient
                          colors={[theme.userGradientFrom, theme.userGradientTo]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={styles.userBubble}
                        >
                          <Text style={styles.userMessageText}>{m.content}</Text>
                        </LinearGradient>
                      </View>
                    ) : (
                      <View key={m.id} style={styles.messageAssistant}>
                        <View style={[styles.assistantBubble, { backgroundColor: theme.bgTertiary }]}>
                          <Text style={[styles.assistantMessageText, { color: theme.textPrimary }]}>
                            {m.content}
                          </Text>
                        </View>
                      </View>
                    )
                  )}

                  {sending && (
                    <View style={styles.typingContainer}>
                      <View style={[styles.typingBubble, { backgroundColor: theme.bgTertiary }]}>
                        <View style={[styles.typingDot, { backgroundColor: theme.textMuted }]} />
                        <View style={[styles.typingDot, { backgroundColor: theme.textMuted }]} />
                        <View style={[styles.typingDot, { backgroundColor: theme.textMuted }]} />
                      </View>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          )}

          {/* Input Area */}
          {/* ANDROID FIX: Bottom padding uses safe area insets to avoid overlap with gesture nav */}
          <View style={[
            styles.inputArea, 
            { 
              backgroundColor: theme.bgPrimary, 
              // ANDROID FIX: Ensure sufficient padding at bottom for gesture navigation
              paddingBottom: Math.max(insets.bottom, Spacing.sm) + Spacing.sm 
            }
          ]}>
            <View
              style={[
                styles.inputContainer,
                { backgroundColor: theme.bgTertiary, borderColor: theme.borderColor },
              ]}
            >
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="Message MedGuard..."
                placeholderTextColor={theme.textMuted}
                style={[styles.chatInput, { color: theme.textPrimary }]}
                multiline
                editable={!sending}
              />
              <Pressable
                onPress={() => sendMessage(draft)}
                disabled={sending || draft.trim().length === 0}
                style={[
                  styles.sendBtn,
                  { backgroundColor: theme.accent },
                  (sending || draft.trim().length === 0) && { backgroundColor: theme.bgHover },
                ]}
              >
                <Text style={{ color: Colors.textLight, fontFamily: FontFamily.bold, fontSize: 18 }}>
                  ↑
                </Text>
              </Pressable>
            </View>
            <Text style={[styles.inputFooter, { color: theme.textMuted }]}>
              {isGuest 
                ? `Guest mode · ${guestRemaining} messages remaining`
                : 'AI answers are informational only. Consult a doctor for medical advice.'
              }
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* Auth gate modal for guests hitting rate limit */}
      <AuthGateModalComponent />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },

  // Sidebar
  sidebarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 99,
    // ANDROID FIX: Ensure overlay captures all touches when visible
    // This prevents touch events from passing through to the chat underneath
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    justifyContent: 'flex-end',
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
  },
  modalBtnPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  modalBtnText: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
  },
  modalBtnTextPrimary: {
    fontSize: 14,
    fontFamily: FontFamily.semibold,
    color: Colors.textLight,
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    zIndex: 100,
    borderRightWidth: 1,
  },
  sidebarHeader: {
    padding: 12,
    borderBottomWidth: 1,
  },
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
  },
  newChatBtnText: {
    fontSize: 14,
    fontFamily: FontFamily.medium,
  },
  sidebarContent: {
    flex: 1,
    padding: 8,
  },
  sidebarSectionTitle: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 8,
    paddingTop: 12,
    paddingBottom: 8,
  },
  chatHistoryList: {
    flex: 1,
  },
  chatHistoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 2,
  },
  chatTitle: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },
  actionBtn: {
    padding: 4,
    borderRadius: 4,
  },
  emptyState: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 20,
  },
  sidebarFooter: {
    padding: 12,
    borderTopWidth: 1,
  },
  userMenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 12,
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: {
    color: 'white',
    fontFamily: FontFamily.semibold,
    fontSize: 14,
  },
  userName: {
    flex: 1,
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },

  // Main content
  mainContent: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  // Chat container
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  messagesWrapper: {
    // ANDROID FIX: flexGrow ensures content fills available space on short screens
    // This allows proper scrolling when content is shorter than the container
    flexGrow: 1,
    maxWidth: 768,
    alignSelf: 'center',
    width: '100%',
    padding: 24,
    paddingBottom: 32,
  },
  errorContainer: {
    paddingVertical: Spacing.base,
  },
  errorTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.sm,
  },
  errorBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
  },

  // Welcome screen
  welcomeScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  welcomeLogo: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 28,
    fontFamily: FontFamily.bold,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  welcomeSubtitle: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    lineHeight: 26,
    maxWidth: 500,
  },
  suggestionChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginTop: 32,
    maxWidth: 600,
  },
  suggestionChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  suggestionChipText: {
    fontSize: 14,
    fontFamily: FontFamily.regular,
  },

  // Messages
  messageUser: {
    alignItems: 'flex-end',
    marginBottom: 6,
    maxWidth: '80%',
    alignSelf: 'flex-end',
  },
  userBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomRightRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  userMessageText: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: 'white',
    lineHeight: 22,
  },
  messageAssistant: {
    alignItems: 'flex-start',
    marginBottom: 6,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  assistantBubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderBottomLeftRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(17,180,212,0.12)',
  },
  assistantMessageText: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  typingContainer: {
    alignSelf: 'flex-start',
  },
  typingBubble: {
    flexDirection: 'row',
    gap: 4,
    padding: 12,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Input area
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 12,
    borderWidth: 1,
    borderRadius: 26,
    paddingHorizontal: 20,
    paddingVertical: 8,
    maxWidth: 768,
    alignSelf: 'center',
    width: '100%',
  },
  chatInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 200,
    paddingVertical: 8,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  inputFooter: {
    textAlign: 'center',
    paddingVertical: 12,
    fontSize: 12,
    fontFamily: FontFamily.regular,
  },
});

export default ChatbotScreen;
