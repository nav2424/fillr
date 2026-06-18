import test from 'node:test'
import assert from 'node:assert/strict'

import { canReuseBarcodeHistoryResult } from './scanHistoryReuse'
import type { ScanResult } from '../types'

function reusableResult(overrides: Partial<ScanResult> = {}): ScanResult {
  const base: ScanResult = {
    product: {
      id: 'prod_123',
      barcode: '123',
      name: 'Test product',
      brand: 'Test brand',
      ingredientText: 'sugar, cocoa butter',
      source: 'openfoodfacts',
      createdAt: '2026-06-14T00:00:00.000Z',
      updatedAt: '2026-06-14T00:00:00.000Z',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: 'No profile conflicts found.',
    ingredientBreakdown: [
      {
        name: 'Sugar',
        whatItIs: 'Sucrose crystals from cane or beet plants used as a familiar sweetener.',
        whyItsUsed: 'Adds sweetness, browning, and structure in this packaged product.',
        whatToKnow: 'Portion size and total sugars matter more than this single line.',
        labelDecoder: 'Sugar is the common label name for sucrose.',
        quickSummary: 'A straightforward sweetener used for taste and texture.',
      },
    ],
    insights: [],
  }
  return { ...base, ...overrides }
}

test('barcode history result can be reused for a low-risk profile with complete decode', () => {
  assert.equal(canReuseBarcodeHistoryResult(reusableResult(), { allergies: [] }), true)
})

test('barcode history reuse is disabled when current profile has allergies', () => {
  const priorSafeResult = reusableResult({
    product: {
      ...reusableResult().product,
      ingredientText: 'milk, cream, carrageenan',
    },
  })

  assert.equal(
    canReuseBarcodeHistoryResult(priorSafeResult, { allergies: ['milk'] }),
    false
  )
})

test('barcode history reuse is disabled when current profile has celiac mode enabled', () => {
  assert.equal(
    canReuseBarcodeHistoryResult(reusableResult(), { allergies: [], celiacStrictGluten: true }),
    false
  )
})

test('barcode history reuse is disabled for stored allergy or celiac-specific results', () => {
  assert.equal(
    canReuseBarcodeHistoryResult(
      reusableResult({
        matchedAllergens: [
          {
            allergenKey: 'milk',
            allergenName: 'Milk',
            matchedIngredient: 'milk',
            explanation: 'Contains milk.',
            severity: 'CONTAINS',
          },
        ],
      }),
      { allergies: [] }
    ),
    false
  )

  assert.equal(
    canReuseBarcodeHistoryResult(
      reusableResult({
        celiac: {
          celiacModeEnabled: true,
          celiacSeverity: 'AVOID',
          matchedGlutenSignals: [
            {
              ingredient: 'wheat flour',
              signalType: 'wheat',
              severity: 'AVOID',
              reason: 'Wheat flour contains gluten.',
            },
          ],
        },
      }),
      { allergies: [] }
    ),
    false
  )
})
