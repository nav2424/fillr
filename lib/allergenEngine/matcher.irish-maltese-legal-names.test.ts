/**
 * Whole-word matching misses Irish and Maltese legal allergen names that do
 * not contain the English or French dictionary words (egg/oeuf, peanut/arachide,
 * fish/poisson, milk/lait).
 *
 * OCR never translates GA/MT labels. English `milk` does not match `bainne` /
 * `ħalib`; `egg` does not match `uibheacha` / `bajd`; French `arachide` does
 * not stem to `piseanna talún` / `karawett`. Maltese sesame is `ġulġlien`, not
 * `sesame`/`sésame`. Maltese soy is `sojja`, which does not match `soja`.
 *
 * Maltese `ħ` does not NFKD-decompose. JS word boundaries treat it as a
 * non-word char, so `ħalib` / `ħut` / `qamħ` would not even match themselves
 * without folding `ħ`→`h` (same class as Danish `æ`→`ae`).
 *
 * Distinct from Baltic (piim/piens/pienas), Slovenian (jajca/mleko), Croatian
 * (jaja/mlijeko), Greek, Bulgarian, Romanian, Hungarian, Slovak, Czech,
 * Finnish, Danish, Swedish, Polish, Dutch, Portuguese, Spanish, Italian, and
 * German.
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.irish-maltese-legal-names.test.ts
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

test('Irish fadas NFKD-fold; Maltese ħ folds to h so word-boundary matching can fire', () => {
  assert.equal(normalizeText('bainne'), 'bainne')
  assert.equal(normalizeText('uibheacha'), 'uibheacha')
  assert.equal(normalizeText('piseanna talún'), 'piseanna talun')
  assert.equal(normalizeText('cnónna'), 'cnonna')
  assert.equal(normalizeText('almóinní'), 'almoinni')
  assert.equal(normalizeText('cruithneacht'), 'cruithneacht')
  assert.equal(normalizeText('ħalib'), 'halib')
  assert.equal(normalizeText('Ħalib'), 'halib')
  assert.equal(normalizeText('ħut'), 'hut')
  assert.equal(normalizeText('qamħ'), 'qamh')
  assert.equal(normalizeText('ġewż'), 'gewz')
  assert.equal(normalizeText('ġulġlien'), 'gulglien')
  assert.equal(normalizeText('bajd'), 'bajd')
  assert.equal(normalizeText('karawett'), 'karawett')
  assert.equal(normalizeText('sojja'), 'sojja')
  assert.equal(normalizeText('krafess'), 'krafess')
})

test('ħalib does not substring-match English halibut (milk stays SAFE)', () => {
  const milk = detect(['milk'], 'water, salt, halibut, oil')
  assert.equal(milk.overall_status, 'SAFE')
  assert.equal(milk.matched_allergens.some((m) => m.allergen_id === 'milk'), false)

  const fish = detect(['fish'], 'water, salt, halibut, oil')
  assert.equal(fish.overall_status, 'CONTAINS')
  assert.ok(fish.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('uibheacha / bajd are CONTAINS for egg allergy (no word egg/oeuf)', () => {
  const ga = detect(['eggs'], 'siúcra, uibheacha, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'eggs'))

  const mt = detect(['eggs'], 'zokkor, bajd, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('gealacán is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'uisce, gealacán, salann')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Ailéirginí: uibheacha / Fih: bajd are CONTAINS for egg allergy', () => {
  const ga = detect(['eggs'], 'plúr arbhair, siúcra, salann. Ailéirginí: uibheacha')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'eggs'))

  const mt = detect(['eggs'], 'dqiq tal-qamħirrun, zokkor, melħ. Fih: bajd')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Ailéirginí/Fih as Contains headers and does not steal negation', () => {
  const ga = parseSections('plúr arbhair, salann. Ailéirginí: uibheacha, bainne')
  assert.match(ga.contains_text, /uibheacha/i)
  assert.match(ga.contains_text, /bainne/i)
  assert.doesNotMatch(ga.ingredients_text, /Ailéirginí/i)

  const mt = parseSections('dqiq, melħ. Fih: bajd, ħalib')
  assert.match(mt.contains_text, /bajd/i)
  assert.match(mt.contains_text, /ħalib/i)
  assert.doesNotMatch(mt.ingredients_text, /\bFih\b/i)

  const mayGa = parseSections('plúr arbhair, salann. Féadfaidh a bheith: cnónna')
  assert.match(mayGa.may_contain_text, /cnónna/i)
  assert.doesNotMatch(mayGa.contains_text, /cnónna/i)

  const mayMt = parseSections('dqiq, melħ. Jista\' jkun fih: ġewż')
  assert.match(mayMt.may_contain_text, /ġewż/i)
  assert.doesNotMatch(mayMt.contains_text, /ġewż/i)

  const out = detect(['tree_nuts'], 'dqiq, melħ. Jista\' jkun fih: ġewż')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const noStealGa = parseSections('rís, salann. níl ailéirginí uibheacha')
  assert.equal(noStealGa.contains_text, '')
  assert.match(noStealGa.ingredients_text, /níl ailéirginí uibheacha/i)

  const noStealMt = parseSections('ross, melħ. ma fihx bajd')
  assert.equal(noStealMt.contains_text, '')
  assert.match(noStealMt.ingredients_text, /ma fihx bajd/i)
})

test('English Ingredients: prefix still strips after adding Comhábhair / Ingredjenti', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const ga = parseSections('Comhábhair: siúcra, salann, plúr arbhair')
  assert.match(ga.ingredients_text, /siúcra/i)
  assert.doesNotMatch(ga.ingredients_text, /Comhábhair/i)

  const mt = parseSections('Ingredjenti: zokkor, melħ, dqiq tal-qamħirrun')
  assert.match(mt.ingredients_text, /zokkor/i)
  assert.doesNotMatch(mt.ingredients_text, /Ingredjenti/i)
})

test('piseanna talún / karawett are CONTAINS for peanut allergy', () => {
  const ga = detect(['peanuts'], 'ola, piseanna talún, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'peanuts'))

  const mt = detect(['peanuts'], 'żejt, karawett, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('bare piseanna (peas) does not fire peanut allergy', () => {
  const out = detect(['peanuts'], 'uisce, piseanna, salann')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'), false)
})

test('im piseanna talún / butir tal-karawett are CONTAINS for peanuts and SAFE for milk (do not add im/butir)', () => {
  const gaPeanuts = detect(['peanuts'], 'siúcra, im piseanna talún, salann')
  assert.equal(gaPeanuts.overall_status, 'CONTAINS')
  assert.ok(gaPeanuts.matched_allergens.some((m) => m.allergen_id === 'peanuts'))

  const gaMilk = detect(['milk'], 'siúcra, im piseanna talún, salann')
  assert.equal(gaMilk.overall_status, 'SAFE')
  assert.equal(gaMilk.matched_allergens.some((m) => m.allergen_id === 'milk'), false)

  const mtPeanuts = detect(['peanuts'], 'zokkor, butir tal-karawett, melħ')
  assert.equal(mtPeanuts.overall_status, 'CONTAINS')
  assert.ok(mtPeanuts.matched_allergens.some((m) => m.allergen_id === 'peanuts'))

  const mtMilk = detect(['milk'], 'zokkor, butir tal-karawett, melħ')
  assert.equal(mtMilk.overall_status, 'SAFE')
  assert.equal(mtMilk.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('peanut-only piseanna talún / karawett stay SAFE for tree-nut allergy', () => {
  const ga = detect(['tree_nuts'], 'siúcra, piseanna talún, salann')
  assert.equal(ga.overall_status, 'SAFE')
  assert.equal(ga.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)

  const mt = detect(['tree_nuts'], 'zokkor, karawett, melħ')
  assert.equal(mt.overall_status, 'SAFE')
  assert.equal(mt.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('iasc / ħut are CONTAINS for fish allergy (no word fish/poisson)', () => {
  const ga = detect(['fish'], 'ola, plúr, iasc, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'fish'))

  const mt = detect(['fish'], 'żejt, dqiq, ħut, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('bradán / salamun are CONTAINS for fish allergy (species name, no standalone iasc/ħut)', () => {
  const ga = detect(['fish'], 'ola, bradán, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'fish'))

  const mt = detect(['fish'], 'żejt, salamun, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('bainne / ħalib are CONTAINS for milk allergy', () => {
  const ga = detect(['milk'], 'siúcra, bainne, cócó')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'milk'))

  const mt = detect(['milk'], 'zokkor, ħalib, kawkaw')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('cáis / ġobon are CONTAINS for milk allergy', () => {
  const ga = detect(['milk'], 'plúr arbhair, cáis, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'milk'))

  const mt = detect(['milk'], 'dqiq tal-qamħirrun, ġobon, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('bainne still fires when bainne cnó cócó is also present (do not add coconut-milk anti-match)', () => {
  const ga = detect(['milk'], 'uisce, bainne, bainne cnó cócó, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'milk'))

  const mt = detect(['milk'], 'ilma, ħalib, ħalib tal-ġewż, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('almóinní / lewż are CONTAINS for tree-nut allergy', () => {
  const ga = detect(['tree_nuts'], 'siúcra, almóinní, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const mt = detect(['tree_nuts'], 'zokkor, lewż, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Ailéirginí: cnónna / Fih: ġewż are CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const ga = detect(['tree_nuts'], 'siúcra, cócó, vanilla. Ailéirginí: cnónna')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const mt = detect(['tree_nuts'], 'zokkor, kawkaw, vanilja. Fih: ġewż')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('seasamain / ġulġlien are CONTAINS for sesame allergy', () => {
  const ga = detect(['sesame'], 'ola, seasamain, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'sesame'))

  const mt = detect(['sesame'], 'żejt, ġulġlien, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('soighe / sojja are CONTAINS for soy allergy (sojja ≠ soja)', () => {
  const ga = detect(['soy'], 'ola, soighe, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'soy'))

  const mt = detect(['soy'], 'żejt, sojja, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'soy'))

  const lecithin = detect(['soy'], 'ilma, leċitina tas-sojja, melħ')
  assert.equal(lecithin.overall_status, 'CONTAINS')
  assert.ok(lecithin.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('ribí róibéis / gamberi are CONTAINS for shellfish allergy', () => {
  const ga = detect(['shellfish'], 'ola, gairleog, ribí róibéis, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'shellfish'))

  const mt = detect(['shellfish'], 'żejt, tewm, gamberi, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('plúr cruithneachta / qamħ are CONTAINS for wheat allergy', () => {
  const ga = detect(['wheat'], 'siúcra, plúr cruithneachta, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'wheat'))

  const mt = detect(['wheat'], 'zokkor, qamħ, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('mustaird / mustarda are CONTAINS for mustard allergy', () => {
  const ga = detect(['mustard'], 'ola, mustaird, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'mustard'))

  const mt = detect(['mustard'], 'żejt, mustarda, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'mustard'))
})

test('soilire / krafess are CONTAINS for celery allergy', () => {
  const ga = detect(['celery'], 'ola, soilire, salann')
  assert.equal(ga.overall_status, 'CONTAINS')
  assert.ok(ga.matched_allergens.some((m) => m.allergen_id === 'celery'))

  const mt = detect(['celery'], 'żejt, krafess, melħ')
  assert.equal(mt.overall_status, 'CONTAINS')
  assert.ok(mt.matched_allergens.some((m) => m.allergen_id === 'celery'))
})

test('próitéin piseanna / proteina tal-piżelli do not fire egg allergy', () => {
  const ga = detect(['eggs'], 'uisce, próitéin piseanna, salann')
  assert.equal(ga.overall_status, 'SAFE')

  const mt = detect(['eggs'], 'ilma, proteina tal-piżelli, melħ')
  assert.equal(mt.overall_status, 'SAFE')
})

test('short Irish/Maltese terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, tomato, piano, host, most, cost, halibut')
  assert.equal(milk.matched_allergens.some((m) => m.allergen_id === 'milk'), false)

  const eggs = detect(['eggs'], 'water, suburb, rubbish, communication')
  assert.equal(eggs.overall_status, 'SAFE')

  const fish = detect(['fish'], 'water, hutch, shutter, fiscal, alias')
  assert.equal(fish.overall_status, 'SAFE')

  const wheat = detect(['wheat'], 'water, popcorn, corn flakes, qamhirrun')
  assert.equal(wheat.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only uibheacha/bajd stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')

  const peanutOnEggGa = detect(['peanuts'], 'plúr arbhair, uibheacha, salann')
  assert.equal(peanutOnEggGa.overall_status, 'SAFE')
  assert.equal(peanutOnEggGa.matched_allergens.length, 0)

  const peanutOnEggMt = detect(['peanuts'], 'dqiq tal-qamħirrun, bajd, melħ')
  assert.equal(peanutOnEggMt.overall_status, 'SAFE')
  assert.equal(peanutOnEggMt.matched_allergens.length, 0)
})

test('plúr arbhair / dqiq tal-qamħirrun do not fire wheat (do not add bare flour)', () => {
  const ga = detect(['wheat'], 'uisce, plúr arbhair, salann')
  assert.equal(ga.overall_status, 'SAFE')

  const mt = detect(['wheat'], 'ilma, dqiq tal-qamħirrun, melħ')
  assert.equal(mt.overall_status, 'SAFE')
})

test('celiac AVOID on wheat flours and Contains: gluten, but not maize or gluten-free', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['plúr cruithneachta', 'siúcra'], '')), 'AVOID')
  assert.equal(getCeliacSeverity(runCeliacCheck(['dqiq tal-qamħ', 'zokkor'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['siúcra', 'cócó'], 'Ailéirginí: glútan')),
    'AVOID'
  )
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['zokkor', 'kawkaw'], 'Fih: glutina')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['plúr arbhair', 'salann'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['qamħirrun', 'melħ'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['dqiq tal-qamħirrun', 'melħ'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['coirce saor ó ghlútan', 'salann'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['ħafur mingħajr glutina', 'melħ'], '')), 'SAFE')
})
