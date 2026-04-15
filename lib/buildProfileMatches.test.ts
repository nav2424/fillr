import test from 'node:test'
import assert from 'node:assert/strict'

import { buildProfileMatches, extractSubIngredientsFromParentheticals } from './buildProfileMatches'
import {
  SENSITIVITY_SIGNALS,
  PREFERENCE_SIGNALS,
  GOAL_SIGNALS,
} from './profileSignals'
import { calculateFillrFit } from './fillrScoring'

const BASE_PROFILE = {
  allergies: [],
  sensitivities: [],
  avoiding: [],
  preferences: [],
  goal: '',
}

const SENSITIVITY_POSITIVE_INGREDIENT: Record<string, string> = {
  lactose: 'milk protein concentrate',
  gluten_sensitivity: "brewer's yeast extract",
  artificial_sweeteners: 'sucralose',
  high_sodium: 'soy sauce',
  msg: 'yeast extract',
  sulfites: 'sulfur dioxide',
}

const PREFERENCE_MATCH_INGREDIENT: Record<string, string> = {
  high_protein: 'pea protein isolate',
}

const PREFERENCE_CONFLICT_INGREDIENT: Record<string, string> = {
  high_protein: 'none',
  low_sugar: 'glucose syrup',
  low_carb: 'maltodextrin',
  low_calorie: 'shortening',
  vegan: 'milk powder',
  vegetarian: 'anchovies',
  plant_based: 'whey',
  less_processed: 'E452',
}

const GOAL_ALIGN_INGREDIENT: Record<string, string> = {
  lose_weight: 'none',
  build_muscle: 'whey protein isolate',
  eat_cleaner: 'organic oats',
  improve_health: 'none',
  understand: 'none',
}

const GOAL_CONFLICT_INGREDIENT: Record<string, string> = {
  lose_weight: 'corn syrup',
  build_muscle: 'hydrogenated oil',
  eat_cleaner: 'maltodextrin',
  improve_health: 'artificial flavor',
  understand: 'none',
}

test('every sensitivity signal key fires when present and does not fire when absent', () => {
  for (const [key, signal] of Object.entries(SENSITIVITY_SIGNALS)) {
    const hitIngredient = SENSITIVITY_POSITIVE_INGREDIENT[key]
    assert.ok(hitIngredient, `missing positive fixture for sensitivity: ${key}`)

    const hit = buildProfileMatches(
      { ...BASE_PROFILE, sensitivities: [key] },
      [hitIngredient]
    )
    assert.ok(
      hit.sensitivityMatches.includes(signal.label),
      `expected sensitivity "${key}" to match "${hitIngredient}"`
    )
    assert.ok(
      hit.sensitivityPenalty >= signal.penalty,
      `expected sensitivity penalty for "${key}" to be >= ${signal.penalty}`
    )

    const miss = buildProfileMatches(
      { ...BASE_PROFILE, sensitivities: [key] },
      ['plain water']
    )
    assert.equal(
      miss.sensitivityMatches.includes(signal.label),
      false,
      `did not expect sensitivity "${key}" to match plain water`
    )
  }
})

test('every preference signal applies match boosts and conflict penalties where defined', () => {
  for (const [key, signal] of Object.entries(PREFERENCE_SIGNALS)) {
    const profile = { ...BASE_PROFILE, preferences: [key] }

    if (signal.matchPattern && signal.matchBoost) {
      const hitIngredient = PREFERENCE_MATCH_INGREDIENT[key]
      assert.ok(hitIngredient, `missing match fixture for preference: ${key}`)
      const hit = buildProfileMatches(profile, [hitIngredient])
      assert.ok(hit.goalMatches.includes(signal.label), `expected match for preference "${key}"`)
      assert.ok(
        hit.preferenceBoost >= signal.matchBoost,
        `expected boost for "${key}" >= ${signal.matchBoost}`
      )

      const miss = buildProfileMatches(profile, ['plain water'])
      assert.equal(miss.goalMatches.includes(signal.label), false, `did not expect match for "${key}"`)
    }

    if (signal.conflictPattern && signal.conflictPenalty) {
      const conflictIngredient = PREFERENCE_CONFLICT_INGREDIENT[key]
      assert.ok(conflictIngredient, `missing conflict fixture for preference: ${key}`)
      const hit = buildProfileMatches(profile, [conflictIngredient])
      assert.ok(
        hit.goalConflicts.includes(signal.label),
        `expected conflict for preference "${key}"`
      )
      assert.ok(
        hit.preferencePenalty >= signal.conflictPenalty,
        `expected penalty for "${key}" >= ${signal.conflictPenalty}`
      )

      const miss = buildProfileMatches(profile, ['plain water'])
      assert.equal(
        miss.goalConflicts.includes(signal.label),
        false,
        `did not expect conflict for "${key}"`
      )
    }
  }
})

test('every goal signal applies align boosts and conflict penalties where defined', () => {
  for (const [key, signal] of Object.entries(GOAL_SIGNALS)) {
    const profile = { ...BASE_PROFILE, goal: key }

    if (signal.alignPattern && signal.alignBoost) {
      const hitIngredient = GOAL_ALIGN_INGREDIENT[key]
      assert.ok(hitIngredient, `missing align fixture for goal: ${key}`)
      const hit = buildProfileMatches(profile, [hitIngredient])
      assert.ok(hit.goalMatches.includes(signal.label), `expected align for goal "${key}"`)
      assert.ok(
        hit.preferenceBoost >= signal.alignBoost,
        `expected align boost for "${key}" >= ${signal.alignBoost}`
      )

      const miss = buildProfileMatches(profile, ['plain water'])
      assert.equal(miss.goalMatches.includes(signal.label), false, `did not expect align for "${key}"`)
    }

    if (signal.conflictPattern && signal.conflictPenalty) {
      const conflictIngredient = GOAL_CONFLICT_INGREDIENT[key]
      assert.ok(conflictIngredient, `missing conflict fixture for goal: ${key}`)
      const hit = buildProfileMatches(profile, [conflictIngredient])
      assert.ok(hit.goalConflicts.includes(signal.label), `expected conflict for goal "${key}"`)
      assert.ok(
        hit.preferencePenalty >= signal.conflictPenalty,
        `expected conflict penalty for "${key}" >= ${signal.conflictPenalty}`
      )

      const miss = buildProfileMatches(profile, ['plain water'])
      assert.equal(
        miss.goalConflicts.includes(signal.label),
        false,
        `did not expect conflict for "${key}"`
      )
    }
  }
})

test('edge: empty ingredient list returns empty arrays and zero penalties', () => {
  const result = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['lactose'], preferences: ['vegan'], goal: 'eat_cleaner' },
    []
  )
  assert.deepEqual(result.sensitivityMatches, [])
  assert.deepEqual(result.goalMatches, [])
  assert.deepEqual(result.goalConflicts, [])
  assert.deepEqual(result.avoidingMatches, [])
  assert.equal(result.sensitivityPenalty, 0)
  assert.equal(result.preferenceBoost, 0)
  assert.equal(result.preferencePenalty, 0)
})

test('edge: empty profile returns empty arrays and zero penalties', () => {
  const result = buildProfileMatches({ ...BASE_PROFILE }, ['milk', 'sugar'])
  assert.deepEqual(result.sensitivityMatches, [])
  assert.deepEqual(result.goalMatches, [])
  assert.deepEqual(result.goalConflicts, [])
  assert.deepEqual(result.avoidingMatches, [])
  assert.equal(result.sensitivityPenalty, 0)
  assert.equal(result.preferenceBoost, 0)
  assert.equal(result.preferencePenalty, 0)
})

test('edge: one ingredient can trigger multiple independent signals', () => {
  const result = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['lactose'], preferences: ['vegan'] },
    ['milk']
  )
  assert.ok(result.sensitivityMatches.includes('Lactose'))
  assert.ok(result.goalConflicts.includes('Vegan'))
})

test('edge: case insensitivity works for sensitivity and preference signals', () => {
  const low = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['lactose'], preferences: ['vegan'] },
    ['milk']
  )
  const title = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['lactose'], preferences: ['vegan'] },
    ['Milk']
  )
  const upper = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['lactose'], preferences: ['vegan'] },
    ['MILK']
  )
  assert.deepEqual(low.sensitivityMatches, title.sensitivityMatches)
  assert.deepEqual(title.sensitivityMatches, upper.sensitivityMatches)
  assert.deepEqual(low.goalConflicts, title.goalConflicts)
  assert.deepEqual(title.goalConflicts, upper.goalConflicts)
})

test('edge: punctuation artifacts still match expected patterns', () => {
  const result = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['artificial_sweeteners'], preferences: ['less_processed'] },
    ['E340ii)', 'emulsifiers (E452)', 'sucralose.']
  )
  assert.ok(result.sensitivityMatches.includes('Artificial sweeteners'))
  assert.ok(result.goalConflicts.includes('Eat cleaner / less processed'))
})

test('edge: all profile options set simultaneously is stable and bounded through scoring', () => {
  const allProfile = {
    allergies: [],
    sensitivities: Object.keys(SENSITIVITY_SIGNALS),
    avoiding: ['palm_oil'],
    preferences: Object.keys(PREFERENCE_SIGNALS),
    goal: 'eat_cleaner',
  }
  const ingredients = [
    'Milk',
    'whey protein',
    'sugar',
    'glucose syrup',
    'E452',
    'hydrogenated vegetable oil',
    'yeast extract',
    'sulfur dioxide',
  ]
  const matches = buildProfileMatches(allProfile, ingredients)
  const fit = calculateFillrFit({
    allergyMatches: [],
    celiacSeverity: 'SAFE',
    sensitivityMatches: matches.sensitivityMatches,
    goalMatches: matches.goalMatches,
    goalConflicts: matches.goalConflicts,
    avoidingMatches: matches.avoidingMatches,
    ingredientCounts: { natural: 1, processed: 2, additive: 3, flagged: 1 },
    totalIngredients: ingredients.length,
    eNumberCount: 1,
    genericFunctionalTermCount: 1,
    industrialSweetenerCount: 1,
    hydrogenatedOilCount: 1,
  })
  assert.ok(Number.isFinite(fit.score))
  assert.ok(fit.score >= 0 && fit.score <= 100)
})

test('avoiding signals: seed oils match sunflower and canola oil', () => {
  const profile = { ...BASE_PROFILE, avoiding: ['seed oils'] }
  const a = buildProfileMatches(profile, ['sunflower oil'])
  const b = buildProfileMatches(profile, ['canola oil'])
  assert.ok(a.avoidingMatches.includes('seed oils'))
  assert.ok(b.avoidingMatches.includes('seed oils'))
})

test('avoiding signals: hfcs matches high fructose corn syrup', () => {
  const result = buildProfileMatches(
    { ...BASE_PROFILE, avoiding: ['hfcs'] },
    ['high fructose corn syrup']
  )
  assert.ok(result.avoidingMatches.includes('hfcs'))
})

test('avoiding signals: artificial dyes match Red 40 and E129', () => {
  const profile = { ...BASE_PROFILE, avoiding: ['artificial dyes'] }
  const a = buildProfileMatches(profile, ['Red 40'])
  const b = buildProfileMatches(profile, ['E129'])
  assert.ok(a.avoidingMatches.includes('artificial dyes'))
  assert.ok(b.avoidingMatches.includes('artificial dyes'))
})

test('avoiding signals: carrageenan matches carrageenan and E407', () => {
  const profile = { ...BASE_PROFILE, avoiding: ['carrageenan'] }
  const a = buildProfileMatches(profile, ['carrageenan'])
  const b = buildProfileMatches(profile, ['E407'])
  assert.ok(a.avoidingMatches.includes('carrageenan'))
  assert.ok(b.avoidingMatches.includes('carrageenan'))
})

test('vegan hidden animal-derived conflicts fire on E120 and carmine', () => {
  const profile = { ...BASE_PROFILE, preferences: ['vegan'] }
  const a = buildProfileMatches(profile, ['E120'])
  const b = buildProfileMatches(profile, ['carmine'])
  assert.ok(a.goalConflicts.includes('Vegan'))
  assert.ok(b.goalConflicts.includes('Vegan'))
})

test('sulfites allergy+sensitivity does not double-apply sensitivity penalty', () => {
  const result = buildProfileMatches(
    { ...BASE_PROFILE, allergies: ['sulfites'], sensitivities: ['sulfites'] },
    ['sulfur dioxide']
  )
  assert.equal(result.sensitivityMatches.includes('Sulfites'), false)
  assert.equal(result.sensitivityPenalty, 0)
})

test('less_processed pattern does not fire on vitamin E strings', () => {
  const result = buildProfileMatches(
    { ...BASE_PROFILE, preferences: ['less_processed'] },
    ['vitamin E', 'Vitamin E acetate']
  )
  assert.equal(result.goalConflicts.includes('Eat cleaner / less processed'), false)
})

test('extractSubIngredientsFromParentheticals splits inner comma lists', () => {
  assert.deepEqual(extractSubIngredientsFromParentheticals('a (wheat, salt), b'), ['wheat', 'salt'])
})

test('parenthetical sub-ingredients drive lactose sensitivity when raw haystack is passed', () => {
  const result = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['lactose'] },
    ['cheese powder', 'modified starch'],
    'cheese powder (cheddar cheese, whey, salt, enzymes), modified starch'
  )
  assert.ok(result.sensitivityMatches.includes('Lactose'))
})

test('parenthetical sub-ingredients drive gluten sensitivity when raw haystack is passed', () => {
  const result = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['gluten_sensitivity'] },
    ['glucose syrup', 'sugar'],
    'glucose syrup (wheat), sugar, salt'
  )
  assert.ok(result.sensitivityMatches.includes('Gluten sensitivity'))
})

test('parenthetical sub-ingredients drive palm oil avoiding', () => {
  const result = buildProfileMatches(
    { ...BASE_PROFILE, avoiding: ['palm oil'] },
    ['vegetable shortening', 'flour'],
    'vegetable shortening (palm oil, soybean oil), flour, sugar'
  )
  assert.ok(result.avoidingMatches.includes('palm oil'))
})

test('no parenthetical raw text behaves like two-arg buildProfileMatches', () => {
  const withRaw = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['lactose'] },
    ['sugar', 'salt'],
    'sugar, salt, water'
  )
  const withoutRaw = buildProfileMatches(
    { ...BASE_PROFILE, sensitivities: ['lactose'] },
    ['sugar', 'salt']
  )
  assert.equal(withRaw.sensitivityMatches.length, withoutRaw.sensitivityMatches.length)
})
