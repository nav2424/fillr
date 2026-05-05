/**
 * Fillr onboarding — premium surface tokens (mint field, ink type, bright CTA).
 * Scoped so tab/home theme stays unchanged.
 */

export const ob = {
  bg: '#eef8f3',
  /** Mesh gradient stops (welcome + shell) */
  bgTop: '#f6fdf9',
  bgMid: '#eef8f3',
  bgBottom: '#e6f4ed',
  bgElevated: '#f7fcfa',
  surface: '#ffffff',
  surfaceTint: 'rgba(255, 255, 255, 0.92)',
  /** Frosted cards / inputs on mint mesh */
  surfaceFrost: 'rgba(255, 255, 255, 0.78)',
  surfaceFrostStrong: 'rgba(255, 255, 255, 0.92)',

  ink: '#0a1628',
  inkMuted: '#4b5563',
  inkFaint: '#6b7280',

  /** Brand bar + highlights (aligns with app marketing) */
  accentBar: '#22C55E',

  /** Primary CTA — bright, trustworthy green */
  cta: '#16d97a',
  ctaPressed: '#12c26c',
  ctaText: '#042014',
  ctaGradient: ['#34f5a8', '#16d97a', '#0fb86a'] as const,

  accentBlue: '#0ea5e9',
  accentBlueMuted: 'rgba(14, 165, 233, 0.12)',

  allergy: '#ef4444',
  allergyMuted: 'rgba(239, 68, 68, 0.1)',
  allergyBorder: 'rgba(239, 68, 68, 0.35)',

  sensitivity: '#f59e0b',
  sensitivityMuted: 'rgba(245, 158, 11, 0.12)',
  sensitivityBorder: 'rgba(245, 158, 11, 0.4)',

  preference: '#10b981',
  preferenceMuted: 'rgba(16, 185, 129, 0.1)',
  preferenceBorder: 'rgba(16, 185, 129, 0.35)',

  border: 'rgba(10, 22, 40, 0.08)',
  borderStrong: 'rgba(10, 22, 40, 0.12)',

  radiusLg: 22,
  radiusMd: 16,
  radiusSm: 12,

  shadow: {
    card: {
      shadowColor: '#0a1628',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.06,
      shadowRadius: 24,
      elevation: 4,
    },
    soft: {
      shadowColor: '#0a1628',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
  },

  /** Vertical rhythm */
  padX: 24,
  padTop: 10,
  sectionGap: 28,
  footerGap: 12,

  /** Step screens — editorial spacing (reduces “clustered” feel) */
  step: {
    heroBottom: 36,
    sectionAfterRule: 32,
    sectionBlockBottom: 40,
    chipGap: 11,
    presetGridGap: 14,
  },
} as const

export const obType = {
  overline: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 2.2,
    lineHeight: 14,
    color: ob.inkMuted,
    textTransform: 'uppercase' as const,
    textAlign: 'center' as const,
  },
  title: {
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.6,
    lineHeight: 36,
    color: ob.ink,
  },
  /** Welcome / hero headlines */
  display: {
    fontSize: 34,
    fontWeight: '800' as const,
    letterSpacing: -1.05,
    lineHeight: 40,
    color: ob.ink,
  },
  displayAccent: {
    color: ob.accentBar,
    fontWeight: '800' as const,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
    color: ob.inkMuted,
  },
  body: {
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
    color: ob.inkMuted,
  },
  label: {
    fontSize: 14,
    fontWeight: '700' as const,
    lineHeight: 20,
    color: ob.ink,
  },
  chip: {
    fontSize: 14,
    fontWeight: '600' as const,
    lineHeight: 18,
  },
  /** Step hero — airy, left-aligned “product UI” */
  stepEyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 2.8,
    lineHeight: 14,
    color: ob.accentBar,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
  },
  heroDisplay: {
    fontSize: 30,
    fontWeight: '800' as const,
    letterSpacing: -0.85,
    lineHeight: 36,
    color: ob.ink,
    marginBottom: 12,
  },
  heroLead: {
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: -0.25,
    lineHeight: 23,
    color: ob.ink,
    marginBottom: 8,
  },
  heroDetail: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 21,
    color: ob.inkFaint,
  },
  /** Section stack — thin rule + label, not centered “poster” type */
  stepSectionLabel: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 2.4,
    lineHeight: 13,
    color: ob.inkMuted,
    textTransform: 'uppercase' as const,
    textAlign: 'left' as const,
    marginBottom: 8,
  },
  stepSectionHint: {
    fontSize: 13,
    fontWeight: '500' as const,
    lineHeight: 19,
    color: ob.inkFaint,
    textAlign: 'left' as const,
    marginBottom: 16,
  },
} as const
