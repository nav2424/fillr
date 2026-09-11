/**
 * Whole-word matching misses Czech legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Czech labels. English `milk` does not match `mléko`;
 * `egg` does not match `vejce`; French `arachide` does not stem to `arašídy`.
 * Czech sesame is `sezam`, not `sesame`/`sésame`. Czech soy `sója` already
 * matches existing `soja` after NFKD. NFKD folds á/č/ě/í/ň/ř/š/ů/ý/ž.
 *
 * Distinct from Finnish (muna/maito), Danish (æg/mælk), Swedish (ägg/mjölk),
 * Polish (jajka/mleko), Dutch (ei/pinda/melk), Portuguese (ovos/amendoim),
 * Spanish (leche/huevo), Italian (uova/arachidi), and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.czech-legal-names.test.ts
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

test('Czech diacritics fold via NFKD so word-boundary matching can fire', () => {
  assert.equal(normalizeText('mléko'), 'mleko')
  assert.equal(normalizeText('arašídy'), 'arasidy')
  assert.equal(normalizeText('pšeničná'), 'psenicna')
  assert.equal(normalizeText('hořčice'), 'horcice')
  assert.equal(normalizeText('tuňák'), 'tunak')
  assert.equal(normalizeText('vejce'), 'vejce')
})

test('vejce is CONTAINS for egg allergy (Czech eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'cukr, vejce, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('vaječný bílek is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'voda, vaječný bílek, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Obsahuje: vejce is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'kukuřičný škrob, cukr, sůl. Obsahuje: vejce')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Obsahuje as a Contains header and does not steal ne obsahuje', () => {
  const parsed = parseSections('kukuřičný škrob, sůl. Obsahuje: vejce, mléko')
  assert.match(parsed.contains_text, /vejce/i)
  assert.match(parsed.contains_text, /mléko/i)
  assert.doesNotMatch(parsed.ingredients_text, /Obsahuje/i)

  const may = parseSections('kukuřičný škrob, sůl. Může obsahovat: ořechy')
  assert.match(may.may_contain_text, /ořechy/i)
  assert.doesNotMatch(may.contains_text, /ořechy/i)

  const out = detect(['tree_nuts'], 'kukuřičný škrob, sůl. Může obsahovat: ořechy')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const muzeMay = parseSections('rýže, sůl. Muze obsahovat: ořechy')
  assert.match(muzeMay.may_contain_text, /ořechy/i)
  assert.doesNotMatch(muzeMay.contains_text, /ořechy/i)

  const noSteal = parseSections('rýže, sůl. ne obsahuje vejce')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /ne obsahuje vejce/i)
})

test('English Ingredients: prefix still strips after adding Složení', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const cs = parseSections('Složení: cukr, sůl, kukuřičná mouka')
  assert.match(cs.ingredients_text, /cukr/i)
  assert.doesNotMatch(cs.ingredients_text, /Složení/i)

  const ocr = parseSections('Slozeni: cukr, sůl, kukuřičná mouka')
  assert.match(ocr.ingredients_text, /cukr/i)
  assert.doesNotMatch(ocr.ingredients_text, /Slozeni/i)
})

test('arašídy is CONTAINS for peanut allergy (Czech peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'rostlinný olej, sůl, arašídy')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('arašídové máslo is CONTAINS for peanut allergy (compound, no word peanut)', () => {
  const out = detect(['peanuts'], 'cukr, arašídové máslo, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only arašídy', () => {
  const out = detect(['tree_nuts'], 'rostlinný olej, sůl, arašídy')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('ryba is CONTAINS for fish allergy (Czech fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'olej, mouka, ryba, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('mléko is CONTAINS for milk allergy (Czech milk ≠ English milk)', () => {
  const out = detect(['milk'], 'cukr, mléko, kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('sýr is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'kukuřičná mouka, sýr, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('arašídové máslo does not fire milk (do not add máslo)', () => {
  const out = detect(['milk'], 'cukr, arašídové máslo, sůl')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('mléko still fires when kokosové mléko is also present (do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'voda, mléko, kokosové mléko, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('lískové ořechy is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'cukr, lískové ořechy, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Obsahuje: ořechy is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'cukr, kakao, vanilka. Obsahuje: ořechy')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('sezam is CONTAINS for sesame allergy (Czech sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'olej, sezam, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('sója still matches soy after NFKD (existing soja synonym)', () => {
  const out = detect(['soy'], 'olej, sója, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('krevety is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'olej, česnek, krevety, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('pšeničná mouka is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'cukr, pšeničná mouka, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('hořčice is CONTAINS for mustard allergy', () => {
  const out = detect(['mustard'], 'olej, hořčice, sůl')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'mustard'))
})

test('hráchový protein does not fire egg allergy (do not add generic protein)', () => {
  const out = detect(['eggs'], 'voda, hráchový protein, sůl')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Czech terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, dessert, serial, conserve, syrup, server')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, average, conveyance, vegetable')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, library, crybaby, calendar')
  assert.equal(fish.overall_status, 'SAFE')
  const celery = detect(['celery'], 'water, accelerator, excellent')
  assert.equal(celery.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only vejce stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'kukuřičná mouka, vejce, sůl')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('does not contain is not a tree-nut hit (do not add bare oříšky)', () => {
  const out = detect(['tree_nuts'], 'water, sugar, salt. does not contain peanuts')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('kukuřičná mouka does not fire wheat (do not add bare mouka)', () => {
  const out = detect(['wheat'], 'cukr, kukuřičná mouka, sůl')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'wheat'), false)
})

test('celiac AVOID on pšeničná mouka and Obsahuje: lepek, but not pohanka or bezlepková', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['pšeničná mouka', 'cukr'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['cukr', 'kakao'], 'Obsahuje: lepek')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['pohanka', 'sůl'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['bezlepková rýže', 'sůl'], '')), 'SAFE')
})
