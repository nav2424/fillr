/**
 * Whole-word matching misses German legal allergen names and compounds that do not
 * contain the English or French dictionary words (milk/lait, egg/oeuf, wheat/blé).
 *
 * OCR never translates German labels (only French-only lists). Fillr already treats
 * vollmilch / magermilch / eier / weizenmehl as milk/egg/wheat in bilingualIngredients,
 * but the safety matcher did not.
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.german-legal-names.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'
import { parseSections } from './textParser'
import { getCeliacSeverity, runCeliacCheck } from './matcher'

function detect(allergies: string[], ingredients_text: string) {
  return detectAllergensEvidenceBased(
    { ingredients_text },
    buildUserAllergenConfig(allergies)
  )
}

test('Vollmilchpulver is CONTAINS for milk allergy (German compound, no word milk/lait)', () => {
  const out = detect(['milk'], 'Zucker, Kakaobutter, Vollmilchpulver, Kakaomasse')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('Magermilch is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'Wasser, Zucker, Magermilch, Kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('Enthält: Milch is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'Zucker, Kakao. Enthält: Milch')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('Molkenprotein is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'Zucker, Molkenprotein, Kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('Kokosmilch compound stays SAFE for milk allergy (no whole-word milch)', () => {
  const out = detect(['milk'], 'Wasser, Zucker, Kokosmilch')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})

test('Eier is CONTAINS for egg allergy (German egg, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'Weizenmehl, Zucker, Eier, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Eiweiß is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'Zucker, Weizenmehl, Eiweiß, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Weizenmehl is CONTAINS for wheat allergy', () => {
  const out = detect(['wheat'], 'Wasser, Weizenmehl, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('Buchweizen stays SAFE for wheat allergy (buckwheat is not a whole-word weizen)', () => {
  const out = detect(['wheat'], 'Wasser, Buchweizen, Salz')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'wheat'), false)
})

test('Sojalecithin is CONTAINS for soy allergy (compound hides whole-word soja)', () => {
  const out = detect(['soy'], 'Zucker, Kakaobutter, Sojalecithin')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('Erdnüsse is CONTAINS for peanut allergy', () => {
  const out = detect(['peanuts'], 'Mais, Pflanzenöl, Salz. Enthält: Erdnüsse')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only Erdnuss', () => {
  const out = detect(['tree_nuts'], 'Mais, Pflanzenöl, Salz, Erdnuss')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('Fisch is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], 'Öl, Mehl, Fisch, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('Sesam is CONTAINS for sesame allergy (German sesame ≠ English sesame)', () => {
  const out = detect(['sesame'], 'Öl, Sesam, Salz')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('Garnelen is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'Wasser, Salz, Garnelen')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('Enthält: is parsed as a Contains section, not the verb enthalten', () => {
  const contains = parseSections('Zucker, Kakao. Enthält: Milch, Ei')
  assert.match(contains.contains_text, /milch/i)
  const traces = parseSections('Zucker, Kakao. Kann Spuren von Nüssen enthalten')
  assert.equal(traces.contains_text, '')
  assert.match(traces.ingredients_text, /enthalten/i)
})

test('celiac AVOID on Weizenmehl and Enthält: Weizen, but not Buchweizen', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['Weizenmehl', 'Zucker'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['Reis', 'Salz'], 'Enthält: Weizen')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['Buchweizen'], '')), 'SAFE')
})

test('English milk still matches and peanut-only Vollmilch stays SAFE', () => {
  const milk = detect(['milk'], 'water, sugar, milk, cocoa')
  assert.equal(milk.overall_status, 'CONTAINS')
  const peanutOnMilk = detect(['peanuts'], 'Zucker, Vollmilchpulver, Kakao')
  assert.equal(peanutOnMilk.overall_status, 'SAFE')
  assert.equal(peanutOnMilk.matched_allergens.length, 0)
})
