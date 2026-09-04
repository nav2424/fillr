/**
 * Whole-word matching misses Italian legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Italian labels (only French-only lists). French `arachide`
 * does not match Italian plural `arachidi`; French `soja` does not match `soia`.
 * Bare `latte` is intentionally omitted — it collides with English coffee latte.
 *
 * Distinct from Spanish legal names (leche/huevo/cacahuate) and German
 * (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.italian-legal-names.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'
import { getCeliacSeverity, runCeliacCheck } from './matcher'

function detect(allergies: string[], ingredients_text: string) {
  return detectAllergensEvidenceBased(
    { ingredients_text },
    buildUserAllergenConfig(allergies)
  )
}

test('uova is CONTAINS for egg allergy (Italian eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'farina di riso, uova, sale')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('uovo singular is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'acqua, uovo, sale')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Contiene: uova is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'farina di riso, zucchero, sale. Contiene: uova')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('arachidi is CONTAINS for peanut allergy (Italian plural ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'olio vegetale, sale, arachidi')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only arachidi', () => {
  const out = detect(['tree_nuts'], 'olio vegetale, sale, arachidi')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('pesce is CONTAINS for fish allergy (Italian fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'olio, farina, pesce, sale')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('nocciole is CONTAINS for tree-nut allergy (Italian hazelnuts, no word hazelnut/noisette)', () => {
  const out = detect(['tree_nuts'], 'zucchero, cacao, nocciole, vaniglia')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('mandorle is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'zucchero, mandorle, sale')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Contiene: frutta a guscio is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'zucchero, cacao, vaniglia. Contiene: frutta a guscio')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('soia is CONTAINS for soy allergy (Italian soy ≠ French/Spanish soja)', () => {
  const out = detect(['soy'], 'olio, lecitina di soia, sale')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('frumento is CONTAINS for wheat allergy', () => {
  const out = detect(['wheat'], 'zucchero, farina di frumento, sale')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('sesamo is CONTAINS for sesame allergy (Italian sesame ≠ French sésame after normalize)', () => {
  const out = detect(['sesame'], 'olio, sesamo, sale')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('gamberi is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'olio, aglio, gamberi, sale')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('formaggio is CONTAINS for milk allergy without matching coffee latte', () => {
  const out = detect(['milk'], 'farina, formaggio, sale')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('bare coffee latte stays SAFE for milk allergy (latte is not a milk synonym)', () => {
  const out = detect(['milk'], 'espresso, sugar, vanilla latte flavor, cinnamon')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('English eggs still match and peanut-only uova stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnUova = detect(['peanuts'], 'farina di riso, uova, sale')
  assert.equal(peanutOnUova.overall_status, 'SAFE')
  assert.equal(peanutOnUova.matched_allergens.length, 0)
})

test('celiac AVOID on farina di frumento and Contiene: glutine, but not grano saraceno', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['farina di frumento', 'zucchero'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['zucchero', 'cacao'], 'Contiene: glutine')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['grano saraceno', 'sale'], '')), 'SAFE')
})
