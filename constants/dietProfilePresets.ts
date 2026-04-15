/** Preset dietary options — slug is stored in userProfileStore and used by ingredientMatcher. */

export type DietPreset = {
  slug: string
  label: string
  userStoreAllergyKey?: string
  id?: string
  description?: string
  sets?: { celiacStrictGluten?: boolean }
}

/** Serious allergies → matcher + avoid in analysis */
export const PRESET_ALLERGIES: DietPreset[] = [
  { slug: 'peanuts', label: 'Peanuts', userStoreAllergyKey: 'peanuts' },
  { slug: 'tree nuts', label: 'Tree Nuts', userStoreAllergyKey: 'tree_nuts' },
  { slug: 'dairy', label: 'Dairy / Milk', userStoreAllergyKey: 'milk' },
  { slug: 'eggs', label: 'Eggs', userStoreAllergyKey: 'eggs' },
  { slug: 'gluten', label: 'Wheat / Gluten', userStoreAllergyKey: 'wheat' },
  { slug: 'soy', label: 'Soy', userStoreAllergyKey: 'soy' },
  { slug: 'fish', label: 'Fish', userStoreAllergyKey: 'fish' },
  { slug: 'shellfish', label: 'Shellfish', userStoreAllergyKey: 'shellfish' },
  { slug: 'sesame', label: 'Sesame', userStoreAllergyKey: 'sesame' },
  { slug: 'corn', label: 'Corn' },
  { slug: 'sulfites', label: 'Sulfites', userStoreAllergyKey: 'sulfites' },
]

export const PRESET_SENSITIVITIES: DietPreset[] = [
  { slug: 'msg', label: 'MSG' },
  { slug: 'caffeine', label: 'Caffeine' },
  { slug: 'lactose', label: 'Lactose' },
  { slug: 'fructose', label: 'Fructose' },
  { slug: 'histamine', label: 'Histamine' },
  { slug: 'nightshades', label: 'Nightshades' },
  { slug: 'fodmaps', label: 'FODMAPs' },
  { slug: 'artificial sweeteners', label: 'Artificial Sweeteners' },
  { slug: 'alcohol', label: 'Alcohol' },
  { slug: 'salicylates', label: 'Salicylates' },
]

export const PRESET_AVOIDING: DietPreset[] = [
  { slug: 'seed oils', label: 'Seed Oils' },
  { slug: 'hfcs', label: 'HFCS' },
  { slug: 'artificial dyes', label: 'Artificial Dyes' },
  { slug: 'preservatives', label: 'Preservatives' },
  { slug: 'added sugar', label: 'Added Sugar' },
  { slug: 'gluten', label: 'Gluten' },
  { slug: 'processed meat', label: 'Processed Meat' },
  { slug: 'palm oil', label: 'Palm Oil' },
  { slug: 'refined carbs', label: 'Refined Carbs' },
  { slug: 'artificial flavors', label: 'Artificial Flavors' },
  { slug: 'carrageenan', label: 'Carrageenan' },
]

export const PRESET_PREFERENCES: DietPreset[] = [
  { slug: 'vegan', label: 'Vegan' },
  { slug: 'vegetarian', label: 'Vegetarian' },
  { slug: 'keto', label: 'Keto' },
  { slug: 'paleo', label: 'Paleo' },
  { slug: 'halal', label: 'Halal' },
  { slug: 'kosher', label: 'Kosher' },
  { slug: 'whole30', label: 'Whole30' },
  { slug: 'carnivore', label: 'Carnivore' },
  { slug: 'low fodmap', label: 'Low FODMAP' },
  { slug: 'diabetic-friendly', label: 'Diabetic-friendly' },
]

export const CELIAC_PRESET: DietPreset = {
  id: 'celiac',
  slug: 'celiac',
  label: 'Celiac Disease',
  description: 'Strict gluten-free — all gluten sources flagged',
  sets: { celiacStrictGluten: true },
}
