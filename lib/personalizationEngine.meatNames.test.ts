import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult } from './personalizationEngine'
import { buildProfileMatches } from './buildProfileMatches'
import { extractEnglishIngredientHaystackForSafety } from './ingredientTextParsing'
import type { ScanResult } from '../types'

/**
 * OFF products whose English ingredient field is empty, so the safety haystack
 * is the local list. None of these lists contain chicken, beef, pork, lamb, or meat.
 */
const OFF_LABELS = {
  // 4056489360711 Pavés de poulet
  poulet: 'Poulet',
  // 2128625008329 Sauté de veau pour blanquette
  veau: 'Veau',
  // 2819627015940 Tranche Gigot d'agneau
  agneau: 'AGNEAU ORIGINE FRANCE',
  // 5420015107245 Confit de canard 4/5 cuisses
  canard: 'Cuisse de canard gras, graisse de canard, sel',
  // 3760260080132 Foie gras d'oie entier mi-cuit
  oie: "Foie gras d'oie, sel, poivre.",
  // 2439831049984 Le lapin Loeul & Piriot en cocotte
  lapin: 'Lapin',
  // 4040328033461 BAKTAT Truthahnsalami Weiß
  dinde: "Viande de dinde, graisse de bœuf, farine de mais, épices, sel",
  // 4062300163874 Lasagnes à la Bolognaise — beef is "bœuf", not "beef"
  boeuf: 'Tomates, lasagnes, riz, carottes, bœuf, oignons, huile de tournesol, sel',
  // 4104420138544 Alnatura Karotten mit Kartoffeln und Rind
  rindfleisch: 'Karotten 45 %, Kartoffeln 28 %, Wasser, Rindfleisch 8 %, Rapsöl',
} as const

const PLANT_DIETS = ['vegan', 'vegetarian', 'plant_based'] as const
const RELIGIOUS_DIETS = ['halal', 'kosher'] as const

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
      barcode: '4056489360711',
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

test('vegan, vegetarian, and plant-based flag French and German meat labels', () => {
  for (const [name, ingredients] of Object.entries(OFF_LABELS)) {
    const text = haystack(ingredients)
    assert.ok(text.length > 0, name)
    assert.doesNotMatch(text, /\b(chicken|beef|pork|lamb|turkey|\bmeat\b)\b/i, name)
    for (const preference of PLANT_DIETS) {
      assert.equal(statusFor([preference], text), 'UNSAFE', `${preference} ${name}`)
    }
  }
  assert.equal(statusFor(['vegan'], 'boeuf, sel'), 'UNSAFE')
  assert.equal(statusFor(['vegetarian'], 'veal, salt'), 'UNSAFE')
  assert.equal(statusFor(['plant_based'], 'duck fat, salt'), 'UNSAFE')
  assert.equal(statusFor(['vegan'], 'goose fat, salt'), 'UNSAFE')
  assert.equal(statusFor(['vegetarian'], 'rabbit, salt'), 'UNSAFE')
  assert.equal(statusFor(['vegan'], 'dindon, sel'), 'UNSAFE')
  assert.equal(statusFor(['plant_based'], 'foie gras, sel'), 'UNSAFE')
})

test('halal and kosher stay safe on poultry and beef labels', () => {
  for (const ingredients of [OFF_LABELS.poulet, OFF_LABELS.boeuf, OFF_LABELS.canard, OFF_LABELS.rindfleisch]) {
    const text = haystack(ingredients)
    for (const preference of RELIGIOUS_DIETS) {
      assert.equal(statusFor([preference], text), 'SAFE', `${preference} ${ingredients}`)
    }
  }
})

test('flavor names, citrus rind, and plant lookalikes stay safe', () => {
  const safe = [
    'arome poulet, proteines vegetales, sel',
    'nouilles saveur poulet, farine, sel',
    'sauce poulette, water, salt',
    'duck sauce, sugar, vinegar',
    'gooseberry jam, sugar',
    'orange rind, sugar',
    'Welsh rabbit, salt',
    'Haricots nouveaux, sel',
    'porcini mushrooms, water, salt',
    'eau, sel',
  ]
  for (const ingredientText of safe) {
    const text = haystack(ingredientText)
    for (const preference of PLANT_DIETS) {
      assert.equal(statusFor([preference], text), 'SAFE', `${preference} ${ingredientText}`)
    }
  }
  assert.equal(statusFor(['vegetarian'], 'œufs de poules, sel'), 'SAFE')
})

test('fit score flags the meat gap and ignores gooseberry', () => {
  for (const preference of PLANT_DIETS) {
    const chicken = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['Poulet']
    )
    assert.equal(chicken.goalConflicts.length > 0, true, preference)
    assert.ok(chicken.preferencePenalty >= 20, preference)

    const berries = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['gooseberry jam', 'sugar']
    )
    assert.deepEqual(berries.goalConflicts, [], preference)
    assert.equal(berries.preferencePenalty, 0, preference)
  }

  for (const preference of RELIGIOUS_DIETS) {
    const chicken = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['Poulet']
    )
    assert.deepEqual(chicken.goalConflicts, [], preference)
    assert.equal(chicken.preferencePenalty, 0, preference)
  }
})
