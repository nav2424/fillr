import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'
import { normalizeOFFProduct } from './offNormalizer'

function detect(
  allergies: string[],
  input: {
    product_name?: string
    ingredients_text?: string
    ingredients_text_safety?: string
    contains_text?: string
    may_contain_text?: string
  }
) {
  return detectAllergensEvidenceBased(input, buildUserAllergenConfig(allergies))
}

test('Alaska pollock fish sticks are CONTAINS for fish allergy', () => {
  const out = detect(['fish'], {
    product_name: 'Crispy Fish Sticks',
    ingredients_text: 'Alaska pollock, water, vegetable oil, wheat flour, salt',
    ingredients_text_safety: 'Alaska pollock, water, vegetable oil, wheat flour, salt',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})

test('imitation crab / surimi is CONTAINS for fish allergy', () => {
  const pollock = detect(['fish'], {
    product_name: 'Imitation Crab',
    ingredients_text: 'Alaska pollock, water, egg whites, wheat starch, sugar, salt',
    ingredients_text_safety: 'Alaska pollock, water, egg whites, wheat starch, sugar, salt',
  })
  assert.equal(pollock.overall_status, 'CONTAINS')

  const surimi = detect(['fish'], {
    product_name: 'Surimi',
    ingredients_text: 'surimi, water, sugar, salt',
    ingredients_text_safety: 'surimi, water, sugar, salt',
  })
  assert.equal(surimi.overall_status, 'CONTAINS')
})

test('herring and mackerel labels are CONTAINS for fish allergy', () => {
  const herring = detect(['fish'], {
    ingredients_text: 'herring, vinegar, salt, sugar, onion',
    ingredients_text_safety: 'herring, vinegar, salt, sugar, onion',
  })
  assert.equal(herring.overall_status, 'CONTAINS')

  const mackerel = detect(['fish'], {
    ingredients_text: 'mackerel, salt, smoke',
    ingredients_text_safety: 'mackerel, salt, smoke',
  })
  assert.equal(mackerel.overall_status, 'CONTAINS')
})

test('French cabillaud / colin d\'Alaska are CONTAINS for fish allergy', () => {
  const cabillaud = detect(['fish'], {
    ingredients_text: 'cabillaud, sel, huile',
    ingredients_text_safety: 'cabillaud, sel, huile',
  })
  assert.equal(cabillaud.overall_status, 'CONTAINS')

  const colin = detect(['fish'], {
    ingredients_text: "colin d'Alaska, eau, huile végétale",
    ingredients_text_safety: "colin d'Alaska, eau, huile végétale",
  })
  assert.equal(colin.overall_status, 'CONTAINS')
})

test('potassium caseinate coffee creamer is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], {
    product_name: 'Coffee creamer',
    ingredients_text: 'water, sugar, vegetable oil, potassium caseinate, dipotassium phosphate',
    ingredients_text_safety: 'water, sugar, vegetable oil, potassium caseinate, dipotassium phosphate',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('slash-separated OFF Contains line keeps later allergens', () => {
  const spaced = normalizeOFFProduct({
    product_name: 'Seasoned chips',
    ingredients_text: 'potatoes, vegetable oil, salt, spices',
    allergens: 'Milk / Soy / Wheat',
  })
  assert.ok(spaced)
  assert.match(spaced.contains_text, /soy/i)
  assert.match(spaced.contains_text, /wheat/i)

  const soy = detect(['soy'], {
    product_name: spaced.product_name,
    ingredients_text: spaced.ingredients_text,
    ingredients_text_safety: spaced.ingredients_text_safety,
    contains_text: spaced.contains_text,
  })
  assert.equal(soy.overall_status, 'CONTAINS')
  assert.ok(soy.matched_allergens.some((m) => m.allergen_id === 'soy'))

  const compact = normalizeOFFProduct({
    product_name: 'Cookies',
    ingredients_text: 'enriched flour, sugar, oil',
    allergens: 'Wheat/Soy/Milk',
  })
  assert.ok(compact)
  const milk = detect(['milk'], {
    product_name: compact.product_name,
    ingredients_text: compact.ingredients_text,
    ingredients_text_safety: compact.ingredients_text_safety,
    contains_text: compact.contains_text,
  })
  assert.equal(milk.overall_status, 'CONTAINS')
  assert.ok(milk.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('bilingual Milk / Lait Contains line still matches milk', () => {
  const norm = normalizeOFFProduct({
    product_name: 'Yogurt',
    ingredients_text: 'cultures, sugar',
    allergens: 'Milk / Lait',
  })
  assert.ok(norm)
  const out = detect(['milk'], {
    product_name: norm.product_name,
    ingredients_text: norm.ingredients_text,
    ingredients_text_safety: norm.ingredients_text_safety,
    contains_text: norm.contains_text,
  })
  assert.equal(out.overall_status, 'CONTAINS')
})

test('calamari and krill oil are CONTAINS for shellfish allergy', () => {
  const calamari = detect(['shellfish'], {
    ingredients_text: 'calamari, wheat flour, vegetable oil, salt',
    ingredients_text_safety: 'calamari, wheat flour, vegetable oil, salt',
  })
  assert.equal(calamari.overall_status, 'CONTAINS')

  const krill = detect(['shellfish'], {
    ingredients_text: 'krill oil, gelatin, glycerol',
    ingredients_text_safety: 'krill oil, gelatin, glycerol',
  })
  assert.equal(krill.overall_status, 'CONTAINS')
})
