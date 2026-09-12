/**
 * Whole-word matching misses Slovak legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Slovak labels. English `milk` does not match `mlieko`;
 * `egg` does not match `vajcia`; French `arachide` does not stem to `arašidy`.
 * Slovak sesame is `sezam`, not `sesame`/`sésame`. Slovak soy `sója` already
 * matches existing `soja` after NFKD. NFKD folds á/ä/č/ď/é/í/ĺ/ľ/ň/ó/ô/ŕ/š/ť/ú/ý/ž.
 *
 * Distinct from Czech (vejce/mléko), Finnish (muna/maito), Danish (æg/mælk),
 * Swedish (ägg/mjölk), Polish (jajka/mleko), Dutch (ei/pinda/melk),
 * Portuguese (ovos/amendoim), Spanish (leche/huevo), Italian (uova/arachidi),
 * and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.slovak-legal-names.test.ts
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

test('Slovak diacritics fold via NFKD so word-boundary matching can fire', () => {
  assert.equal(normalizeText('mlieko'), 'mlieko')
  assert.equal(normalizeText('arašidy'), 'arasidy')
  assert.equal(normalizeText('pšeničná'), 'psenicna')
  assert.equal(normalizeText('horčica'), 'horcica')
  assert.equal(normalizeText('tuniak'), 'tuniak')
  assert.equal(normalizeText('vajcia'), 'vajcia')
  assert.equal(normalizeText('mäkkýše'), 'makkyse')
  assert.equal(normalizeText('kôrovce'), 'korovce')
  assert.equal(normalizeText('žĺtok'), 'zltok')
  assert.equal(normalizeText('Zloženie'), 'zlozenie')
})

test('vajcia is CONTAINS for egg allergy (Slovak eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'cukor, vajcia, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('vaječný bielok is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'voda, vaječný bielok, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Obsahuje: vajcia is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'kukuričný škrob, cukor, soľ. Obsahuje: vajcia')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Obsahuje as a Contains header and does not steal ne obsahuje', () => {
  const parsed = parseSections('kukuričný škrob, soľ. Obsahuje: vajcia, mlieko')
  assert.match(parsed.contains_text, /vajcia/i)
  assert.match(parsed.contains_text, /mlieko/i)
  assert.doesNotMatch(parsed.ingredients_text, /Obsahuje/i)

  const may = parseSections('kukuričný škrob, soľ. Môže obsahovať: orechy')
  assert.match(may.may_contain_text, /orechy/i)
  assert.doesNotMatch(may.contains_text, /orechy/i)

  const out = detect(['tree_nuts'], 'kukuričný škrob, soľ. Môže obsahovať: orechy')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const ocrMay = parseSections('ryža, soľ. Moze obsahovat: orechy')
  assert.match(ocrMay.may_contain_text, /orechy/i)
  assert.doesNotMatch(ocrMay.contains_text, /orechy/i)

  const noSteal = parseSections('ryža, soľ. ne obsahuje vajcia')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /ne obsahuje vajcia/i)

  const noStealCompound = parseSections('ryža, soľ. neobsahuje vajcia')
  assert.equal(noStealCompound.contains_text, '')
  assert.match(noStealCompound.ingredients_text, /neobsahuje vajcia/i)
})

test('English Ingredients: prefix still strips after adding Zloženie', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const sk = parseSections('Zloženie: cukor, soľ, kukuričná múka')
  assert.match(sk.ingredients_text, /cukor/i)
  assert.doesNotMatch(sk.ingredients_text, /Zloženie/i)

  const ocr = parseSections('Zlozenie: cukor, soľ, kukuričná múka')
  assert.match(ocr.ingredients_text, /cukor/i)
  assert.doesNotMatch(ocr.ingredients_text, /Zlozenie/i)
})

test('arašidy is CONTAINS for peanut allergy (Slovak peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'rastlinný olej, soľ, arašidy')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('arašidové maslo is CONTAINS for peanut allergy (compound, no word peanut)', () => {
  const out = detect(['peanuts'], 'cukor, arašidové maslo, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only arašidy', () => {
  const out = detect(['tree_nuts'], 'rastlinný olej, soľ, arašidy')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('ryba is CONTAINS for fish allergy (Slovak fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'olej, múka, ryba, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('mlieko is CONTAINS for milk allergy (Slovak milk ≠ English milk or Czech mléko)', () => {
  const out = detect(['milk'], 'cukor, mlieko, kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('syr is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'kukuričná múka, syr, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('arašidové maslo does not fire milk (do not add maslo)', () => {
  const out = detect(['milk'], 'cukor, arašidové maslo, soľ')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('mlieko still fires when kokosové mlieko is also present (do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'voda, mlieko, kokosové mlieko, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('lieskové orechy is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'cukor, lieskové orechy, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Obsahuje: orechy is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'cukor, kakao, vanilka. Obsahuje: orechy')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('sezam is CONTAINS for sesame allergy (Slovak sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'olej, sezam, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('sója still matches soy after NFKD (existing soja synonym)', () => {
  const out = detect(['soy'], 'olej, sója, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('krevety is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'olej, cesnak, krevety, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('pšeničná múka is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'cukor, pšeničná múka, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('horčica is CONTAINS for mustard allergy', () => {
  const out = detect(['mustard'], 'olej, horčica, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'mustard'))
})

test('zeler is CONTAINS for celery allergy', () => {
  const out = detect(['celery'], 'olej, zeler, soľ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'celery'))
})

test('hrachový proteín does not fire egg allergy (do not add generic protein)', () => {
  const out = detect(['eggs'], 'voda, hrachový proteín, soľ')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Slovak terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, dessert, serial, conserve, syrup, server')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, average, conveyance, vegetable')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, library, crybaby, calendar')
  assert.equal(fish.overall_status, 'SAFE')
  const celery = detect(['celery'], 'water, accelerator, excellent')
  assert.equal(celery.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only vajcia stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'kukuričná múka, vajcia, soľ')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('does not contain is not a tree-nut hit (do not add bare oriešky)', () => {
  const out = detect(['tree_nuts'], 'water, sugar, salt. does not contain peanuts')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('kukuričná múka does not fire wheat (do not add bare múka)', () => {
  const out = detect(['wheat'], 'cukor, kukuričná múka, soľ')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'wheat'), false)
})

test('celiac AVOID on pšeničná múka and Obsahuje: lepek, but not pohánka or bezlepková', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['pšeničná múka', 'cukor'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['cukor', 'kakao'], 'Obsahuje: lepek')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['pohánka', 'soľ'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['bezlepková ryža', 'soľ'], '')), 'SAFE')
})
