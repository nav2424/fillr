/**
 * Map Zustand onboarding keys to dietary profile slugs for AsyncStorage.
 */

import { useUserStore } from '../store/userStore'
import type { DietaryProfile } from '../types'
import {
  allergyKeyToSlug,
  preferenceKeyToSlug,
  sensitivityKeyToSlug,
} from './getUserProfileForScan'

/** True if AsyncStorage has dietary choices saved after onboarding questions. */
export function hasMeaningfulLocalDietProfile(
  p: {
    allergies: string[]
    sensitivities: string[]
    avoiding: string[]
    preferences: string[]
    goal?: string
    celiacStrictGluten?: boolean
  } | null
): boolean {
  if (!p) return false
  return (
    p.allergies.length +
      p.sensitivities.length +
      p.avoiding.length +
      p.preferences.length >
      0 ||
    Boolean(typeof p.goal === 'string' && p.goal.trim()) ||
    p.celiacStrictGluten === true
  )
}

function mergeUnique(xs: Array<string | null | undefined>): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of xs) {
    const n = String(x ?? '').toLowerCase().trim()
    if (!n || seen.has(n)) continue
    seen.add(n)
    out.push(n)
  }
  return out
}

/** Build persisted dietary profile from current onboarding selections. */
export function buildDietaryProfileFromZustand(): DietaryProfile {
  const z = useUserStore.getState()
  return {
    allergies: mergeUnique(z.allergies.map(allergyKeyToSlug)),
    sensitivities: mergeUnique(z.sensitivities.map(sensitivityKeyToSlug)),
    avoiding: [],
    preferences: mergeUnique(z.preferences.map(preferenceKeyToSlug)),
    goal: z.goal || '',
    celiacStrictGluten: Boolean(z.celiacStrictGluten),
    scoringPreferenceKeys: mergeUnique(z.preferences),
  }
}
