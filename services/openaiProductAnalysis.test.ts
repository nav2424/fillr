import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeProductDeepAnalysisIntoScan } from './openaiProductAnalysis'
import type { ScanResult } from '../types'

const baseScan = (): ScanResult => ({
  product: {
    id: 'prod_test',
    barcode: '123',
    name: 'Test Bar',
    brand: 'Fillr',
    ingredientText: 'Sugar, cocoa, palm oil',
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  safetyStatus: 'UNSAFE',
  matchedAllergens: [
    {
      allergenKey: 'milk',
      allergenName: 'Milk',
      matchedIngredient: 'whey',
      explanation: 'Contains milk.',
    },
  ],
  matchedSensitivities: [],
  smartSummary: 'Not safe',
  ingredientBreakdown: [
    {
      name: 'Sugar',
      whatItIs: 'Sweetener.',
      whyItsUsed: 'Sweetness.',
      whatToKnow: 'Sugar load.',
      ingredientRating: 'okay',
    },
  ],
  insights: [],
  productVerdict: 'This product is not safe for you — it contains milk from your allergy list.',
})

test('mergeProductDeepAnalysis keeps locked allergen productVerdict', () => {
  const scan = baseScan()
  const merged = mergeProductDeepAnalysisIntoScan(scan, {
    productVerdict: 'A wholesome everyday staple you can trust.',
    productAnalysis: {
      viralHook: 'Stacked sugar with palm oil for shelf-stable texture.',
      bottomLine: 'Engineered for taste and shelf life, not whole-food nutrition.',
      whoShouldAvoid: 'Anyone limiting added sugar.',
      sugarSources: ['Sugar'],
    },
  })
  assert.equal(merged.productVerdict, scan.productVerdict)
  assert.match(merged.productAnalysis?.whoShouldAvoid ?? '', /you should avoid/i)
  assert.equal(merged.productAnalysis?.viralHook?.includes('Stacked sugar'), true)
})
