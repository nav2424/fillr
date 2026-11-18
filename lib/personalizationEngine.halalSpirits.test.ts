import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult } from './personalizationEngine'
import type { ScanResult } from '../types'

function scan(ingredientText: string): ScanResult {
  return {
    product: {
      id: 'prod_test',
      barcode: '0000000000000',
      name: 'Test product',
      brand: '',
      ingredientText,
      source: 'openfoodfacts',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [],
    insights: [],
  }
}

function status(preferences: string[], ingredientText: string) {
  return personalizeScanResult(scan(ingredientText), {
    allergies: [],
    sensitivities: [],
    preferences,
    goal: '',
  }).safetyStatus
}

test('halal scans are UNSAFE when the only spirit word is whisky, rhum, or cognac', () => {
  // OFF 5010204847450 — ingredients are only "blended scotch whisky".
  assert.equal(status(['halal'], 'blended scotch whisky'), 'UNSAFE')
  // OFF 3012993056848 — Sir Edward's. No whiskey/alcohol/ethanol token.
  assert.equal(
    status(['halal'], 'Blended Scotch Whisky. Water, colour:Caramel E150A'),
    'UNSAFE'
  )
  // OFF 3011932026836 — William Lawson's. English field is the one word WHISKY.
  assert.equal(status(['halal'], 'WHISKY'), 'UNSAFE')
  // OFF 0085246139431 — bourbon labeled with the UK spelling.
  assert.equal(status(['halal'], 'kentucky straight bourbon whisky handmade'), 'UNSAFE')
  // OFF 3290370031538 — French rum with no English "rum" or "alcool".
  assert.equal(status(['halal'], 'Rhum agricole'), 'UNSAFE')
  // OFF 7610135121933 — cognac marmalade. Cognac is not the word brandy.
  assert.equal(status(['halal'], 'Cognac, kinds of sugar, coloring E 150a'), 'UNSAFE')
})

test('halal still flags whiskey and rum, and does not flag rhume or crumble', () => {
  assert.equal(status(['halal'], 'Whiskey'), 'UNSAFE')
  assert.equal(status(['halal'], 'dark rum, sugar'), 'UNSAFE')
  assert.equal(status(['halal'], 'sirop pour le rhume'), 'SAFE')
  assert.equal(status(['halal'], 'wheat flour, butter, sugar, crumble topping'), 'SAFE')
})

test('vegan and kosher stay SAFE on whisky, rhum, and cognac labels', () => {
  for (const preference of ['vegan', 'kosher']) {
    assert.equal(status([preference], 'blended scotch whisky'), 'SAFE')
    assert.equal(status([preference], 'Rhum agricole'), 'SAFE')
    assert.equal(status([preference], 'Cognac, kinds of sugar, coloring E 150a'), 'SAFE')
  }
})
