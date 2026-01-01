/**
 * MedGuard Theme - Animation Constants
 * Preserves exact animation timings from CSS
 */

import { Easing } from 'react-native-reanimated';

// Duration constants (in milliseconds)
export const Duration = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  slower: 700,
  slowest: 1000,
  
  // Specific animation durations from CSS
  fadeIn: 500,
  slideIn: 700,
  pulse: 2000,
  float: 3000,
  shimmer: 1500,
  spin: 1000,
  bgZoom: 20000,
  
  // Welcome page intro sequence
  overlayFadeOut: 800,
  logoScaleIn: 900,
  logoMoveUp: 1200,
  titleReveal: 800,
  textSlideIn: 700,
  footerSlideIn: 800,
  iconBounceIn: 500,
  glowAppear: 500,
  glowPulse: 3000,
  celebrateRing: 800,
  ctaAttention: 2000,
  drawCheckmark: 700,
  checkmarkFill: 400,
} as const;

// Delay constants (matching CSS animation-delay)
export const Delay = {
  stagger1: 100,
  stagger2: 200,
  stagger3: 300,
  
  // Welcome page sequence delays
  introOverlay: 200,
  logoScale: 300,
  glowAppear: 500,
  logoMove: 1200,
  titleReveal: 2000,
  text2: 2250,
  text3: 2400,
  text4: 2550,
  checkmarkDraw: 2400,
  checkmarkFill: 3000,
  celebrateRing1: 3100,
  celebrateRing2: 3200,
  floatingShapes: 2800,
  footer1: 3300,
  footer2: 3500,
  footer3: 3600,
  footer4: 3700,
  footer5: 3850,
} as const;

// Easing functions matching CSS cubic-bezier
export const CustomEasing = {
  // cubic-bezier(0.34, 1.56, 0.64, 1) - Spring-like bounce
  springBounce: Easing.bezier(0.34, 1.56, 0.64, 1),
  
  // Standard easings
  easeIn: Easing.in(Easing.ease),
  easeOut: Easing.out(Easing.ease),
  easeInOut: Easing.inOut(Easing.ease),
  
  // Linear
  linear: Easing.linear,
  
  // Elastic-like
  elastic: Easing.elastic(1),
} as const;
