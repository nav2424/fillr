import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult } from './personalizationEngine'
import { buildProfileMatches } from './buildProfileMatches'
import { extractEnglishIngredientHaystackForSafety } from './ingredientTextParsing'
import type { ScanResult } from '../types'

/**
 * OFF products whose English ingredient field is empty or is still the French
 * list, so the safety haystack has no milk/egg/butter/cream/cheese word.
 * Allergen tags are not consulted by the diet verdict.
 */
const OFF_LABELS = {
  // 20057237 Œufs — ingredients_text_en empty
  eggs: 'Œufs de poules élevées en plein air',
  // 3270190021179 Oeufs frais BIO
  eggsStar: "Oeufs* frais.*Ingredient issu de l'agriculture biologique.",
  // 3700864007128
  egg: 'Oeuf',
  // 20593346 — OFF wraps the allergen in underscores
  eggsUnderscore: '_oeufs_',
  // 6111242105331 Beurre Frais Pasteurisé — "laitière" is not the word lait
  butter: 'Beurre pasteurisé à 82% de matière grasse laitière',
  // 3228020215106
  butterMilk: 'Beurre (lait) (origine crème : France), sel (3% max).',
  // 3451790011245
  lightButter:
    'Eau, beurre concentré, babeurre, fécule, arômes naturels (lait), protéines de lait, fibre végétale, sel (0,3%), concentré de paprika.',
  // 3254550020262 Beurre d'Isigny
  isigny: 'Crème de _lait_ pasteurisée, ferments _lactiques_',
  // 3770032538044 — ingredients_text_en is this French list; no milk/cream/butter word
  cremeFraiche:
    'Légumes 51,9% (poireau (18,5%), pomme de terre (16,7%), carotte (7,4%), oigon rosé (7,4%), navet (1,9%)) eau, crème fraîche, sel, poivre.',
  // 3229820794525 — cocoa butter must not hide the egg
  eggYolk:
    "pépites de chocolat noir (sucre de canne, pâte de cacao, beurre de cacao), jaune d'œuf en poudre, sel marin",
} as const

const PLANT_DIETS = ['vegan', 'vegetarian', 'plant_based'] as const
const VEGAN_DIETS = ['vegan', 'plant_based'] as const
const NOT_VEGAN_CONFLICTS = ['vegetarian', 'halal', 'kosher'] as const

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
      barcode: '20057237',
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

test('vegan and plant-based flag French eggs, milk, butter, and cream', () => {
  for (const [name, ingredients] of Object.entries(OFF_LABELS)) {
    const text = haystack(ingredients)
    assert.ok(text.length > 0, name)
    assert.doesNotMatch(text, /\b(milk|eggs?|butter|cream|cheese)\b/i, name)
    for (const preference of VEGAN_DIETS) {
      assert.equal(statusFor([preference], text), 'UNSAFE', `${preference} ${name}`)
    }
  }
  assert.equal(statusFor(['vegan'], 'CRÈME FRAÎCHE, sel'), 'UNSAFE')
  assert.equal(statusFor(['plant_based'], 'creme fraiche, sel'), 'UNSAFE')
})

test('vegetarian, halal, and kosher stay safe on French eggs and dairy', () => {
  for (const ingredients of Object.values(OFF_LABELS)) {
    const text = haystack(ingredients)
    for (const preference of NOT_VEGAN_CONFLICTS) {
      assert.equal(statusFor([preference], text), 'SAFE', `${preference} ${ingredients}`)
    }
  }
})

test('plant milks, plant butters, and sans-claims stay safe', () => {
  const safe = [
    // 3608580942764 Gourmand & Végétal mousse
    "Lait de coco allégé 31,8% (eau, extrait de noix de coco), eau, chocolat 18% (sucre, pâte de cacao, beurre de cacao, cacao maigre en poudre, émulsifiant : lécithine, arôme naturel de vanille), sucre, eau de coco, amidon, protéines de pomme de terre, sel",
    'lait de coco, eau, extrait de noix de coco',
    "lait d'amande, eau, sel",
    'lait d’avoine, eau',
    'poudre de lait de coco, sucre, sel',
    'sucre, pâte de cacao, beurre de cacao, vanille',
    'beurre de cacahuète, sucre, sel',
    "beurre d'amande, sucre",
    'beurre de karité',
    'beurre de noix de coco, sucre',
    'crème de coco, eau, sel',
    'crème de noix de coco, sucre',
    'laitue, eau, sel',
    'chocolat, sans lait, sans œufs',
    'Sans oeufs, sucre, cacao',
    'eau, sel',
  ]
  for (const ingredientText of safe) {
    const text = haystack(ingredientText)
    for (const preference of PLANT_DIETS) {
      assert.equal(statusFor([preference], text), 'SAFE', `${preference} ${ingredientText}`)
    }
  }
})

test('plant phrasing beside real dairy still conflicts', () => {
  const unsafe = [
    'lait de coco, lait entier, sucre',
    'beurre de cacao, beurre, sucre',
    'crème de coco, crème, sucre',
    'chocolat (beurre de cacao, lait), sucre',
    'sans lait, protéines de lait',
  ]
  for (const ingredientText of unsafe) {
    const text = haystack(ingredientText)
    for (const preference of VEGAN_DIETS) {
      assert.equal(statusFor([preference], text), 'UNSAFE', `${preference} ${ingredientText}`)
    }
  }
})

test('English milk, egg, butter, and cheese conflicts still fire', () => {
  for (const ingredientText of ['milk powder', 'egg white', 'butter, sugar', 'cheddar cheese']) {
    assert.equal(statusFor(['vegan'], ingredientText), 'UNSAFE', ingredientText)
  }
  assert.equal(statusFor(['vegetarian'], 'milk powder'), 'SAFE')
  assert.equal(statusFor(['vegetarian'], 'egg white'), 'SAFE')
})

test('fit score flags French dairy and ignores coconut milk', () => {
  for (const preference of VEGAN_DIETS) {
    const eggs = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['Œufs de poules élevées en plein air']
    )
    assert.equal(eggs.goalConflicts.length > 0, true, preference)
    assert.ok(eggs.preferencePenalty >= 20, preference)

    const coconut = buildProfileMatches(
      { allergies: [], sensitivities: [], avoiding: [], preferences: [preference], goal: '' },
      ['Lait de coco', 'beurre de cacao', 'sucre']
    )
    assert.deepEqual(coconut.goalConflicts, [], preference)
    assert.equal(coconut.preferencePenalty, 0, preference)
  }

  const vegetarianEggs = buildProfileMatches(
    { allergies: [], sensitivities: [], avoiding: [], preferences: ['vegetarian'], goal: '' },
    ['Œufs', 'beurre', 'crème fraîche']
  )
  assert.deepEqual(vegetarianEggs.goalConflicts, [])
  assert.equal(vegetarianEggs.preferencePenalty, 0)
})
