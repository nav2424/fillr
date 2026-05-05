import test from 'node:test'
import assert from 'node:assert/strict'
import { getGoalDisplayLabel } from './profileDisplayLabels'
import { buildProfileReasoningModel } from './buildProfileReasoning'

test('getGoalDisplayLabel maps persisted goal keys', () => {
  assert.equal(getGoalDisplayLabel('more_protein'), 'Eat more protein')
  assert.equal(getGoalDisplayLabel('eat_cleaner'), 'Eat cleaner')
})

test('profile reasoning summary avoids raw snake_case goal keys', () => {
  const m = buildProfileReasoningModel({
    safetyStatus: 'SAFE',
    matchedAllergens: [],
    matchedSensitivities: [],
    celiac: undefined,
    scoringData: {
      goalConflicts: ['Eat cleaner'],
      goalConflictDetails: [{ label: 'Eat cleaner', ingredients: ['maltodextrin', 'modified corn starch'] }],
    },
    fillrFit: {
      score: 55,
      verdict: 'Decent fit',
      verdictColor: '#d97706',
      progressColor: '#f59e0b',
      reason: 'Scored on overall ingredient quality for your profile',
      tier: 2,
    },
    userGoalKey: 'eat_cleaner',
  })
  assert.equal(m.summary.includes('eat_cleaner'), false)
  assert.equal(m.summary.includes('more_protein'), false)
})
