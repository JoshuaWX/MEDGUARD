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

// Dark theme — flat, matte "island" scheme (JetBrains New UI feel). TRUE NEUTRAL
// grays (no teal tint, no gloss/glow): cards are slightly lighter gray islands
// floating on a darker canvas, separated by tone + a subtle border rather than
// shadow. Teal is an ACCENT only. Semantics are re-tuned to read on neutral gray
// (the light *Light pastels from BaseColors are overridden to low-alpha tints).
export const DarkColors = {
  ...BaseColors,
  // Accent teal, slightly matte (less neon than a glossy scheme).
  primary: '#3BACBB',
  primaryLight: 'rgba(59, 172, 187, 0.16)',
  primaryDark: '#2C818E',

  // Neutral-gray "island" ramp — canvas darkest, card one step lighter.
  background: '#1A1B1E',       // canvas behind the islands
  surface: '#26282C',          // card / island
  surfaceElevated: '#2F3236',  // menus / popovers, one step up
  surfaceSunken: '#202124',    // wells / inputs, one step down

  // Kept for API compatibility; near-flat neutral (no colored gradient).
  gradientFrom: '#1A1B1E',
  gradientVia: '#202124',
  gradientTo: '#26282C',

  text: '#DFE1E5',
  textSecondary: '#9DA2AB',
  textMuted: '#6B6F76',
  textInverse: '#1A1B1E',

  // Subtle neutral borders carry the island separation.
  border: '#34363B',
  borderLight: '#3C3F44',
  borderStrong: '#4A4D53',
  outline: '#3C3F44',
  divider: '#2E3034',

  primaryTint: 'rgba(59, 172, 187, 0.14)',

  // Semantics — clear on neutral gray, slightly matte (not neon).
  success: '#54B394',
  successLight: 'rgba(84, 179, 148, 0.15)',
  warning: '#DDA53F',
  warningLight: 'rgba(221, 165, 63, 0.15)',
  danger: '#E56A62',
  dangerLight: 'rgba(229, 106, 98, 0.15)',
  info: '#6C9CEA',
  infoLight: 'rgba(108, 156, 234, 0.15)',
  emerald: '#54B394',
  emeraldLight: 'rgba(84, 179, 148, 0.15)',
  alertUrgent: '#E56A62',
  alertCaution: '#DDA53F',
  alertInfo: '#54B394',

  // Flat surfaces (no translucent glass, no colored overlay glow).
  glass: '#26282C',
  glassOverlay: 'rgba(255, 255, 255, 0.03)',

  // Neutral, restrained shadows — depth in dark comes from tone + border.
  shadow: 'rgba(0, 0, 0, 0.40)',
  shadowPrimary: 'rgba(0, 0, 0, 0.40)',

  overlay: 'rgba(0, 0, 0, 0.66)',
  cardBackground: '#26282C',
  inputBackground: '#202124',
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
