/**
 * MedGuard Theme - Main Export
 */

export { Colors, LightColors, DarkColors, useThemedColors, type ColorKey } from './colors';
export { Spacing, type SpacingKey } from './spacing';
export { FontFamily, FontSize, LineHeight, FontWeight, TextStyles } from './typography';
export { BorderRadius, type BorderRadiusKey } from './borderRadius';
export { Shadows, type ShadowKey } from './shadows';
export { Duration, Delay, CustomEasing } from './animations';

// Gradient definitions for LinearGradient component
export const Gradients = {
  primary: {
    colors: ['#11b4d4', '#0d8fa9'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  primaryVertical: {
    colors: ['#11b4d4', '#0d8fa9'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  welcomeHero: {
    colors: ['rgba(17, 180, 212, 0.9)', 'rgba(13, 143, 169, 0.78)', 'rgba(246, 248, 248, 0.96)'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  signinHero: {
    colors: ['rgba(17, 180, 212, 0.92)', 'rgba(13, 143, 169, 0.82)'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  alertsHero: {
    colors: ['rgba(17, 180, 212, 0.9)', 'rgba(239, 68, 68, 0.8)'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  healthHeader: {
    colors: ['#11b4d4', '#0d8fa9', '#0a6f84'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  fab: {
    colors: ['#11b4d4', '#0d8fa9'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  amber: {
    colors: ['#fbbf24', '#f97316'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  danger: {
    colors: ['#ef4444', '#dc2626'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  background: {
    colors: ['#f8fafc', 'rgba(236, 254, 255, 0.5)', 'rgba(240, 253, 250, 0.3)'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  backgroundDark: {
    colors: ['#0f1419', '#152028', '#1a2632'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
} as const;
