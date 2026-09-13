/**
 * Whole-word matching misses Hungarian legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Hungarian labels. English `milk` does not match `tej`;
 * `egg` does not match `tojás`; French `arachide` does not stem to `földimogyoró`.
 * Hungarian sesame is `szezám`, not `sesame`/`sésame`. Hungarian soy `szója`
 * folds to `szoja`, which is not the existing `soja` synonym.
 * NFKD + combining-mark strip folds á/é/í/ó/ö/ő/ú/ü/ű.
 *
 * Distinct from Slovak (vajcia/mlieko), Czech (vejce/mléko), Finnish (muna/maito),
 * Danish (æg/mælk), Swedish (ägg/mjölk), Polish (jajka/mleko), Dutch (ei/pinda/melk),
 * Portuguese (ovos/amendoim), Spanish (leche/huevo), Italian (uova/arachidi),
 * and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.hungarian-legal-names.test.ts
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

test('Hungarian diacritics fold via NFKD so word-boundary matching can fire', () => {
  assert.equal(normalizeText('tojás'), 'tojas')
  assert.equal(normalizeText('földimogyoró'), 'foldimogyoro')
  assert.equal(normalizeText('szója'), 'szoja')
  assert.equal(normalizeText('szezám'), 'szezam')
  assert.equal(normalizeText('búza'), 'buza')
  assert.equal(normalizeText('diófélék'), 'diofelek')
  assert.equal(normalizeText('Összetevők'), 'osszetevok')
  assert.equal(normalizeText('tej'), 'tej')
  assert.equal(normalizeText('hal'), 'hal')
  assert.equal(normalizeText('tőkehal'), 'tokehal')
})

test('tojás is CONTAINS for egg allergy (Hungarian eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'cukor, tojás, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('tojásfehérje is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'víz, tojásfehérje, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Tartalmaz: tojás is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'kukoricaliszt, cukor, só. Tartalmaz: tojás')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Tartalmaz as a Contains header and does not steal nem tartalmaz', () => {
  const parsed = parseSections('kukoricaliszt, só. Tartalmaz: tojás, tej')
  assert.match(parsed.contains_text, /tojás/i)
  assert.match(parsed.contains_text, /tej/i)
  assert.doesNotMatch(parsed.ingredients_text, /Tartalmaz/i)

  const may = parseSections('kukoricaliszt, só. Tartalmazhat: diófélék')
  assert.match(may.may_contain_text, /diófélék/i)
  assert.doesNotMatch(may.contains_text, /diófélék/i)

  const out = detect(['tree_nuts'], 'kukoricaliszt, só. Tartalmazhat: diófélék')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const ocrMay = parseSections('rizs, só. Nyomokban tartalmazhat: diófélék')
  assert.match(ocrMay.may_contain_text, /diófélék/i)
  assert.doesNotMatch(ocrMay.contains_text, /diófélék/i)

  const noSteal = parseSections('rizs, só. nem tartalmaz tojást')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /nem tartalmaz tojást/i)
})

test('English Ingredients: prefix still strips after adding Összetevők', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const hu = parseSections('Összetevők: cukor, só, kukoricaliszt')
  assert.match(hu.ingredients_text, /cukor/i)
  assert.doesNotMatch(hu.ingredients_text, /Összetevők/i)

  const ocr = parseSections('Osszetevok: cukor, só, kukoricaliszt')
  assert.match(ocr.ingredients_text, /cukor/i)
  assert.doesNotMatch(ocr.ingredients_text, /Osszetevok/i)
})

test('földimogyoró is CONTAINS for peanut allergy (Hungarian peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'növényi olaj, só, földimogyoró')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('földimogyoróvaj is CONTAINS for peanut allergy (compound, no word peanut)', () => {
  const out = detect(['peanuts'], 'cukor, földimogyoróvaj, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only földimogyoró', () => {
  const out = detect(['tree_nuts'], 'növényi olaj, só, földimogyoró')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('hal is CONTAINS for fish allergy (Hungarian fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'olaj, liszt, hal, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('tonhal is CONTAINS for fish allergy (compound tuna, no standalone hal)', () => {
  const out = detect(['fish'], 'olaj, tonhal, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('tej is CONTAINS for milk allergy (Hungarian milk ≠ English milk)', () => {
  const out = detect(['milk'], 'cukor, tej, kakaó')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('sajt is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'kukoricaliszt, sajt, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('földimogyoróvaj does not fire milk (compound butter, not standalone vaj)', () => {
  const out = detect(['milk'], 'cukor, földimogyoróvaj, só')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('tej still fires when kókusztej is also present (do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'víz, tej, kókusztej, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('kókusztej alone does not fire milk (compound, no standalone tej)', () => {
  const out = detect(['milk'], 'víz, kókusztej, só')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('mandula is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'cukor, mandula, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Tartalmaz: diófélék is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'cukor, kakaó, vanília. Tartalmaz: diófélék')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('kókuszdió does not fire tree nuts (do not treat coconut as dió)', () => {
  const out = detect(['tree_nuts'], 'cukor, kókuszdió, só')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('szezám is CONTAINS for sesame allergy (Hungarian sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'olaj, szezám, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('szója is CONTAINS for soy allergy (szoja ≠ existing soja after NFKD)', () => {
  const out = detect(['soy'], 'olaj, szója, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('garnéla is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'olaj, fokhagyma, garnéla, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('búzaliszt is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'cukor, búzaliszt, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('mustár is CONTAINS for mustard allergy', () => {
  const out = detect(['mustard'], 'olaj, mustár, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'mustard'))
})

test('zeller is CONTAINS for celery allergy', () => {
  const out = detect(['celery'], 'olaj, zeller, só')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'celery'))
})

test('borsófehérje does not fire egg allergy (do not add generic protein)', () => {
  const out = detect(['eggs'], 'víz, borsófehérje, só')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Hungarian terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, dessert, serial, conserve, syrup, server')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, average, conveyance, vegetable')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, half, halloumi, halal, chalk')
  assert.equal(fish.overall_status, 'SAFE')
  const celery = detect(['celery'], 'water, accelerator, excellent')
  assert.equal(celery.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only tojás stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'kukoricaliszt, tojás, só')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('kukoricaliszt does not fire wheat (do not add bare liszt)', () => {
  const out = detect(['wheat'], 'cukor, kukoricaliszt, só')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'wheat'), false)
})

test('celiac AVOID on búzaliszt and Tartalmaz: glutén, but not hajdina or gluténmentes', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['búzaliszt', 'cukor'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['cukor', 'kakaó'], 'Tartalmaz: glutén')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['hajdina', 'só'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['gluténmentes rizs', 'só'], '')), 'SAFE')
})
