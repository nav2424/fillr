/**
 * buildProfileMatches.ts
 *
 * Takes a DietaryProfile and a list of decoded ingredient names,
 * and returns the sensitivityMatches, goalMatches, goalConflicts,
 * and avoidingMatches arrays that feed into calculateFillrFit.
 */

import type { DietaryProfile } from '../types'
import {
  SENSITIVITY_SIGNALS,
  PREFERENCE_SIGNALS,
  GOAL_SIGNALS,
  AVOIDING_SIGNALS,
  UNDETECTABLE_AVOIDING_KEYS,
} from './profileSignals'

export interface ProfileMatchResult {
  sensitivityMatches: string[]
  goalMatches: string[]
  goalConflicts: string[]
  avoidingMatches: string[]
  undetectableAvoiding: string[]
  sensitivityPenalty: number
  preferenceBoost: number
  preferencePenalty: number
}

function normalizeKey(raw: string): string {
  return String(raw || '').toLowerCase().trim().replace(/[\s-]+/g, '_')
}

function normalizePreferenceKey(raw: string): string {
  const k = normalizeKey(raw)
  if (PREFERENCE_SIGNALS[k]) return k
  const aliases: Record<string, string> = {
    keto: 'low_carb',
    'diabetic_friendly': 'low_sugar',
    less_processed: 'less_processed',
    eat_cleaner: 'less_processed',
    eat_cleaner_less_processed: 'less_processed',
  }
  return aliases[k] ?? k
}

function normalizeGoalKey(raw: string): string {
  const k = normalizeKey(raw)
  if (GOAL_SIGNALS[k]) return k
  const aliases: Record<string, string> = {
    eat_cleaner: 'eat_cleaner',
    'eat_cleaner_': 'eat_cleaner',
  }
  return aliases[k] ?? k
}

/** Tokens inside parentheses (e.g. whey in "cheese (whey, salt)") for safety-style profile matching. */
export function extractSubIngredientsFromParentheticals(rawText: string): string[] {
  const subIngredients: string[] = []
  if (!rawText?.trim()) return subIngredients
  const matches = rawText.matchAll(/\(([^)]+)\)/g)
  for (const match of matches) {
    const inner = match[1]
    inner.split(/[,;]/).forEach((s) => {
      const cleaned = s.trim()
      if (cleaned.length > 1) subIngredients.push(cleaned)
    })
  }
  return subIngredients
}

function mergeIngredientNamesForSignals(
  ingredientNames: string[],
  rawIngredientText?: string
): string[] {
  const parenSubs = rawIngredientText?.trim()
    ? extractSubIngredientsFromParentheticals(rawIngredientText)
    : []
  const merged = [...ingredientNames, ...parenSubs]
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of merged) {
    const k = String(n || '')
      .toLowerCase()
      .trim()
    if (!k || seen.has(k)) continue
    seen.add(k)
    out.push(String(n).trim())
  }
  return out
}

export function buildProfileMatches(
  profile: DietaryProfile,
  ingredientNames: string[],
  rawIngredientText?: string
): ProfileMatchResult {
  const sensitivityMatches: string[] = []
  const goalMatches: string[] = []
  const goalConflicts: string[] = []
  const avoidingMatches: string[] = []
  const undetectableAvoiding: string[] = []
  let sensitivityPenalty = 0
  let preferenceBoost = 0
  let preferencePenalty = 0

  const allNames = mergeIngredientNamesForSignals(ingredientNames, rawIngredientText)

  // -- Sensitivities ---------------------------------------------------------
  for (const sensitivityKeyRaw of profile.sensitivities ?? []) {
    const sensitivityKey = normalizeKey(sensitivityKeyRaw)
    // Skip if this sensitivity is already covered by an allergy
    if ((profile.allergies ?? []).some((a) => normalizeKey(a) === sensitivityKey)) continue
    const signal = SENSITIVITY_SIGNALS[sensitivityKey]
    if (!signal) continue

    const triggered = allNames.some((name) => signal.ingredientPattern.test(name))
    if (triggered) {
      sensitivityMatches.push(signal.label)
      sensitivityPenalty += signal.penalty
    }
  }

  // -- Preferences -----------------------------------------------------------
  for (const prefKeyRaw of profile.preferences ?? []) {
    const prefKey = normalizePreferenceKey(prefKeyRaw)
    const signal = PREFERENCE_SIGNALS[prefKey]
    if (!signal) continue

    if (signal.matchPattern && signal.matchBoost) {
      const matchCount = allNames.filter((name) => signal.matchPattern!.test(name)).length
      if (matchCount > 0) {
        goalMatches.push(signal.label)
        preferenceBoost += matchCount * signal.matchBoost
      }
    }

    if (signal.conflictPattern && signal.conflictPenalty) {
      const conflictCount = allNames.filter((name) => signal.conflictPattern!.test(name)).length
      if (conflictCount > 0) {
        goalConflicts.push(signal.label)
        preferencePenalty += conflictCount * signal.conflictPenalty
      }
    }
  }

  // -- Goal -----------------------------------------------------------------
  if (profile.goal) {
    const goalKey = normalizeGoalKey(profile.goal)
    const signal = GOAL_SIGNALS[goalKey]
    if (signal) {
      if (signal.alignPattern && signal.alignBoost) {
        const alignCount = allNames.filter((name) => signal.alignPattern!.test(name)).length
        if (alignCount > 0) {
          goalMatches.push(signal.label)
          preferenceBoost += alignCount * signal.alignBoost
        }
      }

      if (signal.conflictPattern && signal.conflictPenalty) {
        const conflictCount = allNames.filter((name) => signal.conflictPattern!.test(name)).length
        if (conflictCount > 0) {
          goalConflicts.push(signal.label)
          preferencePenalty += conflictCount * signal.conflictPenalty
        }
      }
    }
  }

  // -- Avoiding --------------------------------------------------------------
  for (const avoidKeyRaw of profile.avoiding ?? []) {
    const avoidKey = String(avoidKeyRaw).toLowerCase().trim()
    if (UNDETECTABLE_AVOIDING_KEYS.has(avoidKey)) {
      undetectableAvoiding.push(avoidKey)
      continue
    }
    const pattern = AVOIDING_SIGNALS[avoidKey]
    if (!pattern) continue
    const triggered = allNames.some((name) => pattern.test(name))
    if (triggered) avoidingMatches.push(avoidKey)
  }

  return {
    sensitivityMatches: [...new Set(sensitivityMatches)],
    goalMatches: [...new Set(goalMatches)],
    goalConflicts: [...new Set(goalConflicts)],
    avoidingMatches: [...new Set(avoidingMatches)],
    undetectableAvoiding: [...new Set(undetectableAvoiding)],
    sensitivityPenalty,
    preferenceBoost,
    preferencePenalty,
  }
}
