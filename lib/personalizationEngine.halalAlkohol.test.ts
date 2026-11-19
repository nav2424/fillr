import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult } from './personalizationEngine'
import { buildProfileMatches } from './buildProfileMatches'
import { extractEnglishIngredientHaystackForSafety } from './ingredientTextParsing'
import type { ScanResult } from '../types'

/**
 * OFF products whose English ingredient field is empty, so the safety haystack
 * is the local list. None of these contain wine, beer, rum, whiskey, or ethanol.
 */
const OFF_LABELS = {
  // 4061458046046 steinofen Baguette
  baguette:
    'Weizenmehl, Wasser, Sauerteig (Weizenmehl, Wasser), Backhefe, Meersalz, Weizengluten, Alkohol, Maisessig, fermentiertes Weizenmehl, Weizenmalzmehl',
  // 4061458013178 Pizzateig. Ethanol is the one word Ethylalkohol.
  pizza:
    'Pizzateig (Weizenmehl, Trinkwasser, Backtriebmittel: Glucono-Delta-Lacton, Kaliumcarbonate; Ethylalkohol, 1,5 % Natives Olivenöl extra, Weizenkleber, Speisesalz, Weizenstärke, Hefe, Antioxidationsmittel: Ascorbinsäure), Tomatensauce (Tomatenpüree, Trinkwasser, Zwiebel, Zucker, modifizierte Stärke, Speisesalz, Sonnenblumenöl, Säuerungsmittel: Citronensäure; Kräuter).',
  // 4971435050013 Mirin Fu
  mirin:
    'Glukos sirop, vatten, socker, vinäger, alkohol, sake (ris, ris koji), livsmedelssyra (äppelsyra, vinsyra), salt.',
} as const

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
      barcode: '4061458046046',
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

test('halal profile flags German and Nordic alkohol on real labels', () => {
  for (const [name, ingredients] of Object.entries(OFF_LABELS)) {
    const text = haystack(ingredients)
    assert.match(text, /alkohol/i, name)
    assert.equal(statusFor(['halal'], text), 'UNSAFE', name)
  }
  assert.equal(statusFor(['halal'], 'Äthylalkohol, Wasser'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'etylalkohol'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'Ethyl-Alkohol'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'Aroma (enthält Alkohol)'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'Alkohol, Frischkäse'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'wine'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'pork fat'), 'UNSAFE')
  assert.equal(statusFor(['halal'], 'ethanol'), 'UNSAFE')
})

test('halal profile keeps alcohol-free claims and non-beverage alcohols safe', () => {
  const safe = [
    // 4082100006508 Natur Radler 0,0%
    'Alkoholfreies Bier (Wasser, Gerstenmalz, Hopfen, Hefe, Gärungskohlensäure), Limonade, Wasser, Zucker',
    // 42440840 Sommersby Zero
    'Wasser, alkoholfreier Apfeldessertwein (10%), Kohlensäure, Säuerungsmittel Citronensäure',
    // 4008287052527 Krombacher Pils alkoholfrei — the name is alcohol-free; the list is not ethanol
    'Wasser, Gerstenmalz, Hopfen, Hopfenextrakt, Gärungskohlensäure',
    'Schokolade ohne Alkohol',
    'Aroma ohne Ethylalkohol',
    'dryck utan alkohol',
    'uden alkohol',
    'uten alkohol',
    'bez alkohol',
    'alkohol nélkül',
    'ALKOHOL NÉLKÜL',
    'alkohol-frei Limonade',
    'alkohol frei',
    'alkohol freie',
    'alkohol fri',
    'alkohol fria',
    'alkohol fritt',
    'Benzylalkohol, Citronensäure',
    'Benzyl-Alkohol',
    'Cetylalkohol',
    'Stearyl-Alkohol',
    'Cetearyl-Alkohol',
    'Isopropylalkohol',
    'Polyvinylalkohol',
    'Phenylethylalkohol',
    'Zuckeralkohol, Erythrit',
    'Zucker-Alkohol',
    'Alkoholessig, Salz',
  ]
  for (const ingredientText of safe) {
    assert.equal(statusFor(['halal'], haystack(ingredientText)), 'SAFE', ingredientText)
  }
})

test('German and Nordic alkohol does not change kosher or vegan verdicts', () => {
  for (const ingredients of Object.values(OFF_LABELS)) {
    const text = haystack(ingredients)
    assert.equal(statusFor(['kosher'], text), 'SAFE', text)
    assert.equal(statusFor(['vegan'], text), 'SAFE', text)
    assert.equal(statusFor(['vegetarian'], text), 'SAFE', text)
    assert.equal(statusFor(['plant_based'], text), 'SAFE', text)
  }
})

test('halal fit score flags alkohol and ignores alkoholfrei and benzylalkohol', () => {
  const base = { allergies: [], sensitivities: [], avoiding: [], preferences: ['halal'], goal: '' }
  const baguette = buildProfileMatches(base, ['Weizengluten', 'Alkohol', 'Maisessig'])
  assert.ok(baguette.goalConflicts.includes('Halal'))
  assert.ok(baguette.preferencePenalty >= 22)

  const ethyl = buildProfileMatches(base, ['Ethylalkohol', 'Speisesalz'])
  assert.ok(ethyl.goalConflicts.includes('Halal'))

  const free = buildProfileMatches(base, ['Alkoholfreies Bier', 'Wasser'])
  assert.equal(free.goalConflicts.includes('Halal'), false)
  assert.equal(free.preferencePenalty, 0)

  const ohne = buildProfileMatches(base, ['Schokolade ohne Alkohol'])
  assert.equal(ohne.goalConflicts.includes('Halal'), false)

  const benzyl = buildProfileMatches(base, ['Benzylalkohol', 'Citronensäure'])
  assert.equal(benzyl.goalConflicts.includes('Halal'), false)

  const pork = buildProfileMatches(base, ['pork fat'])
  assert.ok(pork.goalConflicts.includes('Halal'))
})
