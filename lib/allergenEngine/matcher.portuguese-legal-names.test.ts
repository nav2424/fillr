/**
 * Whole-word matching misses Portuguese legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Portuguese or Brazilian labels. French `arachide` does not
 * match `amendoim`; English `milk` does not match `leite` (leite ≠ coffee latte).
 * Brazilian sesame is `gergelim`, not `sésame`/`sesame`.
 *
 * Distinct from Spanish (leche/huevo/cacahuate), Italian (uova/arachidi/pesce),
 * and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.portuguese-legal-names.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'
import { getCeliacSeverity, runCeliacCheck } from './matcher'
import { parseSections } from './textParser'

function detect(allergies: string[], ingredients_text: string) {
  return detectAllergensEvidenceBased(
    { ingredients_text },
    buildUserAllergenConfig(allergies)
  )
}

test('ovos is CONTAINS for egg allergy (Portuguese eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'açucar, ovos, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('ovo singular is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'agua, ovo, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Contém: ovos is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'farinha de arroz, açucar, sal. Contém: ovos')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Contém as a Contains header', () => {
  const parsed = parseSections('farinha de arroz, sal. Contém: ovos, leite')
  assert.match(parsed.contains_text, /ovos/i)
  assert.match(parsed.contains_text, /leite/i)
  assert.doesNotMatch(parsed.ingredients_text, /Contém/i)
})

test('amendoim is CONTAINS for peanut allergy (Portuguese peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'oleo vegetal, sal, amendoim')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('amendoins plural is CONTAINS for peanut allergy', () => {
  const out = detect(['peanuts'], 'açucar, amendoins, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only amendoim', () => {
  const out = detect(['tree_nuts'], 'oleo vegetal, sal, amendoim')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('peixe is CONTAINS for fish allergy (Portuguese fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'oleo, farinha, peixe, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('leite is CONTAINS for milk allergy (Portuguese milk ≠ English coffee latte)', () => {
  const out = detect(['milk'], 'açucar, leite, cacau')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('queijo is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'farinha de arroz, queijo, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('bare coffee latte stays SAFE for milk allergy (leite is not latte)', () => {
  const out = detect(['milk'], 'espresso, sugar, vanilla latte flavor, cinnamon')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('amêndoas is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'açucar, amêndoas, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('avelãs is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'açucar, cacau, avelãs, baunilha')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Contém: frutos de casca rija is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'açucar, cacau, baunilha. Contém: frutos de casca rija')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('gergelim is CONTAINS for sesame allergy (Brazilian sesame ≠ sésame/sesame)', () => {
  const out = detect(['sesame'], 'oleo, gergelim, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('sésamo is CONTAINS for sesame allergy (European Portuguese ≠ French sésame)', () => {
  const out = detect(['sesame'], 'oleo, sésamo, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('camarão is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'oleo, alho, camarão, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('farinha de trigo is CONTAINS for wheat allergy', () => {
  const out = detect(['wheat'], 'açucar, farinha de trigo, sal')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('English eggs still match and peanut-only ovos stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnOvos = detect(['peanuts'], 'farinha de arroz, ovos, sal')
  assert.equal(peanutOnOvos.overall_status, 'SAFE')
  assert.equal(peanutOnOvos.matched_allergens.length, 0)
})

test('celiac AVOID on farinha de trigo and Contém: glúten, but not trigo sarraceno', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['farinha de trigo', 'açucar'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['açucar', 'cacau'], 'Contém: glúten')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['trigo sarraceno', 'sal'], '')), 'SAFE')
})
