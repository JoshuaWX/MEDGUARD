/**
 * MedGuard Theme - Colors
 * Preserves exact color palette from web application
 */

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
  backgroundDark: '#101f22',
  
  // Surface colors
  surfaceLight: '#ffffff',
  surfaceDark: '#1f2937',
  
  // Gradient backgrounds (from Tailwind config)
  gradientFromLight: '#f8fafc', // slate-50
  gradientViaLight: 'rgba(236, 254, 255, 0.5)', // cyan-50/50
  gradientToLight: 'rgba(240, 253, 250, 0.3)', // teal-50/30
  
  gradientFromDark: '#111827', // gray-900
  gradientViaDark: '#111827',
  gradientToDark: '#1f2937', // gray-800
  
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
  borderDark: '#374151',
  
  // Glass effect colors
  glassLight: 'rgba(255, 255, 255, 0.9)',
  glassDark: 'rgba(31, 41, 55, 0.9)',
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
