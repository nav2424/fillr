import test from 'node:test'
import assert from 'node:assert/strict'

import { personalizeScanResult } from './personalizationEngine'
import { PREFERENCE_SIGNALS } from './profileSignals'
import { extractEnglishIngredientHaystackForSafety } from './ingredientTextParsing'
import type { ScanResult } from '../types'

/**
 * Halal hard verdicts matched English brandy/rum/liqueur but not the spirit
 * names on these Open Food Facts foods (empty or non-English alcohol words):
 * - 8712100456695 Cremissimo: Schwarzwälder Kirschwasser 0,7%
 * - 40896670 Bon Gelati: 5,6% Eierlikör
 * - 4000161660408 filled chocolate: Kirschwasser, Williams Birnenbrand, Grappa
 */

const CREMISSIMO =
  'Entrahmte Milch, Wasser, Glukose-Fruktose-Sirup, Zucker, Glukosesirup, Sauerkirschen 6%, Kokosfett, Sauerkirschensaft aus Sauerkirschsaftkonzentrat 3,5%, Molkenerzeugnis, fettarmer Kakao, Invertzucker, Kakaomasse, DE SAHNE/ AT OBERS 1%,Schwarzwälder Kirschwasser 0,7%, Stabilisatoren (Carrageen, Johannisbrotkernmehl, Pektin), Emulgatoren (Mono-und Diglyceride von Speisefettsäuren, Ammoniumphosphatide).'

const BON_GELATI =
  'Entrahmte Milch, Glukose-Fruktose-Sirup, Zucker, Molkenerzeugnis, Kokosfett, Wasser, 5,6% Eierlikör*, Glukosesirup, 1% Schlagsahne, Kakaomasse, natürliches Bourbon Vanille-Aroma, natürliche Aromen.'

const CHOCOLATE =
  'Zartbitter-Schokolade 36% (Kakaomasse, Zucker, Kakaobutter, Vollmilchpulver), Invertzuckersirup, Zucker, Schwarzwälder Kirschwasser, Williams Birnenbrand, Grappa, Glukosesirup, natürliches Aroma, Invertase, natürliches Kirschwasseraroma.'

function halalStatus(ingredientText: string, preferences: string[]): string {
  const base = {
    product: {
      id: 't',
      barcode: 'x',
      name: 'Test',
      brand: '',
      ingredientText,
      ingredientTextSafetyHaystack: ingredientText,
      source: 'off',
      createdAt: '',
      updatedAt: '',
    },
    safetyStatus: 'UNKNOWN',
    matchedAllergens: [],
    matchedSensitivities: [],
    smartSummary: '',
    ingredientBreakdown: [],
    insights: [],
  } as ScanResult
  return personalizeScanResult(base, {
    allergies: [],
    sensitivities: [],
    preferences,
    goal: '',
  }).safetyStatus
}

test('halal scans flag Kirschwasser, Birnenbrand, Grappa, and Eierlikör', () => {
  assert.equal(halalStatus(CREMISSIMO, ['halal']), 'UNSAFE')
  assert.equal(halalStatus(BON_GELATI, ['halal']), 'UNSAFE')
  assert.equal(halalStatus(CHOCOLATE, ['halal']), 'UNSAFE')
  assert.equal(halalStatus('Zucker, Williams Birnenbrand', ['halal']), 'UNSAFE')
  assert.equal(halalStatus('Wasser, Grappa (18%), Zucker', ['halal']), 'UNSAFE')
  assert.equal(halalStatus('Wasser, Zucker, EIERLIKOER', ['halal']), 'UNSAFE')
})

test('cherry fruit, cherry flavor, and bourbon vanilla stay safe for halal', () => {
  for (const text of [
    'Sauerkirschen 6%, Zucker, Wasser',
    'Schwarzwälder Kirsch, Sahne, Zucker',
    'natürliches Kirschwasseraroma, Zucker',
    'natürliches Bourbon Vanille-Aroma',
    'Aroma, Eierlikör-Geschmack, Zucker',
    'natürliches Eierliköraroma',
  ]) {
    assert.equal(halalStatus(text, ['halal']), 'SAFE', text)
  }
})

test('these spirit names are not vegan or kosher conflicts', () => {
  for (const text of [
    'Zucker, Schwarzwälder Kirschwasser, Wasser',
    'Zucker, Williams Birnenbrand',
    'Wasser, Grappa, Zucker',
    'Wasser, Zucker, Eierlikör',
  ]) {
    assert.equal(halalStatus(text, ['vegan']), 'SAFE', text)
    assert.equal(halalStatus(text, ['kosher']), 'SAFE', text)
    assert.equal(halalStatus(text, ['vegetarian']), 'SAFE', text)
    assert.equal(halalStatus(text, ['plant_based']), 'SAFE', text)
  }
})

test('existing halal tokens still match', () => {
  const pattern = PREFERENCE_SIGNALS.halal.conflictPattern!
  assert.equal(pattern.test('pork fat'), true)
  assert.equal(pattern.test('red wine'), true)
  assert.equal(pattern.test('dark rum'), true)
  assert.equal(pattern.test('ethanol'), true)
})

test('OFF haystack keeps Kirschwasser when English text is the German list', () => {
  const haystack = extractEnglishIngredientHaystackForSafety({
    ingredients_text_en:
      'Eis mit Schwarzwälder Kirschwasser und Sahne. Zutaten: Wasser, Zucker, Schwarzwälder Kirschwasser 0,7%',
    ingredients_text: CREMISSIMO,
  })
  assert.match(haystack, /Kirschwasser/)
  assert.equal(halalStatus(haystack, ['halal']), 'UNSAFE')
})
