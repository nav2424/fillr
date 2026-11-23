import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult } from './personalizationEngine'
import { buildProfileMatches } from './buildProfileMatches'
import { extractEnglishIngredientHaystackForSafety } from './ingredientTextParsing'
import type { ScanResult } from '../types'

/**
 * OFF products whose English ingredient field is empty, so the safety haystack
 * is the German list. None of these labels contain the English word "wine".
 */
const OFF_LABELS = {
  // 4061462918728 Sauerkraut — white wine is an ingredient
  sauerkraut: 'Weiẞkohl, Weißwein (2 %), Speisesalz.',
  // 42440840 Sommersby Zero — alcohol-free apple dessert wine must stay safe
  alcoholFreeCider:
    'Wasser, alkoholfreier Apfeldessertwein (10%), Kohlensäure, Säuerungsmittel Citronensäure und Apfelsäure; natürliches Aroma, Säureregulator Trinatriumcitrat, Süßungsmittel Acesulfam K und Aspartam; Farbstoff Zuckerkulör. Enthält eine Phenylalaninquelle.',
  // 40737768 white wine vinegar
  vinegarEszett: 'Weißweinessig, Antiodixationsmittel: Kaliummetabisulfit',
  // 40122403 white wine vinegar, ss spelling
  vinegarSs: 'Weissweinessig, Antioxidationsmittel: Kaliummetabisulfit',
  // 4002859125800 dealcoholized wine — "Wein" is not the word Weißwein
  dealcoholized:
    'Entalkoholisierter Wein (Trauben, Konservierungsstoff: _Schwefeldioxid_, L-Ascorbinsäure, Stabilisator: enthält Citronensäure und/oder Gummi Arabicum, Säureregulator: enthält Weinsäure und/oder Äpfelsäure), konzentrierter Traubenmost, Kohlensäure, Konservierungsstoff: _Schwefeldioxid_, Dimethyldicarbonat.',
} as const

const OTHER_HARD_DIETS = ['vegan', 'vegetarian', 'plant_based', 'kosher'] as const

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
      barcode: '4061462918728',
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

test('halal flags German wine on a real sauerkraut label', () => {
  const text = haystack(OFF_LABELS.sauerkraut)
  assert.match(text, /wei(?:\u00df|\u1e9e)wein/i)
  assert.doesNotMatch(text, /\bwine\b/i)
  assert.equal(statusFor(['halal'], text), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'Weisswein, Salz'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'Weiẞwein, Salz'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'Rotwein, Salz'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'WEISSWEIN'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'white wine'), 'UNSAFE')
})

test('wine vinegar, alcohol-free dessert wine, and other diets stay safe', () => {
  const safeForHalal = [
    OFF_LABELS.alcoholFreeCider,
    OFF_LABELS.vinegarEszett,
    OFF_LABELS.vinegarSs,
    OFF_LABELS.dealcoholized,
    'Rotweinessig, Salz',
    'Wasser, Salz',
  ]
  for (const ingredientText of safeForHalal) {
    const text = haystack(ingredientText)
    assert.equal(statusFor(['halal'], text), 'SAFE', ingredientText)
  }

  const sauerkraut = haystack(OFF_LABELS.sauerkraut)
  for (const preference of OTHER_HARD_DIETS) {
    assert.equal(statusFor([preference], sauerkraut), 'SAFE', preference)
  }
})

test('halal fit score flags Weißwein and ignores vinegar and dessert wine', () => {
  const profile = {
    allergies: [],
    sensitivities: [],
    avoiding: [],
    preferences: ['halal'],
    goal: '',
  }
  const wine = buildProfileMatches(profile, ['Weißwein (2 %)', 'Speisesalz'])
  assert.equal(wine.goalConflicts.includes('Halal'), true)
  assert.ok(wine.preferencePenalty >= 22)

  const vinegar = buildProfileMatches(profile, ['Weißweinessig', 'Salz'])
  assert.deepEqual(vinegar.goalConflicts, [])
  assert.equal(vinegar.preferencePenalty, 0)

  const cider = buildProfileMatches(profile, ['alkoholfreier Apfeldessertwein'])
  assert.deepEqual(cider.goalConflicts, [])
  assert.equal(cider.preferencePenalty, 0)

  const kosher = buildProfileMatches(
    { ...profile, preferences: ['kosher'] },
    ['Weißwein (2 %)', 'Speisesalz']
  )
  assert.deepEqual(kosher.goalConflicts, [])
  assert.equal(kosher.preferencePenalty, 0)
})
