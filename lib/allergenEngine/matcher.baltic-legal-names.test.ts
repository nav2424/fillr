/**
 * Whole-word matching misses Estonian, Latvian, and Lithuanian legal allergen
 * names that do not contain the English or French dictionary words
 * (egg/oeuf, peanut/arachide, fish/poisson, milk/lait).
 *
 * OCR never translates Baltic labels. English `milk` does not match `piim` /
 * `piens` / `pienas`; `egg` does not match `muna` / `olas` / `kiaušiniai`;
 * French `arachide` does not stem to `maapähkel` / `zemesrieksti` /
 * `žemės riešutai`. Estonian sesame is `seesam`, not `sesame`/`sésame`.
 * Inflected soy `sojas` / `sojos` and compound `sojaoad` do not match `soja`.
 *
 * Latin-script terms NFKD-fold (ä/õ/ē/ū/ė/š/ž → ascii), so existing JS `\\b`
 * matching works after normalizeText — unlike Greek/Bulgarian which need
 * unicode-aware boundaries.
 *
 * Distinct from Finnish (muna/maito), Swedish (ägg/mjölk), Danish (æg/mælk),
 * Polish (jajka/mleko), Dutch (ei/pinda), Portuguese (ovos/leite), Spanish
 * (leche/huevo), Italian (uova/arachidi), German (Vollmilch/Haselnüsse),
 * Czech (vejce/mléko), Slovak (vajcia/mlieko), Hungarian (tojás/tej),
 * Romanian (ouă/lapte), Bulgarian (яйца/мляко), Croatian (jaja/mlijeko),
 * Greek (αυγά/γάλα), and Slovenian (jajca/mleko).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.baltic-legal-names.test.ts
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

test('Baltic diacritics fold via NFKD so word-boundary matching can fire', () => {
  assert.equal(normalizeText('piim'), 'piim')
  assert.equal(normalizeText('maapähkel'), 'maapahkel')
  assert.equal(normalizeText('nisujahu'), 'nisujahu')
  assert.equal(normalizeText('piens'), 'piens')
  assert.equal(normalizeText('kvieši'), 'kviesi')
  assert.equal(normalizeText('kazeīns'), 'kazeins')
  assert.equal(normalizeText('pienas'), 'pienas')
  assert.equal(normalizeText('kiaušiniai'), 'kiausiniai')
  assert.equal(normalizeText('žemės riešutai'), 'zemes riesutai')
  assert.equal(normalizeText('žuvis'), 'zuvis')
  assert.equal(normalizeText('garstyčios'), 'garstycios')
})

test('muna is CONTAINS for egg allergy (Estonian eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'suhkur, muna, sool')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('olas is CONTAINS for egg allergy (Latvian eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'cukurs, olas, sāls')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('kiaušiniai is CONTAINS for egg allergy (Lithuanian eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'cukrus, kiaušiniai, druska')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('munavalge is CONTAINS for egg allergy (egg white, not generic protein)', () => {
  const out = detect(['eggs'], 'vesi, munavalge, sool')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Sisaldab: muna is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'maisitärklis, suhkur, sool. Sisaldab: muna')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Baltic Contains headers and does not steal negation', () => {
  const et = parseSections('maisitärklis, sool. Sisaldab: muna, piim')
  assert.match(et.contains_text, /muna/i)
  assert.match(et.contains_text, /piim/i)
  assert.doesNotMatch(et.ingredients_text, /Sisaldab/i)

  const lv = parseSections('kukurūzas milti, sāls. Satur: olas, piens')
  assert.match(lv.contains_text, /olas/i)
  assert.match(lv.contains_text, /piens/i)
  assert.doesNotMatch(lv.ingredients_text, /Satur/i)

  const lt = parseSections('kukurūzų miltai, druska. Sudėtyje yra: kiaušiniai, pienas')
  assert.match(lt.contains_text, /kiaušiniai/i)
  assert.match(lt.contains_text, /pienas/i)
  assert.doesNotMatch(lt.ingredients_text, /Sudėtyje yra/i)

  const etMay = parseSections('maisitärklis, sool. Võib sisaldada: pähklid')
  assert.match(etMay.may_contain_text, /pähklid/i)
  assert.doesNotMatch(etMay.contains_text, /pähklid/i)

  const lvMay = parseSections('kukurūzas milti, sāls. Var saturēt: rieksti')
  assert.match(lvMay.may_contain_text, /rieksti/i)
  assert.doesNotMatch(lvMay.contains_text, /rieksti/i)

  const ltMay = parseSections('kukurūzų miltai, druska. Gali būti: pistacijos')
  assert.match(ltMay.may_contain_text, /pistacijos/i)
  assert.doesNotMatch(ltMay.contains_text, /pistacijos/i)

  const etNoSteal = parseSections('riis, sool. ei sisalda muna')
  assert.equal(etNoSteal.contains_text, '')
  assert.match(etNoSteal.ingredients_text, /ei sisalda muna/i)

  const lvNoSteal = parseSections('rīsi, sāls. nesatur olas')
  assert.equal(lvNoSteal.contains_text, '')
  assert.match(lvNoSteal.ingredients_text, /nesatur olas/i)
})

test('English Ingredients: prefix still strips after adding Baltic prefixes', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const et = parseSections('Koostisosad: suhkur, sool, riisijahu')
  assert.match(et.ingredients_text, /suhkur/i)
  assert.doesNotMatch(et.ingredients_text, /Koostisosad/i)

  const lv = parseSections('Sastāvdaļas: cukurs, sāls, rīsu milti')
  assert.match(lv.ingredients_text, /cukurs/i)
  assert.doesNotMatch(lv.ingredients_text, /Sastāvdaļas/i)

  const lt = parseSections('Sudėtis: cukrus, druska, ryžių miltai')
  assert.match(lt.ingredients_text, /cukrus/i)
  assert.doesNotMatch(lt.ingredients_text, /Sudėtis/i)
})

test('Võib sisaldada pähklid is MAY_CONTAIN for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'maisitärklis, sool. Võib sisaldada: pähklid')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('maapähkel is CONTAINS for peanut allergy (Estonian peanut ≠ peanut/arachide)', () => {
  const out = detect(['peanuts'], 'suhkur, maapähkel, sool')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('maapähklivõi is CONTAINS for peanut allergy (compound, no word peanut)', () => {
  const out = detect(['peanuts'], 'suhkur, maapähklivõi, sool')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('zemesrieksti is CONTAINS for peanut allergy (Latvian compound, no word peanut)', () => {
  const out = detect(['peanuts'], 'cukurs, zemesrieksti, sāls')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('žemės riešutai is CONTAINS for peanut allergy (Lithuanian, no word peanut)', () => {
  const out = detect(['peanuts'], 'cukrus, žemės riešutai, druska')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('tree nuts stay SAFE on peanut-only Baltic peanut names', () => {
  const et = detect(['tree_nuts'], 'taimeõli, sool, maapähkel')
  assert.equal(et.overall_status, 'SAFE')
  assert.equal(et.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)

  const lv = detect(['tree_nuts'], 'eļļa, sāls, zemesrieksti')
  assert.equal(lv.overall_status, 'SAFE')
  assert.equal(lv.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)

  const lt = detect(['tree_nuts'], 'aliejus, druska, žemės riešutai')
  assert.equal(lt.overall_status, 'SAFE')
  assert.equal(lt.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('kala is CONTAINS for fish allergy (Estonian fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'õli, jahu, kala, sool')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('zivis is CONTAINS for fish allergy (Latvian fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'eļļa, milti, zivis, sāls')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('žuvis is CONTAINS for fish allergy (Lithuanian fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'aliejus, miltai, žuvis, druska')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('piim is CONTAINS for milk allergy (Estonian milk ≠ English milk)', () => {
  const out = detect(['milk'], 'suhkur, piim, kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('piens is CONTAINS for milk allergy (Latvian milk ≠ English milk)', () => {
  const out = detect(['milk'], 'cukurs, piens, kakao')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('pienas is CONTAINS for milk allergy (Lithuanian milk ≠ English milk)', () => {
  const out = detect(['milk'], 'cukrus, pienas, kakava')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('juust / siers / sūris are CONTAINS for milk allergy', () => {
  const et = detect(['milk'], 'maisitärklis, juust, sool')
  assert.equal(et.overall_status, 'CONTAINS')
  const lv = detect(['milk'], 'kukurūzas milti, siers, sāls')
  assert.equal(lv.overall_status, 'CONTAINS')
  const lt = detect(['milk'], 'kukurūzų miltai, sūris, druska')
  assert.equal(lt.overall_status, 'CONTAINS')
})

test('kookospiim does not fire milk (Estonian compound; do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'vesi, kookospiim, sool')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('Võib sisaldada does not fire milk (do not add või — it is also Estonian or)', () => {
  const milk = detect(['milk'], 'riis, sool. Võib sisaldada: pähklid')
  assert.equal(milk.overall_status, 'SAFE')
  assert.equal(milk.matched_allergens.some((m) => m.allergen_id === 'milk'), false)

  const nuts = detect(['tree_nuts'], 'riis, sool. Võib sisaldada: pähklid')
  assert.equal(nuts.overall_status, 'MAY_CONTAIN')
  assert.ok(nuts.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('sarapuupähklid / lazdu rieksti / migdolai are CONTAINS for tree-nut allergy', () => {
  const et = detect(['tree_nuts'], 'suhkur, sarapuupähklid, sool')
  assert.equal(et.overall_status, 'CONTAINS')
  const lv = detect(['tree_nuts'], 'cukurs, lazdu rieksti, sāls')
  assert.equal(lv.overall_status, 'CONTAINS')
  const lt = detect(['tree_nuts'], 'cukrus, migdolai, druska')
  assert.equal(lt.overall_status, 'CONTAINS')
})

test('Sisaldab: pähklid / Satur: rieksti are CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const et = detect(['tree_nuts'], 'suhkur, kakao, vanilje. Sisaldab: pähklid')
  assert.equal(et.overall_status, 'CONTAINS')
  const lv = detect(['tree_nuts'], 'cukurs, kakao, vaniļa. Satur: rieksti')
  assert.equal(lv.overall_status, 'CONTAINS')
})

test('seesam / sezams / sezamas are CONTAINS for sesame allergy', () => {
  const et = detect(['sesame'], 'õli, seesam, sool')
  assert.equal(et.overall_status, 'CONTAINS')
  const lv = detect(['sesame'], 'eļļa, sezams, sāls')
  assert.equal(lv.overall_status, 'CONTAINS')
  const lt = detect(['sesame'], 'aliejus, sezamas, druska')
  assert.equal(lt.overall_status, 'CONTAINS')
})

test('sojaoad / sojas lecitīns / sojos lecitinas are CONTAINS for soy allergy', () => {
  const et = detect(['soy'], 'õli, sojaoad, sool')
  assert.equal(et.overall_status, 'CONTAINS')
  const lv = detect(['soy'], 'eļļa, sojas lecitīns, sāls')
  assert.equal(lv.overall_status, 'CONTAINS')
  const lt = detect(['soy'], 'aliejus, sojos lecitinas, druska')
  assert.equal(lt.overall_status, 'CONTAINS')
})

test('krevetid / garneles / krevetės are CONTAINS for shellfish allergy', () => {
  const et = detect(['shellfish'], 'õli, küüslauk, krevetid, sool')
  assert.equal(et.overall_status, 'CONTAINS')
  const lv = detect(['shellfish'], 'eļļa, ķiploki, garneles, sāls')
  assert.equal(lv.overall_status, 'CONTAINS')
  const lt = detect(['shellfish'], 'aliejus, česnakas, krevetės, druska')
  assert.equal(lt.overall_status, 'CONTAINS')
})

test('nisujahu / kviešu milti / kvietiniai miltai are CONTAINS for wheat allergy', () => {
  const et = detect(['wheat'], 'suhkur, nisujahu, sool')
  assert.equal(et.overall_status, 'CONTAINS')
  const lv = detect(['wheat'], 'cukurs, kviešu milti, sāls')
  assert.equal(lv.overall_status, 'CONTAINS')
  const lt = detect(['wheat'], 'cukrus, kvietiniai miltai, druska')
  assert.equal(lt.overall_status, 'CONTAINS')
})

test('sinep / sinepes / garstyčios are CONTAINS for mustard allergy', () => {
  const et = detect(['mustard'], 'õli, sinep, sool')
  assert.equal(et.overall_status, 'CONTAINS')
  const lv = detect(['mustard'], 'eļļa, sinepes, sāls')
  assert.equal(lv.overall_status, 'CONTAINS')
  const lt = detect(['mustard'], 'aliejus, garstyčios, druska')
  assert.equal(lt.overall_status, 'CONTAINS')
})

test('seller / selerijas / salierai are CONTAINS for celery allergy', () => {
  const et = detect(['celery'], 'õli, seller, sool')
  assert.equal(et.overall_status, 'CONTAINS')
  const lv = detect(['celery'], 'eļļa, selerijas, sāls')
  assert.equal(lv.overall_status, 'CONTAINS')
  const lt = detect(['celery'], 'aliejus, salierai, druska')
  assert.equal(lt.overall_status, 'CONTAINS')
})

test('hernevalk / zirņu olbaltumvielas / žirnių baltymai do not fire egg allergy', () => {
  const et = detect(['eggs'], 'vesi, hernevalk, sool')
  assert.equal(et.overall_status, 'SAFE')
  const lv = detect(['eggs'], 'ūdens, zirņu olbaltumvielas, sāls')
  assert.equal(lv.overall_status, 'SAFE')
  const lt = detect(['eggs'], 'vanduo, žirnių baltymai, druska')
  assert.equal(lt.overall_status, 'SAFE')
})

test('short Baltic terms do not fire on English lookalikes', () => {
  const milk = detect(['milk'], 'water, tomato, piano, host, most, cost')
  assert.equal(milk.overall_status, 'SAFE')
  const eggs = detect(['eggs'], 'water, cola, granola, solar, isolation, communication')
  assert.equal(eggs.overall_status, 'SAFE')
  const fish = detect(['fish'], 'water, kalamata, calendar, scala, fiscal')
  assert.equal(fish.overall_status, 'SAFE')
  const wheat = detect(['wheat'], 'water, ragu, popcorn, corn flakes')
  assert.equal(wheat.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only muna stays SAFE', () => {
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
  const peanutOnEgg = detect(['peanuts'], 'maisitärklis, muna, sool')
  assert.equal(peanutOnEgg.overall_status, 'SAFE')
  assert.equal(peanutOnEgg.matched_allergens.length, 0)
})

test('maisijahu / kukurūzas milti / kukurūzų miltai do not fire wheat (do not add bare flour)', () => {
  const et = detect(['wheat'], 'vesi, maisijahu, sool')
  assert.equal(et.overall_status, 'SAFE')
  const lv = detect(['wheat'], 'ūdens, kukurūzas milti, sāls')
  assert.equal(lv.overall_status, 'SAFE')
  const lt = detect(['wheat'], 'vanduo, kukurūzų miltai, druska')
  assert.equal(lt.overall_status, 'SAFE')
})

test('celiac AVOID on Baltic wheat flours and Contains: gluten, but not buckwheat or gluten-free', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['nisujahu', 'suhkur'], '')), 'AVOID')
  assert.equal(getCeliacSeverity(runCeliacCheck(['kviešu milti', 'cukurs'], '')), 'AVOID')
  assert.equal(getCeliacSeverity(runCeliacCheck(['kvietiniai miltai', 'cukrus'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['suhkur', 'kakao'], 'Sisaldab: gluteen')),
    'AVOID'
  )
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['cukurs', 'kakao'], 'Satur: glutēnu')),
    'AVOID'
  )
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['cukrus', 'kakava'], 'Sudėtyje yra: glitimo')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['tatar', 'sool'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['griķi', 'sāls'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['grikiai', 'druska'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['gluteenivaba kaerahelbed', 'sool'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['bezglutēna auzu pārslas', 'sāls'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['avižos be glitimo', 'druska'], '')), 'SAFE')
})
