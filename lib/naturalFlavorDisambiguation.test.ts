import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldEscalateNaturalFlavor, shouldEscalateProcessingSignal } from './naturalFlavorDisambiguation'

test('does not escalate natural flavor without supporting context', () => {
  const out = shouldEscalateNaturalFlavor({
    ingredientName: 'Natural flavor',
    fullLabelHaystack: 'water, natural flavor, citric acid',
    productCategory: 'generic_packaged',
  })
  assert.equal(out.escalate, false)
  assert.equal(out.reason, 'insufficient_context')
})

test('escalates natural flavor with allergen support context', () => {
  const out = shouldEscalateNaturalFlavor({
    ingredientName: 'Natural flavors',
    fullLabelHaystack: 'water, natural flavors, whey protein concentrate',
    productCategory: 'drink',
  })
  assert.equal(out.escalate, true)
  assert.equal(out.reason, 'allergen_context')
})

test('escalates natural flavor in higher-risk product categories', () => {
  const out = shouldEscalateNaturalFlavor({
    ingredientName: 'Natural flavor',
    fullLabelHaystack: 'sugar, natural flavor, color',
    productCategory: 'candy',
  })
  assert.equal(out.escalate, true)
  assert.equal(out.reason, 'category_candy')
})

test('does not escalate caramel color without supporting context', () => {
  const out = shouldEscalateProcessingSignal({
    ingredientName: 'Caramel color',
    fullLabelHaystack: 'water, caramel color, citric acid',
    productCategory: 'generic_packaged',
  })
  assert.equal(out.escalate, false)
  assert.equal(out.reason, 'insufficient_context')
})

test('escalates caramel color with gluten support context', () => {
  const out = shouldEscalateProcessingSignal({
    ingredientName: 'Caramel colour',
    fullLabelHaystack: 'barley malt extract, caramel colour, natural flavor',
    productCategory: 'drink',
  })
  assert.equal(out.escalate, true)
  assert.equal(out.reason, 'gluten_context')
})

test('escalates maltodextrin with paired processed signals', () => {
  const out = shouldEscalateProcessingSignal({
    ingredientName: 'Maltodextrin',
    fullLabelHaystack: 'maltodextrin, artificial flavor, preservative',
    productCategory: 'generic_packaged',
  })
  assert.equal(out.escalate, true)
  assert.equal(out.reason, 'paired_processed_signals')
})

test('does not escalate modified starch without context', () => {
  const out = shouldEscalateProcessingSignal({
    ingredientName: 'Modified food starch',
    fullLabelHaystack: 'modified food starch, salt, water',
    productCategory: 'generic_packaged',
  })
  assert.equal(out.escalate, false)
  assert.equal(out.reason, 'insufficient_context')
})

test('escalates modified starch in higher-risk processed categories', () => {
  const out = shouldEscalateProcessingSignal({
    ingredientName: 'Modified starch',
    fullLabelHaystack: 'modified starch, flavor, syrup solids',
    productCategory: 'condiment',
  })
  assert.equal(out.escalate, true)
  assert.equal(out.reason, 'paired_processed_signals')
})

