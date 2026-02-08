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
  background: '#f6f8f8',
  surface: '#ffffff',
  surfaceElevated: '#ffffff', // Cards and modals
  
  // Gradient backgrounds
  gradientFrom: '#f8fafc', // slate-50
  gradientVia: 'rgba(236, 254, 255, 0.5)', // cyan-50/50
  gradientTo: 'rgba(240, 253, 250, 0.3)', // teal-50/30
  
  // Text colors
  text: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  textInverse: '#ffffff',
  
  // Border colors
  border: '#e5e7eb',
  borderLight: '#f3f4f6', // Lighter variant
  
  // Glass effect colors
  glass: 'rgba(255, 255, 255, 0.9)',
  glassOverlay: 'rgba(255, 255, 255, 0.2)',
  
  // Shadow colors
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowPrimary: 'rgba(17, 180, 212, 0.4)',
  
  // Overlay colors
  overlay: 'rgba(255, 255, 255, 0.5)',
  
  // Light theme specific
  cardBackground: '#ffffff',
  inputBackground: '#f9fafb',
  divider: '#e5e7eb',
} as const;

// Dark theme colors - Island Dark Theme
// A sophisticated dark theme with subtle teal undertones, inspired by tropical island nights
export const DarkColors = {
  ...BaseColors,
  // Background colors - deep ocean blues with teal hints
  background: '#0f1419',      // Deep charcoal with subtle warmth
  surface: '#1a2632',         // Elevated surface with teal undertone
  surfaceElevated: '#243442', // Cards and modals
  
  // Gradient backgrounds - subtle island night vibes
  gradientFrom: '#0f1419',    // Deep base
  gradientVia: '#152028',     // Subtle teal mid
  gradientTo: '#1a2632',      // Elevated end
  
  // Text colors - crisp and readable
  text: '#f0f4f8',            // Soft white, easier on eyes
  textSecondary: '#a8b9c8',   // Muted blue-gray
  textMuted: '#6b8299',       // Subtle hints
  textInverse: '#0f1419',
  
  // Border colors - subtle definition
  border: '#2d3f4f',          // Soft teal-gray border
  borderLight: '#3a4f5f',     // Lighter variant for emphasis
  
  // Glass effect colors - frosted glass aesthetic
  glass: 'rgba(26, 38, 50, 0.95)',
  glassOverlay: 'rgba(17, 180, 212, 0.08)', // Subtle primary tint
  
  // Shadow colors
  shadow: 'rgba(0, 0, 0, 0.4)',
  shadowPrimary: 'rgba(17, 180, 212, 0.3)',
  
  // Overlay colors
  overlay: 'rgba(15, 20, 25, 0.7)',
  
  // Island dark specific
  cardBackground: '#1e2d3a',  // Slightly elevated card bg
  inputBackground: '#152028', // Input fields
  divider: '#2a3a48',         // Subtle dividers
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
  backgroundLight: '#f6f8f8',
  backgroundDark: '#0f1419',  // Island dark
  
  // Surface colors
  surfaceLight: '#ffffff',
  surfaceDark: '#1a2632',     // Island dark surface
  
  // Gradient backgrounds (from Tailwind config)
  gradientFromLight: '#f8fafc', // slate-50
  gradientViaLight: 'rgba(236, 254, 255, 0.5)', // cyan-50/50
  gradientToLight: 'rgba(240, 253, 250, 0.3)', // teal-50/30
  
  gradientFromDark: '#0f1419',  // Island dark
  gradientViaDark: '#152028',   // Island dark via
  gradientToDark: '#1a2632',    // Island dark to
  
  // Text colors
  textPrimary: '#111827',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
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
  borderLight: '#e5e7eb',
  borderDark: '#2d3f4f',      // Island dark border
  
  // Glass effect colors
  glassLight: 'rgba(255, 255, 255, 0.9)',
  glassDark: 'rgba(26, 38, 50, 0.95)',  // Island dark glass
  glassOverlay: 'rgba(255, 255, 255, 0.2)',
  
  // Shadow colors
  shadowLight: 'rgba(0, 0, 0, 0.1)',
  shadowDark: 'rgba(0, 0, 0, 0.3)',
  shadowPrimary: 'rgba(17, 180, 212, 0.4)',
  
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

