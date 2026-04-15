/**
 * Resolve human-readable labels for Profile cards from AsyncStorage profile slugs
 * (same source as edit-preferences / scan pipeline).
 */

import {
  PRESET_ALLERGIES,
  PRESET_PREFERENCES,
  PRESET_SENSITIVITIES,
} from '../constants/dietProfilePresets'
import { getAllergyLabel } from './knownAllergens'

function normSlug(s: string): string {
  return String(s || '')
    .toLowerCase()
    .trim()
}

export function storedDietProfileHasAnyRows(p: {
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  celiacStrictGluten?: boolean
}): boolean {
  return (
    p.allergies.length > 0 ||
    p.sensitivities.length > 0 ||
    p.preferences.length > 0 ||
    p.celiacStrictGluten === true
  )
}

function uniqueLabels(labels: string[]): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  for (const label of labels) {
    const t = label.trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(t)
  }
  return out
}

function allergyLabelsFromSlugs(slugs: string[]): string[] {
  const labels: string[] = []
  for (const raw of slugs) {
    const n = normSlug(raw)
    if (!n) continue
    const preset = PRESET_ALLERGIES.find((a) => normSlug(a.slug) === n)
    const label = preset
      ? preset.label
      : getAllergyLabel(raw.replace(/\s+/g, '_'))
    labels.push(label)
  }
  return uniqueLabels(labels)
}

function labelsFromPresets(
  slugs: string[],
  presets: { slug: string; label: string }[]
): string[] {
  const labels: string[] = []
  for (const raw of slugs) {
    const n = normSlug(raw)
    if (!n) continue
    const preset = presets.find((p) => normSlug(p.slug) === n)
    labels.push(preset ? preset.label : raw.trim())
  }
  return uniqueLabels(labels)
}

export function summaryLabelsFromStoredProfile(p: {
  allergies: string[]
  sensitivities: string[]
  preferences: string[]
  celiacStrictGluten?: boolean
}): {
  allergyLabels: string[]
  sensitivityLabels: string[]
  preferenceLabels: string[]
} {
  const fromSlugs = allergyLabelsFromSlugs(p.allergies)
  const allergyLabels =
    p.celiacStrictGluten === true
      ? uniqueLabels(['Celiac Mode', ...fromSlugs])
      : fromSlugs
  return {
    allergyLabels,
    sensitivityLabels: labelsFromPresets(p.sensitivities, PRESET_SENSITIVITIES),
    preferenceLabels: labelsFromPresets(p.preferences, PRESET_PREFERENCES),
  }
}
