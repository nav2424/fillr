/**
 * Whole-word matching misses Polish legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Polish labels. English `milk` does not match `mleko`;
 * `egg` does not match `jajka`; French `arachide` does not stem to
 * `orzeszki ziemne`. Polish sesame is `sezam`, not `sesame`/`sésame`.
 *
 * Distinct from Dutch (ei/pinda/melk), Portuguese (ovos/amendoim),
 * Spanish (leche/huevo/cacahuate), Italian (uova/arachidi/pesce),
 * and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.polish-legal-names.test.ts
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

test('jajka is CONTAINS for egg allergy (Polish eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'cukier, jajka, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('jajko singular is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'woda, jajko, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Zawiera: jajka is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'mąka kukurydziana, cukier, sól. Zawiera: jajka')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Zawiera as a Contains header and does not steal nie zawiera', () => {
  const parsed = parseSections('mąka kukurydziana, sól. Zawiera: jajka, mleko')
  assert.match(parsed.contains_text, /jajka/i)
  assert.match(parsed.contains_text, /mleko/i)
  assert.doesNotMatch(parsed.ingredients_text, /Zawiera/i)

  const may = parseSections('mąka kukurydziana, sól. Może zawierać: orzechy')
  assert.match(may.may_contain_text, /orzechy/i)
  assert.doesNotMatch(may.contains_text, /orzechy/i)

  const out = detect(['tree_nuts'], 'mąka kukurydziana, sól. Może zawierać: orzechy')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const noSteal = parseSections('ryż, sól. nie zawiera jajek')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /nie zawiera jajek/i)
})

test('English Ingredients: prefix still strips after adding Składniki', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const pl = parseSections('Składniki: cukier, sól, mąka kukurydziana')
  assert.match(pl.ingredients_text, /cukier/i)
  assert.doesNotMatch(pl.ingredients_text, /Składniki/i)
})

test('orzeszki ziemne is CONTAINS for peanut allergy (Polish peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'olej roślinny, sól, orzeszki ziemne')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('pasta arachidowa is CONTAINS for peanut allergy (compound, no word peanut)', () => {
  const out = detect(['peanuts'], 'cukier, pasta arachidowa, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only orzeszki ziemne', () => {
  const out = detect(['tree_nuts'], 'olej roślinny, sól, orzeszki ziemne')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('ryba is CONTAINS for fish allergy (Polish fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'olej, mąka, ryba, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('mleko is CONTAINS for milk allergy (Polish milk ≠ English milk)', () => {
  const out = detect(['milk'], 'cukier, mleko, kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('ser is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'mąka kukurydziana, ser, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('masło matches after ł→l fold', () => {
  const out = detect(['milk'], 'cukier, masło, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('orzechy laskowe is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'cukier, orzechy laskowe, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Zawiera: orzechy is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'cukier, kakao, wanilia. Zawiera: orzechy')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('sezam is CONTAINS for sesame allergy (Polish sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'olej, sezam, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('krewetki is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'olej, czosnek, krewetki, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('mąka pszenna is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'cukier, mąka pszenna, sól')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('białko grochu does not fire egg allergy (do not add bare białko)', () => {
  const out = detect(['eggs'], 'woda, białko grochu, sól')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Polish terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, dessert, serial, conserve, server')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, protein isolate, either flavor, weight')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, television, visual, advisor')
  assert.equal(fish.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only jajka stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnJajka = detect(['peanuts'], 'mąka kukurydziana, jajka, sól')
  assert.equal(peanutOnJajka.overall_status, 'SAFE')
  assert.equal(peanutOnJajka.matched_allergens.length, 0)
})

test('celiac AVOID on mąka pszenna and Zawiera: gluten, but not gryka', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['mąka pszenna', 'cukier'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['cukier', 'kakao'], 'Zawiera: gluten')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['gryka', 'sól'], '')), 'SAFE')
})
