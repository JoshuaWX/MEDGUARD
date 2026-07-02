/**
 * MedGuard Theme - Main Export
 */

export { Colors, LightColors, DarkColors, useThemedColors, type ColorKey } from './colors';
export { Spacing, type SpacingKey } from './spacing';
export { FontFamily, FontSize, LineHeight, LetterSpacing, FontWeight, TextStyles } from './typography';
export { BorderRadius, type BorderRadiusKey } from './borderRadius';
export { Shadows, type ShadowKey } from './shadows';
export { Duration, Delay, CustomEasing } from './animations';

// Gradient definitions ("Calm Clinical" — deep teal accent, near-flat backgrounds).
// Gradients are used sparingly now; backgrounds are effectively flat neutrals.
export const Gradients = {
  primary: {
    colors: ['#0E8A9C', '#0B7C8C', '#086876'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  primaryVertical: {
    colors: ['#0E8A9C', '#086876'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  welcomeHero: {
    colors: ['#0B7C8C', '#086876', '#065663'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  signinHero: {
    colors: ['#0B7C8C', '#086876'],
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
  },
  alertsHero: {
    colors: ['#0B7C8C', '#0A5F6C'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  healthHeader: {
    colors: ['#0E8A9C', '#0B7C8C', '#086876'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  fab: {
    colors: ['#0E8A9C', '#086876'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  amber: {
    colors: ['#E0952B', '#C77A0A'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  danger: {
    colors: ['#E24A4A', '#DC3B3B'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  background: {
    colors: ['#F7F9FA', '#F2F6F7', '#FFFFFF'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  backgroundDark: {
    colors: ['#0A0F13', '#0C141A', '#101A20'],
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
} as const;
