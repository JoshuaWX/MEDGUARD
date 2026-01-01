/**
 * MedGuard Theme - Typography
 * Preserves exact typography from web (Inter font family)
 */

import { Platform } from 'react-native';

export const FontFamily = {
  regular: Platform.select({
    ios: 'Inter-Regular',
    android: 'Inter-Regular',
    default: 'Inter',
  }),
  medium: Platform.select({
    ios: 'Inter-Medium',
    android: 'Inter-Medium',
    default: 'Inter',
  }),
  semibold: Platform.select({
    ios: 'Inter-SemiBold',
    android: 'Inter-SemiBold',
    default: 'Inter',
  }),
  bold: Platform.select({
    ios: 'Inter-Bold',
    android: 'Inter-Bold',
    default: 'Inter',
  }),
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
} as const;

export const LineHeight = {
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 2,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

// Pre-defined text styles matching web
export const TextStyles = {
  h1: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['4xl'],
    lineHeight: FontSize['4xl'] * LineHeight.tight,
    fontWeight: FontWeight.bold,
  },
  h2: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize['2xl'],
    lineHeight: FontSize['2xl'] * LineHeight.tight,
    fontWeight: FontWeight.bold,
  },
  h3: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * LineHeight.snug,
    fontWeight: FontWeight.bold,
  },
  h4: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    lineHeight: FontSize.lg * LineHeight.snug,
    fontWeight: FontWeight.bold,
  },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.normal,
    fontWeight: FontWeight.regular,
  },
  bodySmall: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
    fontWeight: FontWeight.regular,
  },
  caption: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * LineHeight.normal,
    fontWeight: FontWeight.regular,
  },
  button: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    lineHeight: FontSize.base * LineHeight.tight,
    fontWeight: FontWeight.bold,
  },
  buttonSmall: {
    fontFamily: FontFamily.semibold,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.tight,
    fontWeight: FontWeight.semibold,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * LineHeight.normal,
    fontWeight: FontWeight.medium,
  },
} as const;
