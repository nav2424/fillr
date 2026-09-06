/**
 * Whole-word matching misses Dutch legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Dutch or Belgian labels. English `milk` does not match
 * `melk`; `egg` does not match `ei`/`eieren`; French `arachide` does not stem
 * to `pinda`. Dutch sesame is `sesam`, not `sesame`/`sésame`.
 *
 * Distinct from Portuguese (ovos/amendoim), Spanish (leche/huevo/cacahuate),
 * Italian (uova/arachidi/pesce), and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.dutch-legal-names.test.ts
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

test('eieren is CONTAINS for egg allergy (Dutch eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'suiker, eieren, zout')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('ei singular is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'water, ei, zout')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Bevat: ei is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'rijstebloem, suiker, zout. Bevat: ei')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Bevat as a Contains header and does not steal bevatten', () => {
  const parsed = parseSections('rijstebloem, zout. Bevat: ei, melk')
  assert.match(parsed.contains_text, /ei/i)
  assert.match(parsed.contains_text, /melk/i)
  assert.doesNotMatch(parsed.ingredients_text, /Bevat/i)

  const may = parseSections('rijstebloem, zout. Kan bevatten: noten')
  assert.match(may.may_contain_text, /noten/i)
  assert.doesNotMatch(may.contains_text, /noten/i)

  const out = detect(['tree_nuts'], 'rijstebloem, zout. Kan bevatten: noten')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('English Ingredients: prefix still strips after adding Ingrediënten', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)
})

test('pinda is CONTAINS for peanut allergy (Dutch peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'plantaardige olie, zout, pinda')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('pindakaas is CONTAINS for peanut allergy (compound, no word pinda)', () => {
  const out = detect(['peanuts'], 'suiker, pindakaas, zout')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only pinda', () => {
  const out = detect(['tree_nuts'], 'plantaardige olie, zout, pinda')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('vis is CONTAINS for fish allergy (Dutch fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'olie, bloem, vis, zout')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('melk is CONTAINS for milk allergy (Dutch milk ≠ English milk)', () => {
  const out = detect(['milk'], 'suiker, melk, cacao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('kaas is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'rijstebloem, kaas, zout')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('kokosmelk stays SAFE for milk allergy (compound coconut milk, no whole-word melk)', () => {
  const out = detect(['milk'], 'rijst, kokosmelk, zout')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('amandelen is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'suiker, amandelen, zout')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Bevat: schaalvruchten is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'suiker, cacao, vanille. Bevat: schaalvruchten')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('sesamzaad is CONTAINS for sesame allergy (Dutch sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'olie, sesamzaad, zout')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('garnalen is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'olie, knoflook, garnalen, zout')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('tarwemeel is CONTAINS for wheat allergy (compound, no word wheat/blé)', () => {
  const out = detect(['wheat'], 'suiker, tarwemeel, zout')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('short Dutch terms do not fire on English lookalikes', () => {
  const eggs = detect(['eggs'], 'water, protein isolate, either flavor, weight')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, television, visual, advisor')
  assert.equal(fish.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only eieren stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEieren = detect(['peanuts'], 'rijstebloem, eieren, zout')
  assert.equal(peanutOnEieren.overall_status, 'SAFE')
  assert.equal(peanutOnEieren.matched_allergens.length, 0)
})

test('celiac AVOID on tarwemeel and Bevat: gluten, but not boekweit', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['tarwemeel', 'suiker'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['suiker', 'cacao'], 'Bevat: gluten')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['boekweit', 'zout'], '')), 'SAFE')
})
