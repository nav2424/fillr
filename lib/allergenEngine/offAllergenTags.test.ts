import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'
import { normalizeOFFProduct } from './offNormalizer'

function statusFor(
  allergy: string,
  input: {
    product_name?: string
    ingredients_text?: string
    ingredients_text_safety?: string
    contains_text?: string
    may_contain_text?: string
    allergens_tags?: string[]
    traces_tags?: string[]
  }
) {
  return detectAllergensEvidenceBased(
    {
      product_name: input.product_name ?? 'Test',
      ingredients_text: input.ingredients_text ?? '',
      ingredients_text_safety: input.ingredients_text_safety,
      contains_text: input.contains_text ?? '',
      may_contain_text: input.may_contain_text ?? '',
      allergens_tags: input.allergens_tags ?? [],
      traces_tags: input.traces_tags ?? [],
    },
    buildUserAllergenConfig([allergy])
  ).overall_status
}

/** Live OFF record 3017620422003 as of 2026-11-01. English ingredients omit hazelnuts. */
const NUTELLA = {
  product_name: 'Nutella',
  ingredients_text: 'sugar, palm oil',
  ingredients_text_en: 'sugar, palm oil',
  ingredients_text_fr:
    "Sucre, huile de palme, NOISETTES 13%, cacao maigre 7,4%, LAIT écrémé en poudre 6,6%, LACTOSERUM en poudre, émulsifiants: lécithines [SOJA), vanilline. Sans gluten.",
  allergens: 'milk, nuts, soybeans',
  allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
  ingredients: [{ text: 'sugar' }, { text: 'palm oil' }],
}

test('Nutella OFF payload is CONTAINS for tree nuts and still SAFE for peanuts', () => {
  const norm = normalizeOFFProduct(NUTELLA, 'en')
  assert.ok(norm)
  const fields = {
    product_name: 'Nutella',
    ingredients_text: norm!.ingredients_text,
    ingredients_text_safety: norm!.ingredients_text_safety,
    contains_text: norm!.contains_text,
    may_contain_text: norm!.may_contain_text,
    allergens_tags: norm!.allergens_tags,
    traces_tags: norm!.traces_tags,
  }
  assert.equal(statusFor('tree_nuts', fields), 'CONTAINS')
  assert.equal(statusFor('milk', fields), 'CONTAINS')
  assert.equal(statusFor('soy', fields), 'CONTAINS')
  assert.equal(statusFor('peanuts', fields), 'SAFE')
})

test('en:nuts tag alone is tree nuts, en:peanuts tag alone is not', () => {
  const base = { ingredients_text: 'sugar, salt, oil', ingredients_text_safety: 'sugar, salt, oil' }
  assert.equal(statusFor('tree_nuts', { ...base, allergens_tags: ['en:nuts'] }), 'CONTAINS')
  assert.equal(statusFor('tree_nuts', { ...base, allergens_tags: ['en:peanuts'] }), 'SAFE')
  assert.equal(statusFor('peanuts', { ...base, allergens_tags: ['en:peanuts'] }), 'CONTAINS')
})

test('mixed nuts and Contains: nuts are tree nuts; Grape-Nuts cereal is not', () => {
  assert.equal(
    statusFor('tree_nuts', { ingredients_text: 'mixed nuts, dried cranberries, sea salt' }),
    'CONTAINS'
  )
  assert.equal(
    statusFor('tree_nuts', { ingredients_text: 'sugar, palm oil. Contains: milk, nuts.' }),
    'CONTAINS'
  )
  assert.equal(
    statusFor('tree_nuts', { ingredients_text: 'grape-nuts, wheat flour, salt' }),
    'SAFE'
  )
  assert.equal(
    statusFor('tree_nuts', { ingredients_text: 'grape-nuts, almonds, salt' }),
    'CONTAINS'
  )
  assert.equal(statusFor('tree_nuts', { ingredients_text: 'doughnuts, sugar' }), 'SAFE')
  assert.equal(statusFor('tree_nuts', { ingredients_text: 'peanuts, salt' }), 'SAFE')
})

test('OFF shellfish and sulfite parent tags map when the ingredient line does not name them', () => {
  const quiet = { ingredients_text: 'water, salt, sugar', ingredients_text_safety: 'water, salt, sugar' }
  assert.equal(statusFor('shellfish', { ...quiet, allergens_tags: ['en:molluscs'] }), 'CONTAINS')
  assert.equal(statusFor('shellfish', { ...quiet, allergens_tags: ['en:crustaceans'] }), 'CONTAINS')
  assert.equal(
    statusFor('shellfish', {
      ingredients_text: "Farine de ble, eau, encornets, huile",
      contains_text: 'gluten, molluscs',
      allergens_tags: ['en:gluten', 'en:molluscs'],
    }),
    'CONTAINS'
  )
  assert.equal(
    statusFor('sulfites', { ...quiet, allergens_tags: ['en:sulphur-dioxide-and-sulphites'] }),
    'CONTAINS'
  )
  assert.equal(statusFor('shellfish', quiet), 'SAFE')
})
