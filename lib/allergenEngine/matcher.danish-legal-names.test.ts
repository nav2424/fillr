/**
 * Whole-word matching misses Danish legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Danish labels. English `milk` does not match `mælk`;
 * `egg` does not match `æg`; French `arachide` does not stem to `jordnødder`.
 * Danish sesame is `sesam`, not `sesame`/`sésame`.
 *
 * æ and ø do not NFKD-decompose, and JavaScript \\b treats them as non-word
 * characters, so `æg` never equals `egg` and would not even whole-word match
 * itself without an ASCII fold (æ→ae, ø→o).
 *
 * Distinct from Swedish (ägg/mjölk), Polish (jajka/mleko), Dutch (ei/pinda/melk),
 * Portuguese (ovos/amendoim), Spanish (leche/huevo/cacahuate), Italian
 * (uova/arachidi), and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.danish-legal-names.test.ts
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'
import { getCeliacSeverity, normalizeText, runCeliacCheck } from './matcher'
import { parseSections } from './textParser'

function detect(allergies: string[], ingredients_text: string) {
  return detectAllergensEvidenceBased(
    { ingredients_text },
    buildUserAllergenConfig(allergies)
  )
}

test('æ and ø fold to ASCII so word-boundary matching can fire', () => {
  assert.equal(normalizeText('æg'), 'aeg')
  assert.equal(normalizeText('mælk'), 'maelk')
  assert.equal(normalizeText('jordnødder'), 'jordnodder')
  assert.equal(normalizeText('smør'), 'smor')
})

test('æg is CONTAINS for egg allergy (Danish eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'sukker, æg, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('æggehvide is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'vand, æggehvide, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Indeholder: æg is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'majsstivelse, sukker, salt. Indeholder: æg')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Indeholder as a Contains header and does not steal indeholder ikke', () => {
  const parsed = parseSections('majsstivelse, salt. Indeholder: æg, mælk')
  assert.match(parsed.contains_text, /æg/i)
  assert.match(parsed.contains_text, /mælk/i)
  assert.doesNotMatch(parsed.ingredients_text, /Indeholder/i)

  const may = parseSections('majsstivelse, salt. Kan indeholde: nødder')
  assert.match(may.may_contain_text, /nødder/i)
  assert.doesNotMatch(may.contains_text, /nødder/i)

  const out = detect(['tree_nuts'], 'majsstivelse, salt. Kan indeholde: nødder')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const noSteal = parseSections('ris, salt. indeholder ikke æg')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /indeholder ikke æg/i)
})

test('English Ingredients: prefix still strips after adding Ingredienser', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const da = parseSections('Ingredienser: sukker, salt, majsstivelse')
  assert.match(da.ingredients_text, /sukker/i)
  assert.doesNotMatch(da.ingredients_text, /Ingredienser/i)
})

test('jordnødder is CONTAINS for peanut allergy (Danish peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'vegetabilsk olie, salt, jordnødder')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('jordnøddesmør is CONTAINS for peanut allergy (compound, no word peanut)', () => {
  const out = detect(['peanuts'], 'sukker, jordnøddesmør, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only jordnødder', () => {
  const out = detect(['tree_nuts'], 'vegetabilsk olie, salt, jordnødder')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('fisk is CONTAINS for fish allergy (Danish fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'olie, mel, fisk, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('mælk is CONTAINS for milk allergy (Danish milk ≠ English milk)', () => {
  const out = detect(['milk'], 'sukker, mælk, kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('ost is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'majsstivelse, ost, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('smør matches after ø→o fold', () => {
  const out = detect(['milk'], 'sukker, smør, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('kokosmælk does not fire milk (compound, do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'vand, kokosmælk, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('hasselnødder is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'sukker, hasselnødder, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Indeholder: nødder is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'sukker, kakao, vanilje. Indeholder: nødder')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('sesam is CONTAINS for sesame allergy (Danish sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'olie, sesam, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('rejer is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'olie, hvidløg, rejer, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('hvedemel is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'sukker, hvedemel, salt')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('ærteprotein does not fire egg allergy (do not add generic protein)', () => {
  const out = detect(['eggs'], 'vand, ærteprotein, salt')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Danish terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, host, most, cost, frost, poster, boston')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, egg, aggregation, jagged')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const eggsSafe = detect(['eggs'], 'water, aggregation, jagged, protein isolate')
  assert.equal(eggsSafe.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, fiscal, starfish, office, fortune, tuning')
  assert.equal(fish.overall_status, 'SAFE')
  const salmon = detect(['fish'], 'water, relax, flax, galaxy')
  assert.equal(salmon.overall_status, 'SAFE')
  const wheat = detect(['wheat'], 'water, ragu, popcorn, corn flakes')
  assert.equal(wheat.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only æg stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'majsstivelse, æg, salt')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('does not contain is not a tree-nut hit (do not add bare nød → nod)', () => {
  const out = detect(['tree_nuts'], 'water, sugar, salt. does not contain peanuts')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('celiac AVOID on hvedemel and Indeholder: gluten, but not boghvede', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['hvedemel', 'sukker'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['sukker', 'kakao'], 'Indeholder: gluten')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['boghvede', 'salt'], '')), 'SAFE')
})
