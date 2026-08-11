import assert from 'node:assert/strict'
import test from 'node:test'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'

test('lactose-free dairy still matches milk allergy (not false SAFE)', () => {
  const user = buildUserAllergenConfig(['dairy'])
  const out = detectAllergensEvidenceBased(
    {
      product_name: 'Lactose Free 2% Milk',
      ingredients_text: 'Milk, Vitamin D3, Lactase enzyme',
      ingredients_text_safety: 'Ingredients: Milk, Vitamin D3, Lactase enzyme. Lactose-free.',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('milk evidence is kept when a distant lactose-free claim appears on the same panel', () => {
  const user = buildUserAllergenConfig(['milk'])
  const out = detectAllergensEvidenceBased(
    {
      product_name: 'Milk Chocolate Bar',
      ingredients_text: 'Sugar, milk chocolate, cocoa butter, soy lecithin',
      ingredients_text_safety:
        'Sugar, milk chocolate, cocoa butter, soy lecithin. Also try our lactose-free line.',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('whey / milk protein lactose-free products stay UNSAFE for milk allergy', () => {
  const user = buildUserAllergenConfig(['dairy'])
  const out = detectAllergensEvidenceBased(
    {
      product_name: 'Whey Isolate',
      ingredients_text: 'Whey protein isolate, cocoa',
      ingredients_text_safety: 'Whey protein isolate, cocoa. Lactose free.',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('French sans lactose does not wipe lait / milk matches', () => {
  const user = buildUserAllergenConfig(['dairy'])
  const out = detectAllergensEvidenceBased(
    {
      product_name: 'Lait',
      ingredients_text: 'Lait, vitamines',
      ingredients_text_safety: 'Lait, vitamines. Sans lactose.',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'milk'))
})

test('gluten-free marketing copy does not wipe separate wheat flour evidence', () => {
  const user = buildUserAllergenConfig(['gluten'])
  const out = detectAllergensEvidenceBased(
    {
      product_name: 'Mystery Bar',
      ingredients_text: 'Wheat flour, sugar, oil',
      ingredients_text_safety:
        'Wheat flour, sugar, oil. Certified gluten-free facility nearby produces our GF line.',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.equal(out.overall_status, 'CONTAINS')
  assert.ok(out.matched_allergens.some((m) => m.allergen_id === 'wheat'))
})

test('true milk-free phrasing still suppresses a milk token inside milk-free', () => {
  const user = buildUserAllergenConfig(['milk'])
  const out = detectAllergensEvidenceBased(
    {
      product_name: 'Coating',
      ingredients_text: 'Sugar, cocoa, milk-free chocolate coating',
      ingredients_text_safety: 'Sugar, cocoa, milk-free chocolate coating',
      contains_text: '',
      may_contain_text: '',
      allergens_tags: [],
      traces_tags: [],
    },
    user
  )
  assert.equal(out.overall_status, 'SAFE')
  assert.equal(out.matched_allergens.length, 0)
})
