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

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm MedGuard AI, your personal health assistant. How can I help you today?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

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

  const quickActions = [
    "What are malaria symptoms?",
    "How to prevent fever?",
    "Find nearby clinics",
  ];

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Header */}
      <LinearGradient
        colors={[Colors.primary, Colors.emerald]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.header, { paddingTop: insets.top + Spacing.base }]}
      >
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ChevronDownIcon size={24} color={Colors.textLight} style={{ transform: [{ rotate: '90deg' }] }} />
        </Pressable>
        <View style={styles.headerContent}>
          <View style={styles.botAvatar}>
            <ShieldIcon size={24} color={Colors.primary} />
          </View>
          <View>
            <Text style={styles.headerTitle}>MedGuard AI</Text>
            <Text style={styles.headerStatus}>Online • Ready to help</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Messages */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Actions */}
        {messages.length === 1 && (
          <Animated.View entering={FadeInUp.delay(300).duration(500)} style={styles.quickActions}>
            <Text style={styles.quickActionsLabel}>Quick questions:</Text>
            <View style={styles.quickActionsRow}>
              {quickActions.map((action, index) => (
                <Pressable
                  key={index}
                  style={styles.quickActionBtn}
                  onPress={() => setInputText(action)}
                >
                  <Text style={styles.quickActionText}>{action}</Text>
                </Pressable>
              ))}
            </View>
          </Animated.View>
        )}

        {/* Message Bubbles */}
        {messages.map((message, index) => (
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
      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + Spacing.base }]}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={inputText}
            onChangeText={setInputText}
            placeholder="Ask a health question..."
            placeholderTextColor={Colors.textSecondary}
            multiline
            maxLength={500}
          />
          <AnimatedPressable
            onPress={handleSend}
            style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={inputText.trim() ? [Colors.primary, Colors.emerald] : [Colors.borderLight, Colors.borderLight]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.sendBtnGradient}
            >
              <ArrowRightIcon size={20} color={inputText.trim() ? Colors.textLight : Colors.textSecondary} />
            </LinearGradient>
          </AnimatedPressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// Message Bubble Component
const MessageBubble: React.FC<{ message: Message }> = ({ message }) => {
  return (
    <View style={[styles.messageBubble, message.isUser && styles.userBubble]}>
      {!message.isUser && (
        <View style={styles.botIcon}>
          <ShieldIcon size={16} color={Colors.primary} />
        </View>
      )}
      <View style={[styles.bubbleContent, message.isUser && styles.userBubbleContent]}>
        <Text style={[styles.messageText, message.isUser && styles.userMessageText]}>
          {message.text}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundLight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingBottom: Spacing.base,
    gap: Spacing.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  botAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.textLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.textLight,
  },
  headerStatus: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: Spacing.base,
    paddingBottom: Spacing.xl,
  },
  quickActions: {
    marginBottom: Spacing.xl,
  },
  quickActionsLabel: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  quickActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickActionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primaryLight,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  quickActionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  messageBubble: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  userBubble: {
    justifyContent: 'flex-end',
  },
  botIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleContent: {
    maxWidth: '75%',
    padding: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.xs,
    ...Shadows.sm,
  },
  userBubbleContent: {
    backgroundColor: Colors.primary,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.xs,
    marginLeft: 'auto',
  },
  messageText: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    lineHeight: FontSize.base * 1.5,
  },
  userMessageText: {
    color: Colors.textLight,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  typingBubble: {
    flexDirection: 'row',
    gap: 4,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    borderBottomLeftRadius: BorderRadius.xs,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textSecondary,
  },
  inputContainer: {
    paddingHorizontal: Spacing.base,
    paddingTop: Spacing.base,
    backgroundColor: Colors.backgroundLight,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    color: Colors.textPrimary,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  sendBtnDisabled: {
    opacity: 0.5,
  },
  sendBtnGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ChatbotScreen;
