/**
 * Fillr Design System
 * Light, liquid glass, aesthetic & professional
 */

/** Scan result & product screen tokens (approved mockup). */
export const theme = {
  // Background
  screenBg: '#f7fcf8',

  // Text
  textPrimary: '#0f172a',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textFaint: '#9ca3af',
  textDisabled: '#d1d5db',

  // Green scale
  green900: '#14532d',
  green800: '#15803d',
  green700: '#16a34a',
  green500: '#22c55e',
  green100: '#dcfce7',
  green50: '#f0fdf4',
  greenTrack: '#e9f5ea',
  greenTabBg: '#edf7ee',
  greenBorder: '#bbf7d0',

  // Semantic rating colors
  natural: { text: '#16a34a', bg: '#f0fdf4', accent: '#22c55e' },
  processed: { text: '#d97706', bg: '#fffbeb', accent: '#f59e0b' },
  additive: { text: '#ea580c', bg: '#fff7ed', accent: '#f97316' },
  flagged: { text: '#dc2626', bg: '#fee2e2', accent: '#ef4444' },

  // Allergen warning
  allergenBg: '#fffbeb',
  allergenBorder: '#fde68a',
  allergenText: '#92400e',
  allergenTextStrong: '#78350f',

  // Cards
  cardBg: '#fff',
  cardBorder: '#f0f0f0',
  cardBorderOpen: '#e5e7eb',
  cardRadius: 14,

  // Spacing
  screenPadding: 16,
  heroPadding: 22,
} as const

export const colors = {
  // Backgrounds - soft, warm light
  background: '#f8f9fc',
  backgroundLightGreen: '#f0fdf4',
  backgroundElevated: '#ffffff',
  backgroundCard: 'rgba(255, 255, 255, 0.85)',
  backgroundInput: 'rgba(255, 255, 255, 0.95)',

  // Glass
  glass: 'rgba(255, 255, 255, 0.7)',
  glassBorder: 'rgba(255, 255, 255, 0.95)',
  glassShadow: 'rgba(0, 0, 0, 0.04)',

  // Text
  text: '#1a1a2e',
  textSecondary: '#5c5c6d',
  textMuted: '#8a8a9a',

  // Accents - refined green
  accent: '#22c55e',
  accentLight: '#4ade80',
  accentMuted: 'rgba(34, 197, 94, 0.12)',

  // Gradient orbs (decorative - green tones)
  gradientOrb1: '#dcfce7',
  gradientOrb2: '#ecfdf5',
  gradientOrb3: '#d1fae5',

  // Safety states
  safe: '#30d158',
  safeMuted: 'rgba(48, 209, 88, 0.12)',
  caution: '#ff9f0a',
  cautionMuted: 'rgba(255, 159, 10, 0.12)',
  danger: '#ff453a',
  dangerMuted: 'rgba(255, 69, 58, 0.12)',
  unknown: '#8e8e93',
  unknownMuted: 'rgba(142, 142, 147, 0.12)',

  // Borders
  border: 'rgba(0, 0, 0, 0.05)',
  borderStrong: 'rgba(0, 0, 0, 0.08)',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.4)',

  // Premium home (dark-sage, charcoal)
  homeBg: '#0f1419',
  homeBgElevated: '#1a2229',
  homeCard: 'rgba(26, 34, 41, 0.95)',
  homeCardBorder: 'rgba(255, 255, 255, 0.06)',
  homeText: '#f4f6f8',
  homeTextSecondary: 'rgba(244, 246, 248, 0.7)',
  homeTextMuted: 'rgba(244, 246, 248, 0.5)',
  homeAccent: '#34d399',
  homeAccentMuted: 'rgba(52, 211, 153, 0.15)',
  homeGlow: 'rgba(52, 211, 153, 0.12)',
} as const

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const

export const radius = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  full: 9999,
} as const

export const typography = {
  display: {
    fontSize: 34,
    fontWeight: '700' as const,
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 36,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    lineHeight: 28,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 24,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  labelSmall: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
  },
} as const
