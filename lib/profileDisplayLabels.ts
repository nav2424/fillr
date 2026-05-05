/**
 * Maps internal profile keys (goals, preferences, scoring prefs, avoiding) to polished UI copy.
 * Never surface raw slugs like `more_protein` in user-visible strings.
 */

import {
  ALLERGY_OPTIONS,
  GOAL_OPTIONS,
  PREFERENCE_OPTIONS,
  SENSITIVITY_OPTIONS,
} from '../types'
import { migrateGoalKey } from './goalKeyMigration'

function norm(raw: string | null | undefined): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
}

/** Scoring preference keys from `FillrScoringInput.scoringPreferenceKeys` → short label */
const SCORING_PREFERENCE_LABELS: Record<string, string> = {
  high_protein: 'Eat more protein',
  low_sugar: 'Eat less sugar',
  low_carb: 'Low carb',
  keto: 'Keto',
  low_caffeine: 'Lower caffeine',
  high_caffeine: 'Caffeine',
  low_sodium: 'Lower sodium',
  low_calorie: 'Lower calorie',
  whole_foods: 'Whole foods',
  no_artificial_sweeteners: 'Avoid artificial sweeteners',
  no_seed_oils: 'Avoid seed oils',
  gut_health: 'Gut health',
  anti_inflammatory: 'Anti-inflammatory',
  hormone_health: 'Hormone health',
}

/** Keys from `AVOIDING_SIGNALS` / user “avoiding” list */
const AVOIDING_KEY_LABELS: Record<string, string> = {
  seed_oils: 'Seed oils',
  'seed oils': 'Seed oils',
  hfcs: 'High-fructose corn syrup',
  'artificial dyes': 'Artificial dyes',
  preservatives: 'Preservatives',
  'added sugar': 'Added sugar',
  gluten: 'Gluten',
  'processed meat': 'Processed meat',
  'palm oil': 'Palm oil',
  'refined carbs': 'Refined carbs',
  'artificial flavors': 'Artificial flavors',
  carrageenan: 'Carrageenan',
}

/**
 * Primary helper: map any internal goal / preference / scoring / avoiding key or slug to display text.
 */
export function mapProfileKeyToDisplayText(raw: string | null | undefined): string {
  const key = norm(raw)
  if (!key) return ''

  const migratedGoal = norm(migrateGoalKey(key))
  const goalHit = GOAL_OPTIONS.find((o) => o.key === migratedGoal || o.key === key)
  if (goalHit) return goalHit.label

  const prefHit = PREFERENCE_OPTIONS.find((o) => o.key === key || o.key === migratedGoal)
  if (prefHit) return prefHit.label

  const sensHit = SENSITIVITY_OPTIONS.find((o) => o.key === key)
  if (sensHit) return sensHit.label

  const allergyHit = ALLERGY_OPTIONS.find((o) => o.key === key)
  if (allergyHit) return allergyHit.label

  if (SCORING_PREFERENCE_LABELS[key]) return SCORING_PREFERENCE_LABELS[key]
  const avoidRaw = String(raw ?? '').trim().toLowerCase()
  if (AVOIDING_KEY_LABELS[key]) return AVOIDING_KEY_LABELS[key]
  if (AVOIDING_KEY_LABELS[avoidRaw]) return AVOIDING_KEY_LABELS[avoidRaw]

  // Last resort: soft humanize, never echo snake_case verbatim for short keys
  if (key.length <= 32 && !/[A-Z]/.test(String(raw))) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }
  return String(raw ?? '').trim()
}

/** Display label for the user’s primary goal key (onboarding / store). */
export function getGoalDisplayLabel(goalKey: string | null | undefined): string {
  const k = norm(migrateGoalKey(goalKey))
  if (!k) return ''
  const hit = GOAL_OPTIONS.find((o) => o.key === k)
  if (hit) return hit.label
  return mapProfileKeyToDisplayText(goalKey)
}

/** Humanize a conflict label from `buildProfileMatches` / `GoalConflictDetail.label` if it ever contains a slug. */
export function humanizeConflictLabel(label: string): string {
  const t = String(label ?? '').trim()
  if (!t) return ''
  if (/^[a-z0-9_]+$/.test(t) && t.includes('_')) {
    return mapProfileKeyToDisplayText(t)
  }
  return t
}
