/**
 * Whole-word matching misses Bulgarian legal allergen names. Cyrillic stems
 * never contain English/French dictionary words (egg/oeuf, peanut/arachide,
 * fish/poisson, milk/lait). JS \\b is ASCII-only, so even an added synonym
 * like яйца would not match until word boundaries treat unicode letters as
 * word characters.
 *
 * OCR never translates Bulgarian labels. English `milk` does not match `мляко`;
 * `egg` does not match `яйца`; French `arachide` does not stem to `фъстъци`.
 * Bulgarian soy `соя` is not the existing Latin `soja`. Bulgarian sesame is
 * `сусам`, not `sesame`/`sésame`.
 *
 * NFKD decomposes Cyrillic `й` (яйца → яица after combining-mark strip).
 * Hard sign `ъ` does not decompose.
 *
 * Distinct from Romanian (ouă/lapte), Hungarian (tojás/tej), Slovak (vajcia/mlieko),
 * Czech (vejce/mléko), Finnish (muna/maito), Danish (æg/mælk), Swedish (ägg/mjölk),
 * Polish (jajka/mleko), Dutch (ei/pinda/melk), Portuguese (ovos/amendoim),
 * Spanish (leche/huevo), Italian (uova/arachidi), and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.bulgarian-legal-names.test.ts
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

test('Bulgarian й decomposes via NFKD; ъ does not; Latin milk still folds', () => {
  assert.equal(normalizeText('яйца'), 'яица')
  assert.equal(normalizeText('яйчен'), 'яичен')
  assert.equal(normalizeText('фъстъци'), 'фъстъци')
  assert.equal(normalizeText('мляко'), 'мляко')
  assert.equal(normalizeText('съдържа'), 'съдържа')
  assert.equal(normalizeText('пшеница'), 'пшеница')
  assert.equal(normalizeText('соя'), 'соя')
  assert.equal(normalizeText('сусам'), 'сусам')
  assert.equal(normalizeText('milk'), 'milk')
})

test('яйца is CONTAINS for egg allergy (Bulgarian eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'захар, яйца, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('яйчен белтък is CONTAINS for egg allergy (not generic protein)', () => {
  const out = detect(['eggs'], 'вода, яйчен белтък, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Съдържа: яйца is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'царевично брашно, захар, сол. Съдържа: яйца')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Съдържа as a Contains header and does not steal не съдържа', () => {
  const parsed = parseSections('царевично брашно, сол. Съдържа: яйца, мляко')
  assert.match(parsed.contains_text, /яйца/i)
  assert.match(parsed.contains_text, /мляко/i)
  assert.doesNotMatch(parsed.ingredients_text, /Съдържа/i)

  const may = parseSections('царевично брашно, сол. Може да съдържа: ядки')
  assert.match(may.may_contain_text, /ядки/i)
  assert.doesNotMatch(may.contains_text, /ядки/i)

  const out = detect(['tree_nuts'], 'царевично брашно, сол. Може да съдържа: ядки')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const traces = parseSections('ориз, сол. Може да съдържа следи от: ядки')
  assert.match(traces.may_contain_text, /ядки/i)
  assert.doesNotMatch(traces.contains_text, /ядки/i)

  const noSteal = parseSections('ориз, сол. не съдържа яйца')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /не съдържа яйца/i)
})

test('English Ingredients: prefix still strips after adding Съставки', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const bg = parseSections('Съставки: захар, сол, царевично брашно')
  assert.match(bg.ingredients_text, /захар/i)
  assert.doesNotMatch(bg.ingredients_text, /Съставки/i)
})

test('фъстъци is CONTAINS for peanut allergy (Bulgarian peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'растително олио, сол, фъстъци')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('фъстъчено масло is CONTAINS for peanut allergy (no word peanut)', () => {
  const out = detect(['peanuts'], 'захар, фъстъчено масло, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only фъстъци', () => {
  const out = detect(['tree_nuts'], 'растително олио, сол, фъстъци')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('шам-фъстък is tree nut CONTAINS and does not fire peanut (do not add bare фъстък)', () => {
  const nuts = detect(['tree_nuts'], 'захар, шам-фъстък, сол')
  assert.equal(nuts.overall_status, 'CONTAINS')
  assert.ok(nuts.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const peanuts = detect(['peanuts'], 'захар, шам-фъстък, сол')
  assert.equal(peanuts.overall_status, 'SAFE')
  assert.equal(peanuts.matched_allergens.some((m) => m.allergen_id === 'peanuts'), false)
})

test('фъстъчено масло does not fire milk (do not add bare масло)', () => {
  const out = detect(['milk'], 'захар, фъстъчено масло, сол')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('риба is CONTAINS for fish allergy (Bulgarian fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'олио, брашно, риба, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('сьомга is CONTAINS for fish allergy (species name, no standalone риба)', () => {
  const out = detect(['fish'], 'олио, сьомга, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('тон is CONTAINS for fish allergy (Bulgarian tuna)', () => {
  const out = detect(['fish'], 'олио, тон, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('мляко is CONTAINS for milk allergy (Bulgarian milk ≠ English milk)', () => {
  const out = detect(['milk'], 'захар, мляко, какао')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('сирене is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'царевично брашно, сирене, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('мляко still fires when кокосово мляко is also present (do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'вода, мляко, кокосово мляко, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('бадеми is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'захар, бадеми, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Съдържа: ядки is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'захар, какао, ванилия. Съдържа: ядки')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('сусам is CONTAINS for sesame allergy (Bulgarian sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'олио, сусам, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('соя is CONTAINS for soy allergy (соя ≠ existing soja)', () => {
  const out = detect(['soy'], 'олио, соя, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('скариди is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'олио, чесън, скариди, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('пшенично брашно is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'захар, пшенично брашно, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('горчица is CONTAINS for mustard allergy', () => {
  const out = detect(['mustard'], 'олио, горчица, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'mustard'))
})

test('целина is CONTAINS for celery allergy', () => {
  const out = detect(['celery'], 'олио, целина, сол')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'celery'))
})

test('грахов белтък does not fire egg allergy (do not add generic белтък)', () => {
  const out = detect(['eggs'], 'вода, грахов белтък, сол')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('unicode word boundaries still reject ASCII false friends and keep English matches', () => {
  const donut = detect(['tree_nuts'], 'water, sugar, donut, salt')
  assert.equal(donut.overall_status, 'SAFE')
  const milk = detect(['milk'], 'water, sugar, milk, salt')
  assert.equal(milk.overall_status, 'CONTAINS')
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
})

test('яйца as a prefix inside a longer token does not match', () => {
  const out = detect(['eggs'], 'вода, яйцария, сол')
  assert.equal(out.overall_status, 'SAFE')
})

test('short Bulgarian terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, later, plate, clap, dessert, syrup')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, you, our, average, vegetable')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, 1 ton, boston, cotton, wonton')
  assert.equal(fish.overall_status, 'SAFE')
  const celery = detect(['celery'], 'water, accelerator, excellent')
  assert.equal(celery.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only яйца stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'царевично брашно, яйца, сол')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('царевично брашно does not fire wheat (do not add bare брашно)', () => {
  const out = detect(['wheat'], 'захар, царевично брашно, сол')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'wheat'), false)
})

test('celiac AVOID on пшенично брашно and Съдържа: глутен, but not елда', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['пшенично брашно', 'захар'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['захар', 'какао'], 'Съдържа: глутен')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['елда', 'сол'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['царевично брашно', 'сол'], '')), 'SAFE')
})
