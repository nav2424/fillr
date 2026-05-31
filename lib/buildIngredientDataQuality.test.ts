import test from 'node:test'
import assert from 'node:assert/strict'
import { buildIngredientDataQuality } from './buildIngredientDataQuality'
import type { ScanResult } from '../types'

const base: ScanResult = {
  product: {
    id: 'p1',
    barcode: '123',
    name: 'Test',
    brand: '',
    ingredientText: 'Sugar, cocoa butter, milk, whey protein, salt, natural flavors, lecithin',
    source: 'openfoodfacts',
    createdAt: '',
    updatedAt: '',
    allergensTags: ['en:milk'],
  },
  safetyStatus: 'UNSAFE',
  matchedAllergens: [],
  matchedSensitivities: [],
  smartSummary: '',
  ingredientBreakdown: [],
  insights: [],
  ingredientDataQualityScore: 85,
}

test('high coverage when score and lines are strong', () => {
  const q = buildIngredientDataQuality(base)
  assert.equal(q?.level, 'high')
  assert.equal(q?.suggestLabelCapture, false)
})

test('low coverage caps UNKNOWN scans', () => {
  const q = buildIngredientDataQuality({
    ...base,
    safetyStatus: 'UNKNOWN',
    product: { ...base.product, ingredientText: 'water' },
    ingredientDataQualityScore: 10,
  })
  assert.equal(q?.level, 'low')
  assert.equal(q?.suggestLabelCapture, true)
})
