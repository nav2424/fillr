/**
 * Map Zustand onboarding keys → dietary profile slugs for AsyncStorage (same as scan pipeline).
 */

import { useUserStore } from '../store/userStore'
import type { DietaryProfile } from '../types'
import {
  allergyKeyToSlug,
  preferenceKeyToSlug,
  sensitivityKeyToSlug,
} from './getUserProfileForScan'

/** True if AsyncStorage has dietary choices saved (after onboarding questions). */
export function hasMeaningfulLocalDietProfile(
  p: {
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
  } | null
): boolean {
  if (!p) return false
  return (
    p.allergies.length + p.sensitivities.length + p.avoiding.length + p.preferences.length > 0
  )
}

function mergeUnique(xs: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of xs) {
    const n = String(x).toLowerCase().trim()
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/** Build profile from current user store (onboarding selections use the same keys). */
export function buildDietaryProfileFromZustand(): DietaryProfile {
  const z = useUserStore.getState()
  const allergies = mergeUnique(
    z.allergies.map((k) => allergyKeyToSlug(k)).filter((x): x is string => Boolean(x))
  )
  const sensitivities = mergeUnique(z.sensitivities.map(sensitivityKeyToSlug))
  const preferences = mergeUnique(z.preferences.map(preferenceKeyToSlug))
  return {
    allergies,
    sensitivities,
    avoiding: [],
    preferences,
    goal: z.goal || '',
    celiacStrictGluten: Boolean(z.celiacStrictGluten),
  }
}
