import { parseIngredients } from './fillrAdapter'
import type { ScanResult, SafetyStatus } from '../types'

export type IngredientDataQualityLevel = 'high' | 'medium' | 'low'

export type IngredientDataQuality = {
  score: number
  level: IngredientDataQualityLevel
  title: string
  message: string
  /** Show scan-label / paste-ingredients CTAs */
  suggestLabelCapture: boolean
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)))
}

/**
 * Client-side label confidence from scan payload (mirrors allergen engine coverage heuristics).
 */
export function buildIngredientDataQuality(scan: ScanResult | null | undefined): IngredientDataQuality | null {
  if (!scan) return null

  const storedScore =
    typeof (scan as { ingredientDataQualityScore?: number }).ingredientDataQualityScore === 'number'
      ? clamp((scan as { ingredientDataQualityScore: number }).ingredientDataQualityScore)
      : null

  const text = scan.product.ingredientText?.trim() ?? ''
  const lineCount = text ? parseIngredients(text, scan.scanSource === 'ocr' ? 'ocr' : 'barcode').length : 0
  const hasTags =
    (scan.product.allergensTags?.length ?? 0) > 0 || (scan.product.tracesTags?.length ?? 0) > 0
  const hasDeclared = Boolean(scan.declaredAllergensLabel?.trim())
  const hasCrossContact = (scan.crossContactWarnings?.length ?? 0) > 0

  let score = storedScore ?? 0
  if (storedScore == null) {
    if (text.length >= 80) score += 45
    else if (text.length >= 40) score += 28
    else if (text.length >= 20) score += 12
    if (lineCount >= 8) score += 25
    else if (lineCount >= 4) score += 16
    else if (lineCount >= 2) score += 8
    if (hasTags) score += 18
    if (hasDeclared) score += 10
    if (hasCrossContact) score += 6
    score = clamp(score)
  }

  const status: SafetyStatus = scan.safetyStatus
  if (status === 'UNKNOWN') {
    score = Math.min(score, 35)
  }

  const level: IngredientDataQualityLevel =
    score >= 72 ? 'high' : score >= 45 ? 'medium' : 'low'

  const suggestLabelCapture = level === 'low' || status === 'UNKNOWN'

  if (level === 'high') {
    return {
      score,
      level,
      title: 'Strong label data',
      message:
        'Fillr had a detailed ingredient list plus structured allergen signals to run this scan.',
      suggestLabelCapture: false,
    }
  }

  if (level === 'medium') {
    return {
      score,
      level,
      title: 'Moderate label data',
      message:
        'The database entry had usable ingredients, but a photo of the physical label can still catch typos or recent reformulations.',
      suggestLabelCapture: status === 'UNKNOWN',
    }
  }

  return {
    score,
    level,
    title: status === 'UNKNOWN' ? 'Insufficient label data' : 'Limited label data',
    message:
      status === 'UNKNOWN'
        ? 'We could not read a reliable ingredient list for this barcode. Scan the label or paste ingredients before trusting a safety call.'
        : 'This product had a thin or incomplete ingredient record. Verify the package label — especially for allergy decisions.',
    suggestLabelCapture: true,
  }
}
