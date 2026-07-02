import type { DietaryProfile } from '../types'
import { getDietProfileSnapshotSync, isProfileEmpty } from './getUserProfileForScan'

export function buildDietaryProfileFromZustand(): DietaryProfile {
  return getDietProfileSnapshotSync()
}

export function hasMeaningfulLocalDietProfile(profile: Partial<DietaryProfile> | null | undefined): boolean {
  if (!profile) return false
  return !isProfileEmpty({
    allergies: Array.isArray(profile.allergies) ? profile.allergies : [],
    sensitivities: Array.isArray(profile.sensitivities) ? profile.sensitivities : [],
    avoiding: Array.isArray(profile.avoiding) ? profile.avoiding : [],
    preferences: Array.isArray(profile.preferences) ? profile.preferences : [],
    goal: typeof profile.goal === 'string' ? profile.goal : undefined,
    celiacStrictGluten: profile.celiacStrictGluten === true,
  })
}
