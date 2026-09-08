/**
 * Whole-word matching misses Swedish legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Swedish labels. English `milk` does not match `mjölk`;
 * `egg` does not match `ägg`; French `arachide` does not stem to `jordnötter`.
 * Swedish sesame is `sesam`, not `sesame`/`sésame`. NFKD folds ä/ö/å, so
 * `ägg` becomes `agg` and never equals `egg`.
 *
 * Distinct from Polish (jajka/mleko), Dutch (ei/pinda/melk), Portuguese
 * (ovos/amendoim), Spanish (leche/huevo/cacahuate), Italian (uova/arachidi),
 * and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.swedish-legal-names.test.ts
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

test('ägg is CONTAINS for egg allergy (Swedish eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'socker, ägg, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('äggvita is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'vatten, äggvita, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Innehåller: ägg is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'majsstärkelse, socker, salt. Innehåller: ägg')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Innehåller as a Contains header and does not steal innehåller inte', () => {
  const parsed = parseSections('majsstärkelse, salt. Innehåller: ägg, mjölk')
  assert.match(parsed.contains_text, /ägg/i)
  assert.match(parsed.contains_text, /mjölk/i)
  assert.doesNotMatch(parsed.ingredients_text, /Innehåller/i)

  const may = parseSections('majsstärkelse, salt. Kan innehålla: nötter')
  assert.match(may.may_contain_text, /nötter/i)
  assert.doesNotMatch(may.contains_text, /nötter/i)

  const out = detect(['tree_nuts'], 'majsstärkelse, salt. Kan innehålla: nötter')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const noSteal = parseSections('ris, salt. innehåller inte ägg')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /innehåller inte ägg/i)
})

test('English Ingredients: prefix still strips after adding Ingredienser', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const sv = parseSections('Ingredienser: socker, salt, majsstärkelse')
  assert.match(sv.ingredients_text, /socker/i)
  assert.doesNotMatch(sv.ingredients_text, /Ingredienser/i)
})

test('jordnötter is CONTAINS for peanut allergy (Swedish peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'vegetabilisk olja, salt, jordnötter')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('jordnötssmör is CONTAINS for peanut allergy (compound, no word peanut)', () => {
  const out = detect(['peanuts'], 'socker, jordnötssmör, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only jordnötter', () => {
  const out = detect(['tree_nuts'], 'vegetabilisk olja, salt, jordnötter')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('fisk is CONTAINS for fish allergy (Swedish fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'olja, mjöl, fisk, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('mjölk is CONTAINS for milk allergy (Swedish milk ≠ English milk)', () => {
  const out = detect(['milk'], 'socker, mjölk, kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('ost is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'majsstärkelse, ost, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('smör matches after ö→o fold', () => {
  const out = detect(['milk'], 'socker, smör, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('kokosmjölk does not fire milk (compound, do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'vatten, kokosmjölk, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('hasselnötter is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'socker, hasselnötter, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Innehåller: nötter is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'socker, kakao, vanilj. Innehåller: nötter')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('sesam is CONTAINS for sesame allergy (Swedish sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'olja, sesam, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('räkor is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'olja, vitlök, räkor, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('vetemjöl is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'socker, vetemjöl, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('ärtprotein does not fire egg allergy (do not add generic protein)', () => {
  const out = detect(['eggs'], 'vatten, ärtprotein, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Swedish terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, host, most, cost, frost, poster, boston')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, egg, aggregation, jagged')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const eggsSafe = detect(['eggs'], 'water, aggregation, jagged, protein isolate')
  assert.equal(eggsSafe.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, fiscal, starfish, office')
  assert.equal(fish.overall_status, 'SAFE')
  const salmon = detect(['fish'], 'water, relax, flax, galaxy')
  assert.equal(salmon.overall_status, 'SAFE')
  const wheat = detect(['wheat'], 'water, ragu, popcorn, corn flakes')
  assert.equal(wheat.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only ägg stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'majsstärkelse, ägg, salt')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('does not contain is not a tree-nut hit (do not add bare nöt → not)', () => {
  const out = detect(['tree_nuts'], 'water, sugar, salt. does not contain peanuts')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('celiac AVOID on vetemjöl and Innehåller: gluten, but not bovete', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['vetemjöl', 'socker'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['socker', 'kakao'], 'Innehåller: gluten')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['bovete', 'salt'], '')), 'SAFE')
})
