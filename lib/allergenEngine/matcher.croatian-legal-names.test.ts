/**
 * Whole-word matching misses Croatian legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Croatian labels. English `milk` does not match `mlijeko`;
 * `egg` does not match `jaja`; French `arachide` does not stem to `kikiriki`.
 * Croatian sesame is `sezam`, not `sesame`/`sésame`. Standalone Croatian soy
 * `soja` already matches the existing `soja` synonym, but adjectival `sojino` /
 * `sojin` (sojino brašno, sojin lecitin) does not.
 *
 * Distinct from Bulgarian (яйца/мляко), Romanian (ouă/lapte), Hungarian (tojás/tej),
 * Slovak (vajcia/mlieko), Czech (vejce/mléko), Finnish (muna/maito),
 * Danish (æg/mælk), Swedish (ägg/mjölk), Polish (jajka/mleko), Dutch (ei/pinda/melk),
 * Portuguese (ovos/amendoim), Spanish (leche/huevo), Italian (uova/arachidi),
 * and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.croatian-legal-names.test.ts
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

test('Croatian diacritics fold via NFKD so word-boundary matching can fire', () => {
  assert.equal(normalizeText('jaja'), 'jaja')
  assert.equal(normalizeText('bjelanjak'), 'bjelanjak')
  assert.equal(normalizeText('žumanjak'), 'zumanjak')
  assert.equal(normalizeText('mlijeko'), 'mlijeko')
  assert.equal(normalizeText('kikiriki'), 'kikiriki')
  assert.equal(normalizeText('riba'), 'riba')
  assert.equal(normalizeText('pšenično brašno'), 'psenicno brasno')
  assert.equal(normalizeText('lješnjaci'), 'ljesnjaci')
  assert.equal(normalizeText('škampi'), 'skampi')
  assert.equal(normalizeText('sadrži'), 'sadrzi')
  assert.equal(normalizeText('orašasti plodovi'), 'orasasti plodovi')
  assert.equal(normalizeText('sezam'), 'sezam')
  assert.equal(normalizeText('gorušica'), 'gorusica')
  assert.equal(normalizeText('mekušci'), 'mekusci')
})

test('jaja is CONTAINS for egg allergy (Croatian eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'šećer, jaja, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('bjelanjak is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'voda, bjelanjak, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Sadrži: jaja is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'kukuruzno brašno, šećer, sol. Sadrži: jaja')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Sadrži as a Contains header and does not steal ne sadrži', () => {
  const parsed = parseSections('kukuruzno brašno, sol. Sadrži: jaja, mlijeko')
  assert.match(parsed.contains_text, /jaja/i)
  assert.match(parsed.contains_text, /mlijeko/i)
  assert.doesNotMatch(parsed.ingredients_text, /Sadrži/i)

  const may = parseSections('kukuruzno brašno, sol. Može sadržavati: orašasti plodovi')
  assert.match(may.may_contain_text, /orašasti plodovi/i)

  const out = detect(['tree_nuts'], 'kukuruzno brašno, sol. Može sadržavati: orašasti plodovi')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const noSteal = parseSections('riža, sol. ne sadrži jaja')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /ne sadrži jaja/i)
})

test('Sastojci prefix strips like Ingredients', () => {
  const hr = parseSections('Sastojci: šećer, sol, kukuruzno brašno')
  assert.match(hr.ingredients_text, /šećer/i)
  assert.doesNotMatch(hr.ingredients_text, /Sastojci/i)
})

test('kikiriki is CONTAINS for peanut allergy (Croatian peanuts, no word peanut/arachide)', () => {
  const out = detect(['peanuts'], 'ulje, kikiriki, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('kikiriki maslac is CONTAINS for peanut allergy and SAFE for milk (do not add bare maslac)', () => {
  const peanuts = detect(['peanuts'], 'šećer, kikiriki maslac, sol')
  assert.equal(peanuts.overall_status, 'CONTAINS')
  assert.ok(peanuts.matched_allergens.some((m) => m.allergen_id === 'peanuts'))

  const milk = detect(['milk'], 'šećer, kikiriki maslac, sol')
  assert.equal(milk.overall_status, 'SAFE')
  assert.equal(milk.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('peanut-only kikiriki stays SAFE for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'šećer, kikiriki, sol')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('riba is CONTAINS for fish allergy (Croatian fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'ulje, brašno, riba, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('losos is CONTAINS for fish allergy (species name, no standalone riba)', () => {
  const out = detect(['fish'], 'ulje, losos, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('mlijeko is CONTAINS for milk allergy (Croatian milk ≠ English milk)', () => {
  const out = detect(['milk'], 'šećer, mlijeko, kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('sir is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'kukuruzno brašno, sir, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('mlijeko still fires when kokosovo mlijeko is also present (do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'voda, mlijeko, kokosovo mlijeko, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('bademi is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'šećer, bademi, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('lješnjaci is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'šećer, lješnjaci, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Sadrži: orašasti plodovi is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'šećer, kakao, vanilija. Sadrži: orašasti plodovi')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('sezam is CONTAINS for sesame allergy (Croatian sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'ulje, sezam, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('soja still matches soy; sojino brašno also matches (adjectival form)', () => {
  const whole = detect(['soy'], 'ulje, soja, sol')
  assert.equal(whole.overall_status, 'CONTAINS')
  assert.ok(whole.matched_allergens.some((m) => m.allergen_id === 'soy'))

  const flour = detect(['soy'], 'voda, sojino brašno, sol')
  assert.equal(flour.overall_status, 'CONTAINS')
  assert.ok(flour.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('škampi is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'ulje, češnjak, škampi, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('pšenično brašno is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'šećer, pšenično brašno, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('senf is CONTAINS for mustard allergy', () => {
  const out = detect(['mustard'], 'ulje, senf, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'mustard'))
})

test('celer is CONTAINS for celery allergy', () => {
  const out = detect(['celery'], 'ulje, celer, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'celery'))
})

test('bjelančevine graška does not fire egg allergy (do not add generic protein)', () => {
  const out = detect(['eggs'], 'voda, bjelančevine graška, sol')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Croatian terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, syrup, sirloin, desire, circle')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, jazz, java, average, vegetable')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, tribal, crib, arriba, caribou')
  assert.equal(fish.overall_status, 'SAFE')
  const celery = detect(['celery'], 'water, accelerator, excellent')
  assert.equal(celery.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only jaja stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'kukuruzno brašno, jaja, sol')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('kukuruzno brašno does not fire wheat (do not add bare brašno)', () => {
  const out = detect(['wheat'], 'šećer, kukuruzno brašno, sol')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'wheat'), false)
})

test('celiac AVOID on pšenično brašno and Sadrži: gluten, but not heljda', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['pšenično brašno', 'šećer'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['šećer', 'kakao'], 'Sadrži: gluten')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['heljda', 'sol'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['kukuruzno brašno', 'sol'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['bezglutenski riža', 'sol'], '')), 'SAFE')
})
