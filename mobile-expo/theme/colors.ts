/**
 * MedGuard Theme - Colors
 * Preserves exact color palette from web application with light/dark mode support
 */

// Base color palette (theme-independent)
const BaseColors = {
  // Primary brand colors
  primary: '#11b4d4',
  primaryLight: 'rgba(17, 180, 212, 0.2)',
  primaryDark: '#0d8fa9',
  
  // Secondary/Accent
  emerald: '#10b981',
  emeraldLight: 'rgba(16, 185, 129, 0.2)',
  cyan: '#06b6d4',
  
  // Status colors (same in both themes)
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  
  // Alert severity colors
  alertUrgent: '#ef4444',
  alertCaution: '#f59e0b',
  alertInfo: '#10b981',
  
  // Transparent variants
  transparent: 'transparent',
  whiteAlpha10: 'rgba(255, 255, 255, 0.1)',
  whiteAlpha20: 'rgba(255, 255, 255, 0.2)',
  whiteAlpha30: 'rgba(255, 255, 255, 0.3)',
  whiteAlpha40: 'rgba(255, 255, 255, 0.4)',
  whiteAlpha50: 'rgba(255, 255, 255, 0.5)',
  whiteAlpha80: 'rgba(255, 255, 255, 0.8)',
  whiteAlpha90: 'rgba(255, 255, 255, 0.9)',
  blackAlpha10: 'rgba(0, 0, 0, 0.1)',
  blackAlpha20: 'rgba(0, 0, 0, 0.2)',
  blackAlpha50: 'rgba(0, 0, 0, 0.5)',
} as const;

// Light theme colors
export const LightColors = {
  ...BaseColors,
  // Background colors
  background: '#f3f8f9',
  surface: '#ffffff',
  surfaceElevated: '#fbfefe', // Cards and modals
  
  // Gradient backgrounds
  gradientFrom: '#eefbfc',
  gradientVia: 'rgba(236, 253, 245, 0.78)',
  gradientTo: '#ffffff',
  
  // Text colors
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textInverse: '#ffffff',
  
  // Border colors
  border: '#dbe8ea',
  borderLight: '#edf5f6',
  
  // Glass effect colors
  glass: 'rgba(255, 255, 255, 0.9)',
  glassOverlay: 'rgba(255, 255, 255, 0.2)',
  
  // Shadow colors
  shadow: 'rgba(15, 118, 110, 0.12)',
  shadowPrimary: 'rgba(17, 180, 212, 0.28)',
  
  // Overlay colors
  overlay: 'rgba(255, 255, 255, 0.5)',
  
  // Light theme specific
  cardBackground: '#ffffff',
  inputBackground: '#f7fbfb',
  divider: '#dbe8ea',
} as const;

// Dark theme colors - Island Dark Theme
// A sophisticated dark theme with subtle teal undertones, inspired by tropical island nights
export const DarkColors = {
  ...BaseColors,
  // Background colors - deep ocean blues with teal hints
  background: '#07131a',
  surface: '#0d2029',
  surfaceElevated: '#122c36',
  
  // Gradient backgrounds - subtle island night vibes
  gradientFrom: '#07131a',
  gradientVia: '#0a232c',
  gradientTo: '#10323a',
  
  // Text colors - crisp and readable
  text: '#f6fbfc',
  textSecondary: '#b7c8d1',
  textMuted: '#78909c',
  textInverse: '#07131a',
  
  // Border colors - subtle definition
  border: '#1f4652',
  borderLight: '#2b5965',
  
  // Glass effect colors - frosted glass aesthetic
  glass: 'rgba(13, 32, 41, 0.94)',
  glassOverlay: 'rgba(17, 180, 212, 0.1)',
  
  // Shadow colors
  shadow: 'rgba(0, 0, 0, 0.48)',
  shadowPrimary: 'rgba(17, 180, 212, 0.28)',
  
  // Overlay colors
  overlay: 'rgba(7, 19, 26, 0.76)',
  
  // Island dark specific
  cardBackground: '#122c36',
  inputBackground: '#0a1c24',
  divider: '#1f4652',
} as const;

// Legacy export for backward compatibility (uses light theme by default)
// NOTE: Use useThemedColors() hook in components for dynamic theme support
export const Colors = {
  // Primary brand colors
  primary: '#11b4d4',
  primaryLight: 'rgba(17, 180, 212, 0.2)',
  primaryDark: '#0d8fa9',
  
  // Secondary/Accent
  emerald: '#10b981',
  emeraldLight: 'rgba(16, 185, 129, 0.2)',
  cyan: '#06b6d4',
  
  // Background colors
  backgroundLight: '#f3f8f9',
  backgroundDark: '#07131a',
  
  // Surface colors
  surfaceLight: '#ffffff',
  surfaceDark: '#0d2029',
  
  // Gradient backgrounds (from Tailwind config)
  gradientFromLight: '#eefbfc',
  gradientViaLight: 'rgba(236, 253, 245, 0.78)',
  gradientToLight: '#ffffff',
  
  gradientFromDark: '#07131a',
  gradientViaDark: '#0a232c',
  gradientToDark: '#10323a',
  
  // Text colors
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  textLight: '#ffffff',
  textDark: '#f9fafb',
  
  // Status colors
  success: '#10b981',
  successLight: '#d1fae5',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  danger: '#ef4444',
  dangerLight: '#fee2e2',
  info: '#3b82f6',
  infoLight: '#dbeafe',
  
  // Alert severity colors
  alertUrgent: '#ef4444',
  alertCaution: '#f59e0b',
  alertInfo: '#10b981',
  
  // Border colors
  borderLight: '#dbe8ea',
  borderDark: '#1f4652',
  
  // Glass effect colors
  glassLight: 'rgba(255, 255, 255, 0.9)',
  glassDark: 'rgba(13, 32, 41, 0.94)',
  glassOverlay: 'rgba(255, 255, 255, 0.2)',
  
  // Shadow colors
  shadowLight: 'rgba(15, 118, 110, 0.12)',
  shadowDark: 'rgba(0, 0, 0, 0.48)',
  shadowPrimary: 'rgba(17, 180, 212, 0.28)',
  
  // Overlay colors
  overlayLight: 'rgba(255, 255, 255, 0.5)',
  overlayDark: 'rgba(0, 0, 0, 0.5)',
  
  // Transparent variants
  transparent: 'transparent',
  whiteAlpha10: 'rgba(255, 255, 255, 0.1)',
  whiteAlpha20: 'rgba(255, 255, 255, 0.2)',
  whiteAlpha30: 'rgba(255, 255, 255, 0.3)',
  whiteAlpha40: 'rgba(255, 255, 255, 0.4)',
  whiteAlpha50: 'rgba(255, 255, 255, 0.5)',
  whiteAlpha80: 'rgba(255, 255, 255, 0.8)',
  whiteAlpha90: 'rgba(255, 255, 255, 0.9)',
  blackAlpha10: 'rgba(0, 0, 0, 0.1)',
  blackAlpha20: 'rgba(0, 0, 0, 0.2)',
  blackAlpha50: 'rgba(0, 0, 0, 0.5)',
} as const;

export type ColorKey = keyof typeof Colors;

/**
 * Hook to get themed colors based on current theme mode
 * Usage: const colors = useThemedColors();
 */
export const useThemedColors = (isDark: boolean) => {
  return isDark ? DarkColors : LightColors;
};

