/**
 * MedGuard Theme — Colors ("Calm Clinical" premium system)
 *
 * Deeper, more premium teal + true neutral ramps and muted semantics. Light and
 * dark are tuned independently (dark uses a brighter primary so it reads on the
 * deep surfaces). Export SHAPES are unchanged (LightColors / DarkColors / Colors
 * / useThemedColors) so the whole app keeps compiling; values are evolved and a
 * few tokens (surfaceSunken, borderStrong, outline, primaryTint) are added.
 */

// Base color palette (theme-independent brand + status + alphas)
const BaseColors = {
  // Primary brand — deep premium teal
  primary: '#0B7C8C',
  primaryLight: 'rgba(11, 124, 140, 0.12)',
  primaryDark: '#086876',

  // Secondary / accent
  emerald: '#159E7A',
  emeraldLight: 'rgba(21, 158, 122, 0.14)',
  cyan: '#22B8C9',

  // Status colors (muted, not neon)
  success: '#159E7A',
  successLight: '#DCF2EB',
  warning: '#C77A0A',
  warningLight: '#FBEEDA',
  danger: '#DC3B3B',
  dangerLight: '#FBE3E3',
  info: '#2E6FE0',
  infoLight: '#E1EAFB',

  // Alert severity
  alertUrgent: '#DC3B3B',
  alertCaution: '#C77A0A',
  alertInfo: '#159E7A',

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

// Light theme — airy neutrals, flat surfaces, soft depth
export const LightColors = {
  ...BaseColors,
  // Backgrounds & surfaces
  background: '#F7F9FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#EEF2F4',

  // Kept for API compatibility; near-flat now (we de-gradient)
  gradientFrom: '#F7F9FA',
  gradientVia: '#F2F6F7',
  gradientTo: '#FFFFFF',

  // Text
  text: '#0C1519',
  textSecondary: '#55636B',
  textMuted: '#8C99A0',
  textInverse: '#FFFFFF',

  // Lines
  border: '#E6EBEE',
  borderLight: '#EEF2F4',
  borderStrong: '#D6DEE2',
  outline: '#E6EBEE',
  divider: '#E6EBEE',

  // Accent tint (surfaces/pills)
  primaryTint: '#E4F3F5',

  // Glass (legacy; primitives now prefer flat surfaces)
  glass: 'rgba(255, 255, 255, 0.9)',
  glassOverlay: 'rgba(11, 124, 140, 0.06)',

  // Shadows
  shadow: 'rgba(12, 21, 25, 0.10)',
  shadowPrimary: 'rgba(11, 124, 140, 0.22)',

  // Overlay + inputs
  overlay: 'rgba(9, 15, 19, 0.45)',
  cardBackground: '#FFFFFF',
  inputBackground: '#F3F6F7',
} as const;

// Dark theme — deep ink with a cool teal undertone. Tuned like a premium dark
// UI (Linear/Oura): a near-black base, a clear 3-step elevation ladder, borders
// that carry the structure (dark mode leans on borders, not shadows), softened
// off-white text, a brighter primary, and semantics/tints re-tuned for dark
// (the light pastel *Light tints from BaseColors are overridden to alpha here).
export const DarkColors = {
  ...BaseColors,
  primary: '#2CC3D4',
  primaryLight: 'rgba(44, 195, 212, 0.16)',
  primaryDark: '#0B7C8C',

  // Elevation ladder — each step reads as one surface higher.
  background: '#090D11',
  surface: '#131C22',
  surfaceElevated: '#1B262E',
  surfaceSunken: '#0D141A',

  gradientFrom: '#090D11',
  gradientVia: '#0C141A',
  gradientTo: '#111C23',

  // Softened off-white so long text isn't harsh on the deep base.
  text: '#EAF1F3',
  textSecondary: '#9FAEB7',
  textMuted: '#64757F',
  textInverse: '#06121A',

  // Borders do the structural work in dark; a touch more visible + a clear
  // "strong" step for emphasis/dividers on elevated surfaces.
  border: '#26333D',
  borderLight: '#2F3E48',
  borderStrong: '#3B4C57',
  outline: '#2F3E48',
  divider: '#222F38',

  primaryTint: 'rgba(44, 195, 212, 0.15)',

  // Semantics — brightened so they read as color (not mud) on dark surfaces.
  success: '#2FC091',
  successLight: 'rgba(47, 192, 145, 0.16)',
  warning: '#E7A33A',
  warningLight: 'rgba(231, 163, 58, 0.16)',
  danger: '#F16A63',
  dangerLight: 'rgba(241, 106, 99, 0.16)',
  info: '#5E93F0',
  infoLight: 'rgba(94, 147, 240, 0.16)',
  emerald: '#2FC091',
  emeraldLight: 'rgba(47, 192, 145, 0.16)',
  alertUrgent: '#F16A63',
  alertCaution: '#E7A33A',
  alertInfo: '#2FC091',

  glass: 'rgba(19, 28, 34, 0.94)',
  glassOverlay: 'rgba(44, 195, 212, 0.10)',

  shadow: 'rgba(0, 0, 0, 0.55)',
  shadowPrimary: 'rgba(44, 195, 212, 0.24)',

  overlay: 'rgba(4, 8, 11, 0.72)',
  cardBackground: '#131C22',
  inputBackground: '#0D141A',
} as const;

// Legacy static export (light values). Prefer useTheme().colors in components.
export const Colors = {
  primary: '#0B7C8C',
  primaryLight: 'rgba(11, 124, 140, 0.12)',
  primaryDark: '#086876',

  emerald: '#159E7A',
  emeraldLight: 'rgba(21, 158, 122, 0.14)',
  cyan: '#22B8C9',

  backgroundLight: '#F7F9FA',
  backgroundDark: '#0A0F13',

  surfaceLight: '#FFFFFF',
  surfaceDark: '#141D23',

  gradientFromLight: '#F7F9FA',
  gradientViaLight: '#F2F6F7',
  gradientToLight: '#FFFFFF',

  gradientFromDark: '#0A0F13',
  gradientViaDark: '#0C141A',
  gradientToDark: '#101A20',

  textPrimary: '#0C1519',
  textSecondary: '#55636B',
  textMuted: '#8C99A0',
  textLight: '#FFFFFF',
  textDark: '#ECF2F4',

  success: '#159E7A',
  successLight: '#DCF2EB',
  warning: '#C77A0A',
  warningLight: '#FBEEDA',
  danger: '#DC3B3B',
  dangerLight: '#FBE3E3',
  info: '#2E6FE0',
  infoLight: '#E1EAFB',

  alertUrgent: '#DC3B3B',
  alertCaution: '#C77A0A',
  alertInfo: '#159E7A',

  borderLight: '#E6EBEE',
  borderDark: '#24313A',

  glassLight: 'rgba(255, 255, 255, 0.9)',
  glassDark: 'rgba(20, 29, 35, 0.94)',
  glassOverlay: 'rgba(11, 124, 140, 0.06)',

  shadowLight: 'rgba(12, 21, 25, 0.10)',
  shadowDark: 'rgba(0, 0, 0, 0.55)',
  shadowPrimary: 'rgba(11, 124, 140, 0.22)',

  overlayLight: 'rgba(255, 255, 255, 0.5)',
  overlayDark: 'rgba(5, 9, 12, 0.70)',

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
 * Hook to get themed colors based on current theme mode.
 * Usage: const colors = useThemedColors(isDark);
 */
export const useThemedColors = (isDark: boolean) => {
  return isDark ? DarkColors : LightColors;
};
