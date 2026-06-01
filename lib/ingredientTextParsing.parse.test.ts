import test from 'node:test'
import assert from 'node:assert/strict'
import {
  parseIngredientListFromPlain,
  splitIngredientBlobOutsideParens,
  isOrphanOilSourceSeedToken,
} from './ingredientTextParsing'
import { buildIngredientTemplateItem } from './ingredientTemplates'

test('splitIngredientBlobOutsideParens keeps parenthetical oil sources on one line', () => {
  const parts = splitIngredientBlobOutsideParens(
    'Vegetable oil (soybean and cottonseed oil), Salt'
  )
  assert.equal(parts.length, 2)
  assert.match(parts[0], /vegetable oil/i)
  assert.match(parts[0], /soybean/i)
})

test('parseIngredientListFromPlain drops orphan soybean/cottonseed seed tokens', () => {
  const list = parseIngredientListFromPlain(
    'Vegetable oil, Soybean, Cottonseed, Salt, Modified food starch',
    'barcode'
  )
  assert.ok(!list.some((n) => /^soybean$/i.test(n.trim())))
  assert.ok(list.some((n) => /modified food starch/i.test(n)))
})

test('buildIngredientTemplateItem covers common cereal-bar gaps', () => {
  assert.ok(buildIngredientTemplateItem('Soluble corn fiber'))
  assert.ok(buildIngredientTemplateItem('Reduced iron'))
})

test('isOrphanOilSourceSeedToken identifies bare seed fragments', () => {
  assert.equal(isOrphanOilSourceSeedToken('Soybean'), true)
  assert.equal(isOrphanOilSourceSeedToken('Soybean oil'), false)
})
