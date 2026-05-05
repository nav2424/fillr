// Open Food Facts (OFF) normalization - single source for extracting usable allergen data
// Used to build DetectionInput and enforce strict UNKNOWN rules

import {
  cleanIngredientText,
  extractCrossContactWarnings,
  extractEnglishIngredients,
  extractEnglishIngredientHaystackForSafety,
} from '../ingredientTextParsing'
import { englishPrimarySegment } from '../bilingualDisplay'
import { buildProductName } from '../buildProductName'

/** OFF `product.ingredients` tree node (nested sub-ingredients). */
export type OFFIngredientNode = {
  text?: string
  ingredients?: OFFIngredientNode[]
}

/**
 * Depth-first pre-order: each node's `text` then its children.
 * Matches OFF's analyzed ingredient count when the flat `ingredients_text` bundles
 * sub-ingredients in parentheses (which we strip elsewhere).
 */
export function flattenOffIngredientsPreorder(structured: OFFIngredientNode[] | undefined): string[] {
  if (!structured?.length) return []
  const out: string[] = []
  const visit = (nodes: OFFIngredientNode[] | undefined) => {
    if (!nodes?.length) return
    for (const node of nodes) {
      const line = formatOffStructuredIngredientText(node?.text)
      if (line) out.push(line)
      if (Array.isArray(node.ingredients) && node.ingredients.length > 0) {
        visit(node.ingredients)
      }
    }
  }
  visit(structured)
  return out
}

function formatOffStructuredIngredientText(raw?: string): string {
  let s = String(raw ?? '').trim()
  if (!s) return ''
  let prev = ''
  while (s !== prev) {
    prev = s
    s = s.replace(/_([^_]+)_/g, '$1')
  }
  s = englishPrimarySegment(s) || s
  return s.trim()
}

function stripBilingualSlashes(s: string): string {
  if (!s.includes('/')) return s.trim()
  return s.replace(/\/[^,\)]+/g, '').replace(/\s+/g, ' ').trim()
}

export interface OFFProductLike {
  product_name?: string
  product_name_en?: string
  product_name_fr?: string
  ingredients_text?: string
  ingredients_text_en?: string
  ingredients_text_fr?: string
  ingredients_text_with_allergens?: string
  ingredients?: OFFIngredientNode[]
  ingredients_tags?: string[]
  allergens?: string
  allergens_tags?: string[]
  allergens_hierarchy?: string[]
  traces?: string
  traces_tags?: string[]
  traces_hierarchy?: string[]
  brands_tags?: string[]
  nutriments?: Record<string, unknown>
  [key: string]: unknown
}

export interface NormalizedOFFData {
  ingredients_text: string
  /** English slice with parentheses kept — for allergen/celiac text matching. */
  ingredients_text_safety: string
  contains_text: string
  may_contain_text: string
  /** Parsed may-contain / facility lines for UI (not mixed into ingredient cards). */
  cross_contact_warnings: string[]
  allergens_tags: string[]
  traces_tags: string[]
  ingredients_tags: string[] | undefined
  ingredients: OFFIngredientNode[] | undefined
  product_name: string | undefined
  product_code: string | undefined
  brands: string | undefined
  /** Quality flags for logging */
  source_quality: {
    ingredients_present: boolean
    allergens_tags_present: boolean
    traces_tags_present: boolean
  }
}

function mergeMayContainParts(...parts: (string | undefined)[]): string {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of parts) {
    const t = (p ?? '').trim()
    if (!t) continue
    for (const chunk of t.split(/[;.]\s*/)) {
      const c = chunk.trim()
      if (!c || seen.has(c.toLowerCase())) continue
      seen.add(c.toLowerCase())
      out.push(c)
    }
  }
  return out.join('. ')
}

/**
 * Normalize Open Food Facts product into a single structure for allergen detection.
 * Extracts ingredients, contains (allergens), and may-contain (traces) from all OFF fields.
 */
export function normalizeOFFProduct(
  offProduct: OFFProductLike | null | undefined,
  _langPreference: 'en' | 'fr' | 'auto' = 'en'
): NormalizedOFFData | null {
  if (!offProduct || typeof offProduct !== 'object') {
    return null
  }

  const structured =
    Array.isArray(offProduct.ingredients) && offProduct.ingredients.length > 0
      ? (offProduct.ingredients as OFFIngredientNode[])
      : undefined

  // 1) Ingredients: English-first pipeline (bilingual junk stripped — not raw with_allergens blob)
  let ingredients_list = cleanIngredientText(
    extractEnglishIngredients({
      ingredients_text: offProduct.ingredients_text,
      ingredients_text_en: offProduct.ingredients_text_en,
      ingredients_text_fr: offProduct.ingredients_text_fr,
    })
  )

  if (structured?.length) {
    const fromTree = flattenOffIngredientsPreorder(structured)
    if (fromTree.length > ingredients_list.length) {
      ingredients_list = cleanIngredientText(fromTree.join(', '), { ingredientDedupe: 'exact' })
    }
  }

  let ingredients_text = ingredients_list.join(', ')

  const ingredients_text_safety = extractEnglishIngredientHaystackForSafety(
    {
      ingredients_text: offProduct.ingredients_text,
      ingredients_text_en: offProduct.ingredients_text_en,
      ingredients_text_fr: offProduct.ingredients_text_fr,
    },
    'barcode'
  )
  if (!ingredients_text.trim() && Array.isArray(offProduct.ingredients_tags) && offProduct.ingredients_tags.length) {
    const blob = offProduct.ingredients_tags
      .map((t) => englishPrimarySegment(t.replace(/^[a-z]{2}:/, '')))
      .join(', ')
    ingredients_list = cleanIngredientText(blob)
    ingredients_text = ingredients_list.join(', ')
  }

  const cross_contact_warnings = extractCrossContactWarnings({
    ingredients_text: offProduct.ingredients_text,
    ingredients_text_en: offProduct.ingredients_text_en,
    allergens: typeof offProduct.allergens === 'string' ? offProduct.allergens : undefined,
  })

  // 2) Contains (explicit allergen statement)
  const contains_text_raw =
    typeof offProduct.allergens === 'string' ? offProduct.allergens.trim() : ''
  const contains_text = englishPrimarySegment(stripBilingualSlashes(contains_text_raw))
  const allergens_tags = Array.isArray(offProduct.allergens_tags)
    ? offProduct.allergens_tags
    : []

  // 3) May contain (traces) + cross-contact lines for matching / UI
  const traces_raw = typeof offProduct.traces === 'string' ? offProduct.traces.trim() : ''
  const traces_stripped = englishPrimarySegment(stripBilingualSlashes(traces_raw))
  const may_contain_text = mergeMayContainParts(
    traces_stripped,
    cross_contact_warnings.length ? cross_contact_warnings.join('. ') : undefined
  )
  const traces_tags = Array.isArray(offProduct.traces_tags)
    ? offProduct.traces_tags
    : []

  const ingredients_tags = Array.isArray(offProduct.ingredients_tags)
    ? offProduct.ingredients_tags
    : undefined
  const ingredients = Array.isArray(offProduct.ingredients)
    ? offProduct.ingredients
    : undefined

  const product_name = buildProductName({
    brands: typeof (offProduct as { brands?: string }).brands === 'string'
      ? (offProduct as { brands?: string }).brands
      : undefined,
    product_name_en: offProduct.product_name_en,
    product_name: offProduct.product_name,
    product_name_fr: offProduct.product_name_fr,
  })
  const product_code = (offProduct as { code?: string }).code
  const brands = typeof (offProduct as { brands?: string }).brands === 'string'
    ? (offProduct as { brands?: string }).brands
    : undefined

  const source_quality = {
    ingredients_present: Boolean(
      ingredients_text.trim() ||
        ingredients_text_safety.trim() ||
        ingredients?.length ||
        ingredients_tags?.length
    ),
    allergens_tags_present: allergens_tags.length > 0,
    traces_tags_present: traces_tags.length > 0,
  }

  return {
    ingredients_text: (ingredients_text || '').trim(),
    ingredients_text_safety: (ingredients_text_safety || '').trim(),
    contains_text,
    may_contain_text,
    cross_contact_warnings,
    allergens_tags,
    traces_tags,
    ingredients_tags,
    ingredients,
    product_name,
    product_code,
    brands,
    source_quality,
  }
}

/** Check if OFF data has ANY usable allergen/ingredient info */
export function hasUsableOFFAllergenData(norm: NormalizedOFFData | null): boolean {
  if (!norm) return false
  const {
    ingredients_text,
    ingredients_text_safety,
    contains_text,
    may_contain_text,
    cross_contact_warnings,
    allergens_tags,
    traces_tags,
  } = norm
  return (
    Boolean(ingredients_text) ||
    Boolean(ingredients_text_safety) ||
    Boolean(contains_text) ||
    Boolean(may_contain_text) ||
    cross_contact_warnings.length > 0 ||
    allergens_tags.length > 0 ||
    traces_tags.length > 0
  )
}

