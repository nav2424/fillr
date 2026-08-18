import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'

function detect(
  allergies: string[],
  input: Parameters<typeof detectAllergensEvidenceBased>[0]
) {
  return detectAllergensEvidenceBased(input, buildUserAllergenConfig(allergies))
}

test('Contains: Shellfish is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], {
    ingredients_text: 'water, salt, spices. Contains: Shellfish',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('Contains: Nuts is CONTAINS for tree nut allergy', () => {
  const out = detect(['tree_nuts'], {
    ingredients_text: 'sugar, cocoa. Contains: Nuts',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('Contains: Dairy is CONTAINS for milk allergy', () => {
  const out = detect(['milk'], {
    ingredients_text: 'water, salt. Contains: Dairy',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('bare cheese in ingredients is CONTAINS for milk allergy', () => {
  const out = detect(['dairy'], {
    ingredients_text: 'flour, cheese, salt',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('OFF en:nuts tags with no ingredient text is CONTAINS for tree nuts', () => {
  const out = detect(['tree_nuts'], {
    ingredients_text: '',
    allergens_tags: ['en:nuts'],
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'tree_nuts'))
})

test('OFF en:crustaceans tags with no ingredient text is CONTAINS for shellfish', () => {
  const out = detect(['shellfish'], {
    ingredients_text: '',
    allergens_tags: ['en:crustaceans'],
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('OFF en:molluscs tags with no ingredient text is CONTAINS for shellfish', () => {
  const out = detect(['shellfish'], {
    ingredients_text: '',
    allergens_tags: ['en:molluscs'],
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('OFF sulphite tag with no ingredient text is CONTAINS for sulfites', () => {
  const out = detect(['sulfites'], {
    ingredients_text: '',
    allergens_tags: ['en:sulphur-dioxide-and-sulphites'],
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'sulfites'))
})

test('French crevettes plural is CONTAINS for shellfish allergy', () => {
  const out = detect(['shellfish'], {
    ingredients_text: 'eau, crevettes, sel',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'shellfish'))
})

test('whey plus dairy-free claim still CONTAINS milk', () => {
  const out = detect(['milk'], {
    ingredients_text: 'whey protein isolate, dairy-free chocolate coating, salt',
  })
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('non-dairy creamer is not milk', () => {
  const out = detect(['milk'], {
    ingredients_text: 'water, sugar, non-dairy creamer',
  })
  assert.equal(out.overall_status, 'SAFE')
})

test('cocoa butter is not milk', () => {
  const out = detect(['milk'], {
    ingredients_text: 'cocoa mass, cocoa butter, sugar',
  })
  assert.equal(out.overall_status, 'SAFE')
})

test('nutmeg and coconut are not tree nuts', () => {
  const out = detect(['tree_nuts'], {
    ingredients_text: 'sugar, nutmeg, coconut, salt',
  })
  assert.equal(out.overall_status, 'SAFE')
})

test('vegan cheese is not milk', () => {
  const out = detect(['milk'], {
    ingredients_text: 'water, cashew cheese, salt',
  })
  assert.equal(out.overall_status, 'SAFE')
})
