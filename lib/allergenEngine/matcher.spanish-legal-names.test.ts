/**
 * Whole-word matching misses Spanish / Mexican legal allergen names that do not
 * contain the English or French dictionary words (milk/lait, egg/oeuf, peanut/cacahuète).
 *
 * OCR never translates Spanish labels (only French-only lists), and parseSections
 * already understands "puede contener" but not these ingredient words.
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.spanish-legal-names.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'

function detect(allergies: string[], ingredients_text: string) {
  return detectAllergensEvidenceBased(
    { ingredients_text },
    buildUserAllergenConfig(allergies)
  )
}

test('leche descremada is CONTAINS for milk allergy (Spanish milk, no word milk/lait)', () => {
  const out = detect(['milk'], 'agua, azucar, leche descremada, cocoa')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('Contiene: leche is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'agua, azucar, cocoa. Contiene: leche')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('huevo is CONTAINS for egg allergy (Spanish egg, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'harina de arroz, huevo, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('huevos plural is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'agua, huevos, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('cacahuate is CONTAINS for peanut allergy (Mexican legal name, not French cacahuète)', () => {
  const out = detect(['peanuts'], 'maiz, aceite vegetal, sal, cacahuate')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('Contains: Cacahuates is CONTAINS for peanut allergy', () => {
  const out = detect(['peanuts'], 'maiz, aceite, sal. Contiene: Cacahuates')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only cacahuate', () => {
  const out = detect(['tree_nuts'], 'maiz, aceite vegetal, sal, cacahuate')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('pescado is CONTAINS for fish allergy (Spanish fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'aceite, harina, pescado, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('mariscos is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'agua, sal, mariscos, limon')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('camarón is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'aceite, ajo, camarón, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('sésamo is CONTAINS for sesame allergy (Spanish sesame ≠ French sésame after normalize)', () => {
  const out = detect(['sesame'], 'aceite, sésamo, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('ajonjolí is CONTAINS for sesame allergy (Mexican sesame name)', () => {
  const out = detect(['sesame'], 'maiz, aceite, ajonjolí, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('English milk still matches and peanut-only leche stays SAFE', () => {
  const milk = detect(['milk'], 'water, sugar, milk, cocoa')
  assert.equal(milk.overall_status, 'CONTAINS')
  const peanutOnLeche = detect(['peanuts'], 'agua, azucar, leche descremada, cocoa')
  assert.equal(peanutOnLeche.overall_status, 'SAFE')
  assert.equal(peanutOnLeche.matched_allergens.length, 0)
})
