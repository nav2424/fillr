import test from 'node:test'
import assert from 'node:assert/strict'
import type { IngredientExplanation } from '../types'
import {
  buildIngredientCardViewModel,
  isWeakIngredientCopy,
  isUsableIngredientIntelligenceField,
} from './buildIngredientCardViewModel'

test('isWeakIngredientCopy flags hedge phrases', () => {
  assert.equal(isWeakIngredientCopy('Some people avoid this dye.'), true)
  assert.equal(isWeakIngredientCopy('Adds color in highly processed snacks.'), false)
})

test('isUsableIngredientIntelligenceField rejects boilerplate', () => {
  assert.equal(isUsableIngredientIntelligenceField(''), false)
  assert.equal(isUsableIngredientIntelligenceField('Artificial food dye'), true)
})

test('buildIngredientCardViewModel prefers intelligence fields', () => {
  const ing: IngredientExplanation = {
    name: 'Yellow 5',
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    shortLabel: 'Artificial food dye',
    whyItMattersBullets: [
      'Adds bright color with no nutritional value.',
      'Common in highly processed snacks and drinks.',
    ],
    systemJudgment: 'Raises concern due to artificial dye and additive profile.',
    impactForYou: 'Conflicts with your “avoid additives” preference.',
    ingredientRating: 'avoid',
  }
  const vm = buildIngredientCardViewModel(ing, { displayRating: 'avoid' })
  assert.equal(vm.shortLabel, 'Artificial food dye.')
  assert.equal(vm.bullets.length, 2)
  assert.equal(vm.status, 'FLAGGED')
  assert.ok(vm.systemJudgment?.includes('dye'))
  assert.ok(vm.impactForYou?.includes('avoid'))
})

test('buildIngredientCardViewModel prefers a complete sentence over a truncated shortLabel', () => {
  const ing: IngredientExplanation = {
    name: 'Partially hydrogenated soybean oil',
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    shortLabel: 'A refined cooking fat pressed or solvent-extracted from',
    quickSummary:
      'A refined cooking fat pressed or solvent-extracted from soybeans. Often used in shelf-stable snacks.',
    ingredientRating: 'avoid',
  }
  const vm = buildIngredientCardViewModel(ing, { displayRating: 'avoid' })
  assert.match(vm.shortLabel ?? '', /soybeans/i)
  assert.ok((vm.shortLabel ?? '').endsWith('.'))
})

test('buildIngredientCardViewModel drops model copy that contradicts a severe badge', () => {
  const ing: IngredientExplanation = {
    name: 'Corn syrup',
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: 'Manufacturers often split sugars across several ingredient names.',
    shortLabel: 'Liquid sweetener',
    ratingReason: 'Rated clean based on typical use and how this ingredient behaves in food.',
    ingredientRating: 'concerning',
  }
  const vm = buildIngredientCardViewModel(ing, { displayRating: 'concerning' })
  assert.equal(
    vm.systemJudgment?.includes('Rated clean'),
    false,
    'should not show clean copy under additive/concerning badge'
  )
  assert.ok(
    vm.systemJudgment?.includes('split') || vm.systemJudgment?.includes('Manufacturers'),
    'should fall back to substantive whatToKnow'
  )
})

test('buildIngredientCardViewModel drops product-level allergen impact on non-allergen rows', () => {
  const ing: IngredientExplanation = {
    name: 'Fructose',
    whatItIs: 'A simple sugar.',
    whyItsUsed: '',
    whatToKnow: '',
    impactForYou: 'Allergen conflict: Peanuts.',
    ingredientRating: 'concerning',
  }
  const vm = buildIngredientCardViewModel(ing, {
    displayRating: 'concerning',
    allergyMatch: false,
    sensitivityMatch: false,
  })
  assert.equal(vm.impactForYou, null)
})

test('buildIngredientCardViewModel drops duplicate judgment vs impact', () => {
  const same = 'No conflicts with your current profile.'
  const ing: IngredientExplanation = {
    name: 'Xanthan gum',
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    shortLabel: 'Food thickener',
    whyItMattersBullets: ['Helps texture in packaged foods.', 'Usually a formulation input, not a macro.'],
    systemJudgment: same,
    impactForYou: same,
    ingredientRating: 'concerning',
  }
  const vm = buildIngredientCardViewModel(ing, { displayRating: 'concerning' })
  assert.equal(vm.systemJudgment, null)
  assert.equal(vm.impactForYou, null)
})

test('buildIngredientCardViewModel keeps personalized sensitivity line out of bullets', () => {
  const personal = "You've flagged sensitivity to Caffeine."
  const ing: IngredientExplanation = {
    name: 'Dark chocolate',
    whatItIs: 'Dark chocolate is made from cocoa solids, cocoa butter, and sugar.',
    whyItsUsed: 'Used for cocoa flavor, richness, and structure in bars and coatings.',
    whatToKnow: 'It can include caffeine depending on cocoa concentration and serving size.',
    whyItMattersBullets: [
      personal,
      'Dark chocolate is made from cocoa solids, cocoa butter, and sugar.',
    ],
    impactForYou: personal,
    ingredientRating: 'concerning',
  }
  const vm = buildIngredientCardViewModel(ing, { displayRating: 'concerning', sensitivityMatch: true })
  assert.equal(vm.impactForYou, personal)
  assert.equal(vm.bullets.some((b) => /flagged sensitivity to caffeine/i.test(b)), false)
})

test('buildIngredientCardViewModel suppresses generic packaged-label filler headline', () => {
  const ing: IngredientExplanation = {
    name: 'Organic pea protein',
    whatItIs: 'A concentrated plant protein used to raise protein content in snack bars.',
    whyItsUsed: 'It increases protein grams per serving and improves satiety positioning.',
    whatToKnow: 'It is a processed protein input, not a whole-food equivalent.',
    headline: 'Here is what "organic pea protein" usually means on a packaged-food label.',
    ingredientRating: 'okay',
  }
  const vm = buildIngredientCardViewModel(ing, { displayRating: 'okay' })
  assert.notEqual(vm.shortLabel, 'Here is what "organic pea protein" usually means on a packaged-food label.')
})

test('buildIngredientCardViewModel removes leading ingredient name from description copy', () => {
  const ing: IngredientExplanation = {
    name: 'Organic pea protein',
    whatItIs: 'Organic pea protein is a protein extracted from yellow peas.',
    whyItsUsed: 'Used to increase protein grams in a bar.',
    whatToKnow: 'A processed input used for nutrition positioning.',
    ingredientRating: 'okay',
  }
  const vm = buildIngredientCardViewModel(ing, { displayRating: 'okay' })
  assert.equal(vm.shortLabel?.toLowerCase().startsWith('organic pea protein is'), false)
})

test('buildIngredientCardViewModel evidence shows concrete goal/preference conflict target', () => {
  const ing: IngredientExplanation = {
    name: 'Shea butter',
    whatItIs: 'A fat obtained from shea nuts.',
    whyItsUsed: '',
    whatToKnow: '',
    ingredientRating: 'okay',
    personalFlag: 'preference_conflict',
    profileAnchor: 'vegan',
  }
  const vm = buildIngredientCardViewModel(ing, { displayRating: 'okay' })
  assert.equal(vm.evidence[0]?.label, 'Matched rule')
  assert.equal(vm.evidence[0]?.value, 'Conflict with "Vegan"')
})

test('buildIngredientCardViewModel avoids internal deterministic-rule jargon', () => {
  const ing: IngredientExplanation = {
    name: 'Sugars',
    whatItIs: 'Simple carbohydrates.',
    whyItsUsed: '',
    whatToKnow: '',
    ingredientRating: 'okay',
    ratingSource: 'deterministic',
  }
  const vm = buildIngredientCardViewModel(ing, { displayRating: 'okay' })
  assert.equal(vm.evidence[0]?.label, 'Matched rule')
  assert.equal(vm.evidence[0]?.value, 'Based on known ingredient safety patterns')
})
