/**
 * Persist Open Food Facts allergen / trace signals alongside cached `products` rows.
 */

export type FillrProductAllergenMeta = {
  allergens_tags?: string[]
  traces_tags?: string[]
  contains_text?: string
  may_contain_text?: string
  cross_contact_warnings?: string[]
  ingredients_text_safety?: string
}

const META_KEY = '_fillrAllergenMeta'

export function embedFillrAllergenMetaInNutritionJson(
  nutritionJson: Record<string, unknown> | null | undefined,
  meta: FillrProductAllergenMeta | null | undefined
): Record<string, unknown> | null {
  const base =
    nutritionJson && typeof nutritionJson === 'object' && !Array.isArray(nutritionJson)
      ? { ...nutritionJson }
      : {}
  if (!meta || typeof meta !== 'object') {
    if (META_KEY in base) {
      const { [META_KEY]: _removed, ...rest } = base as Record<string, unknown>
      return Object.keys(rest).length > 0 ? rest : null
    }
    return Object.keys(base).length > 0 ? base : null
  }
  const cleaned: FillrProductAllergenMeta = {}
  if (meta.allergens_tags?.length) cleaned.allergens_tags = [...meta.allergens_tags]
  if (meta.traces_tags?.length) cleaned.traces_tags = [...meta.traces_tags]
  if (meta.contains_text?.trim()) cleaned.contains_text = meta.contains_text.trim()
  if (meta.may_contain_text?.trim()) cleaned.may_contain_text = meta.may_contain_text.trim()
  if (meta.cross_contact_warnings?.length) {
    cleaned.cross_contact_warnings = meta.cross_contact_warnings.map((s) => String(s).trim()).filter(Boolean)
  }
  if (meta.ingredients_text_safety?.trim()) {
    cleaned.ingredients_text_safety = meta.ingredients_text_safety.trim()
  }
  if (Object.keys(cleaned).length === 0) return Object.keys(base).length > 0 ? base : null
  return { ...base, [META_KEY]: cleaned }
}

export function extractFillrAllergenMetaFromNutritionJson(
  nutritionJson: Record<string, unknown> | null | undefined
): FillrProductAllergenMeta | null {
  if (!nutritionJson || typeof nutritionJson !== 'object' || Array.isArray(nutritionJson)) return null
  const raw = (nutritionJson as Record<string, unknown>)[META_KEY]
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const out: FillrProductAllergenMeta = {}
  if (Array.isArray(o.allergens_tags)) {
    out.allergens_tags = o.allergens_tags.map((t) => String(t).trim()).filter(Boolean)
  }
  if (Array.isArray(o.traces_tags)) {
    out.traces_tags = o.traces_tags.map((t) => String(t).trim()).filter(Boolean)
  }
  if (typeof o.contains_text === 'string' && o.contains_text.trim()) {
    out.contains_text = o.contains_text.trim()
  }
  if (typeof o.may_contain_text === 'string' && o.may_contain_text.trim()) {
    out.may_contain_text = o.may_contain_text.trim()
  }
  if (Array.isArray(o.cross_contact_warnings)) {
    out.cross_contact_warnings = o.cross_contact_warnings.map((s) => String(s).trim()).filter(Boolean)
  }
  if (typeof o.ingredients_text_safety === 'string' && o.ingredients_text_safety.trim()) {
    out.ingredients_text_safety = o.ingredients_text_safety.trim()
  }
  return Object.keys(out).length > 0 ? out : null
}
