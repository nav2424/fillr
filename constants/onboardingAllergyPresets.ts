/**
 * Quick presets — each toggles a focused bundle of `ALLERGY_OPTIONS` keys.
 * (Lactose lives under Sensitivities, not here.)
 */

export interface OnboardingAllergyPreset {
  id: string
  title: string
  subtitle: string
  emoji: string
  /** Keys from ALLERGY_OPTIONS / known allergens */
  allergyKeys: readonly string[]
  /** Keys from SENSITIVITY_OPTIONS (usually empty here) */
  sensitivityKeys: readonly string[]
}

export const ONBOARDING_ALLERGY_PRESETS: readonly OnboardingAllergyPreset[] = [
  {
    id: 'peanuts',
    title: 'Peanuts',
    subtitle: 'Peanuts & typical label wording',
    emoji: '🥜',
    allergyKeys: ['peanuts'],
    sensitivityKeys: [],
  },
  {
    id: 'tree_nuts',
    title: 'Tree nuts',
    subtitle: 'Almonds, cashews, walnuts…',
    emoji: '🌰',
    allergyKeys: ['tree_nuts'],
    sensitivityKeys: [],
  },
  {
    id: 'milk_dairy',
    title: 'Milk & dairy',
    subtitle: 'Cow’s milk protein allergy',
    emoji: '🥛',
    allergyKeys: ['milk'],
    sensitivityKeys: [],
  },
  {
    id: 'eggs',
    title: 'Eggs',
    subtitle: 'Egg white & yolk sources',
    emoji: '🥚',
    allergyKeys: ['eggs'],
    sensitivityKeys: [],
  },
  {
    id: 'wheat_gluten',
    title: 'Wheat / gluten',
    subtitle: 'Wheat as an allergen',
    emoji: '🌾',
    allergyKeys: ['wheat'],
    sensitivityKeys: [],
  },
  {
    id: 'soy',
    title: 'Soy',
    subtitle: 'Soybeans & derivatives',
    emoji: '🫘',
    allergyKeys: ['soy'],
    sensitivityKeys: [],
  },
  {
    id: 'fish',
    title: 'Fish',
    subtitle: 'Fin fish & derivatives',
    emoji: '🐟',
    allergyKeys: ['fish'],
    sensitivityKeys: [],
  },
  {
    id: 'shellfish',
    title: 'Shellfish',
    subtitle: 'Crustaceans & mollusks',
    emoji: '🦐',
    allergyKeys: ['shellfish'],
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
