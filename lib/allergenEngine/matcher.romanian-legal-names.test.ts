/**
 * Whole-word matching misses Romanian legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Romanian labels. English `milk` does not match `lapte`;
 * `egg` does not match `ouă`; French `arachide` does not stem to `arahide`.
 * Romanian sesame is `susan`, not `sesame`/`sésame`. Romanian soy `soia`
 * does not equal the existing `soja` synonym.
 * NFKD + combining-mark strip folds ă/â/î/ș/ț (and cedilla ș/ț).
 *
 * Distinct from Hungarian (tojás/tej), Slovak (vajcia/mlieko), Czech (vejce/mléko),
 * Finnish (muna/maito), Danish (æg/mælk), Swedish (ägg/mjölk), Polish (jajka/mleko),
 * Dutch (ei/pinda/melk), Portuguese (ovos/amendoim), Spanish (leche/huevo),
 * Italian (uova/arachidi), and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.romanian-legal-names.test.ts
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

test('Romanian diacritics fold via NFKD so word-boundary matching can fire', () => {
  assert.equal(normalizeText('ouă'), 'oua')
  assert.equal(normalizeText('albuș'), 'albus')
  assert.equal(normalizeText('gălbenuș'), 'galbenus')
  assert.equal(normalizeText('pește'), 'peste')
  assert.equal(normalizeText('soia'), 'soia')
  assert.equal(normalizeText('susan'), 'susan')
  assert.equal(normalizeText('grâu'), 'grau')
  assert.equal(normalizeText('țelină'), 'telina')
  assert.equal(normalizeText('muștar'), 'mustar')
  assert.equal(normalizeText('conține'), 'contine')
  assert.equal(normalizeText('brânză'), 'branza')
  assert.equal(normalizeText('fructe cu coajă'), 'fructe cu coaja')
  assert.equal(normalizeText('lapte'), 'lapte')
  assert.equal(normalizeText('arahide'), 'arahide')
})

test('ouă is CONTAINS for egg allergy (Romanian eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'zahăr, ouă, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('albuș is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'apă, albuș, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Conține: ouă is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'făină de porumb, zahăr, sare. Conține: ouă')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Conține as a Contains header and does not steal nu conține', () => {
  const parsed = parseSections('făină de porumb, sare. Conține: ouă, lapte')
  assert.match(parsed.contains_text, /ouă/i)
  assert.match(parsed.contains_text, /lapte/i)
  assert.doesNotMatch(parsed.ingredients_text, /Conține/i)

  const may = parseSections('făină de porumb, sare. Poate conține: fructe cu coajă')
  assert.match(may.may_contain_text, /fructe cu coajă/i)
  assert.doesNotMatch(may.contains_text, /fructe cu coajă/i)

  const out = detect(['tree_nuts'], 'făină de porumb, sare. Poate conține: fructe cu coajă')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const ocrMay = parseSections('orez, sare. Poate contine urme de: fructe cu coaja')
  assert.match(ocrMay.may_contain_text, /fructe cu coaja/i)
  assert.doesNotMatch(ocrMay.contains_text, /fructe cu coaja/i)

  const noSteal = parseSections('orez, sare. nu conține ouă')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /nu conține ouă/i)
})

test('English Ingredients: prefix still strips after adding Ingrediente', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const ro = parseSections('Ingrediente: zahăr, sare, făină de porumb')
  assert.match(ro.ingredients_text, /zahăr/i)
  assert.doesNotMatch(ro.ingredients_text, /Ingrediente/i)
})

test('arahide is CONTAINS for peanut allergy (Romanian peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'ulei vegetal, sare, arahide')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('unt de arahide is CONTAINS for peanut allergy (no word peanut)', () => {
  const out = detect(['peanuts'], 'zahăr, unt de arahide, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only arahide', () => {
  const out = detect(['tree_nuts'], 'ulei vegetal, sare, arahide')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('unt de arahide does not fire milk (do not add bare unt)', () => {
  const out = detect(['milk'], 'zahăr, unt de arahide, sare')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('pește is CONTAINS for fish allergy (Romanian fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'ulei, făină, pește, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('somon is CONTAINS for fish allergy (species name, no standalone pește)', () => {
  const out = detect(['fish'], 'ulei, somon, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('ton is CONTAINS for fish allergy (Romanian tuna)', () => {
  const out = detect(['fish'], 'ulei, ton, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('lapte is CONTAINS for milk allergy (Romanian milk ≠ English milk)', () => {
  const out = detect(['milk'], 'zahăr, lapte, cacao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('brânză is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'făină de porumb, brânză, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('lapte still fires when lapte de cocos is also present (do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'apă, lapte, lapte de cocos, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('migdale is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'zahăr, migdale, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Conține: fructe cu coajă is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'zahăr, cacao, vanilie. Conține: fructe cu coajă')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('susan is CONTAINS for sesame allergy (Romanian sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'ulei, susan, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('soia is CONTAINS for soy allergy (soia ≠ existing soja)', () => {
  const out = detect(['soy'], 'ulei, soia, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('creveți is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'ulei, usturoi, creveți, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('făină de grâu is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'zahăr, făină de grâu, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('muștar is CONTAINS for mustard allergy', () => {
  const out = detect(['mustard'], 'ulei, muștar, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'mustard'))
})

test('țelină is CONTAINS for celery allergy', () => {
  const out = detect(['celery'], 'ulei, țelină, sare')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'celery'))
})

test('proteină de mazăre does not fire egg allergy (do not add generic protein)', () => {
  const out = detect(['eggs'], 'apă, proteină de mazăre, sare')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('French ou does not fire egg allergy (do not add bare ou)', () => {
  const out = detect(['eggs'], 'sel, poivre ou paprika, huile')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Romanian terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, later, plate, clap, dessert, syrup')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, you, our, average, vegetable')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, pesticide, tempest, boston, cotton, wonton')
  assert.equal(fish.overall_status, 'SAFE')
  const celery = detect(['celery'], 'water, accelerator, excellent')
  assert.equal(celery.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only ouă stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'făină de porumb, ouă, sare')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('făină de porumb does not fire wheat (do not add bare făină)', () => {
  const out = detect(['wheat'], 'zahăr, făină de porumb, sare')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'wheat'), false)
})

test('celiac AVOID on făină de grâu and Conține: gluten, but not hrișcă', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['făină de grâu', 'zahăr'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['zahăr', 'cacao'], 'Conține: gluten')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['hrișcă', 'sare'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['făină de porumb', 'sare'], '')), 'SAFE')
})
