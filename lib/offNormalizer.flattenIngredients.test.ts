import test from 'node:test'
import assert from 'node:assert/strict'
import type { OFFIngredientNode } from './allergenEngine/offNormalizer'
import { normalizeOFFProduct, flattenOffIngredientsPreorder } from './allergenEngine/offNormalizer'
import { buildUserAllergenConfig, detectAllergensEvidenceBased } from './allergenEngine'
import { parseIngredients } from './fillrAdapter'

/** Minimal OFF-style tree matching Kraft Smooth–style nesting (11 analyzed lines). */
const kraftLikeIngredients: OFFIngredientNode[] = [
  { text: '_Select roasted peanuts_' },
  { text: 'Soybean oil' },
  {
    text: 'Sugars',
    ingredients: [{ text: 'corn maltodextrin' }, { text: 'sugar' }],
  },
  {
    text: 'Hydrogenated vegetable oil',
    ingredients: [{ text: 'cottonseed vegetable oil' }, { text: 'rapeseed vegetable oil' }],
  },
  { text: 'oil' },
  { text: 'Salt' },
  { text: 'mono- and diglycerides' },
]

test('flattenOffIngredientsPreorder walks nested OFF ingredients', () => {
  const flat = flattenOffIngredientsPreorder([...kraftLikeIngredients])
  assert.equal(flat.length, 11)
  assert.ok(flat.some((s) => /hydrogenated/i.test(s)))
  assert.ok(flat.some((s) => /cottonseed/i.test(s)))
})

test('normalizeOFFProduct prefers structured tree when it expands the list', () => {
  const n = normalizeOFFProduct({
    ingredients_text_en:
      '_Select roasted peanuts_, Soybean oil, Sugars (corn maltodextrin, sugar), Hydrogenated vegetable oil (cottonseed and rapeseed oil), Salt, Mono - and diglycerides',
    ingredients: [...kraftLikeIngredients],
  })
  assert.ok(n)
  const cards = parseIngredients(n!.ingredients_text, 'barcode')
  assert.equal(cards.length, 11)
})

test('normalizeOFFProduct preserves embedded contains advisory for matching', () => {
  const norm = normalizeOFFProduct({
    product_name: 'Chocolate snack',
    ingredients_text_en: 'Ingredients: sugar, cocoa, salt. Contains: milk.',
    allergens: '',
    allergens_tags: [],
  })

  assert.ok(norm)
  assert.equal(norm!.contains_text, 'milk')

  const output = detectAllergensEvidenceBased(
    {
      product_name: norm!.product_name,
      ingredients_text: norm!.ingredients_text,
      ingredients_text_safety: norm!.ingredients_text_safety,
      contains_text: norm!.contains_text,
      may_contain_text: norm!.may_contain_text,
      allergens_tags: norm!.allergens_tags,
      traces_tags: norm!.traces_tags,
    },
    buildUserAllergenConfig(['milk'])
  )

  assert.equal(output.overall_status, 'CONTAINS')
  assert.equal(output.matched_allergens[0]?.section, 'contains')
})
