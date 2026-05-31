import test from 'node:test'
import assert from 'node:assert/strict'
import type { IngredientExplanation } from '../types'
import { buildFallbackIngredientExplanation } from './fillrAdapter'
import { buildIngredientCardViewModel } from './buildIngredientCardViewModel'
import { textMatchesIngredientGenericPattern } from './ingredientCopyQuality'
import {
  ensureDistinctIngredientExplanation,
  ingredientProseFieldsAreRepetitive,
} from './ingredientProseHydration'

function norm(s: string | undefined): string {
  return String(s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function baseIng(partial: Partial<IngredientExplanation> & { name: string }): IngredientExplanation {
  return {
    whatItIs: '',
    whyItsUsed: '',
    whatToKnow: '',
    ...partial,
  }
}

test('ingredientProseFieldsAreRepetitive detects identical fields', () => {
  const same =
    'This line on the label names a typical packaged-food ingredient used for taste, texture, or shelf life.'
  assert.equal(
    ingredientProseFieldsAreRepetitive(
      baseIng({
        name: 'Mystery',
        whatItIs: same,
        labelDecoder: same,
        whatItDoes: same,
      })
    ),
    true
  )
})

test('ingredientProseFieldsAreRepetitive allows distinct fields', () => {
  assert.equal(
    ingredientProseFieldsAreRepetitive(
      baseIng({
        name: 'Citric acid',
        whatItIs: 'An acid found in citrus fruit, often made by fermentation for food use.',
        whatItDoes: 'Adds tartness and helps keep the product from spoiling too quickly.',
        bodyEffect: 'Your body already uses citrate in normal energy metabolism.',
      })
    ),
    false
  )
})

test('ensureDistinctIngredientExplanation replaces template duplicate copy', () => {
  const template =
    'This line on the label names a typical packaged-food ingredient used for taste, texture, or shelf life.'
  const fixed = ensureDistinctIngredientExplanation(
    baseIng({
      name: 'Soy lecithin',
      whatItIs: template,
      labelDecoder: template,
      whatItDoes: template,
      bodyEffect: template,
    })
  )
  assert.notEqual(norm(fixed.whatItIs), norm(template))
  assert.notEqual(norm(fixed.whatItDoes ?? ''), norm(fixed.whatItIs))
  assert.match(fixed.whatItIs, /lecithin|emulsif/i)
  assert.equal(ingredientProseFieldsAreRepetitive(fixed), false)
  assert.equal(textMatchesIngredientGenericPattern(fixed.whatItIs), false)
})

test('ensureDistinctIngredientExplanation leaves good AI copy unchanged', () => {
  const good = baseIng({
    name: 'Salt',
    whatItIs: 'Sodium chloride—most table salt is mined or produced by evaporating seawater.',
    whatItDoes: 'Sharpens savory flavor and can balance sweetness in the recipe.',
    bodyEffect: 'Sodium and chloride support nerves and fluid balance at normal intake.',
    labelDecoder: 'Table salt is sodium chloride.',
  })
  const out = ensureDistinctIngredientExplanation(good)
  assert.equal(out.whatItIs, good.whatItIs)
  assert.equal(out.whatItDoes, good.whatItDoes)
})

const COMMON_INGREDIENTS = [
  'Salt',
  'Sugar',
  'Citric acid',
  'Soy lecithin',
  'Maltodextrin',
  'High fructose corn syrup',
  'Carrageenan',
  'Natural flavors',
  'Sodium benzoate',
  'Whey protein',
]

for (const name of COMMON_INGREDIENTS) {
  test(`buildFallbackIngredientExplanation: distinct plain English for ${name}`, () => {
    const fb = buildFallbackIngredientExplanation(name)
    assert.ok(fb.whatItIs.trim().length >= 24, 'whatItIs too short')
    assert.ok((fb.whatItDoes ?? fb.whyItsUsed).trim().length >= 24, 'whatItDoes too short')
    assert.ok(fb.bodyEffect.trim().length >= 24, 'bodyEffect too short')
    assert.notEqual(norm(fb.whatItIs), norm(fb.whatItDoes ?? fb.whyItsUsed))
    assert.equal(textMatchesIngredientGenericPattern(fb.whatItIs), false)
    assert.equal(textMatchesIngredientGenericPattern(fb.whatItDoes ?? ''), false)
  })
}

test('buildIngredientCardViewModel hydrates duplicate template into two different bullets', () => {
  const blob =
    'This line on the label names a typical packaged-food ingredient used for taste, texture, or shelf life.'
  const vm = buildIngredientCardViewModel(
    baseIng({
      name: 'Corn starch',
      whatItIs: blob,
      labelDecoder: blob,
      whatItDoes: blob,
      ingredientRating: 'okay',
    }),
    { displayRating: 'okay' }
  )
  assert.equal(vm.bullets.length, 2)
  assert.match(vm.bullets[0], /^What it is:/i)
  assert.match(vm.bullets[1], /^Why it's here:/i)
  const b0 = vm.bullets[0].replace(/^What it is:\s*/i, '')
  const b1 = vm.bullets[1].replace(/^Why it's here:\s*/i, '')
  assert.notEqual(norm(b0), norm(b1))
  assert.equal(textMatchesIngredientGenericPattern(b0), false)
  assert.equal(textMatchesIngredientGenericPattern(b1), false)
  assert.match(b0, /starch|corn/i)
})

test('buildIngredientCardViewModel: system_judgment alone does not duplicate both bullets', () => {
  const sj = 'Raises concern due to artificial dye and additive profile.'
  const vm = buildIngredientCardViewModel(
    baseIng({
      name: 'Yellow 5',
      whatItIs: sj,
      whatItDoes: sj,
      bodyEffect: sj,
      systemJudgment: sj,
      ingredientRating: 'avoid',
    }),
    { displayRating: 'avoid' }
  )
  assert.equal(vm.bullets.length, 2)
  const b0 = vm.bullets[0].replace(/^What it is:\s*/i, '')
  const b1 = vm.bullets[1].replace(/^Why it's here:\s*/i, '')
  assert.notEqual(norm(b0), norm(b1))
})
