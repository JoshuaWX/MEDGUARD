/**
 * PasswordStrengthIndicator
 * Real-time password strength feedback using @zxcvbn-ts/core
 */

import React, { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
  FadeIn, 
  FadeOut 
} from 'react-native-reanimated';
import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';

import { useTheme } from '../hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize } from '../../theme';

// Configure zxcvbn-ts with language dictionaries
const options = {
  translations: zxcvbnEnPackage.translations,
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
    ...zxcvbnEnPackage.dictionary,
  },
};
zxcvbnOptions.setOptions(options);

interface PasswordStrengthIndicatorProps {
  password: string;
  /** Additional inputs to penalize (e.g., user's name, email) */
  userInputs?: string[];
  /** Minimum score required (0-4). Default is 2 (Fair) */
  minScore?: number;
  /** Called when score changes */
  onScoreChange?: (score: number, isValid: boolean) => void;
}

// Score configuration
const STRENGTH_CONFIG = {
  0: { 
    label: 'Too weak', 
    color: '#EF4444', // red
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
  1: { 
    label: 'Weak', 
    color: '#F97316', // orange
    bgColor: 'rgba(249, 115, 22, 0.15)',
  },
  2: { 
    label: 'Fair', 
    color: '#EAB308', // yellow
    bgColor: 'rgba(234, 179, 8, 0.15)',
  },
  3: { 
    label: 'Strong', 
    color: '#22C55E', // green
    bgColor: 'rgba(34, 197, 94, 0.15)',
  },
  4: { 
    label: 'Very strong', 
    color: '#10B981', // emerald
    bgColor: 'rgba(16, 185, 129, 0.15)',
  },
} as const;

export const PasswordStrengthIndicator: React.FC<PasswordStrengthIndicatorProps> = ({
  password,
  userInputs = [],
  minScore = 2,
  onScoreChange,
}) => {
  const { isDark, colors } = useTheme();

  // Analyze password (pure computation, no side effects)
  const analysis = useMemo(() => {
    if (!password) {
      return null;
    }

    // Filter out empty strings from user inputs
    const filteredInputs = userInputs.filter(Boolean);
    
    const result = zxcvbn(password, filteredInputs);
    const isValid = result.score >= minScore;

    return {
      score: result.score as 0 | 1 | 2 | 3 | 4,
      feedback: result.feedback,
      isValid,
    };
  }, [password, userInputs, minScore]);

  // Notify parent of score change via useEffect (not during render)
  useEffect(() => {
    if (analysis) {
      onScoreChange?.(analysis.score, analysis.isValid);
    } else {
      // Password is empty, reset to invalid
      onScoreChange?.(0, false);
    }
  }, [analysis, onScoreChange]);

  // Don't render if no password
  if (!password || !analysis) {
    return null;
  }

  const config = STRENGTH_CONFIG[analysis.score];
  const { warning, suggestions } = analysis.feedback;

  // Get feedback message
  let feedbackMessage = '';
  if (warning) {
    feedbackMessage = warning;
  } else if (suggestions.length > 0) {
    feedbackMessage = suggestions[0];
  } else if (analysis.isValid) {
    feedbackMessage = analysis.score >= 3 ? '✓ Great password!' : '✓ Acceptable password';
  } else {
    feedbackMessage = 'Add more characters or mix it up';
  }

  return (
    <Animated.View 
      entering={FadeIn.duration(200)} 
      exiting={FadeOut.duration(150)}
      style={styles.container}
    >
      {/* Strength bars */}
      <View style={styles.barsContainer}>
        <View style={styles.barsRow}>
          {[0, 1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.bar,
                { backgroundColor: isDark ? colors.border : Colors.borderLight },
                index <= analysis.score && { backgroundColor: config.color },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.label, { color: config.color }]}>
          {config.label}
        </Text>
      </View>

      {/* Feedback message */}
      <Text 
        style={[
          styles.feedback, 
          { color: warning ? '#F97316' : colors.textMuted }
        ]}
        numberOfLines={2}
      >
        {feedbackMessage}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
    paddingHorizontal: Spacing.xs,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  barsRow: {
    flexDirection: 'row',
    flex: 1,
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    marginLeft: Spacing.sm,
    minWidth: 70,
    textAlign: 'right',
  },
  feedback: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
});

export default PasswordStrengthIndicator;
