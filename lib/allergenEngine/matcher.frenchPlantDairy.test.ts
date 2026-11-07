import test from 'node:test'
import assert from 'node:assert/strict'
import { detectAllergensEvidenceBased, buildUserAllergenConfig } from './index'
import { normalizeOFFProduct } from './offNormalizer'

const MOUSSE_INGREDIENTS =
  "Lait de coco allégé 31,8% (eau, extrait de noix de coco), eau, chocolat 18% (sucre, pâte de cacao, beurre de cacao, cacao maigre en poudre, émulsifiant : lécithine, arôme naturel de vanille), sucre, eau de coco, amidon, protéines de pomme de terre, émulsifiant : mono et diglycérides d'acides gras, épaississant: carraghénanes, sel. Peut contenir du SOJA et des FRUITS À COQUE."

function milkStatus(ingredients: string, extra?: { allergens_tags?: string[]; traces_tags?: string[] }) {
  const output = detectAllergensEvidenceBased(
    {
      product_name: 'Plant dessert',
      ingredients_text: ingredients,
      ingredients_text_safety: ingredients,
      allergens_tags: extra?.allergens_tags ?? [],
      traces_tags: extra?.traces_tags ?? [],
    },
    buildUserAllergenConfig(['milk'])
  )
  return output.overall_status
}

test('French coconut milk and cocoa butter are not dairy', () => {
  assert.equal(milkStatus('Lait de coco, eau, extrait de noix de coco'), 'SAFE')
  assert.equal(milkStatus('sucre, pâte de cacao, beurre de cacao, vanille'), 'SAFE')
  assert.equal(milkStatus('crème de coco, eau, sel'), 'SAFE')
  assert.equal(milkStatus("lait d'amande, eau, sel"), 'SAFE')
  assert.equal(milkStatus('beurre de cacahuète, sucre, sel'), 'SAFE')
  assert.equal(milkStatus('poudre de lait de coco, sucre, sel'), 'SAFE')
})

test('plant phrase beside real dairy still contains milk', () => {
  assert.equal(milkStatus('lait de coco, lait entier, sucre'), 'CONTAINS')
  assert.equal(milkStatus('beurre de cacao, beurre, sucre'), 'CONTAINS')
  assert.equal(milkStatus('crème de coco, crème, sucre'), 'CONTAINS')
  assert.equal(milkStatus('chocolat (beurre de cacao, lait), sucre'), 'CONTAINS')
})

test('English milk phrases keep their current results', () => {
  assert.equal(milkStatus('whole milk, sugar, pectin'), 'CONTAINS')
  assert.equal(milkStatus('butter, sugar, flour'), 'CONTAINS')
  assert.equal(milkStatus('cocoa butter, cane sugar, cocoa mass'), 'SAFE')
  assert.equal(milkStatus('coconut milk, water, guar gum'), 'SAFE')
})

test('OFF product 3608580942764 plant mousse is safe for a milk allergy', () => {
  const norm = normalizeOFFProduct({
    product_name: 'Gourmand & Végétal Mousse au chocolat 4 x 55 g',
    ingredients_text: MOUSSE_INGREDIENTS,
    ingredients_text_en: '',
    allergens: 'soybeans',
    allergens_tags: ['en:soybeans'],
    traces: 'nuts, soybeans',
    traces_tags: ['en:nuts', 'en:soybeans'],
  })
  assert.ok(norm)
  const output = detectAllergensEvidenceBased(
    {
      product_name: norm!.product_name,
      ingredients_text: norm!.ingredients_text,
      ingredients_text_safety: norm!.ingredients_text_safety,
      contains_text: norm!.contains_text,
      may_contain_text: norm!.may_contain_text,
      allergens_tags: norm!.allergens_tags,
      traces_tags: norm!.traces_tags,
    },
    buildUserAllergenConfig(['milk'])
  )
  assert.equal(output.overall_status, 'SAFE')
  assert.equal(
    output.matched_allergens.some((match) => match.allergen_id === 'milk'),
    false
  )
})

test('a real milk tag still wins when the French phrase is plant dairy', () => {
  assert.equal(
    milkStatus('Lait de coco, eau', { allergens_tags: ['en:milk'] }),
    'CONTAINS'
  )
})
