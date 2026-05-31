import test from 'node:test'
import assert from 'node:assert/strict'
import { GOAL_OPTIONS } from '../types'
import { GOAL_SIGNALS } from './profileSignals'
import {
  isProductLevelGoal,
  isIngredientLevelGoal,
  shouldAttachGoalConflictsToIngredients,
  isProductLevelGoalImpactBlurb,
  stripProductLevelGoalFromIngredient,
  ingredientLevelGoalFocusLabels,
} from './goalApplicability'
import { buildProfileMatches } from './buildProfileMatches'
import type { DietaryProfile } from '../types'

const BASE: DietaryProfile = {
  allergies: [],
  sensitivities: [],
  avoiding: [],
  preferences: [],
  scoringPreferenceKeys: [],
}

test('every GOAL_SIGNALS entry declares product or ingredient scope', () => {
  for (const [key, signal] of Object.entries(GOAL_SIGNALS)) {
    assert.ok(
      signal.scope === 'product' || signal.scope === 'ingredient',
      `missing scope on goal signal "${key}"`
    )
  }
})

test('every user-selectable goal maps to exactly one scope', () => {
  for (const opt of GOAL_OPTIONS) {
    const product = isProductLevelGoal(opt.key)
    const ingredient = isIngredientLevelGoal(opt.key)
    assert.equal(product, !ingredient, `goal "${opt.key}" must be exclusively product or ingredient scoped`)
    assert.equal(GOAL_SIGNALS[opt.key]?.scope, product ? 'product' : 'ingredient')
  }
})

test('product-scoped goals never attach per-ingredient conflict lists', () => {
  for (const opt of GOAL_OPTIONS) {
    if (!isProductLevelGoal(opt.key)) continue
    const result = buildProfileMatches(
      { ...BASE, goal: opt.key },
      ['glucose syrup', 'salt', 'water', 'maltodextrin']
    )
    for (const detail of result.goalConflictDetails) {
      assert.equal(
        detail.ingredients.length,
        0,
        `expected no ingredient rows for product goal "${opt.key}"`
      )
    }
    assert.equal(shouldAttachGoalConflictsToIngredients(opt.key), false)
  }
})

test('ingredient-scoped goals may attach per-ingredient conflict lists', () => {
  const result = buildProfileMatches(
    { ...BASE, goal: 'less_sugar' },
    ['sugar', 'salt']
  )
  const sugarDetail = result.goalConflictDetails.find((d) => /less sugar/i.test(d.label))
  assert.ok(sugarDetail)
  assert.ok(sugarDetail.ingredients.some((n) => /sugar/i.test(n)))
})

test('isProductLevelGoalImpactBlurb detects generic protein goal stamps', () => {
  assert.equal(
    isProductLevelGoalImpactBlurb(
      'Flagged for you because this works against your current goal: Eat more protein.',
      'more_protein'
    ),
    true
  )
  assert.equal(
    isProductLevelGoalImpactBlurb(
      'Conflicts with your low-sugar goal because it behaves like a fast carbohydrate.',
      'less_sugar'
    ),
    false
  )
})

test('stripProductLevelGoalFromIngredient clears goal driver and blurbs', () => {
  const cleaned = stripProductLevelGoalFromIngredient(
    {
      name: 'Salt',
      flagDriver: 'goal',
      profileAnchor: 'more_protein',
      impactForYou: 'Flagged for you because this works against your current goal: Eat more protein.',
    },
    'more_protein'
  )
  assert.equal(cleaned.flagDriver, undefined)
  assert.equal(cleaned.profileAnchor, undefined)
  assert.equal(cleaned.impactForYou, undefined)
})

test('ingredientLevelGoalFocusLabels excludes product-scoped goals', () => {
  const labels = ingredientLevelGoalFocusLabels()
  assert.ok(labels.less_sugar)
  assert.ok(labels.eat_cleaner)
  assert.equal(labels.more_protein, undefined)
  assert.equal(labels.balanced_diet, undefined)
  assert.equal(labels.understand, undefined)
})
