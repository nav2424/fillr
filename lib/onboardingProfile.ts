import { useUserStore } from '../store/userStore'
import type { DietaryProfile } from '../types'

export function buildDietaryProfileFromZustand(): DietaryProfile {
  const state = useUserStore.getState()
  return {
    allergies: [...state.allergies],
    sensitivities: [...state.sensitivities],
    avoiding: [],
    preferences: [...state.preferences],
    goal: state.goal,
    celiacStrictGluten: state.celiacStrictGluten,
  }
}

export function hasMeaningfulLocalDietProfile(
  profile:
    | Pick<DietaryProfile, 'allergies' | 'sensitivities' | 'avoiding' | 'preferences'> &
        Partial<Pick<DietaryProfile, 'goal' | 'celiacStrictGluten'>>
    | null
    | undefined
): boolean {
  if (!profile) return false
  return Boolean(
    profile.allergies.length > 0 ||
      profile.sensitivities.length > 0 ||
      profile.avoiding.length > 0 ||
      profile.preferences.length > 0 ||
      profile.goal ||
      profile.celiacStrictGluten
  )
}
