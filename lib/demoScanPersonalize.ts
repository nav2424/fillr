/**
 * Demo scan (mock barcode): enrich result for the current profile so gluten/celiac
 * users see realistic Celiac Mode + allergy behavior instead of generic copy.
 */

import type { ScanResult } from '../types'
import type { UserProfile } from './personalizationEngine'
import { parseIngredients } from './fillrAdapter'
import { getCeliacSeverity, runCeliacCheck } from './allergenEngine/matcher'

function hasWheatOrGlutenAllergy(allergies: string[]): boolean {
  return allergies.some((a) => {
    const k = a.toLowerCase().trim()
    return k === 'wheat' || k === 'gluten'
  })
}

function hasGlutenSensitivity(sensitivities: string[]): boolean {
  return sensitivities.some((s) => s === 'gluten_sensitivity')
}

/**
 * After `personalizeScanResult` on the StackFuel demo mock — adds `celiac` when
 * Celiac Mode is on, and rewrites hook/summary/insights for wheat, celiac, or gluten sensitivity.
 */
export function applyDemoScanProfileTailoring(
  result: ScanResult,
  profile: UserProfile
): ScanResult {
  const wheatAllergy = hasWheatOrGlutenAllergy(profile.allergies)
  const celiacOn = Boolean(profile.celiacStrictGluten)
  const glutenSens = hasGlutenSensitivity(profile.sensitivities)
  const wheatMatched = result.matchedAllergens.some(
    (m) => m.allergenKey.toLowerCase() === 'wheat' || m.allergenKey.toLowerCase() === 'gluten'
  )
  /** Demo bar always lists wheat; profile may use `gluten` key while mock rows use `wheat`. */
  const mockListsGlutenGrains = /\bwheat\b|\bbarley\b|\brye\b|triticale|malt extract|malt vinegar|malted barley/i.test(
    (result.product.ingredientText || '').toLowerCase()
  )
  const wheatDemoPersonal =
    wheatAllergy && (wheatMatched || mockListsGlutenGrains) && !celiacOn

  if (!wheatAllergy && !celiacOn && !glutenSens) {
    return result
  }

  const text = result.product.ingredientText ?? ''
  const ingredients = parseIngredients(text)
  let next: ScanResult = { ...result }

  if (celiacOn && ingredients.length > 0) {
    const matches = runCeliacCheck(ingredients, text)
    next = {
      ...next,
      celiac: {
        celiacModeEnabled: true,
        matchedGlutenSignals: matches.map((m) => ({
          ingredient: m.ingredient,
          signalType: m.signalType,
          severity: m.severity,
          reason: m.reason,
        })),
        celiacSeverity: getCeliacSeverity(matches),
      },
    }
  }

  const demoPrefix = 'Demo scan · '
  const pa = next.productAnalysis ? { ...next.productAnalysis } : {}

  if (celiacOn && next.celiac?.celiacSeverity === 'AVOID') {
    pa.viralHook =
      demoPrefix +
      'Celiac Mode flags this sample bar: it lists enriched wheat flour and other gluten sources — not safe for celiac disease.'
    pa.bottomLine =
      'This is Fillr demo data (StackFuel bar). On a real label, use the same decode + celiac checks before you eat.'
    next.smartSummary =
      'Not safe for you with Celiac Mode on — the demo product includes wheat flour and gluten grains. Always verify the physical package.'
    next.insights = [
      'Celiac Mode: direct gluten sources in this demo formula',
      'Compare how wheat and malt show up in the ingredient cards below',
      ...next.insights.filter((i) => !i.startsWith('Multiple allergens')),
    ]
  } else if (celiacOn && next.celiac?.celiacSeverity === 'CAUTION') {
    pa.viralHook =
      demoPrefix +
      'Celiac Mode sees caution-level signals on this demo label (oats, malt, or cross-contact style wording). Review each card.'
    pa.bottomLine =
      'Demo only — your real scans use the same strict gluten logic against the actual ingredient list.'
    next.smartSummary =
      'Celiac Mode: this demo product has ingredients we treat as caution — check the gluten/celiac notes on the cards below.'
    next.insights = ['Celiac Mode caution signals in demo formula', ...next.insights]
  } else if (wheatDemoPersonal) {
    pa.viralHook =
      demoPrefix +
      'Your profile includes wheat/gluten — this sample bar lists enriched wheat flour and other gluten grains, so we flag it for you.'
    pa.bottomLine =
      'Demo product only; use Fillr on your own packaging to confirm every time.'
    const tag = ' (Fillr demo — StackFuel bar.)'
    next.smartSummary = next.smartSummary.includes('Fillr demo')
      ? next.smartSummary
      : next.smartSummary.includes('Not safe for you')
        ? `${next.smartSummary.trim()}${tag}`
        : `Not safe for you — this demo bar contains wheat/gluten sources that match your allergy list.${tag}`
    next.insights = [
      'Your wheat or gluten allergy matches this demo ingredient list',
      ...next.insights.filter((i) => !/^Multiple allergens/i.test(i)),
    ]
  } else if (glutenSens && !wheatMatched) {
    pa.viralHook =
      demoPrefix +
      'You chose gluten sensitivity — this demo bar is heavy on wheat, HFCS, dyes, and gums; worth a careful read.'
    pa.bottomLine = 'Demo scan; your profile shapes how we highlight gluten-adjacent ingredients.'
    if (next.smartSummary.includes('nothing obvious')) {
      next.smartSummary =
        'Heads up for your gluten sensitivity: this demo bar lists wheat flour and many processed ingredients — see the sensitivity callouts below.'
    }
  }

  if (Object.keys(pa).length > 0) {
    next = { ...next, productAnalysis: { ...next.productAnalysis, ...pa } }
  }

  return next
}
