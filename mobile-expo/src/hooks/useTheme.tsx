/**
 * Theme Provider and Hook
 * Manages light/dark mode theme across the app with AsyncStorage persistence
 * Supports system/light/dark modes with proper status bar styling
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { useColorScheme, StatusBar, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors } from '../../theme/colors';

export type ThemeMode = 'system' | 'light' | 'dark';

// Theme colors type - uses string for flexibility between light/dark themes
export interface ThemeColors {
  // Base colors (shared)
  primary: string;
  primaryLight: string;
  primaryDark: string;
  emerald: string;
  emeraldLight: string;
  cyan: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  danger: string;
  dangerLight: string;
  info: string;
  infoLight: string;
  alertUrgent: string;
  alertCaution: string;
  alertInfo: string;
  transparent: string;
  whiteAlpha10: string;
  whiteAlpha20: string;
  whiteAlpha30: string;
  whiteAlpha40: string;
  whiteAlpha50: string;
  whiteAlpha80: string;
  whiteAlpha90: string;
  blackAlpha10: string;
  blackAlpha20: string;
  blackAlpha50: string;
  // Theme-specific colors
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceSunken: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  textInverse: string;
  border: string;
  borderLight: string;
  borderStrong: string;
  outline: string;
  primaryTint: string;
  glass: string;
  glassOverlay: string;
  shadow: string;
  shadowPrimary: string;
  overlay: string;
  cardBackground: string;
  inputBackground: string;
  divider: string;
}

interface ThemeContextValue {
  /** Current mode setting: system | light | dark */
  mode: ThemeMode;
  /** Resolved boolean - true if dark theme is active */
  isDark: boolean;
  /** Current theme color tokens */
  colors: ThemeColors;
  /** Update the theme mode preference */
  setMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark (skips system) */
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const THEME_STORAGE_KEY = '@medguard_theme_mode';

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  // Determine if dark mode should be active based on mode and system preference
  const isDark = useMemo(() => {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    // mode === 'system'
    return systemColorScheme === 'dark';
  }, [mode, systemColorScheme]);

  // Get the appropriate color tokens
  const colors = useMemo(() => (isDark ? DarkColors : LightColors), [isDark]);

  // Update status bar based on theme
  useEffect(() => {
    if (!isLoaded) return;

    StatusBar.setBarStyle(isDark ? 'light-content' : 'dark-content', true);
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(colors.background, true);
    }
  }, [isDark, colors.background, isLoaded]);

  // Load theme preference from storage
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const savedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
          setModeState(savedMode);
        }
      } catch {
        // Silently fail - use default mode
      } finally {
        setIsLoaded(true);
      }
    };
    loadTheme();
  }, []);

  // Save theme preference to storage
  const setMode = async (newMode: ThemeMode) => {
    try {
      setModeState(newMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
    } catch {
      // Silently fail - preference won't persist
    }
  };

  // Toggle between light and dark (bypasses system)
  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark';
    setMode(newMode);
  };

  const value = useMemo(
    () => ({ mode, isDark, colors, setMode, toggleTheme }),
    [mode, isDark, colors]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access theme context
 * @returns Theme context with mode, isDark, colors, setMode, toggleTheme
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

/**
 * Convenience hook to get a specific theme color
 * @param colorKey - Key of the color in the theme
 * @returns The color value for the current theme
 */
export const useThemeColor = <K extends keyof ThemeColors>(colorKey: K): ThemeColors[K] => {
  const { colors } = useTheme();
  return colors[colorKey];
};
