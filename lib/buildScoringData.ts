/**
 * Builds deterministic scoring input from a ScanResult + profile.
 */

import type { DietaryProfile, IngredientExplanation, IngredientRating, ScanResult } from '../types'
import { runCeliacCheck, getCeliacSeverity } from './allergenEngine/matcher'
import type { FillrScoringInput } from './fillrScoring'
import { buildProfileMatches } from './buildProfileMatches'

function ratingOf(i: IngredientExplanation): IngredientRating {
  return (i.ingredientRating ?? 'okay') as IngredientRating
}

function normName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[#'"().]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildScoringData(
  scanResult: ScanResult,
  ingredients: IngredientExplanation[],
  profile: DietaryProfile
): FillrScoringInput {
  const ingredientCounts = {
    natural: ingredients.filter((i) => ratingOf(i) === 'clean').length,
    processed: ingredients.filter((i) => ratingOf(i) === 'okay').length,
    additive: ingredients.filter((i) => ratingOf(i) === 'concerning').length,
    flagged: ingredients.filter((i) => ratingOf(i) === 'avoid').length,
  }

  const totalIngredients = ingredients.length

  const allergyFromFlags = ingredients
    .filter((i) => i.personalFlag === 'allergy')
    .map((i) => {
      const msg = i.personalMessage
      if (msg) {
        const stripped = msg.replace(/^⚠️\s*Contains\s+/i, '').split(/\s—/)[0]?.trim()
        if (stripped) return stripped
      }
      return i.name
    })

  const allergyFromScan = scanResult.matchedAllergens.map((m) => m.allergenName).filter(Boolean)

  const allergyMatches = [...new Set([...allergyFromScan, ...allergyFromFlags])]

  let celiacSeverity: 'SAFE' | 'CAUTION' | 'AVOID' = 'SAFE'
  if (profile.celiacStrictGluten) {
    if (scanResult.celiac?.celiacModeEnabled) {
      celiacSeverity = scanResult.celiac.celiacSeverity
    } else {
      const safety = scanResult.product.ingredientTextSafetyHaystack?.trim()
      const display = scanResult.product.ingredientText ?? ''
      const haystack = safety && safety.length > 0 ? safety : display
      const segments = haystack.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      const celiacMatches = runCeliacCheck(segments, haystack)
      celiacSeverity = getCeliacSeverity(celiacMatches)
    }
  }

  const sensitivityFromIngredients = ingredients
    .filter((i) => i.personalFlag === 'sensitivity')
    .map((i) => i.name)

  const sensitivityFromScan = scanResult.matchedSensitivities.map((m) => m.sensitivityName)

  const sensitivityMatches = [
    ...new Set([...sensitivityFromIngredients, ...sensitivityFromScan]),
  ]

  const normalizedNames = ingredients.map((i) => normName(i.name))
  const eNumberCount = normalizedNames.filter((n) => /\be\d{3}[a-z]{0,3}\b/i.test(n)).length
  const genericFunctionalTermCount = normalizedNames.filter((n) =>
    /\bstabiliser(s)?\b|\bemulsifier(s)?\b|\bacidity regulator(s)?\b|\banticaking agent\b|\bflavouring(s)?\b|\bflavoring(s)?\b/.test(
      n
    )
  ).length
  const industrialSweetenerCount = normalizedNames.filter((n) =>
    /\bglucose syrup\b|\bglucose fructose syrup\b|\bglucose-fructose syrup\b|\bhigh fructose corn syrup\b|\bhfcs\b|\bcorn syrup\b|\bfructose syrup\b/.test(
      n
    )
  ).length
  const hydrogenatedOilCount = normalizedNames.filter((n) =>
    /\bhydrogenated\b|\bpartially hydrogenated\b/.test(n)
  ).length

  const profileHaystack =
    scanResult.product.ingredientTextSafetyHaystack?.trim() ||
    scanResult.product.ingredientText ||
    ''

  const profileMatches = buildProfileMatches(
    {
      ...profile,
      preferences: profile.scoringPreferenceKeys?.length
        ? [...profile.scoringPreferenceKeys]
        : [...(profile.preferences ?? [])],
    },
    ingredients.map((i) => i.name),
    profileHaystack
  )

  return {
    allergyMatches,
    celiacSeverity,
    sensitivityMatches: profileMatches.sensitivityMatches.length
      ? profileMatches.sensitivityMatches
      : sensitivityMatches,
    avoidingMatches: profileMatches.avoidingMatches,
    goalMatches: profileMatches.goalMatches,
    goalConflicts: profileMatches.goalConflicts,
    ingredientCounts,
    totalIngredients,
    eNumberCount,
    genericFunctionalTermCount,
    industrialSweetenerCount,
    hydrogenatedOilCount,
  }
}
