import type { DietaryProfile } from '../types'

type PersonalizableIngredient = {
  personalFlag?: string
  flagDriver?: string
  personalMessage?: string
  rating?: string
  ratingSource?: string
  ratingOverridden?: boolean
}

/** Remove allergy/sensitivity personalization when the user has none saved. */
export function stripPersonalizationNotInProfile<T extends PersonalizableIngredient>(
  ingredients: T[],
  profile: DietaryProfile
): T[] {
  const hasAllergies = (profile.allergies ?? []).length > 0
  const hasSensitivities = (profile.sensitivities ?? []).length > 0
  const hasAvoiding = (profile.avoiding ?? []).length > 0
  const hasPreferences = (profile.preferences ?? []).length > 0
  const hasCeliac = Boolean(profile.celiacStrictGluten)

  return ingredients.map((ing) => {
    let next = { ...ing }
    const flag = String(next.personalFlag ?? '').toLowerCase()
    const driver = String(next.flagDriver ?? '').toLowerCase()

    if (!hasAllergies && (flag === 'allergy' || driver === 'allergy')) {
      next = clearPersonalConflict(next, 'allergy')
    }
    if (!hasSensitivities && !hasCeliac && (flag === 'sensitivity' || flag === 'celiac' || driver === 'sensitivity')) {
      next = clearPersonalConflict(next, flag === 'celiac' ? 'celiac' : 'sensitivity')
    }
    if (!hasAvoiding && flag === 'avoiding') {
      next = clearPersonalConflict(next, 'avoiding')
    }
    if (!hasPreferences && (flag === 'preference_conflict' || driver === 'preference')) {
      next = clearPersonalConflict(next, 'preference_conflict')
    }

    return next
  })
}

function clearPersonalConflict<T extends PersonalizableIngredient>(
  ing: T,
  removedFlag: string
): T {
  const next = { ...ing }
  if (String(next.personalFlag ?? '').toLowerCase() === removedFlag) {
    delete next.personalFlag
    delete next.personalMessage
  }
  if (String(next.flagDriver ?? '').toLowerCase() === removedFlag.replace('_conflict', '')) {
    delete next.flagDriver
  }
  if (next.ratingSource === 'personal') {
    delete next.ratingSource
    delete next.ratingOverridden
    if (next.rating === 'avoid' || next.rating === 'concerning') {
      delete next.rating
    }
  }
  return next
}
