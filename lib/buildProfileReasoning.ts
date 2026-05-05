/**
 * Structured “Your profile” reasoning for scan results — human copy, prioritized rows, no raw key dumps.
 */

import type {
  CeliacResult,
  FillrFitSnapshot,
  FillrScoringDataSnapshot,
  GoalConflictDetail,
  MatchedAllergen,
  MatchedSensitivity,
  SafetyStatus,
} from '../types'
import { GOAL_SIGNALS, PREFERENCE_SIGNALS } from './profileSignals'
import { getGoalDisplayLabel, humanizeConflictLabel, mapProfileKeyToDisplayText } from './profileDisplayLabels'

export type ProfileReasoningFitKind = 'poor' | 'mixed' | 'good'

export type ProfileReasonRowType =
  | 'allergy_conflict'
  | 'celiac_conflict'
  | 'sensitivity_conflict'
  | 'preference_conflict'
  | 'goal_conflict'
  | 'avoiding_conflict'
  | 'processing_concern'
  | 'profile_clear'
  | 'positive_goal'
  | 'positive_clean'

export type ProfileReasonSeverity = 'high' | 'medium' | 'low'

export type ProfileReasonRow = {
  type: ProfileReasonRowType
  title: string
  body: string
  /** Ionicons glyph name */
  icon: string
  severity: ProfileReasonSeverity
  /** Lower sorts first */
  priority: number
}

export type ProfileReasoningModel = {
  fit: ProfileReasoningFitKind
  headline: string
  summary: string
  reasons: ProfileReasonRow[]
  collapsedTitle: string
  collapsedSubtitle: string
}

const PREFERENCE_LABELS = new Set(
  Object.values(PREFERENCE_SIGNALS).map((s) => s.label)
)
const GOAL_CONFLICT_LABELS = new Set(
  Object.values(GOAL_SIGNALS)
    .map((s) => s.label)
    .filter(Boolean)
)

function oxfordShort(names: string[], max = 2): string {
  const u = [...new Set(names.map((n) => n.trim()).filter(Boolean))].slice(0, max + 1)
  if (u.length === 0) return ''
  if (u.length === 1) return u[0]
  if (u.length === 2) return `${u[0]} and ${u[1]}`
  return `${u[0]}, ${u[1]}, and similar ingredients`
}

function conflictBodyFromIngredients(ingredients: string[]): string {
  const u = [...new Set(ingredients.map((n) => n.trim()).filter(Boolean))]
  if (u.length === 0) {
    return 'Several ingredients on this label triggered this pattern.'
  }
  const phrase = oxfordShort(u, 2)
  return `Includes ${phrase}.`
}

function conflictTitleForLabel(label: string): string {
  const t = label.trim()
  const map: Record<string, string> = {
    Vegan: 'Not vegan',
    Vegetarian: 'Not vegetarian',
    'Plant-based': 'Not fully plant-based',
    'High protein': 'Conflicts with your high protein preference',
    'Low sugar': 'Conflicts with your low sugar preference',
    'Low carb': 'Conflicts with your low carb preference',
    'Low calorie': 'Conflicts with your low calorie preference',
    'Eat cleaner / less processed': 'Conflicts with eat cleaner goal',
    Kosher: 'Kosher considerations',
    Halal: 'Halal considerations',
    Paleo: 'Paleo considerations',
    Whole30: 'Whole30 considerations',
    'Diabetic-friendly': 'Diabetic-friendly considerations',
    'Eat more protein': 'Lower quality protein choice',
    'Eat cleaner': 'Conflicts with eat cleaner goal',
    'Eat less sugar': 'Sugar load concern',
    'Lose weight': 'Works against your weight loss goal',
    'Gain weight': 'Limited alignment with your weight gain goal',
    'Improve gut health': 'Gut comfort tradeoff',
    'Reduce ultra-processed foods': 'Ultra-processed signals',
    'Lower sodium': 'Sodium signals',
    "Understand what I'm eating": 'Label complexity',
    'Maintain a balanced diet': 'Balance tradeoff',
  }
  return map[t] ?? `Conflicts with ${humanizeConflictLabel(t)}`
}

function classifyConflictLabel(label: string): 'preference' | 'goal' {
  if (PREFERENCE_LABELS.has(label)) return 'preference'
  if (GOAL_CONFLICT_LABELS.has(label)) return 'goal'
  if (/vegan|vegetarian|kosher|halal|paleo|plant|diabetic|whole30|low carb|low sugar|high protein|low calorie/i.test(label)) {
    return 'preference'
  }
  return 'goal'
}

export type BuildProfileReasoningInput = {
  safetyStatus: SafetyStatus
  matchedAllergens: MatchedAllergen[]
  matchedSensitivities: MatchedSensitivity[]
  celiac: CeliacResult | null | undefined
  scoringData: FillrScoringDataSnapshot | null | undefined
  fillrFit: FillrFitSnapshot | null
  userGoalKey: string
}

export function buildProfileReasoningModel(input: BuildProfileReasoningInput): ProfileReasoningModel {
  const {
    safetyStatus,
    matchedAllergens,
    matchedSensitivities,
    celiac,
    scoringData,
    fillrFit,
    userGoalKey,
  } = input

  const allergyNames = [
    ...new Map(matchedAllergens.map((m) => [m.allergenKey.toLowerCase(), m.allergenName])).values(),
  ]
  const score = fillrFit?.score ?? 50
  const celiacEnabled = Boolean(celiac?.celiacModeEnabled)
  const celiacAvoid = celiacEnabled && celiac?.celiacSeverity === 'AVOID'
  const celiacCaution = celiacEnabled && celiac?.celiacSeverity === 'CAUTION'

  const sensitivityStrings = scoringData?.sensitivityMatches ?? []
  const avoidingMatches = scoringData?.avoidingMatches ?? []
  const goalMatches = scoringData?.goalMatches ?? []
  const goalConflicts = scoringData?.goalConflicts ?? []
  const goalConflictDetails: GoalConflictDetail[] = scoringData?.goalConflictDetails ?? []
  const counts = scoringData?.ingredientCounts

  const rows: ProfileReasonRow[] = []

  if (allergyNames.length > 0) {
    const list = allergyNames.slice(0, 3).join(', ')
    const more = allergyNames.length > 3 ? ` (+${allergyNames.length - 3} more)` : ''
    rows.push({
      type: 'allergy_conflict',
      title: 'Allergen match',
      body: `Contains ${list}${more} — on your saved allergy profile.`,
      icon: 'alert-circle',
      severity: 'high',
      priority: 0,
    })
  }

  if (celiacAvoid) {
    rows.push({
      type: 'celiac_conflict',
      title: 'Gluten — not safe for celiac',
      body: 'This formula includes gluten sources that are not safe with strict celiac settings.',
      icon: 'ban-outline',
      severity: 'high',
      priority: 1,
    })
  } else if (celiacCaution) {
    rows.push({
      type: 'celiac_conflict',
      title: 'Possible gluten risk',
      body: 'Some lines need a packaging check before you treat this as gluten-free.',
      icon: 'warning-outline',
      severity: 'medium',
      priority: 2,
    })
  }

  if (sensitivityStrings.length > 0) {
    const joined = sensitivityStrings.slice(0, 3).join(', ')
    rows.push({
      type: 'sensitivity_conflict',
      title: 'Sensitivity cue',
      body: `Ingredients here overlap what Fillr flags for ${joined}.`,
      icon: 'pulse-outline',
      severity: 'medium',
      priority: 3,
    })
  }

  for (const detail of goalConflictDetails) {
    const kind = classifyConflictLabel(detail.label)
    const title = conflictTitleForLabel(detail.label)
    const body = conflictBodyFromIngredients(detail.ingredients)
    rows.push({
      type: kind === 'preference' ? 'preference_conflict' : 'goal_conflict',
      title,
      body,
      icon: kind === 'preference' ? 'leaf-outline' : 'flag-outline',
      severity: 'medium',
      priority: kind === 'preference' ? 4 : 5,
    })
  }

  if (avoidingMatches.length > 0) {
    const labels = avoidingMatches.map((k) => mapProfileKeyToDisplayText(k)).filter(Boolean)
    const shown = labels.slice(0, 3).join(', ')
    const extra = labels.length > 3 ? ` (+${labels.length - 3} more)` : ''
    rows.push({
      type: 'avoiding_conflict',
      title: 'Contains ingredients you avoid',
      body: `Touches items you flagged to avoid: ${shown}${extra}.`,
      icon: 'remove-circle-outline',
      severity: 'medium',
      priority: 6,
    })
  }

  const additive = counts?.additive ?? 0
  const flagged = counts?.flagged ?? 0
  if (additive + flagged >= 4 && rows.filter((r) => r.severity === 'high').length === 0) {
    rows.push({
      type: 'processing_concern',
      title: 'Highly processed profile',
      body: 'Multiple additives and flagged ingredients make this a heavier formulation.',
      icon: 'flask-outline',
      severity: 'low',
      priority: 7,
    })
  }

  const hasHardConflict =
    allergyNames.length > 0 ||
    celiacAvoid ||
    celiacCaution ||
    safetyStatus === 'UNSAFE' ||
    sensitivityStrings.length > 0 ||
    goalConflictDetails.length > 0 ||
    avoidingMatches.length > 0

  const hasGlutenProfileConcern = celiacAvoid || celiacCaution
  if (matchedAllergens.length === 0 && !hasGlutenProfileConcern) {
    rows.push({
      type: 'profile_clear',
      title: 'No allergy conflict',
      body: 'Nothing in this product matches your saved allergies.',
      icon: 'shield-checkmark-outline',
      severity: 'low',
      priority: 14,
    })
  }

  const goalLabel = getGoalDisplayLabel(userGoalKey)
  if (goalMatches.length > 0 && goalConflicts.length === 0 && goalLabel) {
    rows.push({
      type: 'positive_goal',
      title: 'Goal-aligned',
      body: `Supports your “${goalLabel}” goal based on the ingredient list.`,
      icon: 'checkmark-circle',
      severity: 'low',
      priority: 16,
    })
  }

  if (!hasHardConflict && score >= 72 && additive + flagged <= 2 && goalConflicts.length === 0) {
    rows.push({
      type: 'positive_clean',
      title: 'Cleaner profile',
      body: 'Fewer flagged additives than many similar packaged products.',
      icon: 'checkmark-circle',
      severity: 'low',
      priority: 17,
    })
  }

  rows.sort((a, b) => a.priority - b.priority)

  const dedup: ProfileReasonRow[] = []
  const seen = new Set<string>()
  for (const r of rows) {
    const k = `${r.type}:${r.title}`
    if (seen.has(k)) continue
    seen.add(k)
    dedup.push(r)
  }

  const top = dedup.slice(0, 4)

  let fit: ProfileReasoningFitKind = 'mixed'
  if (allergyNames.length > 0 || celiacAvoid || safetyStatus === 'UNSAFE' || score < 28) {
    fit = 'poor'
  } else if (score >= 72 && !hasHardConflict && goalConflicts.length === 0) {
    fit = 'good'
  } else if (score >= 68 && goalConflicts.length === 0 && sensitivityStrings.length === 0) {
    fit = 'good'
  } else if (hasHardConflict && score >= 55) {
    fit = 'mixed'
  } else if (hasHardConflict) {
    fit = 'poor'
  } else {
    fit = score >= 60 ? 'good' : 'mixed'
  }

  let headline = 'What to know before choosing this'
  if (fit === 'poor') headline = 'Why this product conflicts with your profile'
  if (fit === 'good') headline = 'Why this works for you'

  const summary = buildSummarySentence({
    fit,
    allergyNames,
    goalConflictDetails,
    sensitivityStrings,
    score,
    goalLabel,
    hasHardConflict,
    celiacAvoid,
    celiacCaution,
  })

  let collapsedTitle = 'Heads up'
  if (fit === 'good') collapsedTitle = 'All clear'
  if (fit === 'mixed') collapsedTitle = 'Mixed fit'
  if (hasGlutenProfileConcern && allergyNames.length === 0) collapsedTitle = 'Gluten detected'

  const collapsedSubtitle = summary.length > 220 ? `${summary.slice(0, 217)}…` : summary

  return {
    fit,
    headline,
    summary,
    reasons: top,
    collapsedTitle,
    collapsedSubtitle,
  }
}

function buildSummarySentence(args: {
  fit: ProfileReasoningFitKind
  allergyNames: string[]
  goalConflictDetails: GoalConflictDetail[]
  sensitivityStrings: string[]
  score: number
  goalLabel: string
  hasHardConflict: boolean
  celiacAvoid: boolean
  celiacCaution: boolean
}): string {
  const {
    fit,
    allergyNames,
    goalConflictDetails,
    sensitivityStrings,
    score,
    goalLabel,
    hasHardConflict,
    celiacAvoid,
    celiacCaution,
  } = args

  if (allergyNames.length > 0) {
    return `This product hits your allergy profile (${allergyNames.slice(0, 2).join(', ')}${
      allergyNames.length > 2 ? ', and more' : ''
    }).`
  }
  if (celiacAvoid) {
    return 'This product is not safe with your strict gluten settings.'
  }

  const prefBits = goalConflictDetails
    .filter((d) => classifyConflictLabel(d.label) === 'preference')
    .map((d) => humanizeConflictLabel(d.label))
  const goalBits = goalConflictDetails
    .filter((d) => classifyConflictLabel(d.label) === 'goal')
    .map((d) => humanizeConflictLabel(d.label))

  if (fit === 'mixed') {
    if (sensitivityStrings.length && !goalConflictDetails.length) {
      return `This product fits your allergy profile, but includes sensitivity cues (${sensitivityStrings
        .slice(0, 2)
        .join(', ')}).`
    }
    if (prefBits.length && goalBits.length) {
      return `This product conflicts with your ${prefBits[0]} preference and your ${goalBits[0]} goal.`
    }
    if (prefBits.length) {
      return `This product conflicts with your ${prefBits.join(' and ')} preference${prefBits.length > 1 ? 's' : ''}.`
    }
    if (goalBits.length) {
      return `This product conflicts with your ${goalBits.join(' and ')} goal${goalBits.length > 1 ? 's' : ''}.`
    }
    if (sensitivityStrings.length) {
      return 'This product fits your allergy profile, but includes sensitivity cues worth a second read.'
    }
    return `Fillr scores this around ${score}/100 for your profile — worth a quick scan of the ingredient list.`
  }

  if (fit === 'good') {
    if (goalLabel) {
      return `This product matches your profile and lines up with your “${goalLabel}” goal.`
    }
    return 'This product matches your profile and shows no major conflicts in the ingredient list.'
  }

  // poor
  if (celiacCaution) {
    return 'Possible gluten risk — verify on packaging before you rely on it.'
  }
  if (goalBits.length || prefBits.length) {
    const a = prefBits[0]
    const b = goalBits[0]
    if (a && b) return `This product conflicts with your ${a} preference and ${b} goal.`
    if (a) return `This product conflicts with your ${a} preference.`
    if (b) return `This product conflicts with your ${b} goal.`
  }
  if (!hasHardConflict) {
    return `Fillr scores this ${score}/100 for your profile.`
  }
  return 'This product has several profile pressure points in the ingredient list.'
}
