import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult } from './personalizationEngine'
import { buildProfileMatches } from './buildProfileMatches'
import { extractEnglishIngredientHaystackForSafety } from './ingredientTextParsing'
import type { ScanResult } from '../types'

/**
 * OFF products whose English ingredient field is German and does not contain
 * the word "pork". The safety haystack is that text.
 */
const OFF_LABELS = {
  // 20487584 Minced pork
  minced: 'Schweinefleisch 100%',
  // 4061458013116 Prosciutto Italiano piccolino
  prosciutto: 'Schweinefleisch, Meersalz',
  // 4012941867044 Sahneleberwurst
  leberwurst: 'Schweinefleisch 35%.',
  // 2173184007320 Schweine-Schinken-Braten
  schinkenBraten: 'Schweine-Schinken-Braten aus der Nuss',
  // 4311501667576 Edeka Blattgelatine — halal does not match the substring "gelatine"
  blattgelatine: 'Schweinegelatine',
  // 21368028 Speckies
  speckies:
    'Glukose-fruktose-Sirup,Zucker, Wasser, Traubenzucker, Maisstärke, Gelatine (vom Schwein), natürliches Aroma, Farbstoffe (Kurkumin, Echtes Karmin).',
} as const

const HARD_DIETS = ['vegan', 'vegetarian', 'plant_based', 'halal', 'kosher'] as const

function haystack(ingredients: string): string {
  return extractEnglishIngredientHaystackForSafety({
    ingredients_text: ingredients,
    ingredients_text_en: ingredients,
  })
}

function scan(ingredientText: string): ScanResult {
  return {
    product: {
      id: 'p',
      barcode: '20487584',
      name: 'Test',
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

function statusFor(preferences: string[], ingredientText: string) {
  return personalizeScanResult(scan(ingredientText), {
    allergies: [],
    sensitivities: [],
    preferences,
    goal: '',
  }).safetyStatus
}

test('hard diet profiles flag German Schwein and Schinken on real labels', () => {
  for (const [name, ingredients] of Object.entries(OFF_LABELS)) {
    const text = haystack(ingredients)
    assert.match(text, /schwein/i, name)
    assert.doesNotMatch(text, /\bpork\b/i, name)
    for (const preference of HARD_DIETS) {
      assert.equal(statusFor([preference], text), 'UNSAFE', `${preference} ${name}`)
    }
  }
  assert.equal(statusFor(['halal'], 'Schinken, Speisesalz'), 'UNSAFE')
  assert.equal(statusFor(['kosher'], 'SCHWEINEFLEISCH, Salz'), 'UNSAFE')
  assert.equal(statusFor(['vegan'], 'pork fat'), 'UNSAFE')
})

test('Schwein and Schinken boundaries keep Swiss cheese and turkey ham safe', () => {
  const safe = [
    // 7613404557273 Reibkäse
    'Schweizer Hartkäse, vollfett, mit Rohmilch hergestellt',
    'Putenschinken, Salz',
    'Wasser, Salz',
  ]
  for (const ingredientText of safe) {
    const text = haystack(ingredientText)
    for (const preference of HARD_DIETS) {
      assert.equal(statusFor([preference], text), 'SAFE', `${preference} ${ingredientText}`)
    }
  }
  // Trailing boundary: Schinkenhäger is a juniper spirit, not ham. Vegan and kosher
  // have no alcohol term here, so they stay SAFE only if Schinken does not match.
  const spirit = haystack('Schinkenhäger')
  assert.equal(statusFor(['vegan'], spirit), 'SAFE')
  assert.equal(statusFor(['kosher'], spirit), 'SAFE')
})

test('German pork fit score flags every hard diet and ignores Schweizer', () => {
  for (const preference of HARD_DIETS) {
    const pork = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['Schweinefleisch', 'Meersalz']
    )
    assert.equal(pork.goalConflicts.length > 0, true, preference)
    assert.ok(pork.preferencePenalty >= 20, preference)

    const ham = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['Schinken', 'Speisesalz']
    )
    assert.equal(ham.goalConflicts.length > 0, true, preference)

    const swiss = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['Schweizer Hartkäse', 'vollfett', 'mit Rohmilch hergestellt']
    )
    assert.deepEqual(swiss.goalConflicts, [], preference)
    assert.equal(swiss.preferencePenalty, 0, preference)
  }
})
