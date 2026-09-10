/**
 * Whole-word matching misses Finnish legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Finnish labels. English `milk` does not match `maito`;
 * `egg` does not match `muna`; French `arachide` does not stem to `maapähkinä`.
 * Finnish sesame is `seesami`, not `sesame`/`sésame`/`sesam`. Finnish soy is
 * `soija`, not `soja`. NFKD folds ä/ö, so `pähkinä` becomes `pahkina`.
 *
 * Distinct from Danish (æg/mælk), Swedish (ägg/mjölk), Polish (jajka/mleko),
 * Dutch (ei/pinda/melk), Portuguese (ovos/amendoim), Spanish (leche/huevo),
 * Italian (uova/arachidi), and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.finnish-legal-names.test.ts
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

test('ä folds via NFKD so word-boundary matching can fire', () => {
  assert.equal(normalizeText('pähkinä'), 'pahkina')
  assert.equal(normalizeText('maapähkinä'), 'maapahkina')
  assert.equal(normalizeText('äyriäiset'), 'ayriaiset')
  assert.equal(normalizeText('maito'), 'maito')
  assert.equal(normalizeText('muna'), 'muna')
})

test('muna is CONTAINS for egg allergy (Finnish eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'sokeri, muna, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('munanvalkuainen is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'vesi, munanvalkuainen, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Sisältää: muna is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'maissitärkkelys, sokeri, suola. Sisältää: muna')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Sisältää as a Contains header and does not steal ei sisällä', () => {
  const parsed = parseSections('maissitärkkelys, suola. Sisältää: muna, maito')
  assert.match(parsed.contains_text, /muna/i)
  assert.match(parsed.contains_text, /maito/i)
  assert.doesNotMatch(parsed.ingredients_text, /Sisältää/i)

  const may = parseSections('maissitärkkelys, suola. Saattaa sisältää: pähkinöitä')
  assert.match(may.may_contain_text, /pähkinöitä/i)
  assert.doesNotMatch(may.contains_text, /pähkinöitä/i)

  const out = detect(['tree_nuts'], 'maissitärkkelys, suola. Saattaa sisältää: pähkinöitä')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const voiMay = parseSections('riisi, suola. Voi sisältää: pähkinöitä')
  assert.match(voiMay.may_contain_text, /pähkinöitä/i)
  assert.doesNotMatch(voiMay.contains_text, /pähkinöitä/i)

  const noSteal = parseSections('riisi, suola. ei sisällä munaa')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /ei sisällä munaa/i)
})

test('English Ingredients: prefix still strips after adding Ainesosat', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const fi = parseSections('Ainesosat: sokeri, suola, maissitärkkelys')
  assert.match(fi.ingredients_text, /sokeri/i)
  assert.doesNotMatch(fi.ingredients_text, /Ainesosat/i)
})

test('maapähkinä is CONTAINS for peanut allergy (Finnish peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'kasviöljy, suola, maapähkinä')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('maapähkinävoi is CONTAINS for peanut allergy (compound, no word peanut)', () => {
  const out = detect(['peanuts'], 'sokeri, maapähkinävoi, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only maapähkinä', () => {
  const out = detect(['tree_nuts'], 'kasviöljy, suola, maapähkinä')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('kala is CONTAINS for fish allergy (Finnish fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'öljy, jauho, kala, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('maito is CONTAINS for milk allergy (Finnish milk ≠ English milk)', () => {
  const out = detect(['milk'], 'sokeri, maito, kaakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('juusto is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'maissitärkkelys, juusto, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('kookosmaito does not fire milk (compound, do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'vesi, kookosmaito, suola')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('Voi sisältää does not fire milk (do not add voi — it is also the may-contain modal)', () => {
  const milk = detect(['milk'], 'riisi, suola. Voi sisältää: pähkinöitä')
  assert.equal(milk.overall_status, 'SAFE')
  assert.equal(milk.matched_allergens.some((m) => m.allergen_id === 'milk'), false)

  const nuts = detect(['tree_nuts'], 'riisi, suola. Voi sisältää: pähkinöitä')
  assert.equal(nuts.overall_status, 'MAY_CONTAIN')
  assert.ok(nuts.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('hasselpähkinä is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'sokeri, hasselpähkinä, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Sisältää: pähkinät is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'sokeri, kaakao, vanilja. Sisältää: pähkinät')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('seesami is CONTAINS for sesame allergy (Finnish sesame ≠ sesame/sésame/sesam)', () => {
  const out = detect(['sesame'], 'öljy, seesami, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('soija is CONTAINS for soy allergy (Finnish soy ≠ soja)', () => {
  const out = detect(['soy'], 'öljy, soija, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('katkarapu is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'öljy, valkosipuli, katkarapu, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('vehnäjauho is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'sokeri, vehnäjauho, suola')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('herneproteiini does not fire egg allergy (do not add generic protein)', () => {
  const out = detect(['eggs'], 'vesi, herneproteiini, suola')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Finnish terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, tomato, maitake, host, most, cost')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, egg, aggregation, jagged')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const eggsSafe = detect(['eggs'], 'water, aggregation, jagged, ammunition, communication')
  assert.equal(eggsSafe.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, kalamata, calendar, scala, fiscal')
  assert.equal(fish.overall_status, 'SAFE')
  const salmon = detect(['fish'], 'water, abolish, phi, success')
  assert.equal(salmon.overall_status, 'SAFE')
  const wheat = detect(['wheat'], 'water, ragu, popcorn, corn flakes')
  assert.equal(wheat.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only muna stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'maissitärkkelys, muna, suola')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('does not contain is not a tree-nut hit (do not add bare pähkinä)', () => {
  const out = detect(['tree_nuts'], 'water, sugar, salt. does not contain peanuts')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('celiac AVOID on vehnäjauho and Sisältää: gluteeni, but not tattari or gluteeniton', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['vehnäjauho', 'sokeri'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['sokeri', 'kaakao'], 'Sisältää: gluteeni')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['tattari', 'suola'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['gluteeniton kaurahiutale', 'suola'], '')), 'SAFE')
})
