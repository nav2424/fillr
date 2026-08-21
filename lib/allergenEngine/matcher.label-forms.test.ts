import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'

function detect(
  allergies: string[],
  input: Parameters<typeof detectAllergensEvidenceBased>[0]
) {
  return detectAllergensEvidenceBased(input, buildUserAllergenConfig(allergies))
}

test('sulphur dioxide is CONTAINS for sulfite allergy', () => {
  const out = detect(['sulfites'], {
    ingredients_text: 'dried apricots, sulphur dioxide',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sulfites'))
})

test('sodium metabisulphite is CONTAINS for sulfite allergy', () => {
  const out = detect(['sulfites'], {
    ingredients_text: 'wine, sodium metabisulphite',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sulfites'))
})

test('E220 preservative code is CONTAINS for sulfite allergy', () => {
  const out = detect(['sulfites'], {
    ingredients_text: 'lemon juice concentrate, preservative: E220',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sulfites'))
})

test('dioxyde de soufre is CONTAINS for sulfite allergy', () => {
  const out = detect(['sulfites'], {
    ingredients_text: 'abricots secs, dioxyde de soufre',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sulfites'))
})

test('French arachides plural is CONTAINS for peanut allergy', () => {
  const out = detect(['peanuts'], {
    ingredients_text: 'sel, arachides, huile végétale',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'peanuts'))
})

test('Contient fruits à coque is CONTAINS for tree nut allergy', () => {
  const out = detect(['tree_nuts'], {
    ingredients_text: 'sucre, beurre de cacao, vanille. Contient : fruits à coque',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('French amandes plural is CONTAINS for tree nut allergy', () => {
  const out = detect(['tree_nuts'], {
    ingredients_text: 'sucre, amandes, sel',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('French poissons plural is CONTAINS for fish allergy', () => {
  const out = detect(['fish'], {
    ingredients_text: 'eau, sel. Contient : poissons',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'fish'))
})
