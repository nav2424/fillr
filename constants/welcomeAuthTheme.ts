/**
 * Welcome / sign-in — white canvas, high-contrast ink, Fillr green as precision accent.
 */

export const wa = {
  bg: '#FFFFFF',

  card: '#FFFFFF',
  cardBorder: 'rgba(15, 23, 42, 0.07)',

  ink: '#0B1220',
  slate: '#5C6678',
  muted: '#94A3B8',

  accent: '#22C55E',
  accentBright: '#4ADE80',
  accentDeep: '#15803D',
  accentMuted: 'rgba(34, 197, 94, 0.12)',
  accentSoft: 'rgba(34, 197, 94, 0.18)',

  border: 'rgba(15, 23, 42, 0.09)',
  inputBg: '#F4F6F8',

  danger: '#DC2626',

  radiusLg: 26,
  radiusMd: 16,
  radiusPill: 999,

  padX: 22,

  shadowCard: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.09,
    shadowRadius: 36,
    elevation: 6,
  },
  shadowButton: {
    shadowColor: '#16A34A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.35,
    shadowRadius: 22,
    elevation: 6,
  },
  shadowCtaRow: {
    shadowColor: '#0B1220',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
} as const

/** Primary CTA gradient (left → right, slightly “lit” top edge). */
export const waButtonGradient = ['#4ADE80', '#22C55E', '#16A34A'] as const

/** Auth card edge wash — reads as precision instrument, not decoration. */
export const waCardEdgeGradient = [
  'rgba(34, 197, 94, 0.55)',
  'rgba(15, 23, 42, 0.14)',
  'rgba(34, 197, 94, 0.35)',
] as const

export const waType = {
  eyebrow: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 2.4,
    color: wa.slate,
    textAlign: 'center' as const,
  },
  heroDisplay: {
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -1.1,
    lineHeight: 34,
    color: wa.ink,
    textAlign: 'center' as const,
  },
  heroAccent: {
    color: wa.accent,
    fontWeight: '800' as const,
  },
  heroSub: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
    color: wa.slate,
    textAlign: 'center' as const,
  },
  footer: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 18,
    color: wa.muted,
    textAlign: 'center' as const,
  },
  ctaTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    letterSpacing: -0.35,
    color: wa.ink,
  },
  ctaBody: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: wa.slate,
    marginTop: 2,
  },
} as const
