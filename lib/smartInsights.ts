/**
 * Smart insights for the home screen - personalized value messaging
 */

import type { ScanRecord } from '../store/scanHistoryStore'
import { getAllergyLabel } from './knownAllergens'
import { parseScanHistoryDate } from './parseScanHistoryDate'
import type { CeliacSignal } from '../types'

/** Allergy key -> hidden ingredient examples we flag automatically */
const ALLERGY_INGREDIENT_TIPS: Record<
  string,
  { examples: string[]; allergenLabel: string }
> = {
  milk: {
    examples: ['casein', 'whey', 'sodium caseinate', 'lactose'],
    allergenLabel: 'milk',
  },
  eggs: {
    examples: ['albumin', 'lecithin', 'ovoglobulin'],
    allergenLabel: 'eggs',
  },
  wheat: {
    examples: ['malt', 'semolina', 'durum', 'modified wheat starch'],
    allergenLabel: 'wheat',
  },
  soy: {
    examples: ['soy lecithin', 'hydrolyzed soy protein', 'tofu'],
    allergenLabel: 'soy',
  },
  tree_nuts: {
    examples: ['almond flour', 'cashew butter', 'natural nut flavor'],
    allergenLabel: 'tree nuts',
  },
  peanuts: {
    examples: ['arachis oil', 'groundnut', 'peanut flour'],
    allergenLabel: 'peanuts',
  },
  fish: {
    examples: ['fish oil', 'anchovy', 'gelatin (from fish)'],
    allergenLabel: 'fish',
  },
  shellfish: {
    examples: ['shrimp paste', 'crab extract', 'glucosamine'],
    allergenLabel: 'shellfish',
  },
  sesame: {
    examples: ['tahini', 'sesame oil', 'benne'],
    allergenLabel: 'sesame',
  },
}

export interface SmartInsight {
  title: string
  description: string
  keywords: string[]
}

export function getCeliacInsight(
  celiacSeverity: 'SAFE' | 'CAUTION' | 'AVOID' | undefined,
  celiacMatches: CeliacSignal[] = []
): string | null {
  if (!celiacSeverity) return null
  if (celiacSeverity === 'AVOID') {
    return 'This product contains a direct gluten source and is not safe for celiac disease.'
  }
  if (celiacSeverity === 'CAUTION') {
    const caution = celiacMatches.find((m) => m.severity === 'CAUTION')
    if (caution?.signalType === 'OATS') {
      return 'Contains oats. These are only safe for celiac disease if certified gluten-free — check packaging for a certification logo.'
    }
    return `Celiac risk unclear — ${caution?.reason ?? 'verify certified gluten-free labeling and cross-contact risk.'}`
  }
  return null
}

export function getSmartInsight(allergies: string[]): SmartInsight {
  const firstAllergy = allergies[0]
  const tip = firstAllergy && ALLERGY_INGREDIENT_TIPS[firstAllergy]

  if (tip) {
    const [first, ...rest] = tip.examples
    const restText =
      rest.length > 0
        ? ` and "${rest[0]}"`
        : ''
    return {
      title: 'Smart insight',
      description: `Products with "${first}"${restText} contain ${tip.allergenLabel} — we flag these automatically for you.`,
      keywords: tip.examples,
    }
  }

  return {
    title: 'Smart insight',
    description:
      'Add your allergies and we\'ll automatically flag hidden ingredients. For example, "casein" and "whey" contain milk — we catch these so you don\'t have to.',
    keywords: ['casein', 'whey'],
  }
}

/** Count products avoided (UNSAFE or CAUTION) in the last 7 days */
export function getAvoidedCountThisWeek(scans: ScanRecord[]): number {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  return scans.filter((s) => {
    if (s.safetyStatus !== 'UNSAFE' && s.safetyStatus !== 'CAUTION') return false
    const scanDate = parseScanHistoryDate(s.date)
    return scanDate !== null && scanDate >= weekAgo
  }).length
}

/** Count safe scans in the last 7 days */
export function getSafeScansThisWeek(scans: ScanRecord[]): number {
  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)

  return scans.filter((s) => {
    if (s.safetyStatus !== 'SAFE') return false
    const scanDate = parseScanHistoryDate(s.date)
    return scanDate !== null && scanDate >= weekAgo
  }).length
}

export interface PersonalizedContext {
  greetingSubtext: string
  emptyStateTitle: string
  emptyStateSubtext: string
}

export function getPersonalizedContext(
  hasProfile: boolean,
  allergies: string[],
  lastScan: ScanRecord | null,
  avoidedThisWeek: number,
  safeScansThisWeek: number
): PersonalizedContext {
  if (!hasProfile) {
    return {
      greetingSubtext: 'Add your allergies to get personalized scan results',
      emptyStateTitle: 'Your first scan awaits',
      emptyStateSubtext: 'Add allergies in settings, then scan any product. We\'ll tell you instantly if it\'s safe for you.',
    }
  }

  if (avoidedThisWeek > 0) {
    return {
      greetingSubtext: `We helped you avoid ${avoidedThisWeek} risky product${avoidedThisWeek !== 1 ? 's' : ''} this week`,
      emptyStateTitle: 'No scans yet',
      emptyStateSubtext: `We're watching for ${allergies.map((a) => getAllergyLabel(a)).slice(0, 2).join(' & ')}${allergies.length > 2 ? ' and more' : ''}. Scan a product to check.`,
    }
  }

  if (safeScansThisWeek > 0) {
    return {
      greetingSubtext: `${safeScansThisWeek} safe scan${safeScansThisWeek !== 1 ? 's' : ''} this week`,
      emptyStateTitle: 'No scans yet',
      emptyStateSubtext: `We're watching for ${allergies.map((a) => getAllergyLabel(a)).slice(0, 2).join(' & ')}${allergies.length > 2 ? ' and more' : ''}. Scan to check any product.`,
    }
  }

  const allergyLabels = allergies.map((a) => getAllergyLabel(a)).slice(0, 2)
  return {
    greetingSubtext: '',
    emptyStateTitle: 'Ready for your first scan',
    emptyStateSubtext: `We'll check ingredients for ${allergyLabels.join(', ')}${allergies.length > 2 ? ' and more' : ''}. Point your camera at any barcode.`,
  }
}
