/**
 * MedGuard Theme - Border Radius
 * Preserves exact border radii from Tailwind config
 */

export const BorderRadius = {
  none: 0,
  xs: 2,
  sm: 4,      // rounded-sm
  base: 8,    // rounded (0.5rem)
  md: 12,     // rounded-md
  lg: 16,     // rounded-lg (1rem)
  xl: 24,     // rounded-xl (1.5rem)
  '2xl': 32,  // rounded-2xl
  '3xl': 48,  // rounded-3xl
  full: 9999, // rounded-full
} as const;

export type BorderRadiusKey = keyof typeof BorderRadius;
