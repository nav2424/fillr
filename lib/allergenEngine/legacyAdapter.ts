// Adapter: Convert evidence-based engine output to legacy AllergenCheckResult
// For backward compatibility (optional)

import type { DetectionOutput } from './types'

export interface LegacyAllergenCheckResult {
  hasAllergens: boolean
  detectedAllergens: string[]
  userAllergens: string[]
  riskLevel: 'HIGH_RISK' | 'POSSIBLE_RISK' | 'NO_MATCH_FOUND' | 'INSUFFICIENT_DATA'
  matches: Array<{ allergen: string; matchedTerm: string; source: string; confidence: string }>
  message: string
  scannedText?: {
    ingredientsText?: string
    allergensText?: string
    tracesText?: string
    productName?: string
  }
  fallbackCtas?: {
    scanLabelPhoto?: boolean
    pasteIngredientsManually?: boolean
  }
  /** 0-100 OFF completeness; when UNKNOWN and <60, show "OFF data incomplete" */
  sourceCoverageScore?: number
}

export function toLegacyAllergenCheckResult(
  output: DetectionOutput,
  userAllergens: string[]
): LegacyAllergenCheckResult {
  const { overall_status, matched_allergens, scan_log, fallback_ctas } = output

  const riskLevel = (() => {
    if (overall_status === 'UNKNOWN') return 'INSUFFICIENT_DATA'
    if (overall_status === 'CONTAINS') return 'HIGH_RISK'
    if (overall_status === 'MAY_CONTAIN') return 'POSSIBLE_RISK'
    return 'NO_MATCH_FOUND'
  })()

  const detectedAllergens = Array.from(new Set(matched_allergens.map(m => m.allergen_name)))

  const matches = matched_allergens.map(m => ({
    allergen: m.allergen_name,
    allergenId: m.allergen_id,
    matchedTerm: m.match_text,
    source: sectionToSource(m.section),
    confidence: m.severity === 'CONTAINS' ? 'HIGH' : 'MEDIUM',
  }))

  let message: string
  if (overall_status === 'UNKNOWN') {
    message = 'Ingredients unavailable; cannot verify allergens.'
    if (fallback_ctas?.scan_label_photo || fallback_ctas?.paste_ingredients_manually) {
      message += ' Scan label photo to check.'
    }
  } else if (overall_status === 'CONTAINS') {
    message = `Contains: ${detectedAllergens.join(', ')}`
  } else if (overall_status === 'MAY_CONTAIN') {
    message = `May contain: ${detectedAllergens.join(', ')}`
  } else {
    message = 'No allergens found. Safe for your household.'
  }

  return {
    hasAllergens: overall_status === 'CONTAINS' || overall_status === 'MAY_CONTAIN',
    detectedAllergens,
    userAllergens,
    riskLevel,
    matches,
    message,
    scannedText: {
      ingredientsText: scan_log.ingredients_text_used,
      allergensText: scan_log.contains_text_used,
      tracesText: scan_log.may_contain_text_used,
      productName: undefined,
    },
    fallbackCtas: overall_status === 'UNKNOWN' ? {
      scanLabelPhoto: fallback_ctas?.scan_label_photo ?? true,
      pasteIngredientsManually: fallback_ctas?.paste_ingredients_manually ?? true,
    } : undefined,
    sourceCoverageScore: scan_log.source_coverage_score,
  }
}

function sectionToSource(section: string): 'ingredients' | 'allergens' | 'traces' | 'product_name' {
  if (section === 'contains') return 'allergens'
  if (section === 'may_contain') return 'traces'
  return 'ingredients'
}

