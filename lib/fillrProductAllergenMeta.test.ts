import test from 'node:test'
import assert from 'node:assert/strict'
import {
  embedFillrAllergenMetaInNutritionJson,
  extractFillrAllergenMetaFromNutritionJson,
} from './fillrProductAllergenMeta'

test('embed and extract allergen meta round-trip', () => {
  const embedded = embedFillrAllergenMetaInNutritionJson(
    { 'energy-kcal_100g': 400 },
    {
      allergens_tags: ['en:milk'],
      traces_tags: ['en:peanuts'],
      contains_text: 'Contains: Milk',
      ingredients_text_safety: 'Milk, sugar, cocoa',
    }
  )
  assert.ok(embedded)
  const meta = extractFillrAllergenMetaFromNutritionJson(embedded)
  assert.deepEqual(meta?.allergens_tags, ['en:milk'])
  assert.deepEqual(meta?.traces_tags, ['en:peanuts'])
  assert.equal(meta?.contains_text, 'Contains: Milk')
  assert.equal(meta?.ingredients_text_safety, 'Milk, sugar, cocoa')
})
