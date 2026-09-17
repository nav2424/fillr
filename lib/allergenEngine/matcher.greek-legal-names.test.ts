/**
 * Whole-word matching misses Greek legal allergen names. Greek stems never
 * contain English/French dictionary words (egg/oeuf, peanut/arachide,
 * fish/poisson, milk/lait). JS \\b is ASCII-only, so even an added synonym
 * like αυγά would not match until word boundaries treat unicode letters as
 * word characters.
 *
 * OCR never translates Greek labels. English `milk` does not match `γάλα`;
 * `egg` does not match `αυγά`; French `arachide` does not stem to `αραχίδες`.
 * Greek soy `σόγια` is not the existing Latin `soja`. Greek sesame is
 * `σουσάμι`, not `sesame`/`sésame`.
 *
 * NFKD strips Greek tonos (`αυγά` → `αυγα`). Final sigma is not in the core
 * FDA-9 terms. ALL-CAPS headers drop tonos (`ΠΕΡΙΕΧΕΙ` ≠ `Περιέχει`).
 *
 * Distinct from Croatian (jaja/mlijeko), Bulgarian (яйца/мляко),
 * Romanian (ouă/lapte), Hungarian (tojás/tej), Slovak (vajcia/mlieko),
 * Czech (vejce/mléko), Finnish (muna/maito), Danish (æg/mælk),
 * Swedish (ägg/mjölk), Polish (jajka/mleko), Dutch (ei/pinda/melk),
 * Portuguese (ovos/amendoim), Spanish (leche/huevo), Italian (uova/arachidi),
 * and German (Vollmilch/Haselnüsse).
 *
 * Run: npx tsx --test lib/allergenEngine/matcher.greek-legal-names.test.ts
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

test('Greek tonos strip via NFKD; Latin milk still folds', () => {
  assert.equal(normalizeText('αυγά'), 'αυγα')
  assert.equal(normalizeText('αυγό'), 'αυγο')
  assert.equal(normalizeText('γάλα'), 'γαλα')
  assert.equal(normalizeText('ψάρι'), 'ψαρι')
  assert.equal(normalizeText('αραχίδες'), 'αραχιδες')
  assert.equal(normalizeText('σόγια'), 'σογια')
  assert.equal(normalizeText('σουσάμι'), 'σουσαμι')
  assert.equal(normalizeText('σιταλεύρο'), 'σιταλευρο')
  assert.equal(normalizeText('γλουτένη'), 'γλουτενη')
  assert.equal(normalizeText('Περιέχει'), 'περιεχει')
  assert.equal(normalizeText('soja'), 'soja')
  assert.equal(normalizeText('milk'), 'milk')
})

test('αυγά is CONTAINS for egg allergy (Greek eggs, no word egg/oeuf)', () => {
  const out = detect(['eggs'], 'ζάχαρη, αυγά, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('ασπράδι αυγού is CONTAINS for egg allergy (not generic protein)', () => {
  const out = detect(['eggs'], 'νερό, ασπράδι αυγού, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('Περιέχει: αυγά is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'αλεύρι καλαμποκιού, ζάχαρη, αλάτι. Περιέχει: αυγά')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('ALL-CAPS ΠΕΡΙΕΧΕΙ: ΑΥΓΑ is CONTAINS for egg allergy', () => {
  const out = detect(['eggs'], 'αλεύρι καλαμποκιού, ζάχαρη, αλάτι. ΠΕΡΙΕΧΕΙ: ΑΥΓΑ')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'eggs'))
})

test('parseSections treats Περιέχει as a Contains header and does not steal δεν περιέχει', () => {
  const parsed = parseSections('αλεύρι καλαμποκιού, αλάτι. Περιέχει: αυγά, γάλα')
  assert.match(parsed.contains_text, /αυγά/i)
  assert.match(parsed.contains_text, /γάλα/i)
  assert.doesNotMatch(parsed.ingredients_text, /Περιέχει/i)

  const may = parseSections('αλεύρι καλαμποκιού, αλάτι. Μπορεί να περιέχει: καρποί με κέλυφος')
  assert.match(may.may_contain_text, /καρποί με κέλυφος/i)
  assert.doesNotMatch(may.contains_text, /καρποί με κέλυφος/i)

  const out = detect(['tree_nuts'], 'αλεύρι καλαμποκιού, αλάτι. Μπορεί να περιέχει: καρποί με κέλυφος')
  assert.equal(out.overall_status, 'MAY_CONTAIN')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const traces = parseSections('ρύζι, αλάτι. Μπορεί να περιέχει ίχνη από: καρποί με κέλυφος')
  assert.match(traces.may_contain_text, /καρποί με κέλυφος/i)
  assert.doesNotMatch(traces.contains_text, /καρποί με κέλυφος/i)

  const noSteal = parseSections('ρύζι, αλάτι. δεν περιέχει αυγά')
  assert.equal(noSteal.contains_text, '')
  assert.match(noSteal.ingredients_text, /δεν περιέχει αυγά/i)
})

test('English Ingredients: prefix still strips after adding Συστατικά', () => {
  const parsed = parseSections('Ingredients: sugar, salt, rice flour')
  assert.match(parsed.ingredients_text, /sugar/i)
  assert.doesNotMatch(parsed.ingredients_text, /Ingredients/i)

  const el = parseSections('Συστατικά: ζάχαρη, αλάτι, αλεύρι καλαμποκιού')
  assert.match(el.ingredients_text, /ζάχαρη/i)
  assert.doesNotMatch(el.ingredients_text, /Συστατικά/i)
})

test('αραχίδες is CONTAINS for peanut allergy (Greek peanut ≠ French arachide)', () => {
  const out = detect(['peanuts'], 'φυτικό έλαιο, αλάτι, αραχίδες')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('φυστικοβούτυρο is CONTAINS for peanut allergy and SAFE for milk (do not add bare βούτυρο)', () => {
  const peanuts = detect(['peanuts'], 'ζάχαρη, φυστικοβούτυρο, αλάτι')
  assert.equal(peanuts.overall_status, 'CONTAINS')
  assert.ok(peanuts.matched_allergens.some((m) => m.allergen_id === 'peanuts'))

  const milk = detect(['milk'], 'ζάχαρη, φυστικοβούτυρο, αλάτι')
  assert.equal(milk.overall_status, 'SAFE')
  assert.equal(milk.matched_allergens.some((m) => m.allergen_id === 'milk'), false)
})

test('peanut-only αραχίδες stays SAFE for tree nuts', () => {
  const out = detect(['tree_nuts'], 'ζάχαρη, αραχίδες, αλάτι')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'), false)
})

test('φιστίκι Αιγίνης is tree nut CONTAINS and does not fire peanut (do not add bare φιστίκι)', () => {
  const nuts = detect(['tree_nuts'], 'ζάχαρη, φιστίκι Αιγίνης, αλάτι')
  assert.equal(nuts.overall_status, 'CONTAINS')
  assert.ok(nuts.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))

  const peanuts = detect(['peanuts'], 'ζάχαρη, φιστίκι Αιγίνης, αλάτι')
  assert.equal(peanuts.overall_status, 'SAFE')
  assert.equal(peanuts.matched_allergens.some((m) => m.allergen_id === 'peanuts'), false)
})

test('ψάρι is CONTAINS for fish allergy (Greek fish, no word fish/poisson)', () => {
  const out = detect(['fish'], 'έλαιο, αλεύρι καλαμποκιού, ψάρι, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('σολομός is CONTAINS for fish allergy (species name, no standalone ψάρι)', () => {
  const out = detect(['fish'], 'έλαιο, σολομός, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('γάλα is CONTAINS for milk allergy (Greek milk ≠ English milk)', () => {
  const out = detect(['milk'], 'ζάχαρη, γάλα, κακάο')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('τυρί is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], 'αλεύρι καλαμποκιού, τυρί, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('γάλα still fires when γάλα καρύδας is also present (do not add coconut-milk anti-match)', () => {
  const out = detect(['milk'], 'νερό, γάλα, γάλα καρύδας, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('αμύγδαλα is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'ζάχαρη, αμύγδαλα, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('φουντούκια is CONTAINS for tree-nut allergy', () => {
  const out = detect(['tree_nuts'], 'ζάχαρη, φουντούκια, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('καρποί με κέλυφος is CONTAINS for tree-nut allergy (EU umbrella)', () => {
  const out = detect(['tree_nuts'], 'ζάχαρη, κακάο, βανίλια. Περιέχει: καρποί με κέλυφος')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('σουσάμι is CONTAINS for sesame allergy (Greek sesame ≠ sesame/sésame)', () => {
  const out = detect(['sesame'], 'έλαιο, σουσάμι, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sesame'))
})

test('σόγια is CONTAINS for soy allergy (Greek soy ≠ Latin soja)', () => {
  const out = detect(['soy'], 'έλαιο, σόγια, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('σογιάλευρο is CONTAINS for soy allergy (compound, no standalone σόγια)', () => {
  const out = detect(['soy'], 'νερό, σογιάλευρο, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'soy'))
})

test('γαρίδες is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], 'έλαιο, σκόρδο, γαρίδες, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('σιταλεύρο is CONTAINS for wheat allergy (no word wheat/blé)', () => {
  const out = detect(['wheat'], 'ζάχαρη, σιταλεύρο, αλάτι')
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('αλεύρι καλαμποκιού stays SAFE for wheat allergy (do not add bare αλεύρι)', () => {
  const out = detect(['wheat'], 'ζάχαρη, αλεύρι καλαμποκιού, αλάτι')
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.some((m) => m.allergen_id === 'wheat'), false)
})

test('unicode word boundaries still reject ASCII false friends and keep English matches', () => {
  const donut = detect(['tree_nuts'], 'water, sugar, donut, salt')
  assert.equal(donut.overall_status, 'SAFE')
  const milk = detect(['milk'], 'water, sugar, milk, salt')
  assert.equal(milk.overall_status, 'CONTAINS')
  const eggs = detect(['eggs'], 'water, sugar, eggs, salt')
  assert.equal(eggs.overall_status, 'CONTAINS')
})

test('αυγά as a prefix inside a longer token does not match', () => {
  const out = detect(['eggs'], 'νερό, αυγάρια, αλάτι')
  assert.equal(out.overall_status, 'SAFE')
})

test('English eggs still match and peanut-only αυγά stays SAFE', () => {
  const en = detect(['eggs'], 'water, eggs, salt')
  assert.equal(en.overall_status, 'CONTAINS')
  const peanuts = detect(['peanuts'], 'ζάχαρη, αυγά, αλάτι')
  assert.equal(peanuts.overall_status, 'SAFE')
})

test('celiac AVOID on σιταλεύρο and Περιέχει: γλουτένη; buckwheat and corn flour stay SAFE', () => {
  assert.equal(getCeliacSeverity(runCeliacCheck(['σιταλεύρο', 'ζάχαρη'], '')), 'AVOID')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['ζάχαρη', 'κακάο'], 'Περιέχει: γλουτένη')),
    'AVOID'
  )
  assert.equal(getCeliacSeverity(runCeliacCheck(['φαγόπυρο', 'αλάτι'], '')), 'SAFE')
  assert.equal(getCeliacSeverity(runCeliacCheck(['αλεύρι καλαμποκιού', 'αλάτι'], '')), 'SAFE')
  assert.equal(
    getCeliacSeverity(runCeliacCheck(['αλεύρι καλαμποκιού', 'αλάτι'], 'χωρίς γλουτένη')),
    'SAFE'
  )
})
