/**
 * One-tap presets for onboarding allergies step.
 * Most map to allergy keys; lactose intolerance maps to sensitivity (digestive) vs milk allergy.
 */

export interface OnboardingAllergyPreset {
  id: string
  title: string
  subtitle: string
  emoji: string
  /** Keys from ALLERGY_OPTIONS / known allergens */
  allergyKeys: readonly string[]
  /** Keys from SENSITIVITY_OPTIONS (e.g. lactose) */
  sensitivityKeys: readonly string[]
}

export const ONBOARDING_ALLERGY_PRESETS: readonly OnboardingAllergyPreset[] = [
  {
    id: 'peanut',
    title: 'Peanut allergy',
    subtitle: 'Peanuts & typical cross-contact wording',
    emoji: '🥜',
    allergyKeys: ['peanuts'],
    sensitivityKeys: [],
  },
  {
    id: 'tree_nuts',
    title: 'Tree nut allergy',
    subtitle: 'Almonds, cashews, walnuts, etc.',
    emoji: '🌰',
    allergyKeys: ['tree_nuts'],
    sensitivityKeys: [],
  },
  {
    id: 'milk_eggs',
    title: 'Milk & eggs',
    subtitle: 'Allergy-level dairy & eggs (not lactose)',
    emoji: '🥛',
    allergyKeys: ['milk', 'eggs'],
    sensitivityKeys: [],
  },
  {
    id: 'lactose',
    title: 'Lactose intolerance',
    subtitle: 'Digestive — heads-up, not an allergy flag',
    emoji: '🧈',
    allergyKeys: [],
    sensitivityKeys: ['lactose'],
  },
  {
    id: 'seafood',
    title: 'Fish & shellfish',
    subtitle: 'Fin fish plus crustaceans / mollusks',
    emoji: '🐟',
    allergyKeys: ['fish', 'shellfish'],
    sensitivityKeys: [],
  },
  {
    id: 'soy_sesame',
    title: 'Soy & sesame',
    subtitle: 'Common label pairings',
    emoji: '🫘',
    allergyKeys: ['soy', 'sesame'],
    sensitivityKeys: [],
  },
]

export function isPresetFullySelected(
  preset: OnboardingAllergyPreset,
  selectedAllergies: string[],
  selectedSensitivities: string[]
): boolean {
  const aOk =
    preset.allergyKeys.length === 0 ||
    preset.allergyKeys.every((k) => selectedAllergies.includes(k))
  const sOk =
    preset.sensitivityKeys.length === 0 ||
    preset.sensitivityKeys.every((k) => selectedSensitivities.includes(k))
  return aOk && sOk && (preset.allergyKeys.length > 0 || preset.sensitivityKeys.length > 0)
}

export function togglePresetSelection(
  preset: OnboardingAllergyPreset,
  selectedAllergies: string[],
  selectedSensitivities: string[]
): { allergies: string[]; sensitivities: string[] } {
  const active = isPresetFullySelected(preset, selectedAllergies, selectedSensitivities)
  if (active) {
    return {
      allergies: selectedAllergies.filter((k) => !preset.allergyKeys.includes(k)),
      sensitivities: selectedSensitivities.filter((k) => !preset.sensitivityKeys.includes(k)),
    }
  }
  return {
    allergies: [...new Set([...selectedAllergies, ...preset.allergyKeys])],
    sensitivities: [...new Set([...selectedSensitivities, ...preset.sensitivityKeys])],
  }
}
