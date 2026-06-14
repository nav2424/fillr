import type { ScanResult } from '../types'
import { ingredientExplanationFailsQualityGate } from './ingredientCopyQuality'

export type ScanHistoryReuseProfile = {
  allergies?: readonly string[]
  celiacStrictGluten?: boolean
}

function hasSafetyCriticalProfile(profile: ScanHistoryReuseProfile): boolean {
  const hasAllergies = (profile.allergies ?? []).some((a) => String(a ?? '').trim().length > 0)
  return hasAllergies || profile.celiacStrictGluten === true
}

function hasStoredSafetySpecificState(result: ScanResult): boolean {
  if (result.matchedAllergens.length > 0) return true
  if (result.celiac?.celiacModeEnabled) return true
  return result.ingredientBreakdown.some(
    (ing) => ing.personalFlag === 'allergy' || ing.personalFlag === 'celiac'
  )
}

export function hasReusableIngredientDecode(result: ScanResult): boolean {
  if (!result.ingredientBreakdown.length) return false
  if (result.ingredientBreakdown.some((ing) => ing.aiDecodePending)) return false
  if (result.ingredientBreakdown.some((ing) => ing.ingredientDecodeStatus === 'unavailable')) return false
  if (result.ingredientBreakdown.some((ing) => ingredientExplanationFailsQualityGate(ing))) return false
  return result.ingredientBreakdown.some((ing) => {
    const text = [ing.whatItIs, ing.whatItDoes, ing.whyItsUsed, ing.labelDecoder, ing.quickSummary]
      .map((s) => s?.trim() ?? '')
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    if (!text) return false
    return !(
      text.includes('explicitly listed on the label and contributes') ||
      text.includes('contributes to the product recipe, texture, flavor, stability') ||
      text.includes('decode for') ||
      text.includes('didn\'t load this time') ||
      text.includes('didn’t load this time')
    )
  })
}

export function canReuseBarcodeHistoryResult(
  result: ScanResult,
  profile: ScanHistoryReuseProfile
): boolean {
  if (!hasReusableIngredientDecode(result)) return false
  if (hasSafetyCriticalProfile(profile)) return false
  if (hasStoredSafetySpecificState(result)) return false
  return true
}
