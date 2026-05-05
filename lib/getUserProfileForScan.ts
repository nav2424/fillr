/**
 * Profile used for ingredient analysis: AsyncStorage profile, with zustand fallback.
 */

import { useUserStore } from '../store/userStore'
import { PRESET_ALLERGIES } from '../constants/dietProfilePresets'
import type { DietaryProfile } from '../types'
import { PREFERENCE_OPTIONS, SENSITIVITY_OPTIONS } from '../types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getUserProfile } = require('../store/userProfileStore.js') as {
  getUserProfile: () => Promise<DietaryProfile>
}

const ZUSTAND_SENS_TO_SLUG: Record<string, string> = {
  lactose: 'lactose',
  gluten_sensitivity: 'gluten',
  artificial_sweeteners: 'artificial sweeteners',
  high_sodium: 'msg',
  msg: 'msg',
  sulfites: 'sulfites',
}

const ZUSTAND_PREF_TO_DIET_SLUG: Record<string, string> = {
  vegan: 'vegan',
  vegetarian: 'vegetarian',
  high_protein: 'keto',
  low_sugar: 'diabetic-friendly',
  low_carb: 'keto',
  low_calorie: 'diabetic-friendly',
  plant_based: 'vegan',
  less_processed: 'paleo',
}

function hasAny(p: DietaryProfile): boolean {
  return (
    p.allergies.length > 0 ||
    p.sensitivities.length > 0 ||
    p.avoiding.length > 0 ||
    p.preferences.length > 0 ||
    Boolean(typeof p.goal === 'string' && p.goal.trim().length > 0) ||
    p.celiacStrictGluten === true
  )
}

/** Map onboarding allergy keys → matcher slugs (e.g. milk → dairy). */
export function allergyKeyToSlug(key: string): string | null {
  const k = key.toLowerCase().trim()
  const preset = PRESET_ALLERGIES.find((a) => a.userStoreAllergyKey === k)
  if (preset) return preset.slug
  if (k === 'wheat') return 'gluten'
  if (PRESET_ALLERGIES.some((a) => a.slug === k)) return k
  return k
}

export function sensitivityKeyToSlug(key: string): string {
  return ZUSTAND_SENS_TO_SLUG[key] ?? key.toLowerCase().replace(/_/g, ' ')
}

export function preferenceKeyToSlug(key: string): string {
  return ZUSTAND_PREF_TO_DIET_SLUG[key] ?? key.toLowerCase().replace(/_/g, ' ')
}

/** Normalize diet preset slugs from `edit-preferences` / AsyncStorage for comparisons. */
function normDietSlug(s: string): string {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Map a diet-preset slug (e.g. from `PRESET_SENSITIVITIES`) to a `useUserStore` sensitivity key.
 * The old partial map dropped most selections so the home watchlist stayed empty.
 */
export function dietSlugToSensitivityKey(slug: string): string | undefined {
  const n = normDietSlug(slug)
  const legacy: Record<string, string> = {
    lactose: 'lactose',
    msg: 'msg',
    gluten: 'gluten_sensitivity',
    'artificial sweeteners': 'artificial_sweeteners',
    sulfites: 'sulfites',
  }
  if (legacy[n]) return legacy[n]
  for (const o of SENSITIVITY_OPTIONS) {
    if (normDietSlug(sensitivityKeyToSlug(o.key)) === n) return o.key
  }
  const asKey = n.replace(/\s+/g, '_').replace(/-/g, '_')
  if (SENSITIVITY_OPTIONS.some((o) => o.key === asKey)) return asKey
  return undefined
}

/**
 * Map a diet-preset slug (e.g. from `PRESET_PREFERENCES`) to a `useUserStore` preference key.
 */
export function dietSlugToPreferenceKey(slug: string): string | undefined {
  const n = normDietSlug(slug)
  for (const o of PREFERENCE_OPTIONS) {
    if (normDietSlug(preferenceKeyToSlug(o.key)) === n) return o.key
  }
  const asKey = n.replace(/\s+/g, '_').replace(/-/g, '_')
  if (PREFERENCE_OPTIONS.some((o) => o.key === asKey)) return asKey
  return undefined
}

/**
 * Older saves wrote preset slugs to disk but `handleDone` dropped most keys when syncing Zustand.
 * If the store is still empty while disk has selections, hydrate once so the home watchlist can render.
 */
export async function repairUserStoreSensitivitiesPreferencesFromDisk(): Promise<void> {
  try {
    const stored = await getUserProfile()
    const z = useUserStore.getState()
    const zSens = [
      ...new Set(
        stored.sensitivities
          .map((s) => dietSlugToSensitivityKey(String(s)))
          .filter((x): x is string => Boolean(x))
      ),
    ]
    const zPrefs = [
      ...new Set(
        stored.preferences
          .map((s) => dietSlugToPreferenceKey(String(s)))
          .filter((x): x is string => Boolean(x))
      ),
    ]
    if (zSens.length > 0 && z.sensitivities.length === 0) {
      useUserStore.getState().setSensitivities(zSens)
    }
    if (zPrefs.length > 0 && z.preferences.length === 0) {
      useUserStore.getState().setPreferences(zPrefs)
    }
  } catch {
    /* ignore */
  }
}

export async function getUserProfileForScan(): Promise<DietaryProfile> {
  const stored = await getUserProfile()
  if (hasAny(stored)) {
    const z = useUserStore.getState()
    const storedGoal = typeof stored.goal === 'string' ? stored.goal.trim() : ''
    return {
      allergies: stored.allergies.map((a) => String(a).toLowerCase().trim()).filter(Boolean),
      sensitivities: stored.sensitivities.map((a) => String(a).toLowerCase().trim()).filter(Boolean),
      avoiding: stored.avoiding.map((a) => String(a).toLowerCase().trim()).filter(Boolean),
      preferences: stored.preferences.map((a) => String(a).toLowerCase().trim()).filter(Boolean),
      scoringPreferenceKeys: [...stored.preferences.map((a) => String(a).toLowerCase().trim())],
      goal: storedGoal || (z.goal ?? '').trim() || undefined,
      celiacStrictGluten:
        typeof stored.celiacStrictGluten === 'boolean'
          ? stored.celiacStrictGluten
          : Boolean(z.celiacStrictGluten),
    }
  }

  const z = useUserStore.getState()
  const allergies = z.allergies.map(allergyKeyToSlug).filter((x): x is string => Boolean(x))
  const sensitivities = z.sensitivities.map(sensitivityKeyToSlug)
  const preferences = z.preferences.map(preferenceKeyToSlug)
  const zGoal = (z.goal ?? '').trim()

  return {
    allergies: [...new Set(allergies)],
    sensitivities: [...new Set(sensitivities)],
    avoiding: [],
    preferences: [...new Set(preferences)],
    scoringPreferenceKeys: [...z.preferences.map((k) => String(k).toLowerCase().trim())],
    ...(zGoal ? { goal: zGoal } : {}),
    celiacStrictGluten: Boolean(z.celiacStrictGluten),
  }
}

export function isProfileEmpty(p: DietaryProfile): boolean {
  return !hasAny(p)
}

/**
 * Zustand-only profile for synchronous rescoring on screens (AsyncStorage avoiding omitted).
 */
export function getDietProfileSnapshotSync(): DietaryProfile {
  const z = useUserStore.getState()
  const allergies = z.allergies.map(allergyKeyToSlug).filter((x): x is string => Boolean(x))
  const sensitivities = z.sensitivities.map(sensitivityKeyToSlug)
  const preferences = z.preferences.map(preferenceKeyToSlug)
  const zGoal = (z.goal ?? '').trim()

  return {
    allergies: [...new Set(allergies)],
    sensitivities: [...new Set(sensitivities)],
    avoiding: [],
    preferences: [...new Set(preferences)],
    scoringPreferenceKeys: [...z.preferences.map((k) => String(k).toLowerCase().trim())],
    ...(zGoal ? { goal: zGoal } : {}),
    celiacStrictGluten: Boolean(z.celiacStrictGluten),
  }
}
