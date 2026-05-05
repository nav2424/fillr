import test from 'node:test'
import assert from 'node:assert/strict'
import type { DietaryProfile } from '../types'
import type { IngredientAnalysisItem, ProductIngredientAnalysisResponse } from '../services/openaiIngredientAnalysisPrompt'
import { enforcePersonalizedCopy } from '../services/openaiIngredientAnalysis'

const BASE_PROFILE: DietaryProfile = {
  allergies: [],
  sensitivities: [],
  avoiding: [],
  preferences: [],
  scoringPreferenceKeys: [],
}

function makeIngredient(overrides: Partial<IngredientAnalysisItem> = {}): IngredientAnalysisItem {
  return {
    name: 'Ingredient',
    headline: 'Ingredient headline.',
    labelDecoder: 'This ingredient appears on packaged food labels.',
    whatItIs: 'This is a standard ingredient entry for testing purposes.',
    whatItDoes: 'It helps with flavor or texture in many products.',
    bodyEffect: 'Body impact depends on dose and product context.',
    funFact: 'Comparing similar products can improve your label choices.',
    whyItMattersYou: 'This line helps you compare products faster.',
    rating: 'okay',
    ratingReason: 'This ingredient has a moderate concern profile.',
    contextStat: '',
    ...overrides,
  }
}

function makeResponse(ingredient: IngredientAnalysisItem): ProductIngredientAnalysisResponse {
  return {
    productVerdict: 'This is not suitable for people with strict ingredient goals.',
    productAnalysis: {
      viralHook: 'Not suitable for people with sensitivities.',
      whoShouldAvoid: 'Those with allergies should avoid this.',
      bottomLine: 'Individuals with restrictions should skip this.',
    },
    ingredients: [ingredient],
  }
}

test('replaces generic cohort phrases with second-person framing', () => {
  const input = makeResponse(
    makeIngredient({
      rating: 'concerning',
      impactForYou: 'Not suitable for people with allergies.',
      whyItMattersYou: 'Those with allergies should avoid this ingredient.',
    })
  )

  const out = enforcePersonalizedCopy(input, BASE_PROFILE)
  assert.match(out.productVerdict, /\byou with\b/i)
  assert.match(out.productAnalysis?.whoShouldAvoid ?? '', /\byou with\b/i)
  assert.doesNotMatch(out.ingredients[0].impactForYou ?? '', /\bpeople with\b/i)
  assert.match(out.ingredients[0].impactForYou ?? '', /\b(you|your)\b/i)
})

test('adds fallback personalized impact for flagged ingredient when missing', () => {
  const input = makeResponse(
    makeIngredient({
      name: 'Maltodextrin',
      rating: 'concerning',
      impactForYou: '',
      whyItMattersYou: '',
      personalFlag: 'allergy',
    })
  )

  const out = enforcePersonalizedCopy(input, BASE_PROFILE)
  assert.match(out.ingredients[0].impactForYou ?? '', /your saved allergy profile/i)
  assert.equal(out.ingredients[0].whyItMattersYou, out.ingredients[0].impactForYou)
})

test('uses goal-specific fallback when no direct personal flag exists', () => {
  const input = makeResponse(
    makeIngredient({
      name: 'Sugar',
      rating: 'concerning',
      impactForYou: 'Some people may want to limit this.',
      whyItMattersYou: 'People with goals may avoid this.',
    })
  )
  const profile: DietaryProfile = { ...BASE_PROFILE, goal: 'more_protein' }

  const out = enforcePersonalizedCopy(input, profile)
  assert.match(out.ingredients[0].impactForYou ?? '', /your current goal: eat more protein/i)
  assert.match(out.ingredients[0].whyItMattersYou ?? '', /\byour current goal\b/i)
})
