/**
 * High-severity false-SAFE regressions in the allergen engine.
 * Run: npx tsx --test lib/allergenEngine/falseSafe.regression.test.ts
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'
import { parseSections } from './textParser'

test('soybeans plural is CONTAINS for soy allergy (FDA / tofu label)', () => {
  const out = detectAllergensEvidenceBased(
    { ingredients_text: 'Water, soybeans, salt' },
    buildUserAllergenConfig(['soy'])
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('Contains: Soybeans is CONTAINS for soy allergy', () => {
  const out = detectAllergensEvidenceBased(
    { ingredients_text: 'Water, salt', contains_text: 'Soybeans' },
    buildUserAllergenConfig(['soy'])
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('in-sentence traces-of advisory keeps prior ingredients for matching', () => {
  const blob = 'wheat flour, sugar, vegetable oil, traces of almonds'
  const parsed = parseSections(blob)
  assert.match(parsed.ingredients_text, /wheat flour/i)
  assert.match(parsed.may_contain_text, /almonds/i)

  const wheat = detectAllergensEvidenceBased(
    { ingredients_text: blob },
    buildUserAllergenConfig(['wheat'])
  )
  assert.equal(wheat.overall_status, 'CONTAINS')
  assert.ok(wheat.matched_allergens.some((m) => m.allergen_id === 'wheat'))

  const treeNuts = detectAllergensEvidenceBased(
    { ingredients_text: blob },
    buildUserAllergenConfig(['tree_nuts'])
  )
  assert.equal(treeNuts.overall_status, 'MAY_CONTAIN')
})

test('in-sentence may-contain advisory keeps prior ingredients for matching', () => {
  const parsed = parseSections('enriched flour, sugar, cocoa, may contain milk')
  assert.match(parsed.ingredients_text, /enriched flour/i)
  assert.match(parsed.may_contain_text, /milk/i)

  const wheat = detectAllergensEvidenceBased(
    { ingredients_text: 'enriched flour, sugar, cocoa, may contain milk' },
    buildUserAllergenConfig(['wheat'])
  )
  assert.equal(wheat.overall_status, 'CONTAINS')
})

test('standalone may-contain segment still does not invent ingredients', () => {
  const parsed = parseSections('May contain peanuts')
  assert.equal(parsed.ingredients_text.trim(), '')
  assert.match(parsed.may_contain_text, /peanuts/i)
})
