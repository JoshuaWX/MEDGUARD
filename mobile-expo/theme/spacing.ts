/**
 * MedGuard Theme - Spacing
 * Preserves exact spacing from Tailwind CSS classes
 */

export const Spacing = {
  // Base spacing (1 unit = 4px in Tailwind)
  xs: 4,    // 1
  sm: 8,    // 2
  md: 12,   // 3
  base: 16, // 4
  lg: 20,   // 5
  xl: 24,   // 6
  '2xl': 32, // 8
  '3xl': 40, // 10
  '4xl': 48, // 12
  '5xl': 56, // 14
  '6xl': 64, // 16
  '7xl': 80, // 20
  '8xl': 96, // 24
  
  // Screen padding
  screenPadding: 16,
  cardPadding: 20,
  sectionGap: 24,
  
  // Component specific
  inputHeight: 56,   // h-14 = 3.5rem = 56px
  buttonHeight: 56,  // h-14
  buttonHeightSm: 48, // h-12
  navHeight: 64,     // h-16
  avatarSm: 40,      // w-10 h-10
  avatarMd: 56,      // w-14 h-14
  avatarLg: 96,      // w-24 h-24
  iconSm: 20,
  iconMd: 24,
  iconLg: 28,
} as const;

export type SpacingKey = keyof typeof Spacing;
