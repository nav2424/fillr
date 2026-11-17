import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult } from './personalizationEngine'
import type { ScanResult } from '../types'

/**
 * OFF 3154230600121 HERTA TARTE EN OR Pâte Brisée.
 * ingredients_text_en is empty, so the safety haystack is this French list.
 */
const HERTA_PATE_BRISEE =
  'Farine de BLÉ, Eau, Huiles végétales (palme, colza), Alcool, Sel, Jus de citron concentré. Peut contenir : LAIT, SOJA, MOUTARDE.'

function scan(ingredientText: string): ScanResult {
  return {
    product: {
      id: 'p',
      barcode: '3154230600121',
      name: 'HERTA TARTE EN OR Pâte Brisée',
      brand: 'Herta',
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

function statusFor(preferences: string[], ingredientText: string) {
  return personalizeScanResult(scan(ingredientText), {
    allergies: [],
    sensitivities: [],
    preferences,
    goal: '',
  }).safetyStatus
}

test('halal profile flags French beverage alcool on a real pastry label', () => {
  assert.equal(statusFor(['halal'], HERTA_PATE_BRISEE), 'UNSAFE')
  assert.equal(
    statusFor(['halal'], "arôme naturel de vanille (contient alcool*)"),
    'UNSAFE'
  )
  assert.equal(statusFor(['halal'], 'alcool éthylique, eau'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'vinaigre d\'alcool, Alcool'), 'UNSAFE')
})

test('halal profile keeps spirit vinegar, alcohol-free claims, and fatty alcohols safe', () => {
  const safe = [
    "vinaigre d'alcool, eau, sel",
    'vinaigre d’alcool',
    "Vinaigre d'Alcool, moutarde",
    'vinaigre d alcool',
    'mojito sans alcool',
    'boisson sans-alcool',
    "sans l'alcool",
    'Eau, malt d\'orge, arôme naturel, extrait de houblon.',
    'alcool benzylique',
    'benzyl alcool',
    'alcool cétylique',
    'alcool stéarylique',
    'alcool cétéarylique',
    'alcool isopropylique',
    'alcool polyvinylique',
    'alcool de sucre',
  ]
  for (const ingredientText of safe) {
    assert.equal(statusFor(['halal'], ingredientText), 'SAFE', ingredientText)
  }
})

test('French alcool does not change kosher or vegan verdicts', () => {
  assert.equal(statusFor(['kosher'], HERTA_PATE_BRISEE), 'SAFE')
  assert.equal(statusFor(['vegan'], HERTA_PATE_BRISEE), 'SAFE')
  assert.equal(statusFor(['vegetarian'], HERTA_PATE_BRISEE), 'SAFE')
  assert.equal(statusFor(['plant_based'], HERTA_PATE_BRISEE), 'SAFE')
})
