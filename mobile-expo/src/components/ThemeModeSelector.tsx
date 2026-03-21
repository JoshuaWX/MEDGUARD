/**
 * ThemeModeSelector Component
 * Provides a segmented control for selecting theme mode: System | Light | Dark
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Circle } from 'react-native-svg';
import { useTheme, ThemeMode } from '../hooks/useTheme';
import { Colors, Spacing, BorderRadius, FontFamily, FontSize } from '../../theme';

interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: React.ReactNode;
}

const SystemIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    <Circle cx={12} cy={12} r={4} />
    <Path d="M12 8a4 4 0 0 1 4 4" opacity={0.5} />
  </Svg>
);

const SunIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Circle cx={12} cy={12} r={5} />
    <Path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </Svg>
);

const MoonIconSmall: React.FC<{ size?: number; color?: string }> = ({ size = 18, color }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <Path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </Svg>
);

const ThemeModeSelector: React.FC = () => {
  const { mode, setMode, colors, isDark } = useTheme();

  const options: ThemeOption[] = [
    {
      mode: 'system',
      label: 'System',
      icon: <SystemIcon color={mode === 'system' ? Colors.textLight : colors.textSecondary} />,
    },
    {
      mode: 'light',
      label: 'Light',
      icon: <SunIcon color={mode === 'light' ? Colors.textLight : colors.textSecondary} />,
    },
    {
      mode: 'dark',
      label: 'Dark',
      icon: <MoonIconSmall color={mode === 'dark' ? Colors.textLight : colors.textSecondary} />,
    },
  ];

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDark ? Colors.blackAlpha20 : Colors.whiteAlpha50,
          borderColor: isDark ? Colors.whiteAlpha10 : Colors.blackAlpha10,
        },
      ]}
    >
      {options.map((option) => {
        const isActive = mode === option.mode;
        return (
          <Pressable
            key={option.mode}
            onPress={() => setMode(option.mode)}
            style={[
              styles.option,
              isActive && styles.optionActive,
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`${option.label} theme`}
          >
            {isActive ? (
              <LinearGradient
                colors={[Colors.primary, Colors.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.activeFill}
              >
                {option.icon}
                <Text style={[styles.optionText, { color: Colors.textLight }]}>{option.label}</Text>
              </LinearGradient>
            ) : (
              <>
                {option.icon}
                <Text style={[styles.optionText, { color: colors.textSecondary }]}>{option.label}</Text>
              </>
            )}
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    gap: Spacing.xs,
    borderWidth: 1,
  },
  option: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.base,
    borderRadius: BorderRadius.base,
    overflow: 'hidden',
  },
  activeFill: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: Spacing.xs,
    borderRadius: BorderRadius.base,
  },
  optionActive: {
    backgroundColor: 'transparent',
  },
  optionText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    letterSpacing: 0.2,
  },
});

export default ThemeModeSelector;
