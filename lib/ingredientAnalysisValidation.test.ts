import test from 'node:test'
import assert from 'node:assert/strict'
import { validateIngredientAnalysisOutput } from './ingredientAnalysisValidation'
import type { ProductIngredientAnalysisResponse } from '../services/openaiIngredientAnalysisPrompt'

function row(name: string, rating: 'clean' | 'okay' | 'concerning' | 'avoid') {
  return {
    name,
    ingredient_name: name,
    short_label: 'Short',
    why_it_matters: ['a', 'b'],
    system_judgment: 'Judgment.',
    impact_for_you: 'Impact.',
    flag_driver: 'processing',
    profile_anchor: 'x',
    actionability: 'okay',
    confidence: 'high',
    headline: 'Headline sentence long enough.',
    labelDecoder: 'Label decoder sentence long enough.',
    whatItIs: 'What it is sentence long enough.',
    whatItDoes: 'What it does sentence long enough.',
    bodyEffect: 'Body effect sentence long enough.',
    funFact: 'Fun fact sentence long enough.',
    whyItMattersYou: 'Why it matters sentence long enough.',
    rating,
    ratingReason: 'Rating reason sentence long enough.',
    contextStat: '',
  } as any
}

test('flags missing ingredient row', () => {
  const parsed = {
    productVerdict: 'Needs care.',
    productAnalysis: { viralHook: 'v', bottomLine: 'b', ingredientOrderInsight: 'i', sugarSources: [] },
    ingredients: [row('Water', 'clean')],
  } as ProductIngredientAnalysisResponse
  const out = validateIngredientAnalysisOutput(['Water', 'Salt'], parsed)
  assert.equal(out.hasMissingOrDuplicateRows, true)
  assert.equal(out.isValid, false)
})

test('flags wrong fixed rating (yellow 5 should not be clean)', () => {
  const parsed = {
    productVerdict: 'Looks clean.',
    productAnalysis: { viralHook: 'v', bottomLine: 'b', ingredientOrderInsight: 'i', sugarSources: [] },
    ingredients: [row('Yellow 5', 'clean')],
  } as ProductIngredientAnalysisResponse
  const out = validateIngredientAnalysisOutput(['Yellow 5'], parsed)
  assert.equal(out.hasFixedRatingMismatch, true)
  assert.equal(out.isValid, false)
})

test('flags positive verdict with concerning ingredient', () => {
  const parsed = {
    productVerdict: 'This is clean and wholesome.',
    productAnalysis: { viralHook: 'v', bottomLine: 'b', ingredientOrderInsight: 'i', sugarSources: [] },
    ingredients: [row('Carrageenan', 'concerning')],
  } as ProductIngredientAnalysisResponse
  const out = validateIngredientAnalysisOutput(['Carrageenan'], parsed)
  assert.equal(out.hasPositiveVerdictConflict, true)
})

test('flags duplicate row via count mismatch', () => {
  const parsed = {
    productVerdict: 'Needs care.',
    productAnalysis: { viralHook: 'v', bottomLine: 'b', ingredientOrderInsight: 'i', sugarSources: [] },
    ingredients: [row('Water', 'clean'), row('Water', 'clean')],
  } as ProductIngredientAnalysisResponse
  const out = validateIngredientAnalysisOutput(['Water'], parsed)
  assert.equal(out.hasMissingOrDuplicateRows, true)
})

