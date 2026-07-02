/**
 * MedGuard Theme — Typography ("Calm Clinical")
 *
 * Body/UI: Inter (existing). Headings + big numbers: Schibsted Grotesk (a premium
 * editorial grotesk), bundled as two static instances and registered in App.tsx
 * under the keys referenced by `FontFamily.display` / `FontFamily.displayBold`.
 * Falls back to Inter Bold until the display faces finish loading.
 */

import { Platform } from 'react-native';

export const FontFamily = {
  regular: Platform.select({ ios: 'Inter-Regular', android: 'Inter-Regular', default: 'Inter' }),
  medium: Platform.select({ ios: 'Inter-Medium', android: 'Inter-Medium', default: 'Inter' }),
  semibold: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter-SemiBold', default: 'Inter' }),
  bold: Platform.select({ ios: 'Inter-Bold', android: 'Inter-Bold', default: 'Inter' }),
  // Display / heading face (Schibsted Grotesk)
  display: 'SchibstedGrotesk-SemiBold',
  displayBold: 'SchibstedGrotesk-Bold',
} as const;

export const FontSize = {
  overline: 11,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  display: 40,
  '5xl': 48,
} as const;

export const LineHeight = {
  tight: 1.15,
  snug: 1.3,
  normal: 1.5,
  relaxed: 1.6,
  loose: 1.9,
} as const;

/** Letter-spacing tokens (absolute px, RN-style). */
export const LetterSpacing = {
  tighter: -0.6,
  tight: -0.3,
  normal: 0,
  wide: 0.3,
  wider: 0.8,
  overline: 1.2,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Pre-defined text styles. Headings use the display face + tight tracking;
// body/labels use Inter for legibility.
export const TextStyles = {
  display: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize.display,
    lineHeight: FontSize.display * LineHeight.tight,
    letterSpacing: LetterSpacing.tighter,
  },
  h1: {
    fontFamily: FontFamily.displayBold,
    fontSize: FontSize['3xl'],
    lineHeight: FontSize['3xl'] * LineHeight.tight,
    letterSpacing: LetterSpacing.tight,
  },
  h2: {
    fontFamily: FontFamily.display,
    fontSize: FontSize['2xl'],
    lineHeight: FontSize['2xl'] * LineHeight.snug,
    letterSpacing: LetterSpacing.tight,
  },
  h3: {
    fontFamily: FontFamily.display,
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * LineHeight.snug,
    letterSpacing: LetterSpacing.tight,
  },
  h4: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.lg,
    lineHeight: FontSize.lg * LineHeight.snug,
  },
  title: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.snug,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.normal,
  },
  bodySmall: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * LineHeight.normal,
  },
  overline: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.overline,
    lineHeight: FontSize.overline * LineHeight.normal,
    letterSpacing: LetterSpacing.overline,
    textTransform: 'uppercase' as const,
  },
  button: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.tight,
    letterSpacing: LetterSpacing.wide,
  },
  buttonSmall: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.tight,
    letterSpacing: LetterSpacing.wide,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
  },
} as const;
