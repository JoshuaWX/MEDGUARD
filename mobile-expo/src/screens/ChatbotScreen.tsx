/**
 * ChatbotScreen
 * AI health assistant chat interface
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeInUp,
  SlideInRight,
  SlideInLeft,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import {
  GlassCard,
  ShieldIcon,
  ArrowRightIcon,
  ChevronDownIcon,
} from '../components';
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

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const ChatbotScreen: React.FC = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Initial loading overlay (parity with web chatbot.html)
  const spinnerProgress = useSharedValue(0);

  useEffect(() => {
    const timeoutId = setTimeout(() => setShowLoadingOverlay(false), 700);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (!showLoadingOverlay) return;
    spinnerProgress.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.linear }),
      -1,
      false
    );
  }, [showLoadingOverlay]);

  const spinnerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spinnerProgress.value * 360}deg` }],
  }));

  // Typing indicator animation
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    if (isTyping) {
      dot1.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 400 })
        ),
        -1
      );
      dot2.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 200 }),
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 400 })
        ),
        -1
      );
      dot3.value = withRepeat(
        withSequence(
          withTiming(0, { duration: 400 }),
          withTiming(1, { duration: 400 }),
          withTiming(0, { duration: 200 })
        ),
        -1
      );
    }
  }, [isTyping]);

  const dot1Style = useAnimatedStyle(() => ({
    opacity: 0.4 + dot1.value * 0.6,
    transform: [{ scale: 0.8 + dot1.value * 0.4 }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    opacity: 0.4 + dot2.value * 0.6,
    transform: [{ scale: 0.8 + dot2.value * 0.4 }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    opacity: 0.4 + dot3.value * 0.6,
    transform: [{ scale: 0.8 + dot3.value * 0.4 }],
  }));

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText.trim(),
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Scroll to bottom
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Simulate AI response (in production, this would call the RAG API)
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: getAIResponse(inputText),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);

      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }, 1500);
  };

  // Simple placeholder responses
  const getAIResponse = (input: string): string => {
    const lowered = input.toLowerCase();
    
    if (lowered.includes('fever') || lowered.includes('temperature')) {
      return "A fever can be a sign of infection. If your temperature is above 38°C (100.4°F), stay hydrated, rest, and consider taking paracetamol. Seek medical attention if the fever persists for more than 3 days or is accompanied by severe symptoms.";
    }
    if (lowered.includes('headache')) {
      return "For headaches, try resting in a quiet, dark room and staying hydrated. Over-the-counter pain relievers like paracetamol can help. If headaches are severe, frequent, or accompanied by other symptoms, please consult a healthcare provider.";
    }
    if (lowered.includes('malaria')) {
      return "Malaria is transmitted through mosquito bites. Symptoms include fever, chills, and body aches. Prevention includes using mosquito nets, repellent, and eliminating stagnant water. If you suspect malaria, get tested immediately at a health facility.";
    }
    if (lowered.includes('clinic') || lowered.includes('hospital') || lowered.includes('doctor')) {
      return "You can find nearby health facilities in the Map section of the app. For emergencies, please call emergency services or visit the nearest hospital immediately.";
    }
    
    return "Thank you for your question. For personalized health advice, I recommend consulting with a healthcare professional. Is there anything specific about your health I can help clarify?";
  };

  const suggestionChips = [
    { label: 'Headache advice', query: "I've been having headaches for the past few days" },
    { label: 'Flu symptoms', query: 'What are the symptoms of the flu?' },
    { label: 'Sleep tips', query: 'How can I improve my sleep quality?' },
    { label: 'Medication info', query: 'What should I know about taking ibuprofen?' },
  ];

  const handleSuggestion = (query: string) => {
    setInputText(query);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
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
            <Text style={styles.logoText}>MedGuard AI</Text>
          </View>
        </View>
      </View>

      {/* Chat Container */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Welcome Screen */}
        {messages.length === 0 && (
          <Animated.View entering={FadeInUp.duration(500)} style={styles.welcomeScreen}>
            <LinearGradient
              colors={[DarkTheme.accent, '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.welcomeLogo}
            >
              <ShieldIcon size={36} color={Colors.textLight} />
            </LinearGradient>
            <Text style={styles.welcomeTitle}>How can I help you today?</Text>
            <Text style={styles.welcomeSubtitle}>
              I'm MedGuard, your AI health assistant. Ask me about symptoms, medications, conditions, or general health advice.
            </Text>
            <View style={styles.suggestionChips}>
              {suggestionChips.map((chip, index) => (
                <Pressable
                  key={index}
                  style={styles.suggestionChip}
                  onPress={() => handleSuggestion(chip.query)}
                >
                  <Text style={styles.suggestionChipText}>{chip.label}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Message Bubbles */}
        {messages.map((message) => (
          <Animated.View
            key={message.id}
            entering={message.isUser ? SlideInRight.duration(300) : SlideInLeft.duration(300)}
          >
            <MessageBubble message={message} />
          </Animated.View>
        ))}

        {/* Typing Indicator */}
        {isTyping && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.typingContainer}>
            <View style={styles.typingBubble}>
              <Animated.View style={[styles.typingDot, dot1Style]} />
              <Animated.View style={[styles.typingDot, dot2Style]} />
              <Animated.View style={[styles.typingDot, dot3Style]} />
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Input Area */}
      <View style={[styles.inputArea, { paddingBottom: insets.bottom + Spacing.base }]}>
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.chatInput}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Message MedGuard..."
            placeholderTextColor={DarkTheme.textMuted}
            multiline
            maxLength={500}
          />
          <Pressable
            onPress={handleSend}
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            disabled={!inputText.trim()}
          >
            <ArrowRightIcon size={20} color={Colors.textLight} style={{ transform: [{ rotate: '-90deg' }] }} />
          </Pressable>
        </View>
        <Text style={styles.inputFooter}>
          MedGuard can make mistakes. Always consult a healthcare professional for medical advice.
        </Text>
      </View>

      {showLoadingOverlay && (
        <View style={styles.loadingOverlay}>
          <LinearGradient
            colors={[Colors.primary, Colors.info]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.loadingGradient}
          >
            <Animated.View style={[styles.spinner, spinnerStyle]} />
            <Text style={styles.loadingText}>Redirecting to MedGuard AI...</Text>
          </LinearGradient>
        </View>
      )}
    </KeyboardAvoidingView>
  );
};

// Message Bubble Component
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  if (message.isUser) {
    return (
      <View style={styles.messageUser}>
        <LinearGradient
          colors={[DarkTheme.userGradientFrom, DarkTheme.userGradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.userBubbleGradient}
        >
          <Text style={styles.userMessageText}>{message.text}</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.messageAssistant}>
      <View style={styles.assistantBubble}>
        <Text style={styles.assistantMessageText}>{message.text}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DarkTheme.bgPrimary,
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
