import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult } from './personalizationEngine'
import { buildProfileMatches } from './buildProfileMatches'
import { extractEnglishIngredientHaystackForSafety } from './ingredientTextParsing'
import type { ScanResult } from '../types'

/**
 * OFF products whose English ingredient field is empty, so the safety haystack
 * is the French list. Neither label contains the English word "pork".
 */
const OFF_LABELS = {
  // 3154230809869 Herta Jambon à l'étouffée
  etouffee:
    "Jambon frais de porc, Sel, Arômes naturels (présence naturelle de polyphénols), Bouillon (eau, gras et couenne de porc, os de porc, sel, extraits de carotte et d'oignon, épices et plantes aromatiques), Sucre, Chlorure de potassium, Antioxydant: Acide ascorbique, Vinaigre en poudre.",
  // 3154230810131 Herta Le Bon Paris
  leBonParis:
    "Jambon frais de porc, Sel, Arômes naturels (présence naturelle de polyphénols), Bouillon (eau, os de porc, sel, extraits de carotte et d'oignon, gras et couenne de porc, ail, poivre, persil, laurier, clou de girofle), Chlorure de potassium, Sucre, Antioxydant : acide ascorbique, Vinaigre en poudre.",
} as const

const HARD_DIETS = ['vegan', 'vegetarian', 'plant_based', 'halal', 'kosher'] as const

function haystack(ingredients: string): string {
  return extractEnglishIngredientHaystackForSafety({
    ingredients_text: ingredients,
    ingredients_text_en: '',
  })
}

function scan(ingredientText: string): ScanResult {
  return {
    product: {
      id: 'p',
      barcode: '3154230810131',
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

test('hard diet profiles flag French porc on real labels', () => {
  for (const [name, ingredients] of Object.entries(OFF_LABELS)) {
    const text = haystack(ingredients)
    assert.match(text, /\bporc\b/i, name)
    assert.doesNotMatch(text, /\bpork\b/i, name)
    for (const preference of HARD_DIETS) {
      assert.equal(statusFor([preference], text), 'UNSAFE', `${preference} ${name}`)
    }
  }
  assert.equal(statusFor(['halal'], 'épaule de porc, sel'), 'UNSAFE')
  assert.equal(statusFor(['kosher'], 'PORCS, sel'), 'UNSAFE')
  assert.equal(statusFor(['vegan'], 'pork fat'), 'UNSAFE')
})

test('porc word boundaries keep porcini and poultry ham safe', () => {
  const safe = [
    'Porcini mushrooms, water, salt',
    'porcini, olive oil, garlic',
    'Jambon de dinde, eau, sel',
    'eau, sel',
  ]
  for (const ingredientText of safe) {
    const text = haystack(ingredientText)
    for (const preference of HARD_DIETS) {
      assert.equal(statusFor([preference], text), 'SAFE', `${preference} ${ingredientText}`)
    }
  }
})

test('French porc fit score flags every hard diet and ignores porcini', () => {
  for (const preference of HARD_DIETS) {
    const ham = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['Jambon frais de porc', 'Sel']
    )
    assert.equal(ham.goalConflicts.length > 0, true, preference)
    assert.ok(ham.preferencePenalty >= 20, preference)

    const mushrooms = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['Porcini mushrooms', 'water', 'salt']
    )
    assert.deepEqual(mushrooms.goalConflicts, [], preference)
    assert.equal(mushrooms.preferencePenalty, 0, preference)
  }
})
