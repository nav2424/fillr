/**
 * Whole-word matching misses Slovenian legal allergen names that do not contain
 * the English or French dictionary words (egg/oeuf, peanut/arachide, fish/poisson).
 *
 * OCR never translates Slovenian labels. English `milk` does not match `mleko`;
 * `egg` does not match `jajca`; French `arachide` does not stem to `arašidi`.
 * Slovenian sesame is `sezam`, not `sesame`/`sésame`. Standalone Slovenian soy
 * `soja` already matches the existing `soja` synonym, but adjectival `sojina` /
 * `sojino` (sojina moka, sojin lecitin) does not.
 *
 * `mleko` is ekavian (also Serbian Latin); Croatian ijekavian is `mlijeko`.
 * `jajca` ≠ Croatian `jaja`. `arašidi` ≠ Croatian `kikiriki`. Flour is `moka`,
 * not Croatian `brašno`. Contains header is `Vsebuje:`, not `Sadrži:`.
 *
 * Distinct from Croatian (jaja/mlijeko), Greek (αυγά/γάλα), Bulgarian (яйца/мляко),
 * Romanian (ouă/lapte), Hungarian (tojás/tej), Slovak (vajcia/mlieko),
 * Czech (vejce/mléko), Finnish (muna/maito), Danish (æg/mælk), Swedish (ägg/mjölk),
 * Polish (jajka/mleko), Dutch (ei/pinda/melk), Portuguese (ovos/amendoim),
 * Spanish (leche/huevo), Italian (uova/arachidi), and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.slovenian-legal-names.test.ts
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

test('Slovenian diacritics fold via NFKD so word-boundary matching can fire', () => {
  assert.equal(normalizeText('jajca'), 'jajca')
  assert.equal(normalizeText('beljak'), 'beljak')
  assert.equal(normalizeText('rumenjak'), 'rumenjak')
  assert.equal(normalizeText('mleko'), 'mleko')
  assert.equal(normalizeText('arašidi'), 'arasidi')
  assert.equal(normalizeText('riba'), 'riba')
  assert.equal(normalizeText('pšenična moka'), 'psenicna moka')
  assert.equal(normalizeText('lešniki'), 'lesniki')
  assert.equal(normalizeText('oreški'), 'oreski')
  assert.equal(normalizeText('vsebuje'), 'vsebuje')
  assert.equal(normalizeText('sezam'), 'sezam')
  assert.equal(normalizeText('gorčica'), 'gorcica')
  assert.equal(normalizeText('mehkužci'), 'mehkuzci')
})

test('jajca is CONTAINS for egg allergy (Slovenian eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'sladkor, jajca, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('beljak is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'voda, beljak, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Vsebuje: jajca is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'koruzna moka, sladkor, sol. Vsebuje: jajca')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Vsebuje as a Contains header and does not steal ne vsebuje', () => {
  const parsed = parseSections('koruzna moka, sol. Vsebuje: jajca, mleko')
  assert.match(parsed.contains_text, /jajca/i)
  assert.match(parsed.contains_text, /mleko/i)
  assert.doesNotMatch(parsed.ingredients_text, /Vsebuje/i)

  const may = parseSections('koruzna moka, sol. Lahko vsebuje: oreški')
  assert.match(may.may_contain_text, /oreški/i)
  assert.doesNotMatch(may.contains_text, /oreški/i)

  const out = detect(['tree_nuts'], 'koruzna moka, sol. Lahko vsebuje: oreški')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const traces = parseSections('riž, sol. Lahko vsebuje sledi: oreški')
  assert.match(traces.may_contain_text, /oreški/i)
  assert.doesNotMatch(traces.contains_text, /oreški/i)

  const noSteal = parseSections('riž, sol. ne vsebuje jajca')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /ne vsebuje jajca/i)
})

test('English Ingredients: prefix still strips after adding Sestavine', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const sl = parseSections('Sestavine: sladkor, sol, koruzna moka')
  assert.match(sl.ingredients_text, /sladkor/i)
  assert.doesNotMatch(sl.ingredients_text, /Sestavine/i)
})

test('arašidi is CONTAINS for peanut allergy (Slovenian peanuts ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'olje, arašidi, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('arašidovo maslo is CONTAINS for peanut allergy and SAFE for milk (do not add bare maslo)', () => {
  const peanuts = detect(['peanuts'], 'sladkor, arašidovo maslo, sol')
  assert.equal(peanuts.overall_status, 'CONTAINS')
  assert.ok(peanuts.matched_allergens.some((m) => m.allergen_id === 'peanuts'))

  const milk = detect(['milk'], 'sladkor, arašidovo maslo, sol')
  assert.equal(milk.overall_status, 'SAFE')
  assert.equal(milk.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('peanut-only arašidi stays SAFE for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'sladkor, arašidi, sol')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('riba is CONTAINS for fish allergy (Slovenian fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'olje, moka, riba, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('losos is CONTAINS for fish allergy (species name, no standalone riba)', () => {
  const out = detect(['fish'], 'olje, losos, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('mleko is CONTAINS for milk allergy (Slovenian/Serbian Latin milk ≠ English milk)', () => {
  const out = detect(['milk'], 'sladkor, mleko, kakav')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('sir is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'koruzna moka, sir, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('mleko still fires when kokosovo mleko is also present (do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'voda, mleko, kokosovo mleko, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('mandlji is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'sladkor, mandlji, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('lešniki is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'sladkor, lešniki, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Vsebuje: oreški is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'sladkor, kakav, vanilija. Vsebuje: oreški')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('sezam is CONTAINS for sesame allergy (Slovenian sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'olje, sezam, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('soja still matches soy; sojina moka also matches (adjectival form)', () => {
  const whole = detect(['soy'], 'olje, soja, sol')
  assert.equal(whole.overall_status, 'CONTAINS')
  assert.ok(whole.matched_allergens.some((m) => m.allergen_id === 'soy'))

  const flour = detect(['soy'], 'voda, sojina moka, sol')
  assert.equal(flour.overall_status, 'CONTAINS')
  assert.ok(flour.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('kozice is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'olje, česen, kozice, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('pšenična moka is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'sladkor, pšenična moka, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('gorčica is CONTAINS for mustard allergy', () => {
  const out = detect(['mustard'], 'olje, gorčica, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'mustard'))
})

test('zeler is CONTAINS for celery allergy (do not add bare zelena — also means green)', () => {
  const out = detect(['celery'], 'olje, zeler, sol')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'celery'))

  const green = detect(['celery'], 'olje, zelena paprika, sol')
  assert.equal(green.overall_status, 'SAFE')
  assert.equal(green.matched_allergens.some((m) => m.allergen_id === 'celery'), false)
})

test('beljakovine graha does not fire egg allergy (do not add generic protein)', () => {
  const out = detect(['eggs'], 'voda, beljakovine graha, sol')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'eggs'), false)
})

test('short Slovenian terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, syrup, sirloin, desire, circle')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, jazz, java, average, vegetable')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, tribal, crib, arriba, caribou')
  assert.equal(fish.overall_status, 'SAFE')
  const celery = detect(['celery'], 'water, accelerator, excellent')
  assert.equal(celery.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only jajca stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'koruzna moka, jajca, sol')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('koruzna moka does not fire wheat (do not add bare moka)', () => {
  const out = detect(['wheat'], 'sladkor, koruzna moka, sol')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'wheat'), false)
})

test('celiac AVOID on pšenična moka and Vsebuje: gluten, but not ajda', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['pšenična moka', 'sladkor'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['sladkor', 'kakav'], 'Vsebuje: gluten')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['ajda', 'sol'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['koruzna moka', 'sol'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['brez glutena riž', 'sol'], '')), 'SAFE')
})
