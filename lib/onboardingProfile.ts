import type { DietaryProfile } from '../types'
import { useUserStore } from '../store/userStore'

type LocalDietProfile = Partial<DietaryProfile> | null | undefined

function nonEmptyList(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && item.trim().length > 0)
}

export function buildDietaryProfileFromZustand(): DietaryProfile {
  const state = useUserStore.getState()
  return {
    allergies: [...state.allergies],
    sensitivities: [...state.sensitivities],
    avoiding: [],
    preferences: [...state.preferences],
    goal: state.goal,
    celiacStrictGluten: state.celiacStrictGluten,
    scoringPreferenceKeys: [...state.preferences],
  }
}

export function hasMeaningfulLocalDietProfile(profile: LocalDietProfile): boolean {
  if (!profile) return false
  return Boolean(
    nonEmptyList(profile.allergies) ||
      nonEmptyList(profile.sensitivities) ||
      nonEmptyList(profile.avoiding) ||
      nonEmptyList(profile.preferences) ||
      (typeof profile.goal === 'string' && profile.goal.trim().length > 0) ||
      profile.celiacStrictGluten === true
  )
}
